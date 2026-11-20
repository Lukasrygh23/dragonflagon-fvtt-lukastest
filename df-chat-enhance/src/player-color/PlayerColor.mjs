/// <reference path="../../../fvtt-scripts/foundry.js" />
/// <reference path="../../../common/foundry.d.ts" />
import libWrapperShared from "../../common/libWrapperShared.mjs";
import SETTINGS from "../../common/Settings.mjs";
import UTIL from '../Util.mjs';

export default class PlayerColor {
	/**@readonly*/ static #PREF_TINT_BG = 'PlayerColor_TintBackground';
	/**@readonly*/ static #PREF_BORDER_STYLE = 'PlayerColor.BorderStyle';
	/**@readonly*/ static #FLAG_CHAT_COLOR = 'chat-color';

	static init() {
		SETTINGS.register(PlayerColor.#PREF_TINT_BG, {
			config: true,
			name: 'DF_CHAT_PLAYER_COLOR.SettingTintBackgroundName',
			hint: 'DF_CHAT_PLAYER_COLOR.SettingTintBackgroundHint',
			scope: 'world',
			type: Boolean,
			default: false,
			onChange: UTIL.reloadChatLog
		});
		SETTINGS.register(PlayerColor.#PREF_BORDER_STYLE, {
			name: 'DF_CHAT_PLAYER_COLOR.SettingBorderStyleName',
			hint: 'DF_CHAT_PLAYER_COLOR.SettingBorderStyleHint',
			config: true,
			type: String,
			choices: {
				all: 'DF_CHAT_PLAYER_COLOR.BorderStyle.all',
				mine: 'DF_CHAT_PLAYER_COLOR.BorderStyle.mine',
				none: 'DF_CHAT_PLAYER_COLOR.BorderStyle.none'
			},
			default: 'all',
			scope: 'client',
			onChange: UTIL.reloadChatLog
		});

		Hooks.on('renderUserConfig',
			/**
			 * @param {User} app
			 * @param {JQuery<HTMLElement>} html
			 */
			(app, html) => {
				const color = app.document.getFlag(SETTINGS.MOD_NAME, PlayerColor.#FLAG_CHAT_COLOR) ?? '';
				$(html).find('color-picker[name="color"]').parent().parent().after(`
<div class="form-group">
	<label for="UserCongih-${app.uuid}-form-chat-color">${'DF_CHAT_PLAYER_COLOR.Label'.localize()}</label>
	<div class="form-fields">
		<color-picker name="chat-color" value="${color}" id="UserCongih-${app.uuid}-form-chat-color">
			<input class="text" placeholder>
			<input type="color">
		</color-picker>
	</div>
	<p class="hint">${'DF_CHAT_PLAYER_COLOR.Hint'.localize()}</p>
</div>`);
			});

		libWrapperShared.register('foundry.applications.sheets.UserConfig.prototype._processFormData',
			/**
			 * @this {foundry.applications.sheets.UserConfig}
			 * @param {(...any) => any} wrapped
			 * @param {SubmitEvent} event
			 * @param {HTMLFormElement} form
			 * @param { { "chat-color": string } } formData
			 * @returns {Promise<any>}
			 */
			function (wrapped, event, form, formData) {
				this.document.setFlag(SETTINGS.MOD_NAME, PlayerColor.#FLAG_CHAT_COLOR, formData.object["chat-color"]);
				delete formData.object["chat-color"];
				return wrapped(event, form, formData);
			});

		Hooks.on('renderChatMessageHTML', this.#renderChatMessageHTML);
	}

	static #renderChatMessageHTML(message, html) {
		const STYLE = SETTINGS.get(PlayerColor.#PREF_BORDER_STYLE);
		// If the message has no user bound to it, then it is likely some kind of other message being created by a module. Just return immediately.
		// Also ignore whispers and rolls
		const author = typeof message.author === 'string' ? game.users.get(message.author) : message.author;
		if (!author) return;
		let chatColor = author.getFlag(SETTINGS.MOD_NAME, PlayerColor.#FLAG_CHAT_COLOR)?.trim();
		// If it is a valid color
		if (!chatColor || !/#[a-fA-F0-9]{6,8}/.test(chatColor))
			chatColor = author.color;

		// Set the border colour to its default
		let borderColour = '#6f6c66';
		switch (STYLE) {
			case 'none': break;
			case 'mine': if (game.userId !== author.id) break;
			/** @fallthrough */
			case 'all': borderColour = chatColor; break;
		}
		html.style.borderColor = borderColour;

		// Set the hover border colour to what ever the border colour is
		html.style.setProperty('--dfce-mc-border-color', borderColour);
		if (!message.isRoll && (message.whisper ?? []).length === 0 && SETTINGS.get(PlayerColor.#PREF_TINT_BG)) {
			html.style.backgroundColor = chatColor;
			html.style.backgroundBlendMode = 'screen';
			if (!!game.dnd5e) {
				html.style.backgroundImage = 'url(../ui/parchment.jpg)';
				html.style.backgroundRepeat = 'repeat';
			}
		}
	}
}
