import vscode from 'vscode';

export async function nudge(): Promise<void> {
	await vscode.commands.executeCommand('editor.action.selectAll');

	await new Promise((resolve) => {
		setTimeout(resolve, 500);
	});

	await vscode.commands.executeCommand('editor.removeManualFoldingRanges');
}
