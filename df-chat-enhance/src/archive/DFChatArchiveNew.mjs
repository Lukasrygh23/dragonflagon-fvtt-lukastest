import { DFChatArchive } from "./DFChatArchive.mjs";
import SETTINGS from "../../common/Settings.mjs";

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const HandlebarsApplication = foundry.applications.api.HandlebarsApplicationMixin(ApplicationV2);
const MODULE_ID = 'df-chat-enhance-lukas';

export default class DFChatArchiveNew extends HandlebarsApplication {
	static PREF_DELETE = 'new-should-delete';
	static PREF_HIDE_EXPORT = 'hide-export';

	static DEFAULT_OPTIONS = {
		id: 'df-chat-archive-new',
		position: { width: 400 },
		window: { title: 'DF_CHAT_ARCHIVE.ArchiveNew_Title', resizable: false, minimizable: false }
	};

	static PARTS = {
		form: {
			template: `modules/${MODULE_ID}/templates/archive-new.hbs`,
			forms: {
				'form.archive-new': {
					handler: async function (event, _form, formData) {
						const created = await this._updateObject(event, formData.object);
						if (created) await this.close();
					},
					submitOnChange: false,
					closeOnSubmit: false
				}
			}
		}
	};

	static registerSettings() {
		SETTINGS.register(DFChatArchiveNew.PREF_DELETE, {
			config: false,
			scope: 'world',
			type: Boolean,
			default: true
		});
	}

	async _prepareContext() {
		return { shouldDelete: SETTINGS.get(DFChatArchiveNew.PREF_DELETE) };
	}

	async _onRender(context, options) {
		await super._onRender(context, options);
		const form = this.element.querySelector('form');
		if (!form) return;
		const from = form.querySelector('#dfca-from');
		const to = form.querySelector('#dfca-to');
		const warning = form.querySelector('#dfca-warning');
		form.querySelector('#dfca-all')?.addEventListener('change', () => {
			from.disabled = true;
			to.disabled = true;
			warning?.classList.add('hidden');
		});
		form.querySelector('#dfca-date')?.addEventListener('change', () => {
			from.disabled = false;
			to.disabled = false;
			warning?.classList.remove('hidden');
		});
		form.querySelector('input[type="text"]')?.focus();
	}

	async _updateObject(_event, formData) {
		const deleteMessages = formData.delete === true || formData.delete === 'true' || formData.delete === 'on';
		const visible = formData.visible === true || formData.visible === 'true' || formData.visible === 'on';
		const name = formData.name?.trim();
		if (!name) {
			ui.notifications.warn(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveNew_ErrorNameMissing'));
			return false;
		}

		const isDateRange = formData['date-or-all'] === 'date';
		const fromDate = isDateRange ? new Date(formData.from).getTime() : Number.MIN_VALUE;
		const toDate = isDateRange ? new Date(formData.to).getTime() : Number.MAX_VALUE;
		if (isDateRange && (Number.isNaN(fromDate) || Number.isNaN(toDate))) {
			ui.notifications.warn(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveNew_ErrorDatesMissing'));
			return false;
		}

		const chats = [];
		for (const message of ui.chat.collection.contents) {
			if (message.timestamp < fromDate || message.timestamp > toDate) continue;
			const data = message.toObject();
			data.originalID = data._id;
			data._id = `DFCA${data._id.substring(4)}`;
			chats.push(data);
		}

		try {
			await DFChatArchive.createChatArchive(name, chats, visible);
		} catch (error) {
			console.error(error);
			ui.notifications.error(`Failed to save chat archive "${name}": ${error.message ?? error}`);
			return false;
		}
		if (SETTINGS.get(DFChatArchiveNew.PREF_DELETE) !== deleteMessages) {
			try {
				await SETTINGS.set(DFChatArchiveNew.PREF_DELETE, deleteMessages);
			} catch (error) {
				console.error('Chat archive saved, but the Delete preference could not be updated', error);
				ui.notifications.warn('The archive was saved, but the Delete preference could not be updated.');
			}
		}
		ui.notifications.info(game.i18n.localize('DF_CHAT_ARCHIVE.ArchiveNew_NoticeSuccess').replace('{0}', name));
		if (!deleteMessages) return true;
		if (!isDateRange) game.messages.flush();
		else await game.messages.documentClass.deleteDocuments(chats.map(chat => chat.originalID));
		return true;
	}
}