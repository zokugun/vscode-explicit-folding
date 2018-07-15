import * as vscode from 'vscode'

import FoldingProvider from './foldingProvider'

let $disposable: vscode.Disposable | null = null;

function setup(context: vscode.ExtensionContext) {
	if ($disposable !== null) {
		$disposable.dispose();
	}
	
	const config = vscode.workspace.getConfiguration('folding');
	const subscriptions: vscode.Disposable[] = [];
	
	let provider, disposable;
	for(let name in config) {
		if(name === '*') {
			provider = new FoldingProvider(config[name]);
			
			subscriptions.push(disposable = vscode.languages.registerFoldingRangeProvider({ scheme: 'file' }, provider));
			context.subscriptions.push(disposable);
			
			subscriptions.push(disposable = vscode.languages.registerFoldingRangeProvider({ scheme: 'untitled' }, provider));
			context.subscriptions.push(disposable);
		}
		else {
			provider = new FoldingProvider(config[name]);
			
			subscriptions.push(disposable = vscode.languages.registerFoldingRangeProvider({ language: name, scheme: 'file' }, provider));
			context.subscriptions.push(disposable);
			
			subscriptions.push(disposable = vscode.languages.registerFoldingRangeProvider({ language: name, scheme: 'untitled' }, provider));
			context.subscriptions.push(disposable);
		}
	}
	
	$disposable = vscode.Disposable.from(...subscriptions);
}

export function activate(context: vscode.ExtensionContext) {
	setup(context);
	
	vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('folding')) {
			setup(context);
        }
    });
};