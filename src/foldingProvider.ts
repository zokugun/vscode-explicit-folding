import { FoldingRange, FoldingRangeProvider, ProviderResult, TextDocument } from 'vscode'

type FoldingConfig = {
	begin?: string,
	end?: string,
	beginRegex?: string,
	endRegex?: string,
	offsetTop?: number,
	offsetBottom?: number,
	comment?: string,
	autoFix?: string,
}
type FoldingRegex = {
	begin: RegExp,
	end: RegExp,
	offsetTop: number,
	offsetBottom: number,
}
type FoldingOption = {
	comment?: string,
	autoFix?: string,
}

const matchOperatorRegex = /[-|\\{}()[\]^$+*?.]/g;

function escapeRegex(str: string) {
	return str.replace(matchOperatorRegex, '\\$&');
}

export default class ConfigurableFoldingProvider implements FoldingRangeProvider {
	private regexes: Array<FoldingRegex> = [];
	private option: FoldingOption = {};

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
					end: new RegExp(configuration.endRegex),
					offsetTop: configuration.offsetTop || 0,
					offsetBottom: configuration.offsetBottom || 0,
				});
			} else if (configuration.begin && configuration.end) {
				this.regexes.push({
					begin: new RegExp(escapeRegex(configuration.begin)),
					end: new RegExp(escapeRegex(configuration.end)),
					offsetTop: configuration.offsetTop || 0,
					offsetBottom: configuration.offsetBottom || 0,
				});
			}
			if (configuration.autoFix) {
				this.option.autoFix = configuration.autoFix;
			}
			if (configuration.comment) {
				this.option.comment = escapeRegex(configuration.comment);
			}
		} catch (err) {
		}
	}
	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
		const BEGIN = 1;
		const END = 2;
		let foldingRanges = [];
		let stack: { r: FoldingRegex, i: number }[] = [];
		var regstr = this.regexes.map((regexp, i) => `(?<_${BEGIN}_${i}>${regexp.begin.source})|(?<_${END}_${i}>${regexp.end.source})`).join('|')
			+ (this.option.comment ? `|(?<comment>${this.option.comment})` : '');
		let findOfRegexp = function* (line: string, str: string) {
			let left = 0;
			while (true) {
				let res = line.substring(left || 0).match(str) as { groups?: { [key: string]: string }, index?: number };
				if (res && res.groups) {
					if (res.groups['comment']) {
						break;
					}
					left = left + (res.index || 0) + 1;
					for (const key in res.groups) {
						if(res.groups[key]){
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
						if (this.option.autoFix) {
							if (stack[0].r != this.regexes[index]) {
								let tmp = stack.slice();
								while (tmp.length && tmp[0].r != this.regexes[index]) {
									tmp.shift();
								}
								if (tmp.length) {
									stack = tmp;
								} else {
									break;
								}
							}
						}
						let a = stack[0].i, b = i, c = stack[0].r.offsetTop, d = stack[0].r.offsetBottom;
						if (stack[0]) {
							if (a != b) {
								foldingRanges.push(new FoldingRange(a + c, b - 1 + d));
							}
						}
						stack.shift();
						break;
				}
			}
		}
		return foldingRanges;
	}
}