import { basename } from 'path';
import type API from '@zokugun/vscode.explicit-folding-api';
import { type IMinimatch, Minimatch } from 'minimatch';
import type { FoldingRange, FoldingRangeProvider, OutputChannel, ProviderResult, TextDocument } from 'vscode';
import { FoldingProvider } from './folding-provider.js';

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

	constructor(perFiles: Record<string, API.Config[] | API.Config | undefined>, mainProvider: FoldingProvider, debugChannel: OutputChannel | undefined, documents: TextDocument[], langRules: Record<string, API.Config[]>) { // {{{
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

		this.debugChannel?.appendLine(`[document] fileName: ${basename(document.fileName)}, route: main`);

		return this.mainProvider.provideFoldingRanges(document);
	} // }}}

	protected applyRules(rawRules: API.Config[], langRules: Record<string, API.Config[]>): API.Config[] { // {{{
		const rules: API.Config[] = [];

		for(const rule of rawRules) {
			if(rule.variables) {
				rules.push(rule);
			}
			else if(rule.include) {
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
