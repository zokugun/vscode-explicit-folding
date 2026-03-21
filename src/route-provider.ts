import { basename } from 'path';
import type { ExplicitFoldingConfig } from '@zokugun/vscode.explicit-folding-api';
import { type IMinimatch, Minimatch } from 'minimatch';
import type { FoldingRange, FoldingRangeProvider, ProviderResult, TextDocument } from 'vscode';
import { FoldingProvider } from './folding-provider.js';
import { Logger } from './utils/logger.js';

type Route = {
	label: string;
	route: IMinimatch;
	provider: FoldingProvider;
};

const DIRECTORY = /[/\\]/;

export class RouteProvider implements FoldingRangeProvider {
	private readonly mainProvider: FoldingProvider;
	private readonly routes: Route[] = [];

	constructor(perFiles: Record<string, ExplicitFoldingConfig[] | ExplicitFoldingConfig | undefined>, mainProvider: FoldingProvider, documents: TextDocument[], langRules: Record<string, ExplicitFoldingConfig[]>) { // {{{
		this.mainProvider = mainProvider;

		if(!perFiles) {
			return;
		}

		for(const [pattern, rawRules] of Object.entries(perFiles)) {
			if(rawRules) {
				const route = new Minimatch(`${DIRECTORY.test(pattern) ? '' : '**/'}${pattern}`);
				const rules = this.applyRules(Array.isArray(rawRules) ? rawRules : [rawRules], langRules);
				const provider = new FoldingProvider(rules, documents);

				this.routes.push({
					label: pattern,
					route,
					provider,
				});
			}
		}
	} // }}}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> { // {{{
		Logger.show();

		for(const { label, route, provider } of this.routes) {
			// eslint-disable-next-line unicorn/prefer-regexp-test
			if(route.match(document.fileName)) {
				Logger.info(`[document] fileName: ${basename(document.fileName)}, route: ${label}`);

				return provider.provideFoldingRanges(document);
			}
		}

		Logger.info(`[document] fileName: ${basename(document.fileName)}, route: main`);

		return this.mainProvider.provideFoldingRanges(document);
	} // }}}

	protected applyRules(rawRules: ExplicitFoldingConfig[], langRules: Record<string, ExplicitFoldingConfig[]>): ExplicitFoldingConfig[] { // {{{
		const rules: ExplicitFoldingConfig[] = [];

		for(const rule of rawRules) {
			if(rule.include) {
				if(Array.isArray(rule.include)) {
					for(const lang of rule.include) {
						rules.push(...langRules[lang]);
					}
				}
				else {
					rules.push(...langRules[rule.include]);
				}
			}
			else {
				rules.push(rule);
			}
		}

		return rules;
	} // }}}
}
