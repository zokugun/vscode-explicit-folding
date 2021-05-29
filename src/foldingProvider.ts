import { basename } from 'path'
import { escape, parse, stringify, translate, visit, Flavor, Token, TokenType } from '@daiyam/regexp'
import { FoldingRange, FoldingRangeKind, FoldingRangeProvider, OutputChannel, ProviderResult, TextDocument, window } from 'vscode'
import { FoldingConfig } from './config'

type FoldingRegex = {
	index: number,
	begin?: RegExp,
	middle?: RegExp,
	end?: RegExp,
	loopRegex?: RegExp,
	while?: RegExp,
	continuation?: boolean,
	foldLastLine: (...args: string[]) => boolean,
	foldBOF: boolean,
	foldEOF: boolean,
	nested: boolean,
	kind: FoldingRangeKind,
	endMatcher?: (...args: string[]) => string,
	parents?: number[],
	strict?: boolean,
	name?: string
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
	DOCSTRING,
	SEPARATOR,
	WHILE
}

interface PreviousRegion {
	begin: number;
	end: number;
	indent: number;
}

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

function id<T>(value: T): () => T { // {{{
	return () => value;
} // }}}

function shouldFoldLastLine(foldLastLine: boolean[], groupIndex: number, endGroupCount: number): (...args: string[]) => boolean { // {{{
	return (...args) => {
		for (let i = groupIndex + 1, l = groupIndex + endGroupCount; i < l; ++i) {
			if (typeof args[i] !== 'undefined') {
				return foldLastLine[i - groupIndex];
			}
		}

		return foldLastLine[0];
	}
} // }}}

export default class ExplicitFoldingProvider implements FoldingRangeProvider {
	private groupIndex: number = 0;
	private mainRegex: RegExp;
	private offSideIndentation: boolean = false;
	private regexes: Array<FoldingRegex> = [];
	private useIndentation: boolean = false;
	private debugChannel: OutputChannel | null = null;

	public id: string = 'explicit';
	public isManagingLastLine: boolean = true;

	constructor(configuration: Array<FoldingConfig>, debugChannel: OutputChannel | null) { // {{{
		this.debugChannel = debugChannel;

		let source = '';

		for (const value of configuration) {
			const src = this.addRegex(value, true, []);

			if (src.length !== 0) {
				if (source.length !== 0) {
					source += '|';
				}

				source += src;
			}
		}

		if (source.length === 0) {
			this.mainRegex = new RegExp('a^');
		} else {
			this.mainRegex = new RegExp(source, 'g');
		}
	} // }}}

	private addRegex(configuration: FoldingConfig, strict: boolean, parents: number[]): string { // {{{
		const regexIndex = this.regexes.length;

		try {
			if (configuration.beginRegex && configuration.endRegex) {
				const begin = new RegExp(translate(configuration.beginRegex, Flavor.ES2018) as string);

				if (configuration.beginRegex === configuration.endRegex) {
					return this.addDocstringRegex(configuration, regexIndex, begin);
				} else {
					const middle = configuration.middleRegex && new RegExp(translate(configuration.middleRegex, Flavor.ES2018) as string) || undefined;
					const end = new RegExp(translate(configuration.endRegex, Flavor.ES2018) as string);

					return this.addBeginEndRegex(configuration, regexIndex, begin, middle, end, strict, parents);
				}
			} else if (configuration.begin && configuration.end) {
				const begin = new RegExp(escape(configuration.begin));

				if (configuration.begin === configuration.end) {
					return this.addDocstringRegex(configuration, regexIndex, begin);
				} else {
					const middle = configuration.middle && new RegExp(escape(configuration.middle)) || undefined;
					const end = new RegExp(escape(configuration.end));

					return this.addBeginEndRegex(configuration, regexIndex, begin, middle, end, strict, parents);
				}
			} else if (configuration.beginRegex && configuration.continuationRegex) {
				const begin = new RegExp(translate(configuration.beginRegex, Flavor.ES2018) as string);
				const continuation = new RegExp(`${translate(configuration.continuationRegex, Flavor.ES2018)}$`);

				return this.addContinuationRegex(configuration, regexIndex, begin, continuation);
			} else if (configuration.begin && configuration.continuation) {
				const begin = new RegExp(escape(configuration.begin));
				const continuation = new RegExp(`${escape(configuration.continuation)}$`);

				return this.addContinuationRegex(configuration, regexIndex, begin, continuation);
			} else if (configuration.beginRegex && configuration.whileRegex) {
				const begin = new RegExp(translate(configuration.beginRegex, Flavor.ES2018) as string);
				const whileRegex = new RegExp(translate(configuration.whileRegex, Flavor.ES2018) as string);

				return this.addBeginWhileRegex(configuration, regexIndex, begin, whileRegex);
			} else if (configuration.begin && configuration.while) {
				const begin = new RegExp(escape(configuration.begin));
				const whileRegex = new RegExp(escape(configuration.while));

				return this.addBeginWhileRegex(configuration, regexIndex, begin, whileRegex);
			} else if (configuration.whileRegex) {
				const whileRegex = new RegExp(translate(configuration.whileRegex, Flavor.ES2018) as string);

				return this.addWhileRegex(configuration, regexIndex, whileRegex);
			} else if (configuration.while) {
				const whileRegex = new RegExp(escape(configuration.while));

				return this.addWhileRegex(configuration, regexIndex, whileRegex);
			} else if (configuration.separatorRegex) {
				const separator = new RegExp(translate(configuration.separatorRegex, Flavor.ES2018) as string);

				return this.addSeparatorRegex(configuration, regexIndex, separator, strict, parents);
			} else if (configuration.separator) {
				const separator = new RegExp(escape(configuration.separator));

				return this.addSeparatorRegex(configuration, regexIndex, separator, strict, parents);
			} else if (configuration.indentation) {
				this.useIndentation = configuration.indentation;
				this.offSideIndentation = configuration.offSide || false;
			}
		} catch (err) {
			console.log(err)
			if (this.debugChannel) {
				this.debugChannel.appendLine(err.toString());
			}
		}

		return '';
	} // }}}

	private addBeginEndRegex(configuration: FoldingConfig, regexIndex: number, begin: RegExp, middle: RegExp | undefined, end: RegExp, strict: boolean, parents: number[]): string { // {{{
		if (begin.test('') || end.test('')) {
			return '';
		}

		if (middle && middle.test('')) {
			return '';
		}

		const groups = this.listCaptureGroups(begin.source)

		let index = this.groupIndex + 1;
		let endMatcher;

		if (groups.length !== 0) {
			let captures = configuration.endRegex!.split(/\\(\d+)/g);

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

				end = new RegExp(end.source.replace(/\\(\d+)/g, (_, group) => stringify(groups[Number(group) - 1].body)));
			}
		}

		const nested = typeof configuration.nested === 'boolean' ? configuration.nested : !Array.isArray(configuration.nested);

		const regex: FoldingRegex = {
			index: regexIndex,
			begin,
			middle,
			end,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF || false,
			nested,
			strict: typeof configuration.strict === 'boolean' ? configuration.strict : configuration.strict === 'never' ? false : strict,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			endMatcher
		};

		this.regexes.push(regex);

		let src = `(?<_${Marker.BEGIN}_${regexIndex}>${regex.begin!.source})`;

		this.groupIndex += 1 + this.getCaptureGroupCount(begin.source);

		const middleGroupCount = regex.middle ? 1 + this.getCaptureGroupCount(middle!.source) : 0;
		const endGroupCount = 1 + this.getCaptureGroupCount(end.source);

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
			regex.name = configuration.name ?? `loop=${regexIndex}`;

			if (Array.isArray(configuration.nested)) {
				const regexes = configuration.nested.map((config) => this.addRegex(config, configuration.strict === 'never' ? false : strict, [...parents, regexIndex])).filter((regex) => regex.length !== 0);

				if (!configuration.strict) {
					src += `|${regexes.join('|')}`
				}

				if (regex.middle) {
					regex.loopRegex = new RegExp(`(?<_${Marker.MIDDLE}_${regexIndex}>${regex.middle.source})|(?<_${Marker.END}_${regexIndex}>${regex.end!.source})|${regexes.join('|')}`, 'g');
				}
				else {
					regex.loopRegex = new RegExp(`(?<_${Marker.END}_${regexIndex}>${regex.end!.source})|${regexes.join('|')}`, 'g');
				}
			}
			else {
				if (regex.middle) {
					regex.loopRegex = new RegExp(`(?<_${Marker.MIDDLE}_${regexIndex}>${regex.middle.source})|(?<_${Marker.END}_${regexIndex}>${regex.end!.source})`, 'g');
				}
				else {
					regex.loopRegex = new RegExp(`(?<_${Marker.END}_${regexIndex}>${regex.end!.source})`, 'g');
				}
			}
		}

		return src;
	} // }}}

	private addBeginWhileRegex(configuration: FoldingConfig, regexIndex: number, begin: RegExp, whileRegex: RegExp): string { // {{{
		if (begin.test('') || whileRegex.test('')) {
			return '';
		}

		this.groupIndex += 1 + this.getCaptureGroupCount(begin.source);

		const regex = {
			index: regexIndex,
			begin,
			while: whileRegex,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF || false,
			nested: false,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.BEGIN}_${regexIndex}>${regex.begin.source})`;
	} // }}}

	private addContinuationRegex(configuration: FoldingConfig, regexIndex: number, begin: RegExp, whileRegex: RegExp): string { // {{{
		if (begin.test('') || whileRegex.test('')) {
			return '';
		}

		this.groupIndex += 1 + this.getCaptureGroupCount(begin.source);

		const regex = {
			index: regexIndex,
			begin,
			while: whileRegex,
			continuation: true,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF || false,
			nested: false,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.BEGIN}_${regexIndex}>${regex.begin.source})`;
	} // }}}

	private addDocstringRegex(configuration: FoldingConfig, regexIndex: number, begin: RegExp): string { // {{{
		if (begin.test('')) {
			return '';
		}

		this.groupIndex += 1 + this.getCaptureGroupCount(begin.source);

		const regex = {
			index: regexIndex,
			begin,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF || false,
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : true,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.DOCSTRING}_${regexIndex}>${regex.begin.source})`;
	} // }}}

	private addSeparatorRegex(configuration: FoldingConfig, regexIndex: number, separator: RegExp, strict: boolean, parents: number[]): string { // {{{
		if (separator.test('')) {
			return '';
		}

		this.groupIndex += 1 + this.getCaptureGroupCount(separator.source);

		const regex = {
			index: regexIndex,
			begin: separator,
			foldLastLine: id(false),
			foldBOF: typeof configuration.foldBOF === 'boolean' ? configuration.foldBOF : true,
			foldEOF: typeof configuration.foldEOF === 'boolean' ? configuration.foldEOF : true,
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : true,
			strict: typeof configuration.strict === 'boolean' ? configuration.strict : configuration.strict === 'never' ? false : strict,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			parents,
		};

		this.regexes.push(regex);

		const nested = configuration.descendants || (Array.isArray(configuration.nested) ? configuration.nested : null)

		if (nested) {
			const regexes = nested.map((config) => this.addRegex(config, configuration.strict === 'never' ? false : strict, [...parents, regexIndex])).filter((regex) => regex.length !== 0);

			return `(?<_${Marker.SEPARATOR}_${regexIndex}>${regex.begin.source})|${regexes.join('|')}`;
		} else {
			return `(?<_${Marker.SEPARATOR}_${regexIndex}>${regex.begin.source})`;
		}
	} // }}}

	private addWhileRegex(configuration: FoldingConfig, regexIndex: number, whileRegex: RegExp): string { // {{{
		if (whileRegex.test('')) {
			return '';
		}

		this.groupIndex += 1 + this.getCaptureGroupCount(whileRegex.source);

		const regex = {
			index: regexIndex,
			while: whileRegex,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF || false,
			nested: false,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
		};

		this.regexes.push(regex);

		return `(?<_${Marker.WHILE}_${regexIndex}>${regex.while.source})`;
	} // }}}

	private doEOF(document: TextDocument, foldingRanges: FoldingRange[], stack: StackItem[]): void { // {{{
		const end = document.lineCount;
		while (stack[0]) {
			if (stack[0].regex.foldEOF) {
				const begin = stack[0].line;

				if (end > begin + 1) {
					foldingRanges.push(new FoldingRange(begin, end - 1, stack[0].regex.kind));
				}
			}

			stack.shift();
		}
	} // }}}

	private doWhile(document: TextDocument, foldingRanges: FoldingRange[], regex: FoldingRegex, line: number, continuation: boolean): number { // {{{
		const begin = line;

		while (++line < document.lineCount) {
			const text = document.lineAt(line).text;

			if (!regex.while!.test(text)) {
				const end = line - (continuation ? 0 : 1);

				if (regex.foldLastLine()) {
					if (end > begin) {
						foldingRanges.push(new FoldingRange(begin, end, regex.kind));
					}

					return end + 1;
				} else {
					if (end > begin + 1) {
						foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
					}

					return end;
				}
			}
		}

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

		return line;
	} // }}}

	private *findOfRegexp(regex: RegExp, line: string, offset: number) { // {{{
		// reset regex
		regex.lastIndex = 0;

		while (true) {
			const match = regex.exec(line) as { groups?: { [key: string]: string }, index?: number, [key: number]: string };

			if (match && match.groups) {
				if (match[0].length === 0) {
					break;
				}

				const index = match.index || 0;
				if (index < offset) {
					continue;
				}

				const nextOffset = offset + index + match[0].length;

				for (const key in match.groups) {
					if (match.groups[key]) {
						const keys = key.split('_').map(x => parseInt(x));

						yield {
							type: keys[1],
							index: keys[2],
							match: (match as string[]),
							offset,
							nextOffset
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
		const ast = parse(regex);

		let count = 0;

		visit(ast.body, {
			[TokenType.CAPTURE_GROUP]() {
				++count;
			}
		});

		return count;
	} // }}}

	private listCaptureGroups(regex: string): Token[] { // {{{
		const ast = parse(regex);

		const groups: Token[] = [];

		visit(ast.body, {
			[TokenType.CAPTURE_GROUP](token) {
				groups.push(token);
			}
		});

		return groups;
	} // }}}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> { // {{{
		if (this.debugChannel) {
			this.debugChannel.show(true);

			this.debugChannel.appendLine(`[document] lang: ${document.languageId}, fileName: ${basename(document.fileName)}`);
			this.debugChannel.appendLine(`[main] regex: ${this.mainRegex.toString()}`);
		}

		const foldingRanges: FoldingRange[] = [];

		const stack: StackItem[] = [];

		let line = 0;

		while (line < document.lineCount) {
			line = this.resolveExplicitRange(document, foldingRanges, 'main', this.mainRegex, stack, false, line, 0);
		}

		this.doEOF(document, foldingRanges, stack);

		if (this.useIndentation) {
			this.resolveIndentationRange(document, foldingRanges);
		}

		if (this.debugChannel) {
			this.debugChannel.appendLine(`[document] foldings: ${JSON.stringify(foldingRanges)}`);
		}

		return foldingRanges;
	} // }}}

	private resolveExplicitRange(document: TextDocument, foldingRanges: FoldingRange[], name: String, regexp: RegExp, stack: StackItem[], secondaryLoop: boolean, line: number, lineOffset: number): number { // {{{
		const text = document.lineAt(line).text;

		for (const { type, index, match, offset, nextOffset } of this.findOfRegexp(regexp, text, lineOffset)) {
			const regex = this.regexes[index];

			if (this.debugChannel) {
				this.debugChannel.appendLine(`[${name}] line: ${line + 1}, offset: ${offset}, type: ${Marker[type]}, match: ${match[0]}, regex: ${index}`);
			}

			switch (type) {
				case Marker.BEGIN:
					if (!stack[0] || stack[0].regex.nested) {
						let expectedEnd = null;
						if (regex.endMatcher) {
							expectedEnd = regex.endMatcher(...match);
						}

						if (!regex.nested && regex.end) {
							const loopRegex = regex.loopRegex!;
							const name = regex.name!;

							if (this.debugChannel) {
								this.debugChannel.appendLine(`[${name}] regex: ${loopRegex.toString()}`);
							}

							const stack: StackItem[] = [{ regex, line, expectedEnd }];

							line = this.resolveExplicitRange(document, foldingRanges, name, loopRegex, stack, true, line, nextOffset);

							while (stack.length != 0 && line < document.lineCount) {
								line = this.resolveExplicitRange(document, foldingRanges, name, loopRegex, stack, true, line, 0);
							}

							if (stack.length != 0 && line >= document.lineCount) {
								this.doEOF(document, foldingRanges, stack);
							}

							return line;
						} else if (regex.continuation) {
							if (!regex.while!.test(text)) {
								return line + 1;
							}

							return this.doWhile(document, foldingRanges, regex, line, true);
						} else if (regex.while) {
							return this.doWhile(document, foldingRanges, regex, line, false);
						} else {
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
					const last = stack.length && stack[stack.length - 1];
					if (secondaryLoop && last && last.regex === regex && (!last.expectedEnd || match[0] === last.expectedEnd)) {
						const end = line;

						while (stack.length > 1) {
							const begin = stack[0].line;

							if (end > begin + 1) {
								foldingRanges.push(new FoldingRange(begin, end - 1, stack[0].regex.kind));
							}

							stack.shift();
						}

						stack.shift();

						const begin = last.line;

						if (regex.foldLastLine()) {
							if (end > begin) {
								foldingRanges.push(new FoldingRange(begin, end, regex.kind));
							}

							return line + 1;
						} else {
							if (end > begin + 1) {
								foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
							}

							return line;
						}
					} else if (stack[0] && stack[0].regex === regex && (!stack[0].expectedEnd || match[0] === stack[0].expectedEnd)) {
						const end = line;

						const begin = stack[0].line;

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
					if (!stack[0]) {
						if (regex.foldBOF) {
							if (line > 1) {
								foldingRanges.push(new FoldingRange(0, line - 1, regex.kind));
							}

							stack.unshift({ regex, line, separator: true });
						} else if (!regex.parents || !regex.parents.length) {
							stack.unshift({ regex, line, separator: true });
						}
					} else {
						while (stack.length && stack[0].regex.parents && stack[0].regex.parents!.includes(index)) {
							const begin = stack.shift()!.line;
							const end = line;

							if (end > begin + 1) {
								foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
							}
						}

						if (!stack.length) {
							if (!regex.parents || !regex.parents.length) {
								stack.unshift({ regex, line, separator: true });
							}
						} else if (stack[0].regex === regex) {
							const begin = stack[0].line;
							const end = line;

							if (end > begin + 1) {
								foldingRanges.push(new FoldingRange(begin, end - 1, regex.kind));
							}

							stack[0].line = line;
						} else if (stack[0].regex.nested || (secondaryLoop && stack.length === 1)) {
							if (!regex.parents || !regex.parents.length) {
								stack.unshift({ regex, line, separator: true });
							} else {
								const parent = regex.parents![regex.parents!.length - 1];

								if (this.regexes[parent].strict) {
									if (stack.some(({ regex: { index } }) => parent === index)) {
										stack.unshift({ regex, line, separator: true });
									}
								} else if (stack.some(({ regex: { index } }) => regex.parents!.includes(index))) {
									stack.unshift({ regex, line, separator: true });
								}
							}
						}
					}
					break;
				case Marker.WHILE:
					return this.doWhile(document, foldingRanges, regex, line, false);
			}
		}

		return line + 1;
	} // }}}

	private resolveIndentationRange(document: TextDocument, foldingRanges: FoldingRange[]): void { // {{{
		const tabSize = window.activeTextEditor ? parseInt(`${window.activeTextEditor.options.tabSize || 4}`) : 4;

		const existingRanges: { [key: string]: boolean } = {}
		for (const range of foldingRanges) {
			existingRanges[range.start] = true
		}

		const previousRegions: PreviousRegion[] = [{ indent: -1, begin: document.lineCount, end: document.lineCount }];

		for (let line = document.lineCount - 1; line >= 0; line--) {
			const lineContent = document.lineAt(line).text;
			const indent = computeIndentLevel(lineContent, tabSize);

			let previous = previousRegions[previousRegions.length - 1];

			if (indent === -1) {
				if (this.offSideIndentation) {
					// for offSide languages, empty lines are associated to the previous block
					// note: the next block is already written to the results, so this only
					// impacts the end position of the block before
					previous.end = line;
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
				let endLineNumber = previous.end - 1;
				if (endLineNumber - line >= 1) { // needs at east size 1
					if (!existingRanges[line]) {
						foldingRanges.push(new FoldingRange(line, endLineNumber, FoldingRangeKind.Region));
					}
				}
			}

			if (previous.indent === indent) {
				previous.end = line;
			} else { // previous.indent < indent
				// new region with a bigger indent
				previousRegions.push({ indent, begin: line, end: line });
			}
		}
	} // }}}
}
