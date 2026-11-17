import { ChatMessageData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs";
import libWrapperShared from "../../../common/libWrapperShared";
import SETTINGS from "../../../common/Settings";
import UTIL from "../Util";
import ChatHistoryOptimizer from "./ChatHistoryOptimizer";

declare class ChatLogExt extends ChatLog {
	_scrollToBottomButton: JQuery<HTMLElement>;
}

export default class ScrollManage {
	private static readonly PREF_ENABLED = 'scroll-manage-enabled';
	private static readonly PREF_SCROLL_IF_YOU = 'scroll-manage-scroll-if-you';
	private static readonly ScrollThreshold = 50;
	// private static _scrollToBottomButton: JQuery<HTMLElement>;
	private static _deleteMessageRegistrationID: number | null = null;
	private static _registeredWrapperTargets = new Set<string>();


	static get enabled(): boolean { return SETTINGS.get(this.PREF_ENABLED); }
	static get scrollToBottomIfYouSendMessage(): boolean { return SETTINGS.get(this.PREF_SCROLL_IF_YOU); }

	static init() {
		Hooks.on('renderChatLog', this._renderChatLog.bind(this));

		SETTINGS.register(this.PREF_ENABLED, {
			name: 'DF_CHAT_SCROLL.EnableName',
			hint: 'DF_CHAT_SCROLL.EnableHint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: true,
			onChange: (newValue) => {
				if (newValue) this.register();
				else this.unregister();
			}
		});
		SETTINGS.register(this.PREF_SCROLL_IF_YOU, {
			name: 'DF_CHAT_SCROLL.ScrollIfYouName',
			hint: 'DF_CHAT_SCROLL.ScrollIfYouHint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: true
		});

		ChatHistoryOptimizer.init();
	}

	static ready() {
		if (this.enabled)
			this.register();
	}

	private static register() {
		const postOneTarget = 'foundry.applications.sidebar.tabs.ChatLog.prototype.postOne';
		const scrollBottomTarget = 'foundry.applications.sidebar.tabs.ChatLog.prototype.scrollBottom';
		if (typeof foundry.applications?.sidebar?.tabs?.ChatLog?.prototype?.postOne === 'function' && !this._registeredWrapperTargets.has(postOneTarget)) {
			libWrapper.register(SETTINGS.MOD_NAME, postOneTarget, this._ChatLog_postOne, 'OVERRIDE');
			this._registeredWrapperTargets.add(postOneTarget);
		}
		if (typeof foundry.applications?.sidebar?.tabs?.ChatLog?.prototype?.scrollBottom === 'function' && !this._registeredWrapperTargets.has(scrollBottomTarget)) {
			libWrapper.register(SETTINGS.MOD_NAME, scrollBottomTarget, this._ChatLog_scrollBottom, 'OVERRIDE');
			this._registeredWrapperTargets.add(scrollBottomTarget);
		}
		this._deleteMessageRegistrationID = libWrapperShared.register('foundry.applications.sidebar.tabs.ChatLog.prototype.deleteMessage', this._ChatLog_deleteMessage);
	}
	private static unregister() {
		const postOneTarget = 'foundry.applications.sidebar.tabs.ChatLog.prototype.postOne';
		const scrollBottomTarget = 'foundry.applications.sidebar.tabs.ChatLog.prototype.scrollBottom';
		if (this._registeredWrapperTargets.has(postOneTarget)) {
			libWrapper.unregister(SETTINGS.MOD_NAME, postOneTarget, false);
			this._registeredWrapperTargets.delete(postOneTarget);
		}
		if (this._registeredWrapperTargets.has(scrollBottomTarget)) {
			libWrapper.unregister(SETTINGS.MOD_NAME, scrollBottomTarget, false);
			this._registeredWrapperTargets.delete(scrollBottomTarget);
		}
		libWrapperShared.unregister('foundry.applications.sidebar.tabs.ChatLog.prototype.deleteMessage', this._deleteMessageRegistrationID);
	}

	private static _renderChatLog(app: ChatLogExt, html: JQuery<HTMLElement> | HTMLElement) {
		const $html = UTIL.asJQuery(html);
		app._scrollToBottomButton = $(`<div id="scrollToBottom" style="display:none">
	<span>${'DF_CHAT_SCROLL.NewMessage'.localize()}</span> ${'DF_CHAT_SCROLL.ScrollButton'.localize()}
</div>`);
		app._scrollToBottomButton.on('click', () => {
			const el = app.element;
			const log = el.length ? el[0].querySelector("#chat-log") : null;
			if (log) {
				log.scrollTo({ behavior: "smooth", top: log.scrollHeight });
			}
		});
		$html.find('div#chat-controls').before(app._scrollToBottomButton);

		$html.find('ol#chat-log').on('scroll', (event) => {
			if (!app._scrollToBottomButton) return;
			const element = <HTMLOListElement>event.currentTarget;
			// Ignore events when the scroll height is too small to matter
			if (element.clientHeight > element.scrollHeight - this.ScrollThreshold) return;
			if (element.scrollTop < (element.scrollHeight - element.clientHeight) - this.ScrollThreshold)
				app._scrollToBottomButton.show();
			else {
				app._scrollToBottomButton.hide();
				app._scrollToBottomButton.removeClass('new');
			}
		});
	}

	private static _ChatLog_scrollBottom(this: ChatLogExt) {
		const el = this.element;
		const log = el && el.length ? el[0].querySelector('#chat-log') : null;
		if (!log) return;
		if (!this._scrollToBottomButton) return;
		// If we are already at the bottom, perform the scroll
		if (this._scrollToBottomButton.is(':hidden'))
			setTimeout(() => {
				const activeLog = this.element?.[0]?.querySelector('#chat-log');
				if (activeLog) activeLog.scrollTo({ behavior: 'smooth', top: activeLog.scrollHeight });
			}, 100);
		// Otherwise do not scroll, but do trigger a scroll event.
		// Some modules might use this function after manually adding message content to the ChatLog
		else $('#chat #chat-log').trigger('scroll');
	}

	private static async _ChatLog_postOne(this: ChatLogExt, message: ChatMessageData & ChatMessage, notify = false) {
		if (!message.visible) return;

		// Track internal flags
		if (!this._lastId) this._lastId = message.id; // Ensure that new messages don't result in batched scrolling
		if ((message.whisper || []).includes(game.user.id) && !message.isRoll) {
			this._lastWhisper = message;
		}

		// Render the message to the log
		const root = this.element && typeof (this.element as any).find === 'function' ? this.element : $(this.element ?? document);
		const log = (root as any).find ? (root as any).find('#chat-log').get(0) : (root as any)[0]?.querySelector('#chat-log') ?? null;
		if (!log) return;
		const chatLog = $(log);
		const atBottom = log.scrollTop >= ((log.scrollHeight - log.clientHeight) - ScrollManage.ScrollThreshold);
		const html = await (<any>message).getHTML();
		chatLog.append(html);
		if (atBottom || (ScrollManage.scrollToBottomIfYouSendMessage && message.isAuthor))
			log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
		// this.scrollBottom();
		else if (this._scrollToBottomButton) {
			this._scrollToBottomButton.addClass('new');
		}

		// Post notification
		if (notify) this.notify(message);

		// Update popout tab
		if (this._popout) await (<any>this._popout).postOne(message, false);
		if (this.popOut) this.setPosition();
	}

	private static _ChatLog_deleteMessage(this: ChatLogExt, wrapped: (...args: any) => unknown, messageId: string, { deleteAll = false }: { deleteAll?: boolean } = {}): unknown {
		const result = wrapped(messageId, { deleteAll });
		// Ignore singular message deletions, only react to a Delete All event.
		// Also ignore the deletion if the scroll-to-bottom element is already hidden
		if (!deleteAll || this._scrollToBottomButton.is(':hidden')) return result;
		this._scrollToBottomButton.hide();
		this._scrollToBottomButton.removeClass('new');
		return result;
	}
}