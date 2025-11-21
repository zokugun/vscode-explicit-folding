import { type ExplicitFoldingConfig, type ExplicitFoldingHub } from '@zokugun/vscode.explicit-folding-api';
import vscode, { type OutputChannel } from 'vscode';
import pkg from '../package.json';
import { nudge } from './commands/nudge.js';
import { FoldingHub } from './folding-hub.js';
import { FoldingProvider } from './folding-provider.js';
import { RouteProvider } from './route-provider.js';
import { Disposable } from './utils/disposable.js';
import { hasValue } from './utils/has-value.js';
import { EXTENSION_ID, getContext, getDebugChannel, setupSettings } from './utils/settings.js';

const CONFIG_KEY = 'explicitFolding';
const VERSION_KEY = 'explicitFoldingVersion';

const SCHEMES = ['file', 'untitled', 'vscode-userdata'];

const $disposable: Disposable = new Disposable();
const $documents: vscode.TextDocument[] = [];
const $hub = new FoldingHub(setupProviders);

let $rules: Record<string, ExplicitFoldingConfig[]> = {};
let $useWildcard: Boolean = false;

class MainProvider implements vscode.FoldingRangeProvider {
	private providers: Record<string, boolean> = {};

	provideFoldingRanges(document: vscode.TextDocument): vscode.ProviderResult<vscode.FoldingRange[]> { // {{{
		if(!this.providers[document.languageId]) {
			this.providers[document.languageId] = true;

			const config = vscode.workspace.getConfiguration(CONFIG_KEY, document);
			const delay = getDelay(config);

			if(delay > 0) {
				setTimeout(() => {
					this.setup(document);
				}, delay);
			}
			else {
				this.setup(document);
			}
		}

		return [];
	} // }}}

	setup(document: vscode.TextDocument) { // {{{
		const language = document.languageId;

		const config = vscode.workspace.getConfiguration(CONFIG_KEY, document);
		const additionalSchemes = config.get<string[]>('additionalSchemes') ?? [];

		const mainProvider = buildProvider(language, config);

		const perFiles = config.get<Record<string, ExplicitFoldingConfig[] | ExplicitFoldingConfig | undefined> | undefined>('perFiles');
		const provider = hasValue(perFiles) ? buildRouter(perFiles!, mainProvider, config) : mainProvider;

		for(const scheme of [...SCHEMES, ...additionalSchemes]) {
			const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

			$disposable.push(disposable);
		}

		foldDocument(document);
	} // }}}
}

function applyDependency(dependency: { language: string; index: number }, language: string, done: string[], dependencies: Record<string, Array<{ language: string; index: number }>>, channel: OutputChannel | undefined) { // {{{
	if(!$rules[dependency.language]) {
		channel ??= getDebugChannel(true);

		channel.appendLine(`[init] the language '${language}' is using the undefined group: '${dependency.language}'`);

		return;
	}

	if(!done.includes(dependency.language)) {
		done.push(dependency.language);

		if(dependencies[dependency.language]) {
			for(const d of dependencies[dependency.language]) {
				applyDependency(d, dependency.language, done, dependencies, channel);
			}
		}
	}

	$rules[language].splice(dependency.index, 0, ...$rules[dependency.language].map((rule) => ({ ...rule, name: `${dependency.language}${rule.name?.length ? `, ${rule.name}` : ''}` })));
} // }}}

function applyRules(data: ExplicitFoldingConfig | ExplicitFoldingConfig[] | undefined, rules: ExplicitFoldingConfig[]): void { // {{{
	if(Array.isArray(data)) {
		rules.push(...data);
	}
	else if(data) {
		rules.push(data);
	}
} // }}}

function buildDependencies(language: string, newRules: ExplicitFoldingConfig[], rules: ExplicitFoldingConfig[], dependencies: Record<string, Array<{ language: string; index: number }>>): ExplicitFoldingConfig[] { // {{{
	for(const rule of newRules) {
		const depends = rule.include;

		if(Array.isArray(depends)) {
			dependencies[language] ??= [];

			for(const dependency of depends) {
				if(!dependencies[language].some(({ language }) => language === dependency)) {
					dependencies[language].push({ language: dependency, index: rules.length });
				}
			}
		}
		else if(typeof depends === 'string') {
			dependencies[language] ??= [];

			if(!dependencies[language].some(({ language }) => language === depends)) {
				dependencies[language].push({ language: depends, index: rules.length });
			}
		}
		else {
			rules.push(rule);
		}
	}

	return rules;
} // }}}

function buildProvider(language: string, config: vscode.WorkspaceConfiguration): FoldingProvider { // {{{
	const debug = config.get<boolean>('debug') ?? false;
	const channel = getDebugChannel(debug);

	return new FoldingProvider($rules[language], channel, $documents);
} // }}}

function buildRouter(perFiles: Record<string, ExplicitFoldingConfig[] | ExplicitFoldingConfig | undefined>, mainProvider: FoldingProvider, config: vscode.WorkspaceConfiguration): RouteProvider { // {{{
	const debug = config.get<boolean>('debug') ?? false;
	const channel = getDebugChannel(debug);

	return new RouteProvider(perFiles, mainProvider, channel, $documents, $rules);
} // }}}

async function buildRules() { // {{{
	$rules = {};

	const languages = await vscode.languages.getLanguages();
	const config = vscode.workspace.getConfiguration(CONFIG_KEY, null);
	const debug = config.get<boolean>('debug') ?? false;
	const channel = getDebugChannel(debug);
	const dependencies: Record<string, Array<{ language: string; index: number }>> = {};

	const globalRules = config.get<Record<string, ExplicitFoldingConfig | ExplicitFoldingConfig[]>>('rules') ?? {};

	for(const key in globalRules) {
		if(key.includes(',')) {
			for(const language of key.split(/\s*,\s*/)) {
				if(!$rules[language]) {
					if(Array.isArray(globalRules[language])) {
						$rules[language] = globalRules[language];
					}
					else if(globalRules[language]) {
						$rules[language] = [globalRules[language]];
					}
					else {
						$rules[language] = [];
					}
				}

				applyRules(globalRules[key], $rules[language]);
			}
		}
		else if(Array.isArray(globalRules[key])) {
			$rules[key] = globalRules[key];
		}
		else {
			$rules[key] = [globalRules[key]];
		}
	}

	$useWildcard = Boolean(globalRules['*']);

	for(const language of Object.keys($rules).filter((lang) => !languages.includes(lang))) {
		$rules[language] = buildDependencies(language, $rules[language], [], dependencies);
	}

	for(const language of languages) {
		const rules: ExplicitFoldingConfig[] = [];

		const hubRules = $hub.getRules(language);

		if(hubRules) {
			channel?.appendLine(`[register] use external rules for language: ${language}`);

			applyRules(hubRules, rules);
		}
		else {
			$rules[language] ??= [];

			if($useWildcard) {
				applyRules(globalRules['*'], $rules[language]);
			}

			const langRules = vscode.workspace.getConfiguration(CONFIG_KEY, { languageId: language }).get<ExplicitFoldingConfig[]>('rules');

			applyRules(langRules, $rules[language]);

			buildDependencies(language, $rules[language], rules, dependencies);
		}

		$rules[language] = rules;
	}

	const done: string[] = [];

	for(const [language, depends] of Object.entries(dependencies)) {
		done.push(language);

		for(const dependency of depends.reverse()) {
			applyDependency(dependency, language, done, dependencies, channel);
		}
	}
} // }}}

function foldDocument(document: vscode.TextDocument) { // {{{
	const config = vscode.workspace.getConfiguration(CONFIG_KEY, document);
	const autoFold = config.get<string>('autoFold') ?? 'none';

	if(autoFold === 'all') {
		void vscode.commands.executeCommand('editor.foldAll');
	}
	else if(autoFold === 'comments') {
		void vscode.commands.executeCommand('editor.foldAllBlockComments');
	}
	else if(autoFold !== 'none') {
		try {
			const level = Number.parseInt(autoFold, 10);

			void vscode.commands.executeCommand('editor.unfoldAll');

			for(let i = 7; i >= level; --i) {
				void vscode.commands.executeCommand(`editor.foldLevel${i}`);
			}
		}
		catch {
		}
	}

	if(!$documents.includes(document)) {
		$documents.push(document);
	}
} // }}}

function getDelay(config: vscode.WorkspaceConfiguration): number { // {{{
	return config.get<number>('delay') ?? 0;
} // }}}

async function setupProviders() { // {{{
	$disposable.dispose();

	await buildRules();

	const defaultProvider = vscode.workspace.getConfiguration('editor').get<string>('defaultFoldingRangeProvider') ?? '';

	if(defaultProvider === EXTENSION_ID) {
		setupProvidersWithoutProxy();
	}
	else {
		setupProvidersWithProxy();
	}
} // }}}

function setupProvidersWithProxy(): void { // {{{
	const provider = new MainProvider();

	if($useWildcard) {
		const config = vscode.workspace.getConfiguration(CONFIG_KEY, null);
		const wildcardExclusions = Array.isArray(config.wildcardExclusions) ? config.wildcardExclusions : [];

		if(wildcardExclusions.length > 0) {
			for(const language in $rules) {
				if(!wildcardExclusions.includes(language)) {
					for(const scheme of SCHEMES) {
						const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

						$disposable.push(disposable);
					}
				}
			}
		}
		else {
			for(const scheme of SCHEMES) {
				const disposable = vscode.languages.registerFoldingRangeProvider({ language: '*', scheme }, provider);

				$disposable.push(disposable);
			}
		}
	}
	else {
		for(const language in $rules) {
			if($rules[language]) {
				for(const scheme of SCHEMES) {
					const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

					$disposable.push(disposable);
				}
			}
		}
	}

	getContext().subscriptions.push($disposable);
} // }}}

function setupProvidersWithoutProxy(): void { // {{{
	const config = vscode.workspace.getConfiguration(CONFIG_KEY, null);
	const wildcardExclusions = Array.isArray(config.wildcardExclusions) ? config.wildcardExclusions : [];

	void vscode.languages.getLanguages().then((languages) => {
		for(const language of languages) {
			if(!wildcardExclusions.includes(language)) {
				const config = vscode.workspace.getConfiguration(CONFIG_KEY, { languageId: language });
				const mainProvider = buildProvider(language, config);

				const perFiles = config.get<Record<string, ExplicitFoldingConfig[] | ExplicitFoldingConfig | undefined> | undefined>('perFiles');
				const provider = hasValue(perFiles) ? buildRouter(perFiles!, mainProvider, config) : mainProvider;

				const additionalSchemes = config.get<string[]>('additionalSchemes') ?? [];

				for(const scheme of [...SCHEMES, ...additionalSchemes]) {
					const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

					$disposable.push(disposable);
				}
			}
		}
	});

	getContext().subscriptions.push($disposable);
} // }}}

function setupAutoFold() { // {{{
	let documents: readonly vscode.TextDocument[] = [];

	const disposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
		const activeEditor = vscode.window.activeTextEditor;

		if(editors.length > 0 && activeEditor) {
			const activeDocument = activeEditor.document;

			if(!documents.includes(activeDocument)) {
				foldDocument(activeDocument);
			}

			documents = vscode.workspace.textDocuments;
		}
	});

	getContext().subscriptions.push(disposable);
} // }}}

async function showWhatsNewMessage(version: string) { // {{{
	const actions: vscode.MessageItem[] = [{
		title: 'Homepage',
	}, {
		title: 'Release Notes',
	}];

	const result = await vscode.window.showInformationMessage(
		`Explicit Folding has been updated to v${version} — check out what's new!`,
		...actions,
	);

	if(result !== null) {
		if(result === actions[0]) {
			await vscode.commands.executeCommand(
				'vscode.open',
				vscode.Uri.parse(`${pkg.homepage}`),
			);
		}
		else if(result === actions[1]) {
			await vscode.commands.executeCommand(
				'vscode.open',
				vscode.Uri.parse(`${pkg.homepage}/blob/master/CHANGELOG.md`),
			);
		}
	}
} // }}}

export async function activate(context: vscode.ExtensionContext): Promise<ExplicitFoldingHub> { // {{{
	await setupSettings(context);

	const previousVersion = context.globalState.get<string>(VERSION_KEY);
	const currentVersion = pkg.version;

	const config = vscode.workspace.getConfiguration(CONFIG_KEY, null);

	if(previousVersion === undefined || currentVersion !== previousVersion) {
		void context.globalState.update(VERSION_KEY, currentVersion);

		const notification = config.get<string>('notification');

		if(previousVersion === undefined) {
			// don't show notification on install
		}
		else if(notification === 'major') {
			if(currentVersion.split('.')[0] > previousVersion.split('.')[0]) {
				void showWhatsNewMessage(currentVersion);
			}
		}
		else if(notification === 'minor') {
			if(currentVersion.split('.')[0] > previousVersion.split('.')[0] || (currentVersion.split('.')[0] === previousVersion.split('.')[0] && currentVersion.split('.')[1] > previousVersion.split('.')[1])) {
				void showWhatsNewMessage(currentVersion);
			}
		}
		else if(notification !== 'none') {
			void showWhatsNewMessage(currentVersion);
		}
	}

	await setupProviders();
	setupAutoFold();

	vscode.workspace.onDidChangeConfiguration(
		async (event) => {
			if(event.affectsConfiguration(CONFIG_KEY)) {
				await setupProviders();
				setupAutoFold();
			}
		},
		vscode.commands.registerCommand('explicitFolding.nudge', nudge),
	);

	return $hub;
} // }}}
