/// <reference path="../../../fvtt-scripts/foundry.js" />
import SETTINGS from "../../common/Settings.mjs";
import UTIL from "../Util.mjs";

export default class ChatTime {

	/**@readonly*/static #PREF_ENABLED = 'ChatTime.UseSimpleCalender';
	/**@readonly*/static #PREF_FORMAT = 'ChatTime.SimpleCalendarFormat';
	/**@readonly*/static #FLAG_CHAT_TIME = 'ChatTime.WorldTime';

	/**@type {boolean}*/
	static get #enabled() { return SETTINGS.get(this.#PREF_ENABLED); }
	/**@type {boolean}*/
	static get #simpleCalendarActive() { return !!game.modules.get('foundryvtt-simple-calendar')?.active; }

	static #registerSettings() {
		SETTINGS.register(this.#PREF_ENABLED, {
			scope: 'world',
			type: Boolean,
			name: "DF_CHAT_TIME.EnabledName",
			hint: "DF_CHAT_TIME.EnabledHint",
			default: false,
			config: true,
			onChange: UTIL.reloadChatLog
		});

		SETTINGS.register(this.#PREF_FORMAT, {
			scope: 'world',
			type: String,
			name: 'DF_CHAT_TIME.FormatName',
			hint: 'DF_CHAT_TIME.FormatHint',
			default: 'YYYY, MMM DD, HH:mm',
			config: this.#simpleCalendarActive,
			onChange: UTIL.reloadChatLog
		});
	}

	static ready() {
		this.#registerSettings();
		if (!this.#simpleCalendarActive && game.user.isGM && this.#enabled)
			ui.notifications.warn('DF_CHAT_TIME.ErrorSimpleCalendarMissing', { permanent: true, localize: true });
	}

	static init() {
		this.#registerSettings();

		libWrapper.register(SETTINGS.MOD_NAME, 'ChatMessage.implementation.create',
			/**
			 * @param {(...args: any) => unknown} wrapped
			 * @param {Partial<ChatMessageData>} chatData
			 * @param {*} createOptions
			 * @returns {unknown}
			 */
			(wrapped, chatData, createOptions) => {
				const data = { flags: {} };
				data.flags[SETTINGS.MOD_NAME] = {};
				data.flags[SETTINGS.MOD_NAME][this.#FLAG_CHAT_TIME] = game.time.worldTime;
				return wrapped(foundry.utils.mergeObject(chatData, data), createOptions);
			}, 'WRAPPER');

		Hooks.on('renderChatMessageHTML', this.renderChatMessage);
	}
	/**
	* @param {ChatMessage} message
	* @param {HTMLElement} html
	* @param {any} _data
	* @returns {void}
	*/
	static renderChatMessage(message, html, _data) {
		const time = new Date(message.timestamp).toLocaleString(navigator.language.startsWith('en') ? 'en-CA' : navigator.language);
		const timeElement = html.querySelector('.message-timestamp');
		if (!timeElement) return;
		if (ChatTime.#simpleCalendarActive && ChatTime.#enabled) {
			/**@type {number}*/
			const simpleTimestamp = message.getFlag(SETTINGS.MOD_NAME, ChatTime.#FLAG_CHAT_TIME);
			if (simpleTimestamp !== undefined) {
				const simpleTimeElement = document.createElement('time');
				simpleTimeElement.className = 'dfce-simple-timestamp';
				simpleTimeElement.textContent = SimpleCalendar.api.formatDateTime(
					SimpleCalendar.api.timestampToDate(simpleTimestamp), SETTINGS.get(ChatTime.#PREF_FORMAT)
				);
				simpleTimeElement.dataset.tooltip = time;
				timeElement.after(simpleTimeElement);
				timeElement.hidden = true;
				return;
			}
		}
		timeElement.dataset.tooltip = time;
	}
}