import DFChatArchiveNew from "./DFChatArchiveNew";
import DFChatArchiveManager from "./DFChatArchiveManager";
import { DFChatArchive } from "./DFChatArchive";
import SETTINGS from "../../../common/Settings";
import UTIL from "../Util";


export function init() {

	let archiveNew: DFChatArchiveNew = null;
	let archiveManager: DFChatArchiveManager = null;

	const getSettingsTarget = ($html: JQuery<HTMLElement>) => {
		const selectors = [
			'#settings-game',
			'[data-tab="game"]',
			'[data-category="game"]',
			'.settings-list',
			'.settings-tab',
			'.settings-body',
			'.tab[data-tab="game"]',
		];
		for (const selector of selectors) {
			const target = $html.find(selector).first();
			if (target.length) return target;
		}
		return $html;
	};

	DFChatArchive.registerSettings();
	DFChatArchiveNew.registerSettings();

	SETTINGS.register(DFChatArchiveNew.PREF_HIDE_EXPORT, {
		name: 'DF_CHAT_ARCHIVE.Settings.HideExport',
		scope: 'world',
		type: Boolean,
		default: false,
		config: true,
		onChange: (newValue) => {
			if (!newValue)
				$('#chat-controls .export-log').show();
			else
				$('#chat-controls .export-log').hide();
		}
	});

	SETTINGS.register(DFChatArchiveManager.PREF_REVERSE_SORT, {
		scope: 'world',
		type: Boolean,
		default: false,
		config: false
	});

	Hooks.on('renderChatLog', function (chatLog: ChatLog, html: JQuery<HTMLElement> | HTMLElement) {
		const $html = UTIL.asJQuery(html);
		const archiveButton = $(`<a class="button chat-archive" title="${'DF_CHAT_ARCHIVE.ExportButtonTitle'.localize()}">
		<i class="fas fa-archive"></i></a>`);
		archiveButton.on('click', () => {
			if (archiveNew == null) {
				archiveNew = new DFChatArchiveNew({});
				archiveNew.render(true);
			} else {
				const app = archiveNew as any;
				if (typeof app.bringToFront === 'function') app.bringToFront();
				else app.bringToTop?.();
			}
		});
		$html.find('.control-buttons')
			.prepend(archiveButton)
			.attr('style', 'flex:0 0 auto;');
		if (SETTINGS.get(DFChatArchiveNew.PREF_HIDE_EXPORT)) {
			$html.find('.control-buttons .export-log').hide();
		}
	});

	const addArchiveManagerButton = (settings: Settings | SettingsConfig, html: JQuery<HTMLElement> | HTMLElement) => {
		const $html = UTIL.asJQuery(html);
		const archiveManagerHtml = $(`<div id="df-chat-enhance-settings" style="margin:0">
	<h4>${'DF_CHAT_ARCHIVE.ChatEnhanceSettingGroup'.localize()}</h4>
	<button data-action="archive"><i class="fas fa-archive"></i>${'DF_CHAT_ARCHIVE.OpenChatArchive'.localize()}</button>
</div>`);
		archiveManagerHtml.on('click', () => {
			const renderStates = (Application as any)?.RENDER_STATES;
			const state = (<any>archiveManager)?._state ?? (<any>archiveManager)?.state ?? 0;
			const isRendered = !renderStates
				? ['rendered', 'rendering', 1, 2].includes(state)
				: [renderStates.RENDERED, renderStates.RENDERING].includes(state);
			if (archiveManager == null || !isRendered) {
				archiveManager = new DFChatArchiveManager();
				archiveManager.render(true);
			} else {
				const app = archiveManager as any;
				if (typeof app.bringToFront === 'function') app.bringToFront();
				else app.bringToTop?.();
			}
		});
		const target = getSettingsTarget($html);
		target.append(archiveManagerHtml);
	};

	Hooks.on('renderSettings', function (settings: Settings, html: JQuery<HTMLElement> | HTMLElement) {
		addArchiveManagerButton(settings, html);
	});
	Hooks.on('renderSettingsConfig', function (settings: SettingsConfig, html: JQuery<HTMLElement> | HTMLElement) {
		addArchiveManagerButton(settings, html);
	});
	Hooks.on('closeDFChatArchiveNew', () => { archiveNew = null; });
	Hooks.on('closeDFChatArchiveManager', () => { archiveManager = null; });
	Hooks.on(`renderDFChatArchiveNew`, function (app: any, html: JQuery | HTMLElement) {
		const $html = UTIL.asJQuery(html);
		$html.find('input[type="text"]')[0]?.focus();
	});
}
