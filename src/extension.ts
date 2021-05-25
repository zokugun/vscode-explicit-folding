import * as vscode from 'vscode'
const pkg = require('../package.json')

import { FoldingConfig } from './config'
import FoldingProvider from './foldingProvider'

const DEPRECATED_KEY = 'explicitFoldingDeprecated'
const VERSION_KEY = 'explicitFoldingVersion'

const SCHEMES = ['file', 'untitled', 'vscode-userdata']

let $channel: vscode.OutputChannel | null = null;
let $context: vscode.ExtensionContext | null = null;
const $disposable: vscode.Disposable = new vscode.Disposable(dispose)
const $subscriptions: vscode.Disposable[] = []

class MainProvider implements vscode.FoldingRangeProvider {
	private providers: { [key: string]: boolean } = {}

	public id: string = 'explicit';

	provideFoldingRanges(document: vscode.TextDocument): vscode.ProviderResult<vscode.FoldingRange[]> { // {{{
		if (!this.providers[document.languageId]) {
			this.providers[document.languageId] = true

			const config = vscode.workspace.getConfiguration('explicitFolding', document);
			const delay = getDelay(config);

			if (delay > 0) {
				setTimeout(() => this.setup(document), delay);
			} else {
				this.setup(document);
			}
		}

		return [];
	} // }}}

	setup(document: vscode.TextDocument) { // {{{
		const language = document.languageId;

		const perLanguage = getRules(vscode.workspace.getConfiguration('explicitFolding'));
		const config = vscode.workspace.getConfiguration('explicitFolding', document);

		const rules: FoldingConfig[] = [];

		if(!applyRules(config.get<FoldingConfig | FoldingConfig[]>('rules'), rules)) {
			applyRules(perLanguage[language], rules);
		}

		applyRules(perLanguage['*'], rules);

		checkDeprecatedRules(rules);

		const debug = config.get<boolean>('debug') || false;
		const channel = getDebugChannel(debug);

		const provider = new FoldingProvider(rules, channel);

		for (const scheme of SCHEMES) {
			const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

			$subscriptions.push(disposable);
		}
	} // }}}
}

function applyRules(data: FoldingConfig | FoldingConfig[] | undefined, rules: FoldingConfig[]): boolean { // {{{
	if(data) {
		if(Array.isArray(data)) {
			rules.push(...data);
		} else {
			rules.push(data);
		}

		return true
	} else {
		return false
	}
} // }}}

function checkDeprecatedRule(rule: FoldingConfig | Array<FoldingConfig>, deprecateds: string[]) { // {{{
	if (rule instanceof Array) {
		for (const r of rule) {
			checkDeprecatedRule(r, deprecateds);
		}
	} else {
		if (rule.descendants) {
			if (!deprecateds.includes('descendants')) {
				deprecateds.push('descendants')
			}
		} else if (Array.isArray(rule.nested)) {
			for (const r of rule.nested) {
				checkDeprecatedRule(r, deprecateds);
			}
		}
	}
} // }}}

function checkDeprecatedRules(rules: Array<FoldingConfig>) { // {{{
	const deprecateds: string[] = [];

	checkDeprecatedRule(rules, deprecateds);

	if (deprecateds.includes('descendants')) {
		vscode.window.showWarningMessage('Please update your config. The property `descendants` has been deprecated and replaced with the property `nested`. It will be removed in the next version.');
	}
} // }}}

function dispose() { // {{{
	vscode.Disposable.from(...$subscriptions).dispose();
	$subscriptions.length = 0;
} // }}}

function getDelay(config: vscode.WorkspaceConfiguration): number { // {{{
	if (config.has('startupDelay')) {
		vscode.window.showWarningMessage('Please update your config. The property `startupDelay` has been deprecated and replaced with the property `delay`. It will be removed in the next version.');

		return config.get<number>('startupDelay') || 0;
	} else {
		return config.get<number>('delay') || 0;
	}
} // }}}

function getRules(config: vscode.WorkspaceConfiguration): vscode.WorkspaceConfiguration { // {{{
	let rules = vscode.workspace.getConfiguration('folding');
	if (rules) {
		const value = $context!.globalState.get<Date>(DEPRECATED_KEY);
		const lastWarning = value ? new Date(value) : null;
		const currentWarning = new Date();

		if (currentWarning > new Date(2022, 6, 1)) {
			vscode.window.showErrorMessage('Please update your config. The property `folding` is not supported since July 1, 2022. It has been replaced with the property `explicitFolding.rules`.');

			return config.rules;
		} else if (!lastWarning || lastWarning.getFullYear() !== currentWarning.getFullYear() || lastWarning.getMonth() !== currentWarning.getMonth() || currentWarning > new Date(2022, 5, 1)) {
			$context!.globalState.update(DEPRECATED_KEY, currentWarning);

			vscode.window.showWarningMessage('Please update your config. The property `folding` has been deprecated and replaced with the property `explicitFolding.rules`. Its support will stop on July 1, 2022.');
		}

		return rules;
	} else {
		return config.rules;
	}
} // }}}

function getDebugChannel(debug: boolean): vscode.OutputChannel | null { // {{{
	if (debug) {
		if (!$channel) {
			$channel = vscode.window.createOutputChannel('Folding');
		}

		return $channel;
	} else {
		return null;
	}
} // }}}

function setup() { // {{{
	$disposable.dispose();

	const provider = new MainProvider();

	for (const scheme of SCHEMES) {
		const disposable = vscode.languages.registerFoldingRangeProvider({ language: '*', scheme }, provider);

		$subscriptions.push(disposable);
	}

	$context!.subscriptions.push($disposable);
} // }}}

async function showWhatsNewMessage(version: string) { // {{{
	const actions: vscode.MessageItem[] = [{
		title: 'Homepage'
	}, {
		title: 'Release Notes'
	}];

	const result = await vscode.window.showInformationMessage(
		`Explicit Folding has been updated to v${version} — check out what's new!`,
		...actions
	);

	if (result != null) {
		if (result === actions[0]) {
			await vscode.commands.executeCommand(
				'vscode.open',
				vscode.Uri.parse(`${pkg.homepage}`)
			);
		} else if (result === actions[1]) {
			await vscode.commands.executeCommand(
				'vscode.open',
				vscode.Uri.parse(`${pkg.homepage}/blob/master/CHANGELOG.md`)
			);
		}
	}
} // }}}

export async function activate(context: vscode.ExtensionContext) { // {{{
	$context = context

	const previousVersion = context.globalState.get<string>(VERSION_KEY);
	const currentVersion = pkg.version;

	const config = vscode.workspace.getConfiguration('explicitFolding');

	if (previousVersion === undefined || currentVersion !== previousVersion) {
		context.globalState.update(VERSION_KEY, currentVersion);

		const notification = config.get<string>('notification');

		if (previousVersion === undefined) {
			// don't show notification on install
		} else if (notification === 'major') {
			if (currentVersion.split('.')[0] > previousVersion.split('.')[0]) {
				showWhatsNewMessage(currentVersion);
			}
		} else if (notification === 'minor') {
			if (currentVersion.split('.')[0] > previousVersion.split('.')[0] || (currentVersion.split('.')[0] === previousVersion.split('.')[0]) && currentVersion.split('.')[1] > previousVersion.split('.')[1]) {
				showWhatsNewMessage(currentVersion);
			}
		} else if (notification !== 'none') {
			showWhatsNewMessage(currentVersion);
		}
	}

	setup();

	vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('folding') || event.affectsConfiguration('explicitFolding')) {
			setup();
		}
	});
} // }}}
