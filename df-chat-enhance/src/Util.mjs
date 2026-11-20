export default class UTIL {
	static async requestReload() {
		if (await foundry.applications.api.DialogV2.confirm({
			window: { title: game.i18n.localize("DF_CHAT_ENHANCE.ReloadGameTitle") },
			content: game.i18n.localize("DF_CHAT_ENHANCE.ReloadGameContent"),
			modal: true
		})) {
			window.location.reload();
		}
	}

	static reloadChatLog() {
		ui.chat.render({ force: true });
	}
}