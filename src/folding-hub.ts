import { ExplicitFoldingConfig, ExplicitFoldingHub } from '@zokugun/vscode.explicit-folding-api';

export class FoldingHub implements ExplicitFoldingHub {
	private perLanguages: Record<string, ExplicitFoldingConfig[] | undefined> = {};
	private readonly setup: () => void;

	constructor(setup: () => void) {
		this.setup = setup;
	}

	getRules(language: string): ExplicitFoldingConfig[] | undefined {
		return this.perLanguages[language];
	}

	registerFoldingRules(language: string, rules: ExplicitFoldingConfig[]): void {
		this.perLanguages[language] = rules;

		this.setup();
	}

	unregisterFoldingRules(language: string): void {
		this.perLanguages[language] = undefined;

		this.setup();
	}
}
