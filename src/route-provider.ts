import type { ExplicitFoldingConfig } from '@zokugun/vscode.explicit-folding-api';
import { IMinimatch, Minimatch } from 'minimatch';
import { basename } from 'path';
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

	constructor(perFiles: Record<string, ExplicitFoldingConfig[] | ExplicitFoldingConfig | undefined>, mainProvider: FoldingProvider, debugChannel: OutputChannel | undefined, documents: TextDocument[]) { // {{{
		this.mainProvider = mainProvider;
		this.debugChannel = debugChannel;

		if(!perFiles) {
			return;
		}

		for(const [pattern, rules] of Object.entries(perFiles)) {
			if(rules) {
				const route = new Minimatch(`${DIRECTORY.test(pattern) ? '' : '**/'}${pattern}`);
				const provider = new FoldingProvider(Array.isArray(rules) ? rules : [rules], debugChannel, documents);

				this.routes.push({
					label: pattern,
					route,
					provider,
				});
			}
		}
	} // }}}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> { // {{{
		if(this.debugChannel) {
			this.debugChannel.show(true);
		}

		for(const { label, route, provider } of this.routes) {
			// eslint-disable-next-line unicorn/prefer-regexp-test
			if(route.match(document.fileName)) {
				if(this.debugChannel) {
					this.debugChannel.appendLine(`[document] fileName: ${basename(document.fileName)}, route: ${label}`);
				}

				return provider.provideFoldingRanges(document);
			}
		}

		if(this.debugChannel) {
			this.debugChannel.appendLine(`[document] fileName: ${basename(document.fileName)}, route: main`);
		}

		return this.mainProvider.provideFoldingRanges(document);
	} // }}}
}
