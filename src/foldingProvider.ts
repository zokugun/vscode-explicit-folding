import { FoldingRange, FoldingRangeProvider, ProviderResult, TextDocument } from 'vscode'

type FoldingConfig = {
	begin: string,
	end: string
}

type FoldingRegex = {
	begin: RegExp,
	end: RegExp
}

export default class ConfigurableFoldingProvider implements FoldingRangeProvider {
	private regexes: Array<FoldingRegex> = [];
	private regexLength: number = 0;
	
	constructor(configuration: FoldingConfig | Array<FoldingConfig>) {
		if (configuration instanceof Array) {
			for (let value of configuration) {
				this.regexes.push({
					begin: new RegExp(value.begin),
					end: new RegExp(value.end)
				});
				
				this.regexLength = this.regexes.length;
			}
		} else {
			this.regexes.push({
				begin: new RegExp(configuration.begin),
				end: new RegExp(configuration.end)
			});
		}
	}
	
	private confirmFoldingRangeOf(document: TextDocument, lineCount: number, foldingRanges: FoldingRange[], foldingRangeStart: number, marker: FoldingRegex): number {
		let i = foldingRangeStart + 1;
		let line, j;
		
		while (i < lineCount) {
			line = document.lineAt(i).text;
			if ((j = this.findFoldingRange(document, lineCount, foldingRanges, i, document.lineAt(i).text)) !== i) {
				i = j;
			} else if(marker.end.test(line)) {
				foldingRanges.push(new FoldingRange(foldingRangeStart, i));
				
				return i + 1;
			} else {
				i++;
			}
		}
		
		return i;
	}
	
	private confirmFoldingRangeOfZero(document: TextDocument, lineCount: number, foldingRanges: FoldingRange[], foldingRangeStart: number): number {
		let i = foldingRangeStart + 1;
		let line;
		
		while (i < lineCount) {
			line = document.lineAt(i).text;
			if (this.regexes[0].begin.test(line)) {
				i = this.confirmFoldingRangeOfZero(document, lineCount, foldingRanges, i);
			} else if(this.regexes[0].end.test(line)) {
				foldingRanges.push(new FoldingRange(foldingRangeStart, i));
				
				return i + 1;
			} else {
				i++;
			}
		}
		
		return i;
	}
	
	private findFoldingRange(document: TextDocument, lineCount: number, foldingRanges: FoldingRange[], foldingRangeStart: number, line: string): number {
		for (let i = 0; i < this.regexLength; i++) {
			if (this.regexes[i].begin.test(line)) {
				return this.confirmFoldingRangeOf(document, lineCount, foldingRanges, foldingRangeStart, this.regexes[i]);
			}
		}
		
		return foldingRangeStart;
	}
	
	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
		const foldingRanges: FoldingRange[] = [];
		const lineCount = document.lineCount;
		let i = 0;
		
		if (this.regexLength > 1) {
			let j;
			
			while (i < lineCount) {
				if ((j = this.findFoldingRange(document, lineCount, foldingRanges, i, document.lineAt(i).text)) === i) {
					i++;
				}
				else {
					i = j;
				}
			}
		} else {
			let line;
			
			while (i < lineCount) {
				line = document.lineAt(i).text;
				if (this.regexes[0].begin.test(line)) {
					i = this.confirmFoldingRangeOfZero(document, lineCount, foldingRanges, i);
				} else {
					i++;
				}
			}
		}
		
		return foldingRanges;
	}
}