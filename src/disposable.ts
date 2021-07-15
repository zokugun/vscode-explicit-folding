import * as vscode from 'vscode';

export class Disposable extends vscode.Disposable {
	private subscriptions: vscode.Disposable[] = [];

	constructor() {
		super(() => {});
	}

	dispose() {
		vscode.Disposable.from(...this.subscriptions).dispose();

		this.subscriptions.length = 0;
	}

	push(disposable: vscode.Disposable) {
		this.subscriptions.push(disposable);
	}
}
