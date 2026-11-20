import SETTINGS from "../../common/Settings.mjs";
import { DFChatArchive } from "./DFChatArchive.mjs";
import DFChatArchiveViewer from "./DFChatArchiveViewer.mjs";

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const HandlebarsApplication = foundry.applications.api.HandlebarsApplicationMixin(ApplicationV2);
const DialogV2 = foundry.applications.api.DialogV2;
const MODULE_ID = 'df-chat-enhance-lukas';

export default class DFChatArchiveManager extends HandlebarsApplication {
	static PREF_REVERSE_SORT = 'dfca-manager-reverseSort';
	static PREF_MENU = 'archiveManagerMenu';
	static chatViewers = new Map();

	static DEFAULT_OPTIONS = {
		id: 'df-chat-archive-manager',
		classes: ['df-chat-archive-manager'],
		position: { width: 300, height: 500 },
		window: {
			title: 'DF_CHAT_ARCHIVE.ArchiveManager_Title',
			resizable: true,
			minimizable: true
		}
	};

	static PARTS = {
		body: {
			template: `modules/${MODULE_ID}/templates/archive-manager.hbs`,
			scrollable: ['#dfca-archives']
		}
	};

	async _prepareContext() {
		let messages = DFChatArchive.getLogs();
		if (!game.user.isGM) messages = messages.filter(archive => archive.visible);
		messages.sort((a, b) => a.name.localeCompare(b.name));
		const reverseSort = SETTINGS.get(DFChatArchiveManager.PREF_REVERSE_SORT);
		return {
			messages: reverseSort ? messages.reverse() : messages,
			isGM: game.user.isGM,
			reverseSort
		};
	}

	async _onRender(context, options) {
		await super._onRender(context, options);
		if (this._archiveManagerEventsBound) return;
		this._archiveManagerEventsBound = true;
		DFChatArchive.setUpdateListener(() => this.render({ force: true }));
		this.element.addEventListener('click', event => this._onManagerClick(event));
	}

	async _onManagerClick(event) {
		const target = event.target instanceof Element ? event.target : null;
		const viewLink = target?.closest('[data-type="view"]');
		if (viewLink) {
			event.preventDefault();
			const id = Number.parseInt(viewLink.getAttribute('data-id'), 10);
			if (!Number.isInteger(id) || !DFChatArchive.exists(id)) {
				ui.notifications.error(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ErrorBadId'));
				return;
			}
			let viewer = DFChatArchiveManager.chatViewers.get(id);
			if (viewer?.rendered) return viewer.bringToFront();
			viewer = new DFChatArchiveViewer(DFChatArchive.getArchive(id), closed => {
				DFChatArchiveManager.chatViewers.delete(closed.archive.id);
			});
			DFChatArchiveManager.chatViewers.set(id, viewer);
			return viewer.render({ force: true });
		}

		const deleteLink = target?.closest('[data-type="delete"]');
		if (deleteLink) {
			event.preventDefault();
			const id = Number.parseInt(deleteLink.getAttribute('data-id'), 10);
			if (!Number.isInteger(id) || !DFChatArchive.exists(id)) {
				ui.notifications.error(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ErrorBadId'));
				return;
			}
			const archive = DFChatArchive.getArchive(id);
			const confirmed = await DialogV2.confirm({
				window: { title: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteArchiveTitle') },
				content: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteArchiveContent').replace('{name}', archive.name),
				modal: true
			});
			if (confirmed) await DFChatArchive.deleteChatArchive(id);
			return;
		}

		if (target?.closest('#dfca-delete-all')) {
			event.preventDefault();
			const first = await DialogV2.confirm({
				window: { title: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllTitle') },
				content: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllMessage1'),
				modal: true
			});
			if (!first) return;
			const second = await DialogV2.confirm({
				window: { title: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllTitle') },
				content: game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllMessage2'),
				modal: true
			});
			if (second) {
				await DFChatArchive.deleteAll();
				ui.notifications.info(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveManager_ConfirmDeleteAllComplete'));
			}
			return;
		}

		const sortButton = target?.closest('#dfca-sort-asc, #dfca-sort-dsc');
		if (!sortButton) return;
		event.preventDefault();
		await SETTINGS.set(DFChatArchiveManager.PREF_REVERSE_SORT, sortButton.id === 'dfca-sort-asc');
		await this.render({ force: true });
	}

	_onClose(options) {
		DFChatArchive.setUpdateListener(null);
		super._onClose(options);
	}
}