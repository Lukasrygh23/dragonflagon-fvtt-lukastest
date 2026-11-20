import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const settingsURL = new URL('../../common/Settings.mjs', import.meta.url).href;
const archivePath = new URL('../src/archive/DFChatArchive.mjs', import.meta.url);
const formPath = new URL('../src/archive/DFChatArchiveNew.mjs', import.meta.url);
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

class ApplicationV2 {
	static DEFAULT_OPTIONS = { id: 'foundry-default' };
	async close() { this.closed = true; }
}

const trace = [];
const values = new Map();
let uploadResponse;

globalThis.File = File;
globalThis.foundry = {
	applications: {
		api: { ApplicationV2, HandlebarsApplicationMixin: base => base },
		apps: { FilePicker: { implementation: {
			upload: async (_source, _folder, file) => {
				trace.push('upload');
				trace.push(JSON.parse(await file.text()));
				return uploadResponse;
			}
		} } }
	},
	utils: { mergeObject: (original, other) => Object.assign(original, other) }
};
globalThis.game = {
	modules: new Map(),
	settings: {
		get: (_namespace, key) => values.get(key),
		set: async (_namespace, key, value) => {
			trace.push(`setting:${key}`);
			values.set(key, value);
			return value;
		}
	},
	i18n: { localize: key => key }
};
globalThis.ui = {
	chat: { collection: { contents: [{
		timestamp: 1,
		toObject: () => ({ _id: 'abcdefghijklmnop' })
	}] } },
	notifications: {
		info: message => trace.push(`info:${message}`),
		warn: message => trace.push(`warn:${message}`),
		error: message => trace.push(`error:${message}`)
	}
};

const { default: SETTINGS } = await import(settingsURL);
SETTINGS.init('df-chat-enhance-lukas');
const archiveSource = (await readFile(archivePath, 'utf8'))
	.replace('"../../common/Settings.mjs"', JSON.stringify(settingsURL));
const formSource = (await readFile(formPath, 'utf8'))
	.replace('"./DFChatArchive.mjs"', JSON.stringify(moduleURL(archiveSource)))
	.replace('"../../common/Settings.mjs"', JSON.stringify(settingsURL));
const { default: ArchiveNew } = await import(moduleURL(formSource));

function reset(response) {
	trace.length = 0;
	values.clear();
	values.set('currentId', 0);
	values.set('logs', []);
	values.set('archiveFolder', 'worlds/test/chat-archive');
	values.set('archiveFolderSource', 'data');
	values.set('new-should-delete', false);
	uploadResponse = response;
	game.messages = {
		flush: () => { throw new Error('Deletion must not run'); },
		documentClass: { deleteDocuments: () => { throw new Error('Deletion must not run'); } }
	};
}

test('save form uploads and indexes an archive without deleting messages', async () => {
	reset({ path: 'worlds/test/chat-archive/1_Test.json' });
	const app = new ArchiveNew();
	const form = ArchiveNew.PARTS.form.forms['form.archive-new'];

	assert.equal(ApplicationV2.DEFAULT_OPTIONS.id, 'foundry-default');
	await form.handler.call(app, {}, {}, { object: {
		name: 'Test', visible: false, delete: false, 'date-or-all': 'all'
	} });

	assert.deepEqual(trace.slice(0, 4), [
		'setting:currentId',
		'upload',
		[{ _id: 'DFCAefghijklmnop', originalID: 'abcdefghijklmnop' }],
		'setting:logs'
	]);
	assert.equal(values.get('logs')[0].filepath, 'worlds/test/chat-archive/1_Test.json');
	assert.equal(app.closed, true);
	assert.ok(trace.some(entry => typeof entry === 'string' && entry.startsWith('info:')));
});

test('failed upload leaves the form open without indexing or deleting', async () => {
	reset(false);
	const app = new ArchiveNew();
	const form = ArchiveNew.PARTS.form.forms['form.archive-new'];
	const originalError = console.error;
	console.error = () => {};
	try {
		await form.handler.call(app, {}, {}, { object: {
			name: 'Test', visible: false, delete: false, 'date-or-all': 'all'
		} });
	} finally {
		console.error = originalError;
	}

	assert.equal(app.closed, undefined);
	assert.deepEqual(values.get('logs'), []);
	assert.ok(trace.some(entry => typeof entry === 'string' && entry.startsWith('error:')));
	assert.ok(!trace.includes('setting:logs'));
});
