/// <reference path="../../../fvtt-scripts/foundry.js" />
/// <reference path="../../../common/foundry.d.ts" />
/// <reference path="../../../common/libWrapper.d.ts" />
/// <reference path="../types.d.ts" />
import SETTINGS from "../../common/Settings.mjs";
import DFChatEdit from "./df-chat-edit.mjs";

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const HandlebarsApplication = foundry.applications.api.HandlebarsApplicationMixin(ApplicationV2);
const MODULE_ID = 'df-chat-enhance-lukas';

export default class DFChatEditor extends HandlebarsApplication {
	/**@type {ChatMessage}*/ #chatMessage = null;
	/**@readonly*/ static PREF_MARKDOWN = 'edit-markdown';

	static DEFAULT_OPTIONS = {
		id: 'df-chat-message-editor',
		position: { width: 400 },
		window: { title: 'DF_CHAT_EDIT.Editor_Title', resizable: true },
		form: {
			handler: async function (event, _form, formData) {
				await this._updateObject(event, formData.object);
			},
			submitOnChange: false,
			closeOnSubmit: true
		}
	};

	static PARTS = {
		form: { template: `modules/${MODULE_ID}/templates/chat-edit.hbs` }
	};

	/**@param {ChatMessage} chatMessage*/
	constructor(chatMessage) {
		super();
		this.#chatMessage = chatMessage;
	}

	/**
	 * @override
	 * @param {any} [options]
	 * @returns {any}
	 */
	_prepareContext() {
		// Collect the different Actor types and the labels for those types
		const types = Object.keys(CONFIG.Actor.typeLabels).map(type => {
			return { type, label: (foundry.utils.hasProperty(game.i18n.translations, CONFIG.Actor.typeLabels[type]) ? CONFIG.Actor.typeLabels[type] : "Tokens"), actors: [] };
		});
		// Organize the actors in the current scene into those type categories
		for (const type of types) {
			type.actors = game.scenes.viewed.tokens.contents
				.filter(x => x.actor.type === type.type)
				.filter(x => x.testUserPermission(game.user, foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER))
				.map(x => ({ id: 'token-' + x.id, name: x.name }));
		}

		let selected = '';
		const authorId = typeof this.#chatMessage.author === 'string' ? this.#chatMessage.author : this.#chatMessage.author?.id;
		if (authorId)
			selected = 'user-' + authorId;
		if (this.#chatMessage.speaker.token)
			selected = 'token-' + this.#chatMessage.speaker.token;

		return {
			selected,
			players: game.user.isGM ? game.users.map(x => ({ id: 'user-' + x.id, name: x.name })) : [{ id: 'user-' + game.userId, name: game.user.name }],
			actorGroups: types.filter(x => x.actors.length > 0),
			messageText: this.#chatMessage.content
				.replace(/< *br *\/?>/gm, '\n')
				.replace(/<p +class="df-edited">.+/, '')
		};
	}

	async _onRender(context, options) {
		await super._onRender(context, options);
		this.element.querySelector('#cancel')?.addEventListener('click', async event => {
			event.preventDefault();
			await this.close();
		});
	}

	/**
	 * @override
	 * @param {any} [_event]
	 * @param { { content: string, speaker: string } } [formData]
	 */
	async _updateObject(_event, formData) {
		let data = formData.content;
		if (SETTINGS.get(DFChatEditor.PREF_MARKDOWN)) {
			data = DFChatEditor.processMarkdown(data)[1];
		} else {
			data = data.replace(/\r?\n/gm, '<br/>');
		}
		if (SETTINGS.get(DFChatEdit.PREF_SHOW_EDITED) && data.search(/<p +class="df-edited">/) < 0) {
			data += `<p class="df-edited">${'DF_CHAT_EDIT.EditedFlag'.localize()}</p>`;
		}

		let speaker;
		let author;
		if (formData.speaker.startsWith('user-')) {
			author = game.users.get(formData.speaker.substring('user-'.length))?.id;
			speaker = ChatMessage.getSpeaker({ user: author });
		} else
			speaker = ChatMessage.getSpeaker({ token: game.scenes.viewed.tokens.get(formData.speaker.substring('token-'.length)) });
		if (speaker.alias === undefined)
			speaker.alias = null;
		await this.#chatMessage.update({ content: data, speaker, author });
	}
	/**
	 * @override
	 * @param {FormApplication.CloseOptions} [options]
	 * @returns {Promise<void>}
	 */
	_onClose(options) {
		delete this.#chatMessage.chatEditor;
		super._onClose(options);
	}

	/**
	 * @param {string} message
	 * @returns {[string, string]}
	 */
	static processMarkdown(message) {
		const originalMessage = message;
		message = marked.parse(message, {
			headerIds: false,
			breaks: true
		}).trimEnd();
		if (message.startsWith('<p>'))
			message = message.substring(3);
		if (message.endsWith('</p>'))
			message = message.substring(0, message.length - 4);
		const newLine = /(<\/?[ a-z]+>)\n(<\/?[ a-z]+>?)/;
		while (newLine.test(message))
			message = message.replace(newLine, '$1$2');
		return [originalMessage, message];
	}
}

/**@type {MarkedExtension}*/
const inlineDiceRoll = {
	name: "dice-roll",
	level: 'inline',
	start(src) { return src.match(/\[\[/)?.index; },
	renderer(token) { return token.raw; },
	tokenizer(src, _tokens) {
		const rule = /^\[\[[^\n\r]+\]\]$/;
		const match = rule.exec(src);
		if (match)
			return { type: 'dice-roll', raw: match[0] };
	}
};
marked.use({ extensions: [inlineDiceRoll] });