import vscode from 'vscode';

export async function nudge(): Promise<void> {
	await vscode.commands.executeCommand('editor.unfoldAll');

	await new Promise((resolve) => {
		setTimeout(resolve, 500);
	});

	await vscode.commands.executeCommand('workbench.action.reloadWindow');
}
