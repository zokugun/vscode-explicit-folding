import { ExplicitFoldingConfig, ExplicitFoldingHub } from '@zokugun/vscode.explicit-folding-api';
import vscode from 'vscode';
import pkg from '../package.json';
import { Disposable } from './disposable';
import { FoldingHub } from './folding-hub';
import { FoldingProvider } from './folding-provider';

const CONFIG_KEY = 'explicitFolding';
const VERSION_KEY = 'explicitFoldingVersion';

const SCHEMES = ['file', 'untitled', 'vscode-userdata'];

const $disposable: Disposable = new Disposable();
const $documents: vscode.TextDocument[] = [];
const $hub = new FoldingHub(setupProviders);

let $channel: vscode.OutputChannel | null = null;
let $context: vscode.ExtensionContext | null = null;

class MainProvider implements vscode.FoldingRangeProvider {
	public id = 'explicit';

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

		const provider = buildProvider(language, config);

		for(const scheme of [...SCHEMES, ...additionalSchemes]) {
			const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

			$disposable.push(disposable);
		}

		foldDocument(document);
	} // }}}
}

function applyRules(data: any, rules: ExplicitFoldingConfig[]): void { // {{{
	if(Array.isArray(data)) {
		rules.push(...data);
	}
	else if(data) {
		rules.push(data);
	}
} // }}}

function buildProvider(language: string, config: vscode.WorkspaceConfiguration): FoldingProvider { // {{{
	const debug = config.get<boolean>('debug') ?? false;
	const perLanguages = getRules();
	const channel = getDebugChannel(debug);

	const rules: ExplicitFoldingConfig[] = [];

	const hubRules = $hub.getRules(language);

	const langRules = config.get<Record<string, ExplicitFoldingConfig[]> | undefined>('rules');

	if(hubRules) {
		if(channel) {
			channel.appendLine(`[register] use external rules for language: ${language}`);
		}

		applyRules(hubRules, rules);
	}
	else if(!langRules || langRules[language]) {
		applyRules(perLanguages[language], rules);
	}
	else {
		applyRules(langRules, rules);
	}

	applyRules(perLanguages['*'], rules);

	return new FoldingProvider(rules, channel, $documents);
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

function getRules(): vscode.WorkspaceConfiguration { // {{{
	return vscode.workspace.getConfiguration(`${CONFIG_KEY}.rules`, null);
} // }}}

function getDebugChannel(debug: boolean): vscode.OutputChannel | undefined { // {{{
	if(debug) {
		if(!$channel) {
			$channel = vscode.window.createOutputChannel('Folding');
		}

		return $channel;
	}

	return undefined;
} // }}}

function setupProviders() { // {{{
	$disposable.dispose();

	const defaultProvider = vscode.workspace.getConfiguration('editor').get<string>('defaultFoldingRangeProvider') ?? '';

	if(defaultProvider === 'zokugun.explicit-folding') {
		setupProvidersWithoutProxy();
	}
	else {
		setupProvidersWithProxy();
	}
} // }}}

function setupProvidersWithProxy(): void { // {{{
	const provider = new MainProvider();

	const globalConfig = getRules();

	if(globalConfig['*']) {
		const config = vscode.workspace.getConfiguration(CONFIG_KEY, null);

		if(Array.isArray(config.wildcardExclusions) && config.wildcardExclusions.length > 0) {
			void vscode.languages.getLanguages().then((languages) => {
				for(const language of languages) {
					if(Array.isArray(config.wildcardExclusions) && !config.wildcardExclusions.includes(language)) {
						for(const scheme of SCHEMES) {
							const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

							$disposable.push(disposable);
						}
					}
				}
			});
		}
		else {
			for(const scheme of SCHEMES) {
				const disposable = vscode.languages.registerFoldingRangeProvider({ language: '*', scheme }, provider);

				$disposable.push(disposable);
			}
		}
	}
	else {
		void vscode.languages.getLanguages().then((languages) => {
			for(const language of languages) {
				const langConfig = vscode.workspace.getConfiguration(`[${language}]`, null);

				if(globalConfig[language] || $hub.hasRules(language) || langConfig[`${CONFIG_KEY}.rules`]) {
					for(const scheme of SCHEMES) {
						const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

						$disposable.push(disposable);
					}
				}
			}
		});
	}

	$context!.subscriptions.push($disposable);
} // }}}

function setupProvidersWithoutProxy(): void { // {{{
	$disposable.dispose();

	const config = vscode.workspace.getConfiguration(CONFIG_KEY, null);
	const wildcardExclusions = Array.isArray(config.wildcardExclusions) ? config.wildcardExclusions : [];

	void vscode.languages.getLanguages().then((languages) => {
		for(const language of languages) {
			const config = vscode.workspace.getConfiguration(CONFIG_KEY, { languageId: language });
			const provider = buildProvider(language, config);

			if(!wildcardExclusions.includes(language)) {
				const additionalSchemes = config.get<string[]>('additionalSchemes') ?? [];

				for(const scheme of [...SCHEMES, ...additionalSchemes]) {
					const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

					$disposable.push(disposable);
				}
			}
		}
	});

	$context!.subscriptions.push($disposable);
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

	$context!.subscriptions.push(disposable);
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

export function activate(context: vscode.ExtensionContext): ExplicitFoldingHub { // {{{
	$context = context;

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

	setupProviders();
	setupAutoFold();

	vscode.workspace.onDidChangeConfiguration((event) => {
		if(event.affectsConfiguration(CONFIG_KEY)) {
			setupProviders();
			setupAutoFold();
		}
	});

	return $hub;
} // }}}
