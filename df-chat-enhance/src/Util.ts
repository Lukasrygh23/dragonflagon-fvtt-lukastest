export default class UTIL {
	static asJQuery<T extends HTMLElement = HTMLElement>(html: JQuery<T> | T | null | undefined): JQuery<T> {
		if (!html) return $() as JQuery<T>;
		if (typeof (html as any).find === 'function') return html as JQuery<T>;
		return $(html) as JQuery<T>;
	}

	static async requestReload() {
		if (await Dialog.confirm({
			title: "DF_CHAT_ENHANCE.ReloadGameTitle".localize(),
			content: "DF_CHAT_ENHANCE.ReloadGameContent".localize(),
			defaultYes: true
		})) {
			window.location.reload();
		}
	}

	static reloadChatLog() {
		if (!ui.chat) return;
		// Foundry v13 keeps the internal render state on ChatLog, but the exact value
		// is protected behind Application.RENDER_STATES in newer versions.
		// @ts-expect-error - internal reset for the chat log cache state.
		ui.chat._lastId = null;
		// @ts-expect-error - internal state property is intentionally accessed for refreshes.
		ui.chat._state = Application.RENDER_STATES?.NONE ?? 0;
		ui.chat.render(true);
	}
}