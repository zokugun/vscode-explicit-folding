import { FoldingRange, FoldingRangeProvider, ProviderResult, TextDocument } from 'vscode'

export default class ConfigurableFoldingProvider implements FoldingRangeProvider {
	private begin_regex: RegExp
	private end_regex: RegExp
	constructor(configuration: {start: string, end: string}) {
		this.begin_regex = new RegExp(configuration.start);
		this.end_regex = new RegExp(configuration.end);
	}
	private findFoldRange(document: TextDocument, lineCount: number, foldingRanges: FoldingRange[], foldingRangeStart: number) {
		let i = foldingRangeStart + 1;
		let line;
		while (i < lineCount) {
			line = document.lineAt(i).text;
			if (this.begin_regex.test(line)) {
				i = this.findFoldRange(document, lineCount, foldingRanges, i);
			} else if(this.end_regex.test(line)) {
				foldingRanges.push(new FoldingRange(foldingRangeStart, i));
				
				return i + 1;
			} else {
				i++;
			}
		}
		
		return i;
	}
	private findFoldRanges(document: TextDocument) {
		const foldingRanges: FoldingRange[] = [];
		const lineCount = document.lineCount;
		
		let i = 0;
		let line;
		while (i < lineCount) {
			line = document.lineAt(i).text;
			if (this.begin_regex.test(line)) {
				i = this.findFoldRange(document, lineCount, foldingRanges, i);
			} else {
				i++;
			}
		}
		
		return foldingRanges;
	}
	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
		return this.findFoldRanges(document);
	}
}