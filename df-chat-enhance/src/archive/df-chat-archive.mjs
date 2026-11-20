/// <reference path="../../../fvtt-scripts/foundry.js" />
import DFChatArchiveNew from "./DFChatArchiveNew.mjs";
import DFChatArchiveManager from "./DFChatArchiveManager.mjs";
import { DFChatArchive } from "./DFChatArchive.mjs";
import SETTINGS from "../../common/Settings.mjs";


export function init() {
	DFChatArchive.registerSettings();
	DFChatArchiveNew.registerSettings();
	SETTINGS.registerMenu('archiveNewMenu', {
		name: 'DF_CHAT_ARCHIVE.ExportButtonTitle',
		label: 'DF_CHAT_ARCHIVE.ArchiveNew_Submit',
		hint: 'DF_CHAT_ARCHIVE.ArchiveNew_Title',
		icon: 'fas fa-archive',
		restricted: false,
		type: DFChatArchiveNew
	});
	SETTINGS.registerMenu(DFChatArchiveManager.PREF_MENU, {
		name: 'DF_CHAT_ARCHIVE.OpenChatArchive',
		label: 'DF_CHAT_ARCHIVE.OpenChatArchive',
		hint: 'DF_CHAT_ARCHIVE.ArchiveManager_Title',
		icon: 'fas fa-archive',
		restricted: false,
		type: DFChatArchiveManager
	});

	SETTINGS.register(DFChatArchiveNew.PREF_HIDE_EXPORT, {
		name: 'DF_CHAT_ARCHIVE.Settings.HideExport',
		scope: 'world',
		type: Boolean,
		default: false,
		config: true,
		onChange: (newValue) => {
			for (const button of document.querySelectorAll('.export-log, [data-action="export"]'))
				button.style.setProperty('display', newValue ? 'none' : '');
		}
	});

	SETTINGS.register(DFChatArchiveManager.PREF_REVERSE_SORT, {
		scope: 'client',
		type: Boolean,
		default: false,
		config: false
	});

	Hooks.on('renderChatLog', (_application, html) => {
		const root = html instanceof HTMLElement ? html : html?.[0];
		if (!root) return;
		const hideExport = SETTINGS.get(DFChatArchiveNew.PREF_HIDE_EXPORT);
		for (const button of root.querySelectorAll('.export-log, [data-action="export"]'))
			button.style.setProperty('display', hideExport ? 'none' : '');
	});

	Hooks.on(`renderDFChatArchiveNew`, function (app, html) {
		const root = html instanceof HTMLElement ? html : html?.[0];
		root?.querySelector('input[type="text"]')?.focus();
	});
}
