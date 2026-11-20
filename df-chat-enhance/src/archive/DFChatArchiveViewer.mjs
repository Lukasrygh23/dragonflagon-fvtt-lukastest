import { DFChatArchive } from './DFChatArchive.mjs';

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const HandlebarsApplication = foundry.applications.api.HandlebarsApplicationMixin(ApplicationV2);
const DialogV2 = foundry.applications.api.DialogV2;
const MODULE_ID = 'df-chat-enhance-lukas';
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({
	'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

export default class DFChatArchiveViewer extends HandlebarsApplication {
	archive;
	messages = [];
	onCloseCallBack;
	_deletedMessageIds = new Set();

	static DEFAULT_OPTIONS = {
		id: 'df-chat-archive-viewer',
		classes: ['df-chat-log-window'],
		position: { width: 300, height: 500 },
		window: { title: 'DF_CHAT_ARCHIVE.ArchiveViewer_Title', resizable: true }
	};

	static PARTS = {
		body: {
			template: `modules/${MODULE_ID}/templates/archive-viewer.hbs`,
			scrollable: ['']
		}
	};

	constructor(archive, onCloseCallBack) {
		super({ id: `df-chat-archive-viewer-${archive.id}` });
		this.archive = archive;
		this.onCloseCallBack = onCloseCallBack;
	}

	async _prepareContext() {
		return {
			name: this.archive.name,
			isGM: game.user.isGM,
			visible: this.archive.visible ?? false,
			logId: `df-chat-log-${this.archive.id}`
		};
	}

	async _onRender(context, options) {
		await super._onRender(context, options);
		const root = this.element;
		const html = $(root);

		html.find(`#visible-df-chat-log-${this.archive.id}`).on('change', async event => {
			this.archive.visible = event.currentTarget.checked;
			await DFChatArchive.updateChatArchive(this.archive);
		});
		html.find('#edit').on('click', () => this._editArchiveName());
		html.find('#print').on('click', () => this._printArchive(root));
		html.find('#merge').on('click', () => this._mergeArchive());
		html.find('#html').on('click', () => this._downloadHTML(root));

		const log = html.find('#df-chat-log');
		const entries = await DFChatArchive.getArchiveContents(this.archive);
		this.messages = entries.map(message => {
			const data = message?.toJSON ? message.toJSON() : { ...message };
			const author = data.author ?? data._source?.author ?? data.user;
			data.author = typeof author === 'string' ? author : author?.id;
			delete data.user;
			return data;
		}).filter(message => game.user.isGM
			|| message.author === game.userId
			|| message.type !== CONST.CHAT_MESSAGE_TYPES.WHISPER
			|| (message.whisper ?? []).includes(game.userId));

		const deletionIds = new Set();
		const saveChanges = html.find('#dfal-save-changes');
		for (const data of this.messages) {
			const chatMessage = new ChatMessage(data);
			try {
				const rendered = await foundry.applications.sidebar.tabs.ChatLog.renderMessage(chatMessage);
				const deleteButton = rendered.querySelector('a.message-delete');
				if (this.messages.length === 1 && deleteButton) deleteButton.hidden = true;
				deleteButton?.addEventListener('click', event => {
					event.preventDefault();
					const message = deleteButton.closest('li.chat-message');
					const id = message?.dataset.messageId;
					if (!id) return;
					if (deletionIds.has(id)) {
						deletionIds.delete(id);
						message.classList.remove('dfal-deleted');
						deleteButton.querySelector('i')?.classList.replace('fa-redo-alt', 'fa-trash');
					} else {
						deletionIds.add(id);
						message.classList.add('dfal-deleted');
						deleteButton.querySelector('i')?.classList.replace('fa-trash', 'fa-redo-alt');
					}
					saveChanges.toggle(deletionIds.size > 0);
				});
				log[0].append(rendered);
			} catch (error) {
				console.error(`Chat message ${chatMessage.id} failed to render.\n${error}`);
			}
		}

		saveChanges.hide().on('click', async event => {
			event.preventDefault();
			if (deletionIds.size >= this.messages.length) {
				ui.notifications.warn(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_Error_Delete_All'));
				return;
			}
			const confirmed = await DialogV2.confirm({
				window: { title: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_DeleteTitle') },
				content: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_DeleteContent'),
				modal: true
			});
			if (!confirmed) return;
			for (const id of deletionIds) html.find(`li[data-message-id="${CSS.escape(id)}"]`).remove();
			this.messages = this.messages.filter(message => !deletionIds.has(message._id));
			await DFChatArchive.updateChatArchive(this.archive, this.messages);
		});
	}

	async _editArchiveName() {
		const result = await DialogV2.input({
			window: { title: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_NameEdit_Title') },
			content: `<label>${game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_NameEdit_Title')}<input name="name" type="text" value="${escapeHTML(this.archive.name)}" autofocus></label>`,
			ok: { label: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_NameEdit_Save') },
			modal: true
		});
		if (!result?.name?.trim()) return;
		this.archive.name = result.name.trim();
		await DFChatArchive.updateChatArchive(this.archive);
		await this.render({ force: true });
	}

	async _mergeArchive() {
		const archives = DFChatArchive.getLogs().filter(entry => entry.id !== this.archive.id);
		if (archives.length === 0) {
			ui.notifications.info(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_Merge_OnlyOneArchive'));
			return;
		}
		const options = archives.map(entry => `<option value="${entry.id}">${escapeHTML(entry.name)}</option>`).join('');
		const result = await DialogV2.input({
			window: { title: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_Merge_Title') },
			content: `<label>${game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_Merge_Title')}<select name="archive">${options}</select></label><label><input name="delete" type="checkbox">Delete source archive</label>`,
			ok: { label: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_Merge_Merge') },
			modal: true
		});
		if (!result?.archive) return;
		const source = DFChatArchive.getArchive(Number.parseInt(result.archive, 10));
		if (!source) return;
		const currentChats = await DFChatArchive.getArchiveContents(this.archive);
		const sourceChats = await DFChatArchive.getArchiveContents(source);
		await DFChatArchive.updateChatArchive(this.archive, [...currentChats, ...sourceChats].sort((a, b) => a.timestamp - b.timestamp));
		if (result.delete) await DFChatArchive.deleteChatArchive(source.id);
		await this.render({ force: true });
	}

	_downloadHTML(root) {
		const content = root.querySelector('#df-chat-log')?.cloneNode(true);
		if (!content) return;
		const anchor = document.createElement('a');
		anchor.download = `${encodeURI(this.archive.name)}.html`;
		anchor.href = `data:text/html,${encodeURIComponent(content.outerHTML)}`;
		anchor.click();
	}

	_printArchive(root) {
		const frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		Object.assign(frame.style, { position: 'fixed', width: '1px', height: '1px', left: '-10000px', border: '0' });
		document.body.appendChild(frame);
		const printDocument = frame.contentDocument;
		if (!printDocument) {
			frame.remove();
			ui.notifications.warn('Unable to prepare archive for printing.');
			return;
		}
		const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
			.map(style => style.outerHTML).join('');
		printDocument.open();
		printDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title></title>${styles}<style>@media print { body { margin: 0; background: #fff; color: #111; } #df-chat-log { display: block !important; height: auto !important; overflow: visible !important; } }</style></head><body></body></html>`);
		printDocument.close();
		printDocument.title = this.archive.name;
		const log = root.querySelector('#df-chat-log')?.cloneNode(true);
		if (!log) { frame.remove(); return; }
		printDocument.body.appendChild(log);
		const cleanup = () => frame.remove();
		frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
		frame.contentWindow?.requestAnimationFrame(() => frame.contentWindow?.print());
		window.setTimeout(cleanup, 30000);
	}

	_onClose(options) {
		this.onCloseCallBack(this);
		super._onClose(options);
	}
}