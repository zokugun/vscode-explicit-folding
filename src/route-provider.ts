import { basename } from 'path';
import type { ExplicitFoldingConfig } from '@zokugun/vscode.explicit-folding-api';
import { IMinimatch, Minimatch } from 'minimatch';
import type { FoldingRange, FoldingRangeProvider, OutputChannel, ProviderResult, TextDocument } from 'vscode';
import { FoldingProvider } from './folding-provider';

type Route = {
	label: string;
	route: IMinimatch;
	provider: FoldingProvider;
};

const DIRECTORY = /[/\\]/;

export class RouteProvider implements FoldingRangeProvider {
	private readonly debugChannel: OutputChannel | undefined;
	private readonly mainProvider: FoldingProvider;
	private readonly routes: Route[] = [];

	constructor(perFiles: Record<string, ExplicitFoldingConfig[] | ExplicitFoldingConfig | undefined>, mainProvider: FoldingProvider, debugChannel: OutputChannel | undefined, documents: TextDocument[], langRules: Record<string, ExplicitFoldingConfig[]>) { // {{{
		this.mainProvider = mainProvider;
		this.debugChannel = debugChannel;

		if(!perFiles) {
			return;
		}

		for(const [pattern, rawRules] of Object.entries(perFiles)) {
			if(rawRules) {
				const route = new Minimatch(`${DIRECTORY.test(pattern) ? '' : '**/'}${pattern}`);
				const rules = this.applyRules(Array.isArray(rawRules) ? rawRules : [rawRules], langRules);
				const provider = new FoldingProvider(rules, debugChannel, documents);

				this.routes.push({
					label: pattern,
					route,
					provider,
				});
			}
		}
	} // }}}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> { // {{{
		this.debugChannel?.show(true);

		for(const { label, route, provider } of this.routes) {
			// eslint-disable-next-line unicorn/prefer-regexp-test
			if(route.match(document.fileName)) {
				this.debugChannel?.appendLine(`[document] fileName: ${basename(document.fileName)}, route: ${label}`);

				return provider.provideFoldingRanges(document);
			}
		}

		this.debugChannel?.appendLine(`[document] fileName: ${basename(document.fileName)}, route: fallback`);

		return this.mainProvider.provideFoldingRanges(document);
	} // }}}

	protected applyRules(rawRules: ExplicitFoldingConfig[], langRules: Record<string, ExplicitFoldingConfig[]>): ExplicitFoldingConfig[] { // {{{
		const rules = [];

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
