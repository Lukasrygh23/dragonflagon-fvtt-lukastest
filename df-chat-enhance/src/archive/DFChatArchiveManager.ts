import SETTINGS from "../../../common/Settings";
import { DFChatArchive } from "./DFChatArchive";
import DFChatArchiveViewer from "./DFChatArchiveViewer";

const ApplicationV2 = (globalThis as any).foundry?.applications?.api?.ApplicationV2;
const HandlebarsApplicationMixin = (globalThis as any).foundry?.applications?.api?.HandlebarsApplicationMixin;
const ApplicationBase = ApplicationV2 && HandlebarsApplicationMixin
	? HandlebarsApplicationMixin(ApplicationV2)
	: Application;

// Keeps legacy fallback for Foundry v12 while using ApplicationV2 in v13+.
export default class DFChatArchiveManager extends ApplicationBase {
	static readonly PREF_REVERSE_SORT = 'dfca-manager-reverseSort';
	static chatViewers: Map<number, DFChatArchiveViewer> = new Map();

	static DEFAULT_OPTIONS = ApplicationV2 ? foundry.utils.mergeObject(ApplicationV2.DEFAULT_OPTIONS, {
		id: 'df-chat-archive-manager',
		classes: ['df-chat-archive-manager'],
		position: { width: 300, height: 500 },
		window: {
			title: 'DF_CHAT_ARCHIVE.ArchiveManager_Title',
			resizable: true,
			minimizable: true
		}
	}) : undefined;

	static PARTS = ApplicationV2 ? {
		body: {
			template: 'modules/df-chat-enhance-lukas/templates/archive-manager.hbs',
			scrollable: ['']
		}
	} : undefined;

	private _getManagerData() {
		let messages = DFChatArchive.getLogs();
		if (!game.user.isGM) messages = messages.filter(x => x.visible);
		messages = messages.sort((a, b) => a.name.localeCompare(b.name));
		const reverseSort = SETTINGS.get<boolean>(DFChatArchiveManager.PREF_REVERSE_SORT);
		return {
			messages: reverseSort ? messages.reverse() : messages,
			isGM: game.user.isGM,
			reverseSort
		};
	}

	async _prepareContext(_options: any = {}) {
		return this._getManagerData();
	}

	_onRender(_context: any, _options: any) {
		if (!ApplicationV2) return;
		const element = (this as any).element;
		this.activateListeners($(element instanceof HTMLElement ? element : element?.[0]));
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject((Application as any).defaultOptions ?? Application.defaultOptions as Partial<ApplicationOptions>, {
			template: `modules/${SETTINGS.MOD_NAME}/templates/archive-manager.hbs`,
			resizable: true,
			minimizable: true,
			width: 300,
			height: 500,
			title: "DF_CHAT_ARCHIVE.ArchiveManager_Title"
		}) as ApplicationOptions;
	}

	getData(options?: any) {
		const baseGetData = Object.getPrototypeOf(DFChatArchiveManager.prototype).getData;
		const data = typeof baseGetData === 'function' ? baseGetData.call(this, options) : {};
		let messages = DFChatArchive.getLogs();
		if (!game.user.isGM)
			messages = messages.filter(x => x.visible);
		messages = messages.sort((a, b) => a.name.localeCompare(b.name));
		const reverseSort = SETTINGS.get<boolean>(DFChatArchiveManager.PREF_REVERSE_SORT);
		foundry.utils.mergeObject(data, {
			messages: reverseSort ? messages.reverse() : messages,
			isGM: game.user.isGM,
			reverseSort
		});
		return data;
	}

	private _subscribeView(element: JQuery) {
		element.on('click', function () {
			const id = parseInt($(this).attr('data-id'));
			if (isNaN(id) || !DFChatArchive.exists(id)) {
				ui.notifications.error(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ErrorBadId'));
				throw Error(`Invalid id for Chat Archive: '${$(this).attr('data-id')}'`);
			}
			if (DFChatArchiveManager.chatViewers.has(id)) {
				const viewer = DFChatArchiveManager.chatViewers.get(id) as any;
				if (typeof viewer.bringToFront === 'function') viewer.bringToFront();
				else viewer.bringToTop?.();
			} else {
				DFChatArchiveManager.chatViewers.set(id, new DFChatArchiveViewer(DFChatArchive.getArchive(id), view => {
					DFChatArchiveManager.chatViewers.delete(view.archive.id);
				}));
				DFChatArchiveManager.chatViewers.get(id).render(true);
			}
		});
	}
	private _subscribeDelete(element: JQuery) {
		element.on('click', async function () {
			const id = parseInt($(this).attr('data-id'));
			if (isNaN(id) || !DFChatArchive.exists(id)) {
				ui.notifications.error(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ErrorBadId'));
				throw Error(`Invalid id for Chat Archive: '${$(this).attr('data-id')}'`);
			}
			const archive = DFChatArchive.getArchive(id);
			await Dialog.confirm({
				title: 'DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteArchiveTitle'.localize(),
				content: 'DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteArchiveContent'.localize().replace('{name}', archive.name),
				defaultYes: false,
				yes: async () => await DFChatArchive.deleteChatArchive(id)
			});
		});
	}

	activateListeners(html: JQuery) {
		DFChatArchive.setUpdateListener(this._archiveChanged.bind(this));
		if (DFChatArchive.getLogs().length > 0)
			html.find('p.dfca-no-items').hide();
		html.find('a[data-type="view"]').each((i, element) => { this._subscribeView($(element)); });
		html.find('a[data-type="delete"]').each((i, element) => { this._subscribeDelete($(element)); });
		html.find('#dfca-delete-all').on('click', async function () {
			await Dialog.confirm({
				title: 'DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllTitle'.localize(),
				content: 'DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllMessage1'.localize(),
				defaultYes: false,
				yes: async () => {
					await Dialog.confirm({
						title: 'DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllTitle'.localize(),
						content: 'DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllMessage2'.localize(),
						defaultYes: false,
						yes: async () => {
							await DFChatArchive.deleteAll();
							ui.notifications.info('DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllComplete'.localize());
						}
					});
				}
			});
		});
		const asc = html.find('#dfca-sort-asc');
		const dsc = html.find('#dfca-sort-dsc');
		asc.on('click', async () => {
			await SETTINGS.set(DFChatArchiveManager.PREF_REVERSE_SORT, true);
			asc.hide();
			dsc.show();
			this.render();
		});
		dsc.on('click', async () => {
			await SETTINGS.set(DFChatArchiveManager.PREF_REVERSE_SORT, false);
			dsc.hide();
			asc.show();
			this.render();
		});
	}

	close(options?: any): Promise<void> {
		DFChatArchive.setUpdateListener(null);
		return super.close(options);
	}

	private async _archiveChanged() {
		let logs = DFChatArchive.getLogs();
		if (!game.user.isGM)
			logs = logs.filter(x => x.visible);
		const archiveContainer = this.element.find('#dfca-archives');
		archiveContainer.empty();
		// Add new items
		for (const archive of logs) {
			const visible = archive.visible === true
				? `<i class="dfca-visible fas fa-users" title="${'DF_CHAT_ARCHIVE.ArchiveManager_VisibleToPlayers'.localize()}"></i>` : '';
			const html = $(`
		<li class="dfca-archive-item" data-id="${archive.id}">
			<div>
				<a class="button dfca-view" data-type="view" data-id="${archive.id}"><i class="fas fa-eye"></i>
					<span>${archive.name}</span>
				</a>
				${visible}
				<a class="button dfca-delete" data-type="delete" data-id="${archive.id}"><i class="fas fa-trash"></i></a>
			</div>
		</li>`);
			this._subscribeView(html.find('a[data-type="view"]'));
			this._subscribeDelete(html.find('a[data-type="delete"]'));
			archiveContainer.append(html);
		}
		if (archiveContainer[0].children.length == 0)
			this.element.find('p.dfca-no-items').show();
		else
			this.element.find('p.dfca-no-items').hide();
	}
}