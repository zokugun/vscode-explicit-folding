import type api from '@zokugun/vscode.explicit-folding-api';

export class FoldingHub implements api.Hub {
	private perLanguages: Record<string, api.Config[] | undefined> = {};
	private readonly setup: () => void;

	constructor(setup: () => void) {
		this.setup = setup;
	}

	getRules(language: string): api.Config[] | undefined {
		return this.perLanguages[language];
	}

	hasRules(language: string): boolean {
		return this.perLanguages[language] !== undefined;
	}

	registerFoldingRules(language: string, rules: api.Config[]): void {
		this.perLanguages[language] = rules;

		this.setup();
	}

	unregisterFoldingRules(language: string): void {
		this.perLanguages[language] = undefined;

		this.setup();
	}
}
