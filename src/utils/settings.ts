import vscode from 'vscode';

/* eslint-disable import/no-mutable-exports, @typescript-eslint/naming-convention */
export let EXTENSION_NAME: string = '';
export let EXTENSION_ID: string = '';
export let GLOBAL_STORAGE: string = '';
/* eslint-enable */

let $channel: vscode.OutputChannel | null = null;
let $context: vscode.ExtensionContext | null = null;

export function getContext(): vscode.ExtensionContext {
	return $context!;
}

export function getDebugChannel(debug: false): undefined;
export function getDebugChannel(debug: true): vscode.OutputChannel;
export function getDebugChannel(debug: boolean): vscode.OutputChannel | undefined;
export function getDebugChannel(debug: boolean): vscode.OutputChannel | undefined { // {{{
	if(debug) {
		$channel ??= vscode.window.createOutputChannel(EXTENSION_NAME);

		return $channel;
	}

	return undefined;
} // }}}

export async function setupSettings(context: vscode.ExtensionContext) {
	EXTENSION_ID = context.extension.id;
	EXTENSION_NAME = context.extension.packageJSON.displayName as string;
	GLOBAL_STORAGE = context.globalStorageUri.fsPath;

	$context = context;
}
