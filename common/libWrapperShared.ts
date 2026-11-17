import SETTINGS from "./Settings";

type Wrapper = (...args: any) => unknown;
type Handler = (wrapped: Wrapper, ...args: any) => unknown;

class Registration {
	nextId = 0;
	wrappers = new Map<number, Handler>();

	handler(context: any, wrapped: Wrapper, ...args: any): Promise<unknown> | unknown {
		let current = wrapped;
		for (const wrapper of this.wrappers.values()) {
			const next = current;
			current = (...args: any) => wrapper.call(context, next, ...args);
		}
		return current.call(context, ...args);
	}
}

const LEGACY_GLOBAL_ALIASES: Record<string, string> = {
	ChatLog: 'foundry.applications.sidebar.tabs.ChatLog',
	UserConfig: 'foundry.applications.sheets.UserConfig',
	Sidebar: 'foundry.applications.sidebar.Sidebar',
	SceneDirectory: 'foundry.applications.sidebar.tabs.SceneDirectory'
};

export default class libWrapperShared {
	private static registrations = new Map<string, Registration>();

	private static resolveTarget(target: string): unknown {
		const mappedTarget = target.replace(/^(\w+)(?=\.prototype\.)/, (match) => LEGACY_GLOBAL_ALIASES[match] ?? match);
		let current: any = globalThis.foundry ?? globalThis;
		for (const segment of mappedTarget.split('.')) {
			if (segment === 'prototype') {
				current = current?.prototype;
				continue;
			}
			current = current?.[segment];
		}
		return current;
	}

	static register(target: string, handler: Handler) {
		if (this.resolveTarget(target) === undefined) {
			console.warn(`[${SETTINGS.MOD_NAME}] Skipping wrapper registration for missing target: ${target}`);
			return -1;
		}
		let registration = this.registrations.get(target);
		if (!registration) {
			registration = new Registration();
			libWrapper.register(SETTINGS.MOD_NAME, target,
				function (this: any, wrapped: Wrapper, ...args: any) { return registration.handler(this, wrapped, ...args); }, 'WRAPPER');
			this.registrations.set(target, registration);
		}
		const id = registration.nextId++;
		registration.wrappers.set(id, handler);
		return id;
	}

	static unregister(target: string, id: number): boolean {
		const registration = this.registrations.get(target);
		if (!registration) return false;
		registration.wrappers.delete(id);
		if (registration.wrappers.size === 0) {
			libWrapper.unregister(SETTINGS.MOD_NAME, target, false);
			this.registrations.delete(target);
		}
		return true;
	}
}