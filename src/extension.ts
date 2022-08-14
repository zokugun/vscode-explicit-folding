import { ExplicitFoldingConfig, ExplicitFoldingHub } from '@zokugun/vscode.explicit-folding-api';
import vscode from 'vscode';
import pkg from '../package.json';
import { Disposable } from './disposable';
import { FoldingHub } from './folding-hub';
import { FoldingProvider } from './folding-provider';

const DEPRECATED_KEY = 'explicitFoldingDeprecated';
const VERSION_KEY = 'explicitFoldingVersion';

const SCHEMES = ['file', 'untitled', 'vscode-userdata'];

const $disposable: Disposable = new Disposable();
const $documents: vscode.TextDocument[] = [];
const $hub = new FoldingHub(setupFoldingRangeProvider);

let $channel: vscode.OutputChannel | null = null;
let $context: vscode.ExtensionContext | null = null;

class MainProvider implements vscode.FoldingRangeProvider {
	public id = 'explicit';

	private providers: Record<string, boolean> = {};

	provideFoldingRanges(document: vscode.TextDocument): vscode.ProviderResult<vscode.FoldingRange[]> { // {{{
		if(!this.providers[document.languageId]) {
			this.providers[document.languageId] = true;

			const config = vscode.workspace.getConfiguration('explicitFolding', document);
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

		const perLanguages = getRules();
		const config = vscode.workspace.getConfiguration('explicitFolding', document);
		const debug = config.get<boolean>('debug') ?? false;
		const channel = getDebugChannel(debug);
		const additionalSchemes = config.get<string[]>('additionalSchemes') ?? [];

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

		checkDeprecatedRules(rules);

		const provider = new FoldingProvider(rules, channel, $documents);

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

function checkDeprecatedRule(rule: ExplicitFoldingConfig | ExplicitFoldingConfig[], deprecateds: string[]) { // {{{
	if(Array.isArray(rule)) {
		for(const r of rule) {
			checkDeprecatedRule(r, deprecateds);
		}
	}
	else if(rule.descendants) {
		if(!deprecateds.includes('descendants')) {
			deprecateds.push('descendants');
		}
	}
	else if(Array.isArray(rule.nested)) {
		for(const r of rule.nested) {
			checkDeprecatedRule(r, deprecateds);
		}
	}
} // }}}

function checkDeprecatedRules(rules: ExplicitFoldingConfig[]) { // {{{
	const deprecateds: string[] = [];

	checkDeprecatedRule(rules, deprecateds);

	if(deprecateds.includes('descendants')) {
		void vscode.window.showWarningMessage('Please update your config. The property `descendants` has been deprecated and replaced with the property `nested`. It will be removed in the next version.');
	}
} // }}}

function foldDocument(document: vscode.TextDocument) { // {{{
	const config = vscode.workspace.getConfiguration('explicitFolding', document);
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
	if(config.has('startupDelay')) {
		void vscode.window.showWarningMessage('Please update your config. The property `startupDelay` has been deprecated and replaced with the property `delay`. It will be removed in the next version.');

		return config.get<number>('startupDelay') ?? 0;
	}

	return config.get<number>('delay') ?? 0;
} // }}}

function getRules(): vscode.WorkspaceConfiguration { // {{{
	const rules = vscode.workspace.getConfiguration('folding', null);
	if(Object.keys(rules).length > 4) {
		const value = $context!.globalState.get<Date>(DEPRECATED_KEY);
		const lastWarning = value ? new Date(value) : null;
		const currentWarning = new Date();

		if(currentWarning > new Date(2022, 6, 1)) {
			void vscode.window.showErrorMessage('Please update your config. The property `folding` is not supported since July 1, 2022. It has been replaced with the property `explicitFolding.rules`.');

			return vscode.workspace.getConfiguration('explicitFolding.rules', null);
		}

		if(!lastWarning || lastWarning.getFullYear() !== currentWarning.getFullYear() || lastWarning.getMonth() !== currentWarning.getMonth() || currentWarning > new Date(2022, 5, 1)) {
			void $context!.globalState.update(DEPRECATED_KEY, currentWarning);

			void vscode.window.showWarningMessage('Please update your config. The property `folding` has been deprecated and replaced with the property `explicitFolding.rules`. Its support will stop on July 1, 2022.');
		}

		return rules;
	}

	return vscode.workspace.getConfiguration('explicitFolding.rules', null);
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

function setupFoldingRangeProvider() { // {{{
	$disposable.dispose();

	const provider = new MainProvider();

	const globalConfig = getRules();

	if(globalConfig['*']) {
		const config = vscode.workspace.getConfiguration('explicitFolding', null);

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
		else if(Array.isArray(config.wilcardExclusions) && config.wilcardExclusions.length > 0) {
			const channel = getDebugChannel(true);

			if(channel) {
				channel.appendLine('[deprecated] `explicitFolding.wilcardExclusions` has been replaced with `explicitFolding.wildcardExclusions` (with a `d`)');
			}

			void vscode.languages.getLanguages().then((languages) => {
				for(const language of languages) {
					if(Array.isArray(config.wilcardExclusions) && !config.wilcardExclusions.includes(language)) {
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

				if(globalConfig[language] || $hub.hasRules(language) || langConfig['explicitFolding.rules']) {
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

	const config = vscode.workspace.getConfiguration('explicitFolding', null);

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

	setupFoldingRangeProvider();
	setupAutoFold();

	vscode.workspace.onDidChangeConfiguration((event) => {
		if(event.affectsConfiguration('folding') || event.affectsConfiguration('explicitFolding')) {
			setupFoldingRangeProvider();
			setupAutoFold();
		}
	});

	return $hub;
} // }}}
