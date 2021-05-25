import * as vscode from 'vscode'
const pkg = require('../package.json')

import FoldingProvider from './foldingProvider'

const DEPRECATED_KEY = 'explicitFoldingDeprecated'
const VERSION_KEY = 'explicitFoldingVersion'

const SCHEMES = ['file', 'untitled', 'vscode-userdata']

let $channel: vscode.OutputChannel | null = null;
let $disposable: vscode.Disposable = vscode.Disposable.from();

class DeferredProvider implements vscode.FoldingRangeProvider { // {{{
	private loaded: boolean = false;
	private subscriptions: vscode.Disposable[] = [];

	constructor(private language: string, private delay: number) {
	}

	dispose() {
		vscode.Disposable.from(...this.subscriptions).dispose();
		this.subscriptions.length = 0;
	}

	provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
		if (!this.loaded) {
			this.loaded = true;

			setTimeout(() => this.setup(), this.delay);
		}

		return [];
	}

	push(disposable: vscode.Disposable) {
		this.subscriptions.push(disposable);
	}

	setup() {
		this.dispose();

		const config = vscode.workspace.getConfiguration('folding')[this.language];
		const debug = vscode.workspace.getConfiguration('explicitFolding').get<boolean>('debug') || false;
		const channel = getDebugChannel(debug);

		const provider = new FoldingProvider(config, channel);

		for (const scheme of SCHEMES) {
			const disposable = vscode.languages.registerFoldingRangeProvider({ language: this.language, scheme }, provider);

			this.subscriptions.push(disposable);
		}
	}
} // }}}

function getRules(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): vscode.WorkspaceConfiguration {
	let rules = vscode.workspace.getConfiguration('folding');
	if(rules) {
		const value = context.globalState.get<Date>(DEPRECATED_KEY);
		const lastWarning = value ? new Date(value) : null;
		const currentWarning = new Date();

		if(currentWarning > new Date(2022, 6, 1)) {
			vscode.window.showErrorMessage('Please update your config. The property `folding` is not supported since July 1, 2022. It has been replaced with the property `explicitFolding.rules`.');

			return config.rules;
		} else if(!lastWarning || lastWarning.getFullYear() !== currentWarning.getFullYear() || lastWarning.getMonth() !== currentWarning.getMonth() || currentWarning > new Date(2022, 5, 1)) {
			context.globalState.update(DEPRECATED_KEY, currentWarning);

			vscode.window.showWarningMessage('Please update your config. The property `folding` has been deprecated and replaced with the property `explicitFolding.rules`. Its support will stop on July 1, 2022.');
		}

		return rules;
	}
	else {
		return config.rules;
	}
}

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

function setup(context: vscode.ExtensionContext) { // {{{
	$disposable.dispose();

	const config = vscode.workspace.getConfiguration('explicitFolding');
	const rules = getRules(config, context);
	const delay = config.get<number>('startupDelay') || 0;
	const subscriptions: vscode.Disposable[] = [];

	if (delay > 0) {
		for (const language of Object.keys(rules).filter(name => typeof rules[name] === 'object')) {
			const provider = new DeferredProvider(language, delay);

			for (const scheme of SCHEMES) {
				const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

				provider.push(disposable);
			}

			subscriptions.push(provider);
		}
	} else {
		const debug = config.get<boolean>('debug') || false;
		const channel = getDebugChannel(debug);

		for (let language of Object.keys(rules).filter(name => typeof rules[name] === 'object')) {
			const provider = new FoldingProvider(rules[language], channel);

			for (const scheme of SCHEMES) {
				const disposable = vscode.languages.registerFoldingRangeProvider({ language, scheme }, provider);

				subscriptions.push(disposable);
			}
		}
	}

	$disposable = vscode.Disposable.from(...subscriptions);

	context.subscriptions.push($disposable);
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

	setup(context);

	vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('folding') || event.affectsConfiguration('explicitFolding')) {
			setup(context);
		}
	});
} // }}}
