import fs from 'fs';
import path from 'path';
import type API from '@zokugun/vscode.explicit-folding-api';
import { expect } from 'chai';
import klaw from 'klaw-sync';
import { FoldingRangeKind } from 'vscode';
import YAML from 'yaml';
import { FoldingProvider } from './folding-provider.js';
import { Document } from './test/utils.js';

type Range = {
	start: number;
	end: number;
	kind: string | FoldingRangeKind;
};

function dehumanize(foldings: Range[]): Range[] {
	for(const folding of foldings) {
		folding.kind = /comment/i.test(folding.kind as string) ? FoldingRangeKind.Comment : FoldingRangeKind.Region;
	}

	return foldings;
}

describe('fold', () => {
	function prepare(file: string) {
		const language = path.basename(path.dirname(file));
		const name = path.basename(file).slice(0, path.basename(file).lastIndexOf('.'));

		it(`${language}.${name}`, () => {
			const { config, foldings } = YAML.parse(fs.readFileSync(path.join(path.dirname(file), `${name}.yml`), 'utf8')) as { config: API.Config[]; foldings: Range[] };

			const provider = new FoldingProvider(config, undefined, []);

			const ranges = provider.provideFoldingRanges(new Document(file));

			try {
				expect(ranges).to.eql(dehumanize(foldings));
			}
			catch (error: unknown) {
				console.log(JSON.stringify(config));
				console.log(YAML.stringify(foldings));
				console.log(YAML.stringify(ranges));

				throw error;
			}
		});
	}

	const files = klaw(path.join(__dirname, '..', 'test', 'fixtures'), {
		nodir: true,
		traverseAll: true,
		filter: (item) => !item.path.endsWith('.yml'),
	});

	for(const file of files) {
		prepare(file.path);
	}
});
