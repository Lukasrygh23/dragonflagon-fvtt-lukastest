import { ChatMessageData } from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs';
import SETTINGS from '../../../common/Settings';
import { DFChatArchive, DFChatArchiveEntry } from './DFChatArchive';

const ApplicationV2 = (globalThis as any).foundry?.applications?.api?.ApplicationV2;
const HandlebarsApplicationMixin = (globalThis as any).foundry?.applications?.api?.HandlebarsApplicationMixin;
const ApplicationBase = ApplicationV2 && HandlebarsApplicationMixin
	? HandlebarsApplicationMixin(ApplicationV2)
	: Application;

export default class DFChatArchiveViewer extends ApplicationBase {
	archive: DFChatArchiveEntry;
	messages: ChatMessageData[];
	onCloseCallBack: (view: DFChatArchiveViewer) => void;

	static DEFAULT_OPTIONS = ApplicationV2 ? foundry.utils.mergeObject(ApplicationV2.DEFAULT_OPTIONS, {
		id: 'df-chat-archive-viewer',
		classes: ['df-chat-log-window'],
		position: { width: 300, height: 500 },
		window: {
			title: 'DF_CHAT_ARCHIVE.ArchiveViewer_Title',
			resizable: true
		}
	}) : undefined;

	static PARTS = ApplicationV2 ? {
		body: {
			template: 'modules/df-chat-enhance-lukas/templates/archive-viewer.hbs',
			scrollable: ['']
		}
	} : undefined;

	constructor(archive: DFChatArchiveEntry, onCloseCallBack: (view: DFChatArchiveViewer) => void) {
		super();
		this.archive = archive;
		this.onCloseCallBack = onCloseCallBack;
	}

	async _prepareContext(_options: any = {}) {
		return {
			name: this.archive.name,
			isGM: game.user.isGM,
			visible: this.archive.visible ?? false,
			logId: 'df-chat-log-' + this.archive.id
		};
	}

	async _onRender(_context: any, _options: any) {
		if (!ApplicationV2) return;
		const element = (this as any).element;
		const root = element instanceof HTMLElement ? element : element?.[0];
		if (!root) return;
		const html = $(root);

		html.find('#visible-df-chat-log-' + this.archive.id).on('change', async (event: JQuery.ChangeEvent) => {
			this.archive.visible = (event.target as HTMLInputElement).checked;
			await DFChatArchive.updateChatArchive(this.archive);
		});

		const log = html.find('#df-chat-log');
		const archivedMessages = await DFChatArchive.getArchiveContents(this.archive) as (ChatMessage | ChatMessageData)[];
		this.messages = archivedMessages
			.map((message: any) => {
				const data = message?.toJSON ? message.toJSON() : { ...message };
				const author = data.author ?? data.user;
				if (author) data.author = author;
				delete data.user;
				return data as ChatMessageData;
			})
			.filter((message: any) => game.user.isGM
				|| message.author === game.userId
				|| message.type !== CONST.CHAT_MESSAGE_TYPES.WHISPER
				|| (message.whisper ?? []).some((recipient: string) => recipient === game.userId));

		const messageHtml: HTMLElement[] = [];
		for (const value of this.messages as ChatMessageData[]) {
			const chatMessage = value instanceof ChatMessage ? value : new ChatMessage(value);
			try {
				const rendered = await chatMessage.getHTML();
				if (this.messages.length === 1) rendered.find('a.message-delete').hide();
				messageHtml.push(rendered[0] ?? rendered);
			} catch (error) {
				console.error(`Chat message ${chatMessage.id} failed to render.\n${error}`);
			}
		}
		log.prepend(messageHtml);

		html.find('#html').on('click', () => {
			const data = $('<div></div>').append(log.clone()).html();
			const anchor = document.createElement('a');
			anchor.download = encodeURI(this.archive.name) + '.html';
			anchor.href = 'data:text/html,' + encodeURIComponent(data);
			anchor.click();
		});
	}

	// convert a Unicode string to a string in which
	// each 16-bit unit occupies only one byte
	/**
	 * Converts a UTF-16 string to an ASCii string containing the binary data of the UTF-16 text.
	 * @param data UTF-16 data
	 * @returns Binary data coerced into a string
	 */
	private static toBinary(data: string): string {
		const codeUnits = new Uint16Array(data.length);
		for (let i = 0; i < codeUnits.length; i++) {
			codeUnits[i] = data.charCodeAt(i);
		}
		const charCodes = new Uint8Array(codeUnits.buffer);
		let result = '';
		for (let i = 0; i < charCodes.byteLength; i++) {
			result += String.fromCharCode(charCodes[i]);
		}
		return result;
	}

	_renderInner(data: any): Promise<JQuery> {
		return (super._renderInner(data) as Promise<JQuery>)
			.then(async (html: JQuery<HTMLElement>) => {
				html.find("#visible-df-chat-log-" + this.archive.id).on('change', async (element) => {
					this.archive.visible = (element.target as HTMLInputElement).checked;
					await DFChatArchive.updateChatArchive(this.archive);
				});
				html.find("#edit").on('click', async () => {
					setTimeout(async () => {
						const dialog = new Dialog({
							title: game.i18n.localize("DF_CHAT_ARCHIVE.ArchiveViewer_NameEdit_Title"),
							content: `<input id="name" type="text" value="${this.archive.name}"/>`,
							buttons: {
								save: {
									icon: '<i class="fas fa-save"></i>',
									label: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_NameEdit_Save'),
									callback: async (html) => {
										this.archive.name = $(html).find('#name').val() as string;
										await dialog.close();
										await DFChatArchive.updateChatArchive(this.archive);
										await this.render(false);
									}
								},
								close: {
									icon: '<i class="fas fa-times"></i>',
									label: 'DF_CHAT_ARCHIVE.ArchiveViewer_NameEdit_Cancel'.localize(),
									callback: async () => {
										await dialog.close();
									}
								}
							},
							default: 'save'
						});
						dialog.render(true);
					}, 1);
				});
				html.find('#print').on('click', () => this.printArchive(html));
				html.find('#merge').on('click', async () => {
					if (DFChatArchive.getLogs().length == 1) {
						ui.notifications.info(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_Merge_OnlyOneArchive'));
						return;
					}
					const dialog: Dialog = new Dialog({
						title: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveViewer_Merge_Title'),
						default: 'merge',
						content: await foundry.applications.handlebars.renderTemplate('modules/df-chat-enhance-lukas/templates/archive-merge.hbs', {
							id: this.archive.id,
							name: this.archive.name,
							archives: DFChatArchive.getLogs().filter(x => x.id != this.archive.id)
						}),
						buttons: {
							cancel: {
								icon: '<i class="fas fa-times"></i>',
								label: 'DF_CHAT_ARCHIVE.ArchiveViewer_Merge_Cancel'.localize(),
								callback: async () => await dialog.close()
							},
							merge: {
								icon: '<i class="fas fa-sitemap"></i>',
								label: 'DF_CHAT_ARCHIVE.ArchiveViewer_Merge_Merge'.localize(),
								callback: async (html) => {
									const val = $(html).find('#archive').val() as string;
									if (isNaN(parseInt(val))) return;
									const id = parseInt(val);
									const source = DFChatArchive.getLogs().find(x => x.id == id);
									const currentChats = await DFChatArchive.getArchiveContents(this.archive);
									const sourceChats = await DFChatArchive.getArchiveContents(source);
									const mergedChats = (currentChats as ChatMessageData[])
										.concat(sourceChats as ChatMessageData[])
										.sort((a, b) => a.timestamp - b.timestamp);
									await DFChatArchive.updateChatArchive(this.archive, mergedChats);
									this.render(true);
									if (($(html).find('#delete-' + this.archive.id)[0] as HTMLInputElement).checked) {
										await DFChatArchive.deleteChatArchive(id);
									}
								}
							}
						}
					});
					await dialog.render(true);
				});

				html.find('#html').on('click', () => {
					const data = $('<div></div>').append(html.find('#df-chat-log').clone()).html();
					const anchor = document.createElement('a');
					anchor.download = encodeURI(this.archive.name) + '.html';
					// anchor.href = "data:text/html;base64," + btoa(unescape(encodeURIComponent(data)));
					anchor.href = "data:text/html," + encodeURIComponent(data);
					anchor.click();
				});

				const log = html.find('#df-chat-log');
				const messageHtml = [];
				const archivedMessages = await DFChatArchive.getArchiveContents(this.archive) as (ChatMessage | ChatMessageData)[];
				this.messages = archivedMessages
					.map((message: any) => {
						const data = message?.toJSON ? message.toJSON() : { ...message };
						const author = data.author ?? data.user;
						if (author) data.author = author;
						delete data.user;
						return data as ChatMessageData;
					})
					.filter((x: any) => game.user.isGM
						|| x.author === game.userId
						|| x.type !== CONST.CHAT_MESSAGE_TYPES.WHISPER
						|| (x.whisper ?? []).some((recipient: string) => recipient === game.userId));

				const deletionList: string[] = [];
				const deleteButton = html.find('#dfal-save-changes');
				for (const value of this.messages as ChatMessageData[]) {
					const chatMessage = value instanceof ChatMessage ? value : new ChatMessage(value);
					try {
						// @ts-ignore
						const html = await chatMessage.getHTML();
						// if we only have 1 message, don't allow it to be deleted. They might as well just delete the archive
						if (this.messages.length == 1)
							html.find('a.message-delete').hide();
						html.find('a.message-delete').on('click', (event: JQuery.ClickEvent) => {
							const messageHtml = $(event.target.parentElement?.parentElement?.parentElement?.parentElement);
							const buttonIcon = $(event.target);
							if (messageHtml.hasClass('dfal-deleted')) {
								messageHtml.removeClass('dfal-deleted');
								buttonIcon.removeClass('fa-redo-alt');
								buttonIcon.addClass('fa-trash');
								deletionList.splice(deletionList.findIndex(x => x === messageHtml.attr('data-message-id')), 1);
							} else {
								messageHtml.addClass('dfal-deleted');
								buttonIcon.removeClass('fa-trash');
								buttonIcon.addClass('fa-redo-alt');
								deletionList.push(messageHtml.attr('data-message-id'));
							}
							if (deletionList.length > 0) deleteButton.show();
							else deleteButton.hide();
						});
						messageHtml.push(html);
					} catch (err) {
						console.error(`Chat message ${chatMessage.id} failed to render.\n${err})`);
					}
				}

				// Prepend the HTML
				log.prepend(messageHtml);

				deleteButton.hide();
				deleteButton.on('click', async () => {
					if (deletionList.length === this.messages.length) {
						ui.notifications.warn('DF_CHAT_ARCHIVE.ArchiveViewer_Error_Delete_All'.localize());
						return;
					}
					Dialog.confirm({
						title: "DF_CHAT_ARCHIVE.ArchiveViewer_DeleteTitle".localize(),
						content: "DF_CHAT_ARCHIVE.ArchiveViewer_DeleteContent".localize(),
						defaultYes: false,
						yes: async () => {
							for (const id of deletionList) {
								const message = html.find(`li[data-message-id="${id}"]`);
								message.hide(500, () => message.remove());
							}
							this.messages = this.messages.filter((x: any) => !deletionList.includes(x._id));
							await DFChatArchive.updateChatArchive(this.archive, this.messages);
						}
					});
				});

				return html;
			});
	}
	close(options?: Application.CloseOptions): Promise<void> {
		this.onCloseCallBack(this);
		return super.close(options);
	}

	private printArchive(html: JQuery<HTMLElement>): void {
		const log = html.find('#df-chat-log').clone();
		log.removeAttr('id').addClass('df-chat-print');

		const frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		Object.assign(frame.style, {
			position: 'fixed',
			width: '794px',
			height: '1123px',
			left: '-10000px',
			top: '0',
			visibility: 'hidden'
		});
		document.body.appendChild(frame);

		const printDocument = frame.contentDocument;
		if (!printDocument) {
			frame.remove();
			ui.notifications.warn('Unable to create a print document for this archive.');
			return;
		}

		printDocument.open();
		printDocument.write('<!doctype html><html><head><meta charset="utf-8"><title></title><style>@media print { body { margin: 0; background: #fff; color: #111; } .df-chat-print { width: 100%; margin: 0; padding: 12px; box-sizing: border-box; } }</style></head><body></body></html>');
		printDocument.close();
		printDocument.title = this.archive.name;

		printDocument.body.appendChild(log[0]);

		const cleanup = () => frame.remove();
		frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
		frame.contentWindow?.requestAnimationFrame(() => frame.contentWindow?.print());
		window.setTimeout(cleanup, 30000);
	}
}