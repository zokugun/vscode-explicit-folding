import FoldingProvider from './foldingProvider';
import { Document } from './test/utils';
import { FoldingRangeKind } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as klaw from 'klaw-sync';
import * as YAML from 'yaml';
import { expect } from 'chai';

function dehumanize(foldings: any[]) {
	for(const folding of foldings) {
		if(/comment/i.test(folding.kind)) {
			folding.kind = FoldingRangeKind.Comment;
		} else {
			folding.kind = FoldingRangeKind.Region;
		}
	}

	return foldings;
}

describe('fold', () => {
	function prepare(file: string) {
		const language = path.basename(path.dirname(file));
		const name = path.basename(file).slice(0, path.basename(file).lastIndexOf('.'));

		it(`${language}.${name}`, () => {
			const { config, foldings } = YAML.parse(fs.readFileSync(path.join(path.dirname(file), `${name}.yml`), 'utf8'));

			const provider = new FoldingProvider(config, null, []);

			const ranges = provider.provideFoldingRanges(new Document(file));

			try {
				expect(ranges).to.eql(dehumanize(foldings));
			}
			catch(err) {
				console.log(JSON.stringify(config));
				console.log(YAML.stringify(foldings));
				console.log(YAML.stringify(ranges));

				throw err;
			}
		});
	}

	const files = klaw(path.join(__dirname, '..', 'test', 'fixtures'), {
		nodir: true,
		traverseAll: true,
		filter: (item) => item.path.slice(-4) !== '.yml'
	});

	for(const file of files) {
		prepare(file.path);
	}
});
