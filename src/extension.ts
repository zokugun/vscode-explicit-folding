import * as vscode from 'vscode'

import FoldingProvider from './foldingProvider'

export function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('folding')
	
	let provider
	for(let name in config) {
		if(name === '*') {
			provider = new FoldingProvider(config[name])
			context.subscriptions.push(vscode.languages.registerFoldingRangeProvider({ scheme: 'file' }, provider));
			context.subscriptions.push(vscode.languages.registerFoldingRangeProvider({ scheme: 'untitled' }, provider));
		}
		else {
			provider = new FoldingProvider(config[name])
			context.subscriptions.push(vscode.languages.registerFoldingRangeProvider({ language: name, scheme: 'file' }, provider));
			context.subscriptions.push(vscode.languages.registerFoldingRangeProvider({ language: name, scheme: 'untitled' }, provider));
		}
	}
}
