declare global {
	interface LenientGlobalVariableTypes {
		game: never;
		canvas: never;
	}
	interface String {
		/** Localizes the string via the global `game.i18n.localize()` function. */
		localize(): string
	}
	type AnyFunction = (...args: any) => any;
}

export default class SETTINGS {
	static MOD_NAME: string;
	static readonly SHARED_ALIASES: Record<string, string> = {
		'df-chat-enhance-lukas': 'df-chat-enhance'
	};
	static init(moduleName: string) {
		this.MOD_NAME = moduleName;
		if (!String.prototype.localize) {
			String.prototype.localize = function () {
				return game.i18n.localize(this.valueOf());
			};
		}
	}
	static getEffectiveModuleName(moduleName: string = SETTINGS.MOD_NAME): string {
		if (moduleName == null) return moduleName;

		const alias = this.SHARED_ALIASES[moduleName];
		if (alias && game.modules?.get(alias)?.active) {
			return alias;
		}

		const canonical = ['df-chat-enhance', 'df-chat-enhance-lukas'];
		const sharedOwner = canonical.find(name => name !== moduleName && game.modules?.get(name)?.active);
		if (sharedOwner) return sharedOwner;

		return moduleName;
	}
	static register<T>(key: string, config: ClientSettings.PartialSettingConfig<T>, moduleName: string = SETTINGS.MOD_NAME) {
		if (!game.settings.settings.has(`${moduleName}.${key}`)) {
			game.settings.register(moduleName, key, config);
		}
	}
	static registerMenu(key: string, config: ClientSettings.PartialSettingSubmenuConfig, moduleName: string = SETTINGS.MOD_NAME) {
		if (!game.settings.menus.has(`${moduleName}.${key}`)) {
			game.settings.registerMenu(moduleName, key, config);
		}
	}
	static isRegistered(key: string, moduleName: string = SETTINGS.MOD_NAME): boolean {
		const targets = [this.getEffectiveModuleName(moduleName), moduleName, this.SHARED_ALIASES[moduleName], 'df-chat-enhance', 'df-chat-enhance-lukas']
			.filter((target, index, values): target is string => !!target && values.indexOf(target) === index);
		return targets.some(target => game.settings.settings.has(`${target}.${key}`));
	}
	static get<T>(key: string, moduleName: string = SETTINGS.MOD_NAME): T {
		const targets = [this.getEffectiveModuleName(moduleName), moduleName, this.SHARED_ALIASES[moduleName], 'df-chat-enhance', 'df-chat-enhance-lukas']
			.filter((target, index, values): target is string => !!target && values.indexOf(target) === index);
		for (const target of targets) {
			try {
				if (game.settings.settings.has(`${target}.${key}`)) return <T>game.settings.get(target, key);
			} catch (_error) {
				// Continue instead of aborting Foundry hooks when an alias is missing.
			}
		}
		return undefined as T;
	}
	static async set<T>(key: string, value: T, moduleName: string = SETTINGS.MOD_NAME): Promise<T> { return await game.settings.set(this.getEffectiveModuleName(moduleName), key, value); }
	static default<T>(key: string, moduleName: string = SETTINGS.MOD_NAME): T { return <T>game.settings.settings.get(this.getEffectiveModuleName(moduleName) + '.' + key).default; }
	/** helper for referencing a Typed constructor for the `type` field of a setting { type: SETTINGS.typeOf<MyClass>() } */
	static typeOf<T>(): ConstructorOf<T> { return Object as any; }
}
