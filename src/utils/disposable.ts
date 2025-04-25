import * as vscode from 'vscode';

export class Disposable extends vscode.Disposable {
	private readonly subscriptions: vscode.Disposable[] = [];

	constructor() {
		super(() => {
			// do nothing
		});
	}

	dispose() {
		vscode.Disposable.from(...this.subscriptions).dispose();

		this.subscriptions.length = 0;
	}

	push(disposable: vscode.Disposable) {
		this.subscriptions.push(disposable);
	}
}
