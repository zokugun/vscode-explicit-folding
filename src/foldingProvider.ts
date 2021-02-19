import { parse, Quantified, Token, types as TokenType } from 'regexp2/lib'
import { FoldingRange, FoldingRangeKind, FoldingRangeProvider, ProviderResult, TextDocument, window } from 'vscode'

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
	indentation?: boolean,
	offSide?: boolean;
	foldLastLine?: boolean | boolean[],
	nested?: boolean,
	kind?: 'comment' | 'region'
}

type FoldingRegex = {
	begin: RegExp,
	middle?: RegExp,
	end?: RegExp,
	unnested?: RegExp,
	continuation?: RegExp,
	foldLastLine: (...args: string[]) => boolean,
	nested: boolean,
	kind: FoldingRangeKind,
	endMatcher?: (...args: string[]) => string
}

type StackItem = {
	regex: FoldingRegex,
	line: number,
	expectedEnd?: string | null,
	separator?: boolean,
	continuation?: number
}

enum Marker {
	BEGIN,
	MIDDLE,
	END,
	CONTINUATION,
	DOCSTRING,
	SEPARATOR
}

interface PreviousRegion {
	indent: number; // indent or -2 if a marker
	endAbove: number; // end line number for the region above
	line: number; // start line of the region. Only used for marker regions.
}

const matchOperatorRegex = /[-|\\{}()[\]^$+*?.]/g;

const Tab = 9
const Space = 32

function computeIndentLevel(line: string, tabSize: number): number { // {{{
	let indent = 0;
	let i = 0;
	let len = line.length;

	while (i < len) {
		const chCode = line.charCodeAt(i);

		if (chCode === Space) {
			indent++;
		} else if (chCode === Tab) {
			indent = indent - indent % tabSize + tabSize;
		} else {
			break;
		}

		i++;
	}

	if (i === len) {
		return -1; // line only consists of whitespace
	}

	return indent;
} // }}}

function escapeRegex(str: string) { // {{{
	return str.replace(matchOperatorRegex, '\\$&');
} // }}}

function id<T>(value: T): () => T { // {{{
	return () => value;
} // }}}

function shouldFoldLastLine(foldLastLine: boolean[], groupIndex: number, endGroupCount: number): (...args: string[]) => boolean { // {{{
	return (...args) => {
		for(let i = groupIndex + 1, l = groupIndex + endGroupCount; i < l; ++i) {
			if(typeof args[i] !== 'undefined') {
				return foldLastLine[i - groupIndex];
			}
		}

		return foldLastLine[0];
	}
} // }}}

export default class ExplicitFoldingProvider implements FoldingRangeProvider {
	private groupIndex: number = 0;
	private masterRegex: RegExp;
	private offSideIndentation: boolean = false;
	private regexes: Array<FoldingRegex> = [];
	private useIndentation: boolean = false;

	public id: string = 'explicit';

	constructor(configuration: FoldingConfig | Array<FoldingConfig>) { // {{{
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
	} // }}}

	private addRegex(configuration: FoldingConfig): string { // {{{
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

					let middle
					if (configuration.middleRegex) {
						middle = new RegExp(configuration.middleRegex);

						if (middle.test('')) {
							return '';
						}
					}

					const groups = parse(configuration.beginRegex).body.filter(token => token.type == TokenType.CAPTURE_GROUP);

					let index = this.groupIndex + 1;
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

					const nested = typeof configuration.nested === 'boolean' ? configuration.nested : true;

					const regex: FoldingRegex = {
						begin,
						middle,
						end,
						foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
						nested,
						kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
						endMatcher
					};

					this.regexes.push(regex);

					let src = `(?<_${Marker.BEGIN}_${regexIndex}>${regex.begin.source})`;

					this.groupIndex += 1 + this.getCaptureGroupCount(configuration.beginRegex);

					const middleGroupCount = regex.middle ? 1 + this.getCaptureGroupCount(configuration.middleRegex!) : 0;
					const endGroupCount = 1 + this.getCaptureGroupCount(configuration.endRegex);

					if (Array.isArray(configuration.foldLastLine) && configuration.foldLastLine.length === endGroupCount) {
						const foldLastLine = configuration.foldLastLine;
						const groupIndex = 1 + (nested ? this.groupIndex : 0) + middleGroupCount;

						regex.foldLastLine = shouldFoldLastLine(foldLastLine, groupIndex, endGroupCount)
					}

					if (nested) {
						if (regex.middle) {
							src += `|(?<_${Marker.MIDDLE}_${regexIndex}>${regex.middle.source})`;

							this.groupIndex += middleGroupCount;
						}

						src += `|(?<_${Marker.END}_${regexIndex}>${regex.end!.source})`;

						this.groupIndex += endGroupCount;
					}
					else {
						if (regex.middle) {
							regex.unnested = new RegExp(`(?<_${Marker.MIDDLE}_${regexIndex}>${regex.middle.source})|(?<_${Marker.END}_${regexIndex}>${regex.end!.source})`);
						}
						else {
							regex.unnested = new RegExp(`(?<_${Marker.END}_${regexIndex}>${regex.end!.source})`);
						}
					}

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
					}

					const nested = typeof configuration.nested === 'boolean' ? configuration.nested : true;

					const regex: FoldingRegex = {
						begin,
						middle,
						end,
						foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
						nested,
						kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
					};

					this.regexes.push(regex);

					let src = `(?<_${Marker.BEGIN}_${regexIndex}>${regex.begin.source})`;

					this.groupIndex += 1;

					if (nested) {
						if (regex.middle) {
							src += `|(?<_${Marker.MIDDLE}_${regexIndex}>${regex.middle.source})`;

							this.groupIndex += 1;
						}

						src += `|(?<_${Marker.END}_${regexIndex}>${regex.end!.source})`;

						this.groupIndex += 1;
					}
					else {
						if (regex.middle) {
							regex.unnested = new RegExp(`(?<_${Marker.MIDDLE}_${regexIndex}>${regex.middle.source})|(?<_${Marker.END}_${regexIndex}>${regex.end!.source})`);
						}
						else {
							regex.unnested = new RegExp(`(?<_${Marker.END}_${regexIndex}>${regex.end!.source})`);
						}
					}

					return src;
				}
			} else if (configuration.beginRegex && configuration.continuationRegex) {
				const begin = new RegExp(configuration.beginRegex);
				const continuation = new RegExp(`${configuration.continuationRegex}$`);

				return this.addContinuationRegex(configuration, regexIndex, begin, continuation);
			} else if (configuration.begin && configuration.continuation) {
				const begin = new RegExp(escapeRegex(configuration.begin));
				const continuation = new RegExp(`${escapeRegex(configuration.continuation)}$`);

				return this.addContinuationRegex(configuration, regexIndex, begin, continuation);
			} else if (configuration.separatorRegex) {
				const separator = new RegExp(configuration.separatorRegex);

				return this.addSeparatorRegex(configuration, regexIndex, separator);
			} else if (configuration.separator) {
				const separator = new RegExp(escapeRegex(configuration.separator));

				return this.addSeparatorRegex(configuration, regexIndex, separator);
			} else if (configuration.indentation) {
				this.useIndentation = configuration.indentation;
				this.offSideIndentation = configuration.offSide || false;
			}
		} catch (err) {
		}

		return '';
	} // }}}

	private addContinuationRegex(configuration: FoldingConfig, regexIndex: number, begin: RegExp, continuation: RegExp): string { // {{{
		if (begin.test('') || continuation.test('')) {
			return '';
		}

		this.groupIndex += 2 + this.getCaptureGroupCount(begin.source) + this.getCaptureGroupCount(continuation.source);

		const regex = {
			begin,
			continuation,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : true,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.BEGIN}_${regexIndex}>${regex.begin.source})|(?<_${Marker.CONTINUATION}_${regexIndex}>${regex.continuation.source})`;
	} // }}}

	private addDocstringRegex(configuration: FoldingConfig, regexIndex: number, begin: RegExp): string { // {{{
		if (begin.test('')) {
			return '';
		}

		this.groupIndex += 1 + this.getCaptureGroupCount(begin.source);

		const regex = {
			begin,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : true,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.DOCSTRING}_${regexIndex}>${regex.begin.source})`;
	} // }}}

	private addSeparatorRegex(configuration: FoldingConfig, regexIndex: number, separator: RegExp): string { // {{{
		if (separator.test('')) {
			return '';
		}

		this.groupIndex += 1 + this.getCaptureGroupCount(separator.source);

		const regex = {
			begin: separator,
			foldLastLine: id(false),
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : true,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.SEPARATOR}_${regexIndex}>${regex.begin.source})`;
	} // }}}

	private *findOfRegexp(regex: RegExp, line: string, offset: number) { // {{{
		while (true) {
			const match = regex.exec(line.substring(offset)) as { groups?: { [key: string]: string }, index?: number, [key: number]: string };

			if (match && match.groups) {
				offset = offset + (match.index || 0) + match[0].length;

				for (const key in match.groups) {
					if (match.groups[key]) {
						const keys = key.split('_').map(x => parseInt(x));

						yield {
							type: keys[1],
							index: keys[2],
							match: (match as string[]),
							offset
						};

						break;
					}
				}
			} else {
				break;
			}
		}
	} // }}}

	private getCaptureGroupCount(regex: string): number { // {{{
		function count(tokens: Token[]): number {
			if(!tokens || tokens.length === 0) {
				return 0;
			}

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

		const ast = parse(regex) as any;

		if(ast.body) {
			return count(ast.body);
		} else if(ast.left && ast.right) {
			return count(ast.left.body) + count(ast.right.body);
		} else {
			return 0;
		}
	} // }}}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> { // {{{
		const foldingRanges: FoldingRange[] = [];

		if (this.useIndentation) {
			this.resolveIndentationRange(document, foldingRanges);
		}

		const stack: StackItem[] = [];

		let line = 0;

		while (line < document.lineCount) {
			line = this.resolveExplicitRange(document, foldingRanges, stack, line, 0);
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
	} // }}}

	private resolveExplicitRange(document: TextDocument, foldingRanges: FoldingRange[], stack: StackItem[], line: number, lineOffset: number): number { // {{{
		const text = document.lineAt(line).text;

		for (const { type, index, match, offset } of this.findOfRegexp(this.masterRegex, text, lineOffset)) {
			const regex = this.regexes[index];

			switch (type) {
				case Marker.BEGIN:
					if (!stack[0] || stack[0].regex.nested) {
						let expectedEnd = null;
						if (regex.endMatcher) {
							expectedEnd = regex.endMatcher(...match);
						}

						if (!regex.nested && regex.end) {
							const begin = line;

							const position = {
								line,
								offset
							};

							if (this.resolveUnnestedExplicitRange(document, foldingRanges, stack, regex, begin, expectedEnd, position)) {
								return position.line;
							}

							position.offset = 0;

							while (position.line < document.lineCount) {
								if (this.resolveUnnestedExplicitRange(document, foldingRanges, stack, regex, begin, expectedEnd, position)) {
									return position.line;
								}
							}

							return position.line + 1
						}
						else if (regex.continuation) {
							if (regex.continuation.test(document.lineAt(line).text)) {
								stack.unshift({ regex, line });
							}
							else {
								return line + 1;
							}
						}
						else {
							stack.unshift({ regex, line, expectedEnd });
						}
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

						if (regex.foldLastLine(...match)) {
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
						stack[0].continuation = line;
					}
					break;
				case Marker.DOCSTRING:
					if (stack[0] && stack[0].regex === regex) {
						const begin = stack[0].line;
						const end = line;

						if (regex.foldLastLine()) {
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

					if (regex.foldLastLine()) {
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
			else if (stack[0].line !== line) {
				stack.shift();
			}
		}

		return line + 1;
	} // }}}

	private resolveIndentationRange(document: TextDocument, foldingRanges: FoldingRange[]): void { // {{{
		const tabSize = window.activeTextEditor ? parseInt(`${window.activeTextEditor.options.tabSize || 4}`) : 4;

		const previousRegions: PreviousRegion[] = [{ indent: -1, endAbove: document.lineCount, line: document.lineCount }];

		for (let line = document.lineCount - 1; line >= 0; line--) {
			const lineContent = document.lineAt(line).text;
			const indent = computeIndentLevel(lineContent, tabSize);

			let previous = previousRegions[previousRegions.length - 1];

			if (indent === -1) {
				if (this.offSideIndentation) {
					// for offSide languages, empty lines are associated to the previous block
					// note: the next block is already written to the results, so this only
					// impacts the end position of the block before
					previous.endAbove = line;
				}
				continue; // only whitespace
			}

			if (previous.indent > indent) {
				// discard all regions with larger indent
				do {
					previousRegions.pop();
					previous = previousRegions[previousRegions.length - 1];
				} while (previous.indent > indent);

				// new folding range
				let endLineNumber = previous.endAbove - 1;
				if (endLineNumber - line >= 1) { // needs at east size 1
					foldingRanges.push(new FoldingRange(line, endLineNumber));
				}
			}

			if (previous.indent === indent) {
				previous.endAbove = line;
			} else { // previous.indent < indent
				// new region with a bigger indent
				previousRegions.push({ indent, endAbove: line, line });
			}
		}
	} // }}}

	private resolveUnnestedExplicitRange(document: TextDocument, foldingRanges: FoldingRange[], stack: StackItem[], regex: FoldingRegex, begin: number, expectedEnd: string | null, position: {line: number, offset: number}): boolean { // {{{
		for (const { type, match, offset } of this.findOfRegexp(regex.unnested!, document.lineAt(position.line).text, position.offset)) {
			switch (type) {
				case Marker.MIDDLE:
					const end = position.line;

					if (end > begin + 1) {
						foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
					}

					stack[0].line = position.line;
					break;
				case Marker.END:
					if (!expectedEnd || match[0] === expectedEnd) {
						const end = position.line;

						if (regex.foldLastLine()) {
							if (end > begin) {
								foldingRanges.push(new FoldingRange(begin, end, regex.kind));
							}
						} else {
							if (end > begin + 1) {
								foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
							}
						}

						position.line = this.resolveExplicitRange(document, foldingRanges, stack, position.line, offset);

						return true;
					}
					break;
			}
		}

		++position.line;

		return false;
	} // }}}
}
