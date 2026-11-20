import { DFChatArchive } from "./DFChatArchive";
import SETTINGS from "../../../common/Settings";

const FormApplicationV2 = (globalThis as any).foundry?.applications?.api?.FormApplicationV2;
const FormApplicationBase = FormApplicationV2 ?? FormApplication;

export default class DFChatArchiveNew extends FormApplicationBase {
	static readonly PREF_DELETE = 'new-should-delete';
	static readonly PREF_HIDE_EXPORT = 'hide-export';

	static DEFAULT_OPTIONS = FormApplicationV2 ? foundry.utils.mergeObject(FormApplicationV2.DEFAULT_OPTIONS, {
		id: 'df-chat-archive-new',
		position: { width: 400 },
		window: { title: 'DF_CHAT_ARCHIVE.ArchiveNew_Title' }
	}) : undefined;

	static PARTS = FormApplicationV2 ? {
		form: {
			template: 'modules/df-chat-enhance-lukas/templates/archive-new.hbs'
		}
	} : undefined;

	static registerSettings() {
		SETTINGS.register(DFChatArchiveNew.PREF_DELETE, {
			config: false,
			scope: 'world',
			type: Boolean,
			default: true
		});
	}

	async _prepareContext(_options: any = {}) {
		return { shouldDelete: SETTINGS.get(DFChatArchiveNew.PREF_DELETE) as boolean };
	}

	async _onRender(_context: any, _options: any) {
		if (!FormApplicationV2) return;
		const element = (this as any).element;
		const root = element instanceof HTMLElement ? element : element?.[0];
		if (!root) return;
		const html = $(root);
		const from = html.find('#dfca-from');
		const to = html.find('#dfca-to');
		html.find('#dfca-all').on('change', () => { from.prop('disabled', true); to.prop('disabled', true); });
		html.find('#dfca-date').on('change', () => { from.prop('disabled', false); to.prop('disabled', false); });
		html.find('form').on('submit', async (event) => {
			event.preventDefault();
			const formData = new foundry.applications.ux.FormDataExtended(event.currentTarget).object;
			await this._updateObject(event, formData);
			await this.close();
		});
	}

	async _updateObject(_event?: any, formData?: any) {
		SETTINGS.set(DFChatArchiveNew.PREF_DELETE, formData.delete);

		const name = formData.name;
		if (!name) {
			ui.notifications.warn('DF_CHAT_ARCHIVE.ArchiveNew_ErrorNameMissing'.localize());
			throw Error('DF_CHAT_ARCHIVE.ArchiveNew_ErrorNameMissing'.localize());
		}

		let chats = <ChatMessage[]>[...(ui.chat.collection.values())];

		// If we are selecting a date range
		if (formData['date-or-all'] === 'date') {
			const fromDate = new Date(formData.from).getTime();
			const toDate = new Date(formData.to).getTime();
			if (isNaN(fromDate) || isNaN(toDate)) {
				ui.notifications.warn('DF_CHAT_ARCHIVE.ArchiveNew_ErrorDatesMissing'.localize());
				throw Error('Missing "from" and/or "to" dates');
			}
			chats = chats.filter((value) => value.data.timestamp >= fromDate && value.data.timestamp <= toDate);
		}

		ui.notifications.info('DF_CHAT_ARCHIVE.ArchiveNew_NoticeSuccess'.localize().replace('{0}', name));
		try {
			await DFChatArchive.createChatArchive(name, chats, formData['visible']);
		}
		catch (e) {
			// We have failed to create an archive so we should return immediately
			return;
		}
		// If we don't want to delete the messages, return
		if (!formData.delete) return;

		game.messages.flush();
	}
}