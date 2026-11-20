/// <reference path="../../fvtt-scripts/foundry.js" />
/// <reference path="./types.d.ts" />

import * as DFChatArchive from "./archive/df-chat-archive.mjs";
import DFChatEdit from "./edit/df-chat-edit.mjs";
import * as DFAdventureLog from "./logger/df-adventure-log.mjs";
import DFAdventureLogProcessor from "./logger/DFAdventureLogProcessor.mjs";
import ChatMerge from "./merge/chat-merge.mjs";
import ChatRollPrivacy from "./privacy/df-chat-privacy.mjs";
import ScrollManage from "./scroll-manage/scroll-manage.mjs";
import SETTINGS from "../common/Settings.mjs";
import WhisperTruncation from "./whisper-trunc/whisper-trunc.mjs";
import PlayerColor from './player-color/PlayerColor.mjs';
import SendButton from "./send/send-button.mjs";
import FontSizePatch from "./font-size/font-size.mjs";
import ChatTime from "./chat-time/chat-time.mjs";
SETTINGS.init('df-chat-enhance-lukas');

function runFeaturePhase(phase, name, callback) {
	try {
		callback();
	} catch (error) {
		console.error(`[${SETTINGS.MOD_NAME}] ${name} ${phase} failed`, error);
	}
}

Hooks.once('setup', function () {
	runFeaturePhase('setup', 'Chat privacy', () => ChatRollPrivacy.setup());
});

Hooks.once('init', function () {
	/**
	 * Order here matters! The archive adds a button to the
	 * chat window, while the privacy changes those buttons
	 * from <a> tags to <button> tags if enabled.
	 */
	runFeaturePhase('init', 'Chat archives', () => DFChatArchive.init());
	runFeaturePhase('init', 'Chat privacy', () => ChatRollPrivacy.init());
	runFeaturePhase('init', 'Adventure Log', () => DFAdventureLog.init());
	runFeaturePhase('init', 'Chat Merge', () => ChatMerge.init());
	runFeaturePhase('init', 'Scroll management', () => ScrollManage.init());
	runFeaturePhase('init', 'Whisper truncation', () => WhisperTruncation.init());
	runFeaturePhase('init', 'Player colors', () => PlayerColor.init());
	runFeaturePhase('init', 'Send button', () => SendButton.init());
	runFeaturePhase('init', 'Font size', () => FontSizePatch.init());
	runFeaturePhase('init', 'Chat time', () => ChatTime.init());

	const chatLog = foundry.applications.sidebar.tabs.ChatLog;
	if (typeof chatLog?.prototype?._getEntryContextOptions === 'function') runFeaturePhase('init', 'Chat context menu', () => libWrapper.register(SETTINGS.MOD_NAME, 'foundry.applications.sidebar.tabs.ChatLog.prototype._getEntryContextOptions',
		/**
		 * @param {(...args: any) => ContextMenuEntry[]} wrapped
		 * @param  {...any} args
		 * @returns {ContextMenuEntry[]}
		 */
		function (wrapped, ...args) {
			const options = wrapped(...args);
			DFChatEdit.appendChatContextMenuOptions(options);
			DFAdventureLogProcessor.appendChatContextMenuOptions(options);
			return options;
		}, 'WRAPPER'));
});

Hooks.once('ready', function () {
	if (!game.modules.get('lib-wrapper')?.active) {
		console.error('Missing libWrapper module dependency');
		if (game.user.isGM)
			ui.notifications.error('DF_CHAT_LOG.Error.LibWrapperMissing'.localize());
	}
	runFeaturePhase('ready', 'Adventure Log', () => DFAdventureLog.ready());
	runFeaturePhase('ready', 'Chat edit', () => DFChatEdit.ready());
	runFeaturePhase('ready', 'Chat Merge', () => ChatMerge.ready());
	runFeaturePhase('ready', 'Scroll management', () => ScrollManage.ready());
	runFeaturePhase('ready', 'Chat time', () => ChatTime.ready());
});
