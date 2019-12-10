import { FoldingRange, FoldingRangeProvider, ProviderResult, TextDocument } from 'vscode'

type FoldingConfig = {
	begin?: string,
	end?: string,
	beginRegex?: string,
	endRegex?: string
}

type FoldingRegex = {
	begin: RegExp,
	end: RegExp
}

const matchOperatorRegex = /[-|\\{}()[\]^$+*?.]/g;

function escapeRegex(str: string) {
	return str.replace(matchOperatorRegex, '\\$&');
}

export default class ConfigurableFoldingProvider implements FoldingRangeProvider {
	private regexes: Array<FoldingRegex> = [];

	constructor(configuration: FoldingConfig | Array<FoldingConfig>) {
		if (configuration instanceof Array) {
			for (let value of configuration) {
				this.addRegex(value);
			}
		} else {
			this.addRegex(configuration);
		}

	}

	private addRegex(configuration: FoldingConfig) {
		try {
			if (configuration.beginRegex && configuration.endRegex) {
				this.regexes.push({
					begin: new RegExp(configuration.beginRegex),
					end: new RegExp(configuration.endRegex)
				});
			} else if (configuration.begin && configuration.end) {
				this.regexes.push({
					begin: new RegExp(escapeRegex(configuration.begin)),
					end: new RegExp(escapeRegex(configuration.end))
				});
			}
		} catch (err) {
		}
	}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
		const BEGIN = 1;
		const END = 2;
		let foldingRanges = [];
		let stack: { r: FoldingRegex, i: number }[] = [];
		var regstr = this.regexes.map((regexp, i) => `(?<_${BEGIN}_${i}>${regexp.begin.source})|(?<_${END}_${i}>${regexp.end.source})`).join('|');
		let findOfRegexp = function* (line: string, str: string) {
			let left = 0;
			while (true) {
				let res = line.substring(left || 0).match(str) as { groups?: { [key: string]: string }, index?: number, [key: number]: string };
				if (res && res.groups) {
					left = left + (res.index || 0) + res[0].length;
					for (const key in res.groups) {
						if (res.groups[key]) {
							let keys = key.split('_').map(x => parseInt(x));
							yield { type: keys[1], index: keys[2] };
							break;
						}
					}
				} else {
					break;
				}
			}
		}
		for (let i = 0; i < document.lineCount; i++) {
			for (const { type, index } of findOfRegexp(document.lineAt(i).text, regstr)) {
				switch (type) {
					case BEGIN:
						stack.unshift({ r: this.regexes[index], i: i });
						break;
					case END:
						if (stack[0]) {
							let a = stack[0].i, b = i;
							if (a != b) {
								foldingRanges.push(new FoldingRange(a, b - 1));
							}
							stack.shift();
						}
						break;
				}
			}
		}
		return foldingRanges;
	}
}