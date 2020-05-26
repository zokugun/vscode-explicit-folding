import { parse, Token, types as TokenType, Quantified } from 'regexp2/lib'
import { FoldingRange, FoldingRangeKind, FoldingRangeProvider, ProviderResult, TextDocument } from 'vscode'

type FoldingConfig = {
	begin?: string,
	middle?: string,
	end?: string,
	continuation?: string,
	beginRegex?: string,
	middleRegex?: string,
	endRegex?: string,
	continuationRegex?: string,
	separator?: string,
	separatorRegex?: string,
	foldLastLine?: boolean,
	nested?: boolean,
	kind?: 'comment' | 'region'
}

type FoldingRegex = {
	begin: RegExp,
	middle?: RegExp,
	end?: RegExp,
	continuation?: RegExp,
	foldLastLine: boolean,
	nested: boolean,
	kind: FoldingRangeKind,
	endMatcher?: (...args: string[]) => string
}

enum Marker {
	BEGIN,
	MIDDLE,
	END,
	CONTINUATION,
	DOCSTRING,
	SEPARATOR
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
		const regexIndex = this.regexes.length;

		try {
			if (configuration.beginRegex && configuration.endRegex) {
				if (configuration.beginRegex === configuration.endRegex) {
					const begin = new RegExp(configuration.beginRegex);

					return this.addDocstringRegex(configuration, regexIndex, begin);
				} else {
					let begin = new RegExp(configuration.beginRegex);
					let end = new RegExp(configuration.endRegex);

					if (begin.test('') || end.test('')) {
						return '';
					}

					let index = this.groupIndex + 1;

					let middle
					if (configuration.middleRegex) {
						middle = new RegExp(configuration.middleRegex);

						if (middle.test('')) {
							return '';
						}

						this.groupIndex += 1 + this.getCaptureGroupCount(configuration.middleRegex)
					}

					this.groupIndex += 2 + this.getCaptureGroupCount(configuration.beginRegex) + this.getCaptureGroupCount(configuration.endRegex);

					const groups = parse(configuration.beginRegex).body.filter(token => token.type == TokenType.CAPTURE_GROUP);

					let endMatcher;
					if (groups.length !== 0) {
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

					const regex = {
						begin,
						middle,
						end,
						foldLastLine: typeof configuration.foldLastLine === "boolean" ? configuration.foldLastLine : true,
						nested: typeof configuration.nested === "boolean" ? configuration.nested : true,
						kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
						endMatcher
					};

					this.regexes.push(regex);

					let src = `(?<_${Marker.BEGIN}_${regexIndex}>${regex.begin.source})`

					if (regex.middle) {
						src += `|(?<_${Marker.MIDDLE}_${regexIndex}>${regex.middle.source})`;
					}

					src += `|(?<_${Marker.END}_${regexIndex}>${regex.end.source})`;

					return src;
				}
			} else if (configuration.begin && configuration.end) {
				if (configuration.begin === configuration.end) {
					const begin = new RegExp(escapeRegex(configuration.begin));

					return this.addDocstringRegex(configuration, regexIndex, begin);
				} else {
					const begin = new RegExp(escapeRegex(configuration.begin));
					const end = new RegExp(escapeRegex(configuration.end));

					if (begin.test('') || end.test('')) {
						return '';
					}

					let middle;
					if (configuration.middle) {
						middle = new RegExp(escapeRegex(configuration.middle));

						if (middle.test('')) {
							return '';
						}

						this.groupIndex += 3;
					} else {
						this.groupIndex += 2;
					}

					const regex = {
						begin,
						middle,
						end,
						foldLastLine: typeof configuration.foldLastLine === "boolean" ? configuration.foldLastLine : true,
						nested: typeof configuration.nested === "boolean" ? configuration.nested : true,
						kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
					};

					this.regexes.push(regex);

					let src = `(?<_${Marker.BEGIN}_${regexIndex}>${regex.begin.source})`

					if (regex.middle) {
						src += `|(?<_${Marker.MIDDLE}_${regexIndex}>${regex.middle.source})`;
					}

					src += `|(?<_${Marker.END}_${regexIndex}>${regex.end.source})`;

					return src;
				}
			} else if (configuration.beginRegex && configuration.continuationRegex) {
				const continuation = new RegExp(`${configuration.continuationRegex}$`);
				const begin = new RegExp(`${configuration.beginRegex}.*${continuation.source}`);

				return this.addContinuationRegex(configuration, regexIndex, begin, continuation);
			} else if (configuration.begin && configuration.continuation) {
				const continuation = new RegExp(`${escapeRegex(configuration.continuation)}$`);
				const begin = new RegExp(`${escapeRegex(configuration.begin)}.*${continuation.source}`);

				return this.addContinuationRegex(configuration, regexIndex, begin, continuation);
			} else if (configuration.separatorRegex) {
				const separator = new RegExp(configuration.separatorRegex);

				return this.addSeparatorRegex(configuration, regexIndex, separator);
			} else if (configuration.separator) {
				const separator = new RegExp(escapeRegex(configuration.separator));

				return this.addSeparatorRegex(configuration, regexIndex, separator);
			} else {
				return '';
			}
		} catch (err) {
			return '';
		}
	}

	private addContinuationRegex(configuration: FoldingConfig, regexIndex: number, begin: RegExp, continuation: RegExp): string {
		if (begin.test('') || continuation.test('')) {
			return '';
		}

		this.groupIndex += 2 + this.getCaptureGroupCount(begin.source) + this.getCaptureGroupCount(continuation.source);

		const regex = {
			begin,
			continuation,
			foldLastLine: typeof configuration.foldLastLine === "boolean" ? configuration.foldLastLine : true,
			nested: typeof configuration.nested === "boolean" ? configuration.nested : true,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.BEGIN}_${regexIndex}>${regex.begin.source})|(?<_${Marker.CONTINUATION}_${regexIndex}>${regex.continuation.source})`;
	}

	private addDocstringRegex(configuration: FoldingConfig, regexIndex: number, begin: RegExp): string {
		if (begin.test('')) {
			return '';
		}

		this.groupIndex += 1 + this.getCaptureGroupCount(begin.source);

		const regex = {
			begin,
			foldLastLine: typeof configuration.foldLastLine === "boolean" ? configuration.foldLastLine : true,
			nested: typeof configuration.nested === "boolean" ? configuration.nested : true,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.DOCSTRING}_${regexIndex}>${regex.begin.source})`;
	}

	private addSeparatorRegex(configuration: FoldingConfig, regexIndex: number, separator: RegExp): string {
		if (separator.test('')) {
			return '';
		}

		this.groupIndex += 1 + this.getCaptureGroupCount(separator.source);

		const regex = {
			begin: separator,
			foldLastLine: false,
			nested: typeof configuration.nested === "boolean" ? configuration.nested : true,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.SEPARATOR}_${regexIndex}>${regex.begin.source})`;
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

	private getCaptureGroupCount(regex: string): number {
		function count(tokens: Token[]): number {
			return tokens
				.map((token): number => {
					if (token.type == TokenType.CAPTURE_GROUP || (token.type == TokenType.QUANTIFIED && (token as Quantified).body.type == TokenType.CAPTURE_GROUP)) {
						return 1;
					} else {
						return 0;
					}
				})
				.reduce((a: number, b: number): number => a + b, 0);
		}

		return count(parse(regex).body);
	}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
		const foldingRanges = [];
		const stack: { regex: FoldingRegex, line: number, expectedEnd?: string, separator?: boolean, continuation?: number }[] = [];

		for (let line = 0; line < document.lineCount; line++) {
			for (const { type, index, match } of this.findOfRegexp(document.lineAt(line).text)) {
				const regex = this.regexes[index];

				switch (type) {
					case Marker.BEGIN:
						if (!stack[0] || stack[0].regex.nested) {
							let expectedEnd;
							if (regex.endMatcher) {
								expectedEnd = regex.endMatcher(...match);
							}

							stack.unshift({ regex, line, expectedEnd });
						}
						break;
					case Marker.MIDDLE:
						if (stack[0] && stack[0].regex === regex) {
							const begin = stack[0].line;
							const end = line;

							if (end > begin + 1) {
								foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
							}

							stack[0].line = line;
						}
						break;
					case Marker.END:
						if (stack[0] && stack[0].regex === regex && (!stack[0].expectedEnd || match[0] === stack[0].expectedEnd)) {
							const begin = stack[0].line;
							const end = line;

							if (regex.foldLastLine) {
								if (end > begin) {
									foldingRanges.push(new FoldingRange(begin, end, regex.kind));
								}
							} else {
								if (end > begin + 1) {
									foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
								}
							}

							stack.shift();
						}
						break;
					case Marker.CONTINUATION:
						if (stack[0] && stack[0].regex === regex) {
							stack[0].continuation = line
						}
						break;
					case Marker.DOCSTRING:
						if (stack[0] && stack[0].regex === regex) {
							const begin = stack[0].line;
							const end = line;

							if (regex.foldLastLine) {
								if (end > begin) {
									foldingRanges.push(new FoldingRange(begin, end, regex.kind));
								}
							} else {
								if (end > begin + 1) {
									foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
								}
							}

							stack.shift();
						} else if (!stack[0] || stack[0].regex.nested) {
							stack.unshift({ regex, line });
						}
						break;
					case Marker.SEPARATOR:
						if (stack[0] && stack[0].regex === regex) {
							const begin = stack[0].line;
							const end = line;

							if (end > begin + 1) {
								foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
							}

							stack[0].line = line;
						} else if (!stack[0] || stack[0].regex.nested) {
							if (line > 1) {
								foldingRanges.push(new FoldingRange(0, line - 1, regex.kind));
							}

							stack.unshift({ regex, line, separator: true });
						}
						break;
				}
			}

			if (stack[0] && stack[0].regex.continuation) {
				if (stack[0].continuation) {
					if (stack[0].continuation != line) {
						const regex = stack[0].regex;
						const begin = stack[0].line;
						const end = line;

						if (regex.foldLastLine) {
							if (end > begin) {
								foldingRanges.push(new FoldingRange(begin, end, regex.kind));
							}
						} else {
							if (end > begin + 1) {
								foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
							}
						}

						stack.shift();
					}
				}
				else if (stack[0].line != line) {
					stack.shift();
				}
			}
		}

		if (stack[0] && stack[0].separator) {
			const begin = stack[0].line;
			const end = document.lineCount;

			if (end > begin + 1) {
				foldingRanges.push(new FoldingRange(begin, end - 1, stack[0].regex.kind));
			}

			stack.shift();
		}

		return foldingRanges;
	}
}