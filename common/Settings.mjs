/**
 * @typedef {object} SettingSubmenuConfig
 * @property {string} 				name		Primary text displayed as a labal for the input
 * @property {string} 				hint		Hint text displayed as a sublabel
 * @property {string} 				label		The text label used in the button
 * @property {string} 				icon		A Font Awesome icon used in the submenu button
 * @property {FormApplicationClass}	type		A FormApplication subclass which should be created
 * @property {boolean}				restricted	Restrict this submenu to gamemaster only?
 */

/**
 * @template Type
 * @typedef SettingsConfig
 * @property {string} 						name			Primary text displayed as a labal for the input
 * @property {string} 						hint			Hint text displayed as a sublabel
 * @property {"world" | "client"}			scope			This specifies a client-stored setting
 * @property {boolean}						config			This specifies that the setting appears in the configuration view
 * @property {() => Type}					type			The type constructor for the setting (ie: Boolean, String, Number, MyClass)
 * @property {boolean}						requiresReload 	This will prompt the GM to have all clients reload the application for the setting to take effect.
 * @property {Type}							default			The default value for the setting
 * @property { {[key: string]: string } }	choices			If choices are defined, the resulting setting will be a select menu. The {@link type} should be `String`
 * @property {(newValue: Type) => void}		onChange		A callback function which triggers when the setting is changed
 */

export default class SETTINGS {
	static MOD_NAME;
	static SHARED_ALIASES = {
		'df-chat-enhance-lukas': 'df-chat-enhance'
	};
	/** @param {string} moduleName */
	static init(moduleName) {
		this.MOD_NAME = moduleName;
		if (!String.prototype.localize) {
			String.prototype.localize = function () {
				return game.i18n.localize(this.valueOf());
			};
		}
	}
	/**
	 * @param {string} key
	 * @param {SettingsConfig<*>} config
	 */
	static getEffectiveModuleName(moduleName = SETTINGS.MOD_NAME) {
		const alias = this.SHARED_ALIASES[moduleName];
		return alias && game.modules?.get(alias)?.active ? alias : moduleName;
	}
	static register(key, config, moduleName = SETTINGS.MOD_NAME) {
		const owner = this.getEffectiveModuleName(moduleName);
		if (owner !== moduleName || game.settings.settings.has(`${owner}.${key}`)) return;
		game.settings.register(owner, key, config);
	}
	/**
	 * @param {string} key
	 * @param {SettingSubmenuConfig} config
	 */
	static registerMenu(key, config, moduleName = SETTINGS.MOD_NAME) {
		const owner = this.getEffectiveModuleName(moduleName);
		if (owner !== moduleName || game.settings.menus.has(`${owner}.${key}`)) return;
		game.settings.registerMenu(owner, key, config);
	}
	/**
	 * @param {string} key
	 * @returns {any}
	 */
	static get(key, moduleName = SETTINGS.MOD_NAME) { return game.settings.get(this.getEffectiveModuleName(moduleName), key); }
	/**
	 * @param {string} key
	 * @param {any} value
	 * @returns {Promise<any>}
	 */
	static async set(key, value, moduleName = SETTINGS.MOD_NAME) { return await game.settings.set(this.getEffectiveModuleName(moduleName), key, value); }
	/**
	 * @param {string} key
	 * @returns {any}
	 */
	static default(key, moduleName = SETTINGS.MOD_NAME) { return game.settings.settings.get(`${this.getEffectiveModuleName(moduleName)}.${key}`).default; }
}