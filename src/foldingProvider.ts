import { parse } from 'regexp2'
import { FoldingRange, FoldingRangeKind, FoldingRangeProvider, ProviderResult, TextDocument } from 'vscode'

type FoldingConfig = {
	begin?: string,
	middle?: string,
	end?: string,
	beginRegex?: string,
	middleRegex?: string,
	endRegex?: string,
	foldLastLine?: boolean,
	kind?: 'comment' | 'region'
}

type FoldingRegex = {
	begin: RegExp,
	middle?: RegExp,
	end: RegExp,
	foldLastLine: boolean,
	kind: FoldingRangeKind,
	endMatcher?: (...args: string[]) => string
}

enum Marker {
	BEGIN,
	MIDDLE,
	END
}

const matchOperatorRegex = /[-|\\{}()[\]^$+*?.]/g;

function escapeRegex(str: string) {
	return str.replace(matchOperatorRegex, '\\$&');
}

export default class ExplicitFoldingProvider implements FoldingRangeProvider {
	private groupIndex: number = 0;
	private masterRegex: RegExp;
	private regexes: Array<FoldingRegex> = [];

	public id: string = 'explicit';

	constructor(configuration: FoldingConfig | Array<FoldingConfig>) {
		let source = '';

		if (configuration instanceof Array) {
			for (const value of configuration) {
				const src = this.addRegex(value);

				if (src.length !== 0) {
					if (source.length !== 0) {
						source += '|';
					}

					source += src;
				}
			}
		} else {
			source = this.addRegex(configuration);
		}

		if (source.length === 0) {
			this.masterRegex = new RegExp('a^');
		} else {
			this.masterRegex = new RegExp(source);
		}
	}

	private addRegex(configuration: FoldingConfig): string {
		let regex = null

		try {
			if (configuration.beginRegex && configuration.endRegex) {
				let begin = new RegExp(configuration.beginRegex)
				let end = new RegExp(configuration.endRegex)

				let index = this.groupIndex + 1

				let middle
				if (configuration.middleRegex) {
					middle = new RegExp(configuration.middleRegex)

					this.groupIndex += 3;
				} else {
					this.groupIndex += 2;
				}

				const groups = parse(configuration.beginRegex).body.filter(token => token.type == 'capture-group');

				let endMatcher
				if (groups.length !== 0) {
					this.groupIndex += groups.length

					let captures = configuration.endRegex.split(/\\(\d+)/g);

					if (captures.length > 0) {
						const last = captures.length - 1;

						let src = '""';

						for (let i = 0; i <= last; i += 2) {
							if (i === last) {
								if (captures[i].length !== 0) {
									src += ' + "' + captures[i].replace(/"/g, '\\"') + '"';
								}
							} else {
								src += ' + "' + captures[i].replace(/"/g, '\\"') + '" + args[' + (++index) + ']';
							}
						}

						endMatcher = eval('(function(){return function(...args) { return ' + src + ';};})()') as (...args: string[]) => string;

						end = new RegExp(configuration.endRegex.replace(/\\(\d+)/g, (_, group) => groups[Number(group) - 1].text));
					}
				}

				regex = {
					begin,
					middle,
					end,
					foldLastLine: typeof configuration.foldLastLine === "boolean" ? configuration.foldLastLine : true,
					kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
					endMatcher
				};
			} else if (configuration.begin && configuration.end) {
				const begin = new RegExp(escapeRegex(configuration.begin))
				const end = new RegExp(escapeRegex(configuration.end))

				let middle
				if (configuration.middle) {
					middle = new RegExp(escapeRegex(configuration.middle))

					this.groupIndex += 3;
				} else {
					this.groupIndex += 2;
				}

				regex = {
					begin,
					middle,
					end,
					foldLastLine: typeof configuration.foldLastLine === "boolean" ? configuration.foldLastLine : true,
					kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
				};
			}
		} catch (err) {
			return '';
		}

		if (regex) {
			const index = this.regexes.length;

			this.regexes.push(regex);

			let src = `(?<_${Marker.BEGIN}_${index}>${regex.begin.source})`

			if (regex.middle) {
				src += `|(?<_${Marker.MIDDLE}_${index}>${regex.middle.source})`;
			}

			src += `|(?<_${Marker.END}_${index}>${regex.end.source})`;

			return src;
		} else {
			return '';
		}
	}

	private *findOfRegexp(line: string) {
		let left = 0;

		while (true) {
			const match = this.masterRegex.exec(line.substring(left || 0)) as { groups?: { [key: string]: string }, index?: number, [key: number]: string };

			if (match && match.groups) {
				left = left + (match.index || 0) + match[0].length;

				for (const key in match.groups) {
					if (match.groups[key]) {
						const keys = key.split('_').map(x => parseInt(x));

						yield {
							type: keys[1],
							index: keys[2],
							match: (match as string[])
						};

						break;
					}
				}
			} else {
				break;
			}
		}
	}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
		const foldingRanges = [];
		const stack: { regex: FoldingRegex, line: number, expectedEnd?: string }[] = [];

		for (let line = 0; line < document.lineCount; line++) {
			for (const { type, index, match } of this.findOfRegexp(document.lineAt(line).text)) {
				const regex = this.regexes[index]

				switch (type) {
					case Marker.BEGIN:
						let expectedEnd
						if (regex.endMatcher) {
							expectedEnd = regex.endMatcher(...match)
						}

						stack.unshift({ regex, line, expectedEnd });
						break;
					case Marker.MIDDLE:
						if (stack[0] && stack[0].regex === regex) {
							const begin = stack[0].line;
							const end = line;

							if (begin != end) {
								foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
							}

							stack.shift();
						}

						stack.unshift({ regex, line });
						break;
					case Marker.END:
						if (stack[0] && stack[0].regex === regex && (!stack[0].expectedEnd || match[0] === stack[0].expectedEnd)) {
							const begin = stack[0].line;
							const end = line;

							if (begin != end) {
								foldingRanges.push(new FoldingRange(begin, regex.foldLastLine ? end : end - 1, regex.kind));
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