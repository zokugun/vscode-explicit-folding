import { ExplicitFoldingConfig, ExplicitFoldingHub } from '@zokugun/vscode.explicit-folding-api';

export class FoldingHub implements ExplicitFoldingHub {
	private perLanguages: { [language: string]: ExplicitFoldingConfig[] | null } = {};
	private setup: Function;

	constructor(setup: Function) {
		this.setup = setup;
	}

	getRules(language: string): ExplicitFoldingConfig[] | null {
		return this.perLanguages[language]
	}

	registerFoldingRules(language: string, rules: ExplicitFoldingConfig[]): void {
		this.perLanguages[language] = rules;

		this.setup();
	}

	unregisterFoldingRules(language: string): void {
		this.perLanguages[language] = null;

		this.setup();
	}
}
