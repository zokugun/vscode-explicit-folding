import fse from '@zokugun/fs-extra-plus/sync';
import type api from '@zokugun/vscode.explicit-folding-api';
import { xtry } from '@zokugun/xtry/sync';
import { expect } from 'chai';
import { FoldingRangeKind } from 'vscode';
import YAML from 'yaml';
import { FoldingProvider } from '../src/folding-provider.js';
import { Document } from './mocks/vscode.js';

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
		const language = fse.parentName(file);
		const name = fse.leafName(file, 1);

		it(`${language}.${name}`, () => {
			const path = fse.join(fse.parentPath(file), `${name}.yml`);
			const content = fse.readFile(path, 'utf8');
			if(content.fails) {
				throw content.error;
			}

			const document = xtry(() => YAML.parse(content.value) as unknown);
			if(document.fails) {
				throw document.error;
			}

			const { config, foldings } = document.value as { config: api.Rule[]; foldings: Range[] };

			const provider = new FoldingProvider(config, []);

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

	const files = fse.walk(fse.join(__dirname, '..', '..', 'test', 'fixtures'), {
		absolute: true,
		collect: true,
		onlyFiles: true,
		traverseAll: true,
		filter: (item) => !item.path.endsWith('.yml'),
	});

	if(files.fails) {
		throw files.error;
	}

	for(const file of files.value) {
		prepare(file.path);
	}
});
