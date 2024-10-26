import { basename } from 'path';
import { escape, parse, translate, visit, Flavor, Token, TokenType } from '@daiyam/regexp';
import { ExplicitFoldingConfig } from '@zokugun/vscode.explicit-folding-api';
import { commands, FoldingRange, FoldingRangeKind, FoldingRangeProvider, OutputChannel, ProviderResult, TextDocument, window } from 'vscode';

interface EndMatch {
	index: number;
	regex: string;
}
type EndMatcher = (escape: (value: string) => string, offset: number, ...args: string[]) => string;
type EndMatches = Record<number, EndMatch[]>;

enum Marker {
	BEGIN,
	MIDDLE,
	END,
	DOCSTRING,
	SEPARATOR,
	WHILE,
}

interface GroupContext {
	index: number;
}

interface IndentationConfig {
	enabled: boolean;
	offSide: boolean;
	filter?: RegExp;
}

interface PreviousRegion {
	begin: number;
	end: number;
	indent: number;
}

interface Position {
	line: number;
	offset: number;
}

interface Rule {
	index: number;
	begin?: RegExp;
	middle?: RegExp;
	end?: RegExp;
	loopRegex?: RegExp;
	while?: RegExp;
	continuation?: boolean;
	consumeEnd?: (offset?: number, ...args: string[]) => boolean;
	foldLastLine: (offset?: number, ...args: string[]) => boolean;
	foldBOF: boolean;
	foldEOF: boolean;
	nested: boolean;
	kind: FoldingRangeKind;
	endMatcher?: EndMatcher;
	parents?: number[];
	strict?: boolean;
	name?: string;
	autoFold?: boolean;
}

interface StackItem {
	rule: Rule;
	line: number;
	continuation?: number;
	endIndex?: number;
	separator?: boolean;
}

const TAB = 9;
const SPACE = 32;

function computeIndentLevel(line: string, tabSize: number): number { // {{{
	let indent = 0;
	let i = 0;
	const length = line.length;

	while(i < length) {
		const chCode = line.codePointAt(i);

		if(chCode === SPACE) {
			indent++;
		}
		else if(chCode === TAB) {
			indent = indent - (indent % tabSize) + tabSize;
		}
		else {
			break;
		}

		i++;
	}

	if(i === length) {
		return -1; // line only consists of whitespace
	}

	return indent;
} // }}}

function id<T>(value: T): () => T { // {{{
	return () => value;
} // }}}

function shouldFoldLastLine(foldLastLine: boolean[], groupIndex: number, endGroupCount: number): (offset?: number, ...args: string[]) => boolean { // {{{
	return (offset, ...args) => {
		for(let i = groupIndex + 1, l = groupIndex + endGroupCount; i < l; ++i) {
			if(typeof args[i + offset!] !== 'undefined') {
				return foldLastLine[i - groupIndex];
			}
		}

		return foldLastLine[0];
	};
} // }}}

export class FoldingProvider implements FoldingRangeProvider {
	private readonly autoFoldDocuments: TextDocument[];
	private readonly debugChannel: OutputChannel | undefined;
	private readonly mainRegex: RegExp;
	private readonly indentation: IndentationConfig = {
		enabled: false,
		offSide: false,
	};

	private readonly rules: Rule[] = [];

	constructor(configuration: ExplicitFoldingConfig[], debugChannel: OutputChannel | undefined, documents: TextDocument[]) { // {{{
		this.debugChannel = debugChannel;
		this.autoFoldDocuments = documents;

		const groupContext = { index: 0 };

		let source = '';

		for(const value of configuration) {
			const src = this.addRegex(value, groupContext, true, []);

			if(src.length > 0) {
				if(source.length > 0) {
					source += '|';
				}

				source += src;
			}
		}

		this.mainRegex = source.length === 0 ? /a^/ : new RegExp(source, 'g');
	} // }}}

	public provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> { // {{{
		if(this.debugChannel) {
			this.debugChannel.show(true);

			this.debugChannel.appendLine(`[document] lang: ${document.languageId}, fileName: ${basename(document.fileName)}`);
			this.debugChannel.appendLine(`[main] regex: ${this.mainRegex.toString()}`);
		}

		const foldingRanges: FoldingRange[] = [];
		const foldLines: number[] = [];

		const stack: StackItem[] = [];
		const endMatches = {};

		let position: Position = { line: 0, offset: 0 };

		try {
			while(position.line < document.lineCount) {
				position = this.resolveExplicitRange(document, foldingRanges, 'main', this.mainRegex, stack, endMatches, 0, false, position.line, position.offset, foldLines);
			}

			this.doEOF(document, foldingRanges, stack, foldLines);

			if(this.indentation.enabled) {
				this.resolveIndentationRange(document, foldingRanges);
			}
		}
		catch (error: unknown) {
			if(this.debugChannel && error) {
				this.debugChannel.appendLine(String(error));
			}
		}

		if(this.debugChannel) {
			this.debugChannel.appendLine(`[document] foldings: ${JSON.stringify(foldingRanges)}`);
		}

		const index = this.autoFoldDocuments.indexOf(document);
		if(index !== -1) {
			this.autoFoldDocuments.splice(index, 1);

			if(foldLines.length > 0) {
				void commands.executeCommand('editor.fold', {
					levels: 1,
					selectionLines: foldLines,
				});
			}
		}

		return foldingRanges;
	} // }}}

	private addRegex(configuration: ExplicitFoldingConfig, groupContext: GroupContext, strict: boolean, parents: number[]): string { // {{{
		const ruleIndex = this.rules.length;

		try {
			const bypassProtection = configuration.bypassProtection ?? false;

			let begin;
			if(configuration.beginRegex) {
				begin = new RegExp(translate(configuration.beginRegex, Flavor.ES2018));

				if(configuration.beginRegex === configuration.endRegex) {
					return this.addDocstringRegex(configuration, ruleIndex, begin, groupContext);
				}
			}
			else if(configuration.begin) {
				begin = new RegExp(escape(configuration.begin));

				if(configuration.begin === configuration.end) {
					return this.addDocstringRegex(configuration, ruleIndex, begin, groupContext);
				}
			}

			if(configuration.indentation) {
				this.indentation.enabled = configuration.indentation;
				this.indentation.offSide = configuration.offSide ?? false;

				if(begin) {
					this.indentation.filter = begin;
				}
			}
			else if(begin) {
				let continuation;
				let end;
				let whileRegex;

				if(configuration.endRegex) {
					end = new RegExp(translate(configuration.endRegex, Flavor.ES2018));
				}
				else if(configuration.end) {
					end = new RegExp(escape(configuration.end));
				}
				else if(configuration.continuationRegex) {
					const src = translate(configuration.continuationRegex, Flavor.ES2018);

					continuation = new RegExp(`${src}$`);
				}
				else if(configuration.continuation) {
					continuation = new RegExp(`${escape(configuration.continuation)}$`);
				}
				else if(configuration.whileRegex) {
					whileRegex = new RegExp(translate(configuration.whileRegex, Flavor.ES2018));
				}
				else if(configuration.while) {
					whileRegex = new RegExp(escape(configuration.while));
				}

				if(end) {
					let middle;

					if(configuration.middleRegex) {
						middle = new RegExp(translate(configuration.middleRegex, Flavor.ES2018));
					}
					else if(configuration.middle) {
						middle = new RegExp(escape(configuration.middle));
					}

					if(this.isSupportedRegex(bypassProtection, begin, middle, end)) {
						return this.addBeginEndRegex(configuration, ruleIndex, begin, middle, end, groupContext, strict, parents);
					}
				}
				else if(continuation) {
					if(this.isSupportedRegex(bypassProtection, begin, continuation)) {
						return this.addContinuationRegex(configuration, ruleIndex, begin, continuation, groupContext);
					}
				}
				else if(whileRegex && this.isSupportedRegex(bypassProtection, begin, whileRegex)) {
					return this.addBeginWhileRegex(configuration, ruleIndex, begin, whileRegex, groupContext);
				}
			}
			else if(configuration.whileRegex) {
				const whileRegex = new RegExp(translate(configuration.whileRegex, Flavor.ES2018));

				if(this.isSupportedRegex(bypassProtection, whileRegex)) {
					return this.addWhileRegex(configuration, ruleIndex, whileRegex, groupContext);
				}
			}
			else if(configuration.while) {
				const whileRegex = new RegExp(escape(configuration.while));

				if(this.isSupportedRegex(bypassProtection, whileRegex)) {
					return this.addWhileRegex(configuration, ruleIndex, whileRegex, groupContext);
				}
			}
			else if(configuration.separatorRegex) {
				const separator = new RegExp(translate(configuration.separatorRegex, Flavor.ES2018));

				if(this.isSupportedRegex(bypassProtection, separator)) {
					return this.addSeparatorRegex(configuration, ruleIndex, separator, groupContext, strict, parents);
				}
			}
			else if(configuration.separator) {
				const separator = new RegExp(escape(configuration.separator));

				if(this.isSupportedRegex(bypassProtection, separator)) {
					return this.addSeparatorRegex(configuration, ruleIndex, separator, groupContext, strict, parents);
				}
			}
		}
		catch (error: unknown) {
			if(this.debugChannel) {
				this.debugChannel.appendLine(String(error));
			}
		}

		return '';
	} // }}}

	private addBeginEndRegex(configuration: ExplicitFoldingConfig, ruleIndex: number, begin: RegExp, middle: RegExp | undefined, end: RegExp, groupContext: GroupContext, strict: boolean, parents: number[]): string { // {{{
		const rule: Rule = {
			index: ruleIndex,
			begin,
			middle,
			end,
			consumeEnd: typeof configuration.consumeEnd === 'boolean' ? id(configuration.consumeEnd) : id(true),
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : !Array.isArray(configuration.nested),
			strict: typeof configuration.strict === 'boolean' ? configuration.strict : (configuration.strict === 'never' ? false : strict),
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		let src = `(?<_${Marker.BEGIN}_${ruleIndex}>${rule.begin!.source})`;

		const groups = this.listCaptureGroups(begin.source);
		const beginGroupCount = 1 + groups.length;
		const middleGroupCount = rule.middle ? 1 + this.getCaptureGroupCount(middle!.source) : 0;
		const endGroupCount = 1 + this.getCaptureGroupCount(end.source);

		if(groups.length > 0) {
			let index = groupContext.index + 1;
			const captures = configuration.endRegex!.split(/\\(\d+)/g);

			if(captures.length > 0) {
				const last = captures.length - 1;

				let src = '""';

				for(let i = 0; i <= last; i += 2) {
					if(i === last) {
						if(captures[i].length > 0) {
							src += ` + "${escape(captures[i]).replace(/"/g, '\\"')}"`;
						}
					}
					else {
						src += ` + "${escape(captures[i]).replace(/"/g, '\\"')}" + escape(args[${++index} + offset])`;
					}
				}

				// eslint-disable-next-line no-eval
				rule.endMatcher = eval('(function(){return function(escape, offset, ...args) { return ' + src + ';};})()') as EndMatcher;
			}
		}

		groupContext.index += beginGroupCount;

		if(Array.isArray(configuration.consumeEnd) && configuration.consumeEnd.length === endGroupCount) {
			const consumeEnd = configuration.consumeEnd;
			const groupIndex = 1 + (rule.nested ? groupContext.index : 0) + middleGroupCount;

			rule.consumeEnd = shouldFoldLastLine(consumeEnd, groupIndex, endGroupCount);
		}

		if(Array.isArray(configuration.foldLastLine) && configuration.foldLastLine.length === endGroupCount) {
			const foldLastLine = configuration.foldLastLine;
			const groupIndex = 1 + (rule.nested ? groupContext.index : 0) + middleGroupCount;

			rule.foldLastLine = shouldFoldLastLine(foldLastLine, groupIndex, endGroupCount);
		}

		if(rule.nested) {
			if(rule.middle) {
				src += `|(?<_${Marker.MIDDLE}_${ruleIndex}>${rule.middle.source})`;

				groupContext.index += middleGroupCount;
			}

			if(!rule.endMatcher) {
				src += `|(?<_${Marker.END}_${ruleIndex}>${rule.end!.source})`;

				groupContext.index += endGroupCount;
			}
		}
		else {
			rule.name = configuration.name ?? `loop=${ruleIndex}`;

			if(Array.isArray(configuration.nested)) {
				const strictParent = configuration.strict === 'never' ? false : strict;
				if(!strictParent) {
					const regexes = configuration.nested.map((config) => this.addRegex(config, groupContext, false, [...parents, ruleIndex])).filter((regex) => regex.length > 0);

					src += `|${regexes.join('|')}`;
				}

				const subgroupContext = { index: 1 };
				const regexes = configuration.nested.map((config) => this.addRegex(config, subgroupContext, strictParent, [...parents, ruleIndex])).filter((regex) => regex.length > 0);

				let loopSource = '';

				if(rule.middle) {
					loopSource += `(?<_${Marker.MIDDLE}_${ruleIndex}>${rule.middle.source})`;
				}

				if(!rule.endMatcher) {
					if(loopSource) {
						loopSource += '|';
					}

					loopSource += `(?<_${Marker.END}_${ruleIndex}>${rule.end!.source})`;
				}

				if(loopSource) {
					loopSource += '|';
				}

				loopSource += regexes.join('|');

				rule.loopRegex = new RegExp(loopSource, 'g');
			}
			else {
				let loopSource = '';

				if(rule.middle) {
					loopSource += `(?<_${Marker.MIDDLE}_${ruleIndex}>${rule.middle.source})`;
				}

				if(!rule.endMatcher) {
					if(loopSource) {
						loopSource += '|';
					}

					loopSource += `(?<_${Marker.END}_${ruleIndex}>${rule.end!.source})`;
				}

				if(loopSource) {
					rule.loopRegex = new RegExp(loopSource, 'g');
				}
			}
		}

		return src;
	} // }}}

	private addBeginWhileRegex(configuration: ExplicitFoldingConfig, ruleIndex: number, begin: RegExp, whileRegex: RegExp, groupContext: GroupContext): string { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(begin.source);

		const rule = {
			index: ruleIndex,
			begin,
			while: whileRegex,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: false,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		return `(?<_${Marker.BEGIN}_${ruleIndex}>${rule.begin.source})`;
	} // }}}

	private addContinuationRegex(configuration: ExplicitFoldingConfig, ruleIndex: number, begin: RegExp, whileRegex: RegExp, groupContext: GroupContext): string { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(begin.source);

		const rule = {
			index: ruleIndex,
			begin,
			while: whileRegex,
			continuation: true,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: false,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		return `(?<_${Marker.BEGIN}_${ruleIndex}>${rule.begin.source})`;
	} // }}}

	private addDocstringRegex(configuration: ExplicitFoldingConfig, ruleIndex: number, begin: RegExp, groupContext: GroupContext): string { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(begin.source);

		const rule = {
			index: ruleIndex,
			begin,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : true,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		return `(?<_${Marker.DOCSTRING}_${ruleIndex}>${rule.begin.source})`;
	} // }}}

	private addSeparatorRegex(configuration: ExplicitFoldingConfig, ruleIndex: number, separator: RegExp, groupContext: GroupContext, strict: boolean, parents: number[]): string { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(separator.source);

		const rule = {
			index: ruleIndex,
			begin: separator,
			foldLastLine: id(false),
			foldBOF: typeof configuration.foldBOF === 'boolean' ? configuration.foldBOF : true,
			foldEOF: typeof configuration.foldEOF === 'boolean' ? configuration.foldEOF : true,
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : true,
			strict: typeof configuration.strict === 'boolean' ? configuration.strict : (configuration.strict === 'never' ? false : strict),
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
			parents,
		};

		this.rules.push(rule);

		const nested = configuration.descendants ?? (Array.isArray(configuration.nested) ? configuration.nested : null);

		if(nested) {
			const regexes = nested.map((config) => this.addRegex(config, groupContext, configuration.strict === 'never' ? false : strict, [...parents, ruleIndex])).filter((regex) => regex.length > 0);

			return `(?<_${Marker.SEPARATOR}_${ruleIndex}>${rule.begin.source})|${regexes.join('|')}`;
		}

		return `(?<_${Marker.SEPARATOR}_${ruleIndex}>${rule.begin.source})`;
	} // }}}

	private addWhileRegex(configuration: ExplicitFoldingConfig, ruleIndex: number, whileRegex: RegExp, groupContext: GroupContext): string { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(whileRegex.source);

		const rule = {
			index: ruleIndex,
			while: whileRegex,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: false,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		return `(?<_${Marker.WHILE}_${ruleIndex}>${rule.while.source})`;
	} // }}}

	private doEOF(document: TextDocument, foldingRanges: FoldingRange[], stack: StackItem[], foldLines: number[]): void { // {{{
		const end = document.lineCount;
		while(stack[0]) {
			if(stack[0].rule.foldEOF) {
				const begin = stack[0].line;

				if(end > begin + 1) {
					this.pushNewRange(stack[0].rule, begin, end - 1, foldingRanges, foldLines);
				}
			}

			stack.shift();
		}
	} // }}}

	private doWhile(document: TextDocument, foldingRanges: FoldingRange[], rule: Rule, line: number, continuation: boolean, foldLines: number[]): Position { // {{{
		const begin = line;

		while(++line < document.lineCount) {
			const text = document.lineAt(line).text;

			if(!rule.while!.test(text)) {
				const end = line - (continuation ? 0 : 1);

				if(rule.foldLastLine()) {
					if(end > begin) {
						this.pushNewRange(rule, begin, end, foldingRanges, foldLines);
					}

					return { line: end + 1, offset: 0 };
				}

				if(end > begin + 1) {
					this.pushNewRange(rule, begin, end - 1, foldingRanges, foldLines);
				}

				return { line: end, offset: 0 };
			}
		}

		const end = Math.min(line, document.lineCount - 1);

		if(rule.foldLastLine()) {
			if(end > begin) {
				this.pushNewRange(rule, begin, end, foldingRanges, foldLines);
			}
		}
		else if(end > begin + 1) {
			this.pushNewRange(rule, begin, end - 1, foldingRanges, foldLines);
		}

		return { line, offset: 0 };
	} // }}}

	private * findOfRegexp(regex: RegExp, line: string, offset: number): Generator<{ type: number; index: number; match: RegExpExecArray; nextOffset: number }> { // {{{
		// reset regex
		regex.lastIndex = offset;

		while(true) {
			const match = regex.exec(line) as RegExpExecArray | undefined;

			if(match?.groups) {
				const index = match.index ?? 0;
				if(index < offset) {
					continue;
				}

				const nextOffset = index + (match[0].length === 0 ? 1 : match[0].length);

				for(const key in match.groups) {
					if(match.groups[key] !== undefined) {
						const keys = key.split('_').map((x) => Number.parseInt(x, 10));

						yield {
							type: keys[1],
							index: keys[2],
							match,
							nextOffset,
						};

						break;
					}
				}

				regex.lastIndex = nextOffset;
			}
			else {
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
			},
		});

		return count;
	} // }}}

	private isSupportedRegex(bypassProtection: boolean, ...regexes: Array<RegExp | undefined>): boolean { // {{{
		if(bypassProtection) {
			return true;
		}

		for(const regex of regexes) {
			if(regex?.test('')) {
				return false;
			}
		}

		return true;
	} // }}}

	private listCaptureGroups(regex: string): Token[] { // {{{
		const ast = parse(regex);

		const groups: Token[] = [];

		visit(ast.body, {
			[TokenType.CAPTURE_GROUP](token) {
				groups.push(token);
			},
		});

		return groups;
	} // }}}

	private pushNewRange(rule: Rule, begin: number, end: number, foldingRanges: FoldingRange[], foldLines: number[]): void { // {{{
		foldingRanges.push(new FoldingRange(begin, end, rule.kind));

		if(rule.autoFold) {
			foldLines.push(begin);
		}
	} // }}}

	private resolveExplicitRange(document: TextDocument, foldingRanges: FoldingRange[], name: string, regexp: RegExp, stack: StackItem[], endMatches: EndMatches, matchOffset: number, secondaryLoop: boolean, line: number, offset: number, foldLines: number[]): Position { // {{{
		const text = document.lineAt(line).text;

		for(const { type, index, match, nextOffset } of this.findOfRegexp(regexp, text, offset)) {
			const rule = this.rules[index];

			if(this.debugChannel) {
				this.debugChannel.appendLine(`[${name}] line: ${line + 1}, offset: ${offset}, type: ${Marker[type]}, match: ${match[0]}, regex: ${index}`);
			}

			switch(type) {
				case Marker.BEGIN:
					if(stack.length === 0 || stack[0].rule.nested) {
						if(!rule.nested && (rule.loopRegex || rule.endMatcher)) {
							let loopRegex;
							if(rule.endMatcher) {
								let src = rule.loopRegex ? rule.loopRegex.source : '';
								if(src) {
									src += '|';
								}

								src += `(?<_${Marker.END}_${index}>${rule.endMatcher(escape, matchOffset, ...match)})`;

								loopRegex = new RegExp(src, 'g');
							}
							else {
								loopRegex = rule.loopRegex!;
							}

							const name = rule.name!;

							if(this.debugChannel) {
								this.debugChannel.appendLine(`[${name}] regex: ${loopRegex.toString()}`);
							}

							const stack: StackItem[] = [{ rule, line }];

							let position = this.resolveExplicitRange(document, foldingRanges, name, loopRegex, stack, {}, 0, true, line, nextOffset, foldLines);

							while(stack.length > 0 && position.line < document.lineCount) {
								position = this.resolveExplicitRange(document, foldingRanges, name, loopRegex, stack, {}, 0, true, position.line, position.offset, foldLines);
							}

							if(stack.length > 0 && position.line >= document.lineCount) {
								this.doEOF(document, foldingRanges, stack, foldLines);
							}

							return position;
						}

						if(rule.endMatcher) {
							const endMatch = endMatches[rule.index] ? endMatches[rule.index] : (endMatches[rule.index] = []);
							const end = rule.endMatcher(escape, matchOffset, ...match);

							let nf = true;
							let endIndex = endMatch.length + 1;
							for(const match of endMatch) {
								if(end === match.regex) {
									endIndex = match.index;
									nf = false;
								}
							}

							let loopRegex;
							if(nf) {
								endMatch.push({
									regex: end,
									index: endIndex,
								});

								loopRegex = new RegExp(`(?<_${Marker.END}_${index}_${endIndex}>${end})|${regexp.source}`, 'g');

								++matchOffset;
							}
							else {
								loopRegex = regexp;
							}

							const loopStack: StackItem[] = [{ rule, line, endIndex }];

							let position = this.resolveExplicitRange(document, foldingRanges, name, loopRegex, loopStack, endMatches, matchOffset, true, line, nextOffset, foldLines);

							while(loopStack.length > 0 && position.line < document.lineCount) {
								position = this.resolveExplicitRange(document, foldingRanges, name, loopRegex, loopStack, endMatches, matchOffset, true, position.line, position.offset, foldLines);
							}

							if(nf) {
								const index = endMatch.findIndex(({ index }) => index === endIndex);
								endMatch.splice(index, 1);
							}

							return position;
						}

						if(rule.continuation) {
							if(!rule.while!.test(text)) {
								return { line: line + 1, offset: 0 };
							}

							return this.doWhile(document, foldingRanges, rule, line, true, foldLines);
						}

						if(rule.while) {
							return this.doWhile(document, foldingRanges, rule, line, false, foldLines);
						}

						stack.unshift({ rule, line });
					}

					break;
				case Marker.MIDDLE:
					if(stack.length > 0 && stack[0].rule === rule) {
						const begin = stack[0].line;
						const end = line;

						if(end > begin + 1) {
							this.pushNewRange(rule, begin, end - 1, foldingRanges, foldLines);
						}

						stack[0].line = line;
					}

					break;
				case Marker.END:
					if(secondaryLoop) {
						const last = stack.length > 0 && stack[stack.length - 1];
						if(last && last.rule === rule) {
							if(last.endIndex && match.groups && !match.groups[`_${Marker.END}_${rule.index}_${last.endIndex}`]) {
								stack.pop();

								return { line, offset };
							}

							const begin = last.line;
							const end = rule.consumeEnd!() ? line : Math.max(line - 1, begin);

							while(stack.length > 1) {
								const begin = stack[0].line;

								if(end > begin + 1) {
									this.pushNewRange(stack[0].rule, begin, end - 1, foldingRanges, foldLines);
								}

								stack.shift();
							}

							stack.shift();

							if(rule.foldLastLine()) {
								if(end > begin) {
									this.pushNewRange(rule, begin, end, foldingRanges, foldLines);
								}
							}
							else if(end > begin + 1) {
								this.pushNewRange(rule, begin, end - 1, foldingRanges, foldLines);
							}

							return { line: end, offset: nextOffset };
						}
					}

					if(stack.length > 0 && stack[0].rule === rule) {
						const begin = stack[0].line;
						const end = rule.consumeEnd!() ? line : Math.max(line - 1, begin);

						if(rule.foldLastLine(matchOffset, ...match)) {
							if(end > begin) {
								this.pushNewRange(rule, begin, end, foldingRanges, foldLines);
							}
						}
						else if(end > begin + 1) {
							this.pushNewRange(rule, begin, end - 1, foldingRanges, foldLines);
						}

						stack.shift();
					}

					break;
				case Marker.DOCSTRING:
					if(stack.length > 0 && stack[0].rule === rule) {
						const begin = stack[0].line;
						const end = line;

						if(rule.foldLastLine()) {
							if(end > begin) {
								this.pushNewRange(rule, begin, end, foldingRanges, foldLines);
							}
						}
						else if(end > begin + 1) {
							this.pushNewRange(rule, begin, end - 1, foldingRanges, foldLines);
						}

						stack.shift();
					}
					else if(stack.length === 0 || stack[0].rule.nested) {
						stack.unshift({ rule, line });
					}

					break;
				case Marker.SEPARATOR:
					if(stack.length === 0) {
						if(rule.foldBOF) {
							if(line > 1) {
								this.pushNewRange(rule, 0, line - 1, foldingRanges, foldLines);
							}

							stack.unshift({ rule, line, separator: true });
						}
						else if(!rule.parents || rule.parents.length === 0) {
							stack.unshift({ rule, line, separator: true });
						}
					}
					else {
						while(stack.length > 0 && stack[0].rule.parents && stack[0].rule.parents.includes(index)) {
							const begin = stack.shift()!.line;
							const end = line;

							if(end > begin + 1) {
								this.pushNewRange(rule, begin, end - 1, foldingRanges, foldLines);
							}
						}

						if(stack.length === 0) {
							if(!rule.parents || rule.parents.length === 0) {
								stack.unshift({ rule, line, separator: true });
							}
						}
						else if(stack[0].rule === rule) {
							const begin = stack[0].line;
							const end = line;

							if(end > begin + 1) {
								this.pushNewRange(rule, begin, end - 1, foldingRanges, foldLines);
							}

							stack[0].line = line;
						}
						else if(stack[0].rule.nested || (secondaryLoop && stack.length === 1)) {
							if(!rule.parents || rule.parents.length === 0) {
								stack.unshift({ rule, line, separator: true });
							}
							else {
								const parent = rule.parents[rule.parents.length - 1];

								if(this.rules[parent].strict) {
									if(stack.some(({ rule: { index } }) => parent === index)) {
										stack.unshift({ rule, line, separator: true });
									}
								}
								else if(stack.some(({ rule: { index } }) => rule.parents!.includes(index))) {
									stack.unshift({ rule, line, separator: true });
								}
							}
						}
					}

					break;
				case Marker.WHILE:
					return this.doWhile(document, foldingRanges, rule, line, false, foldLines);
			}
		}

		return { line: line + 1, offset: 0 };
	} // }}}

	private resolveIndentationRange(document: TextDocument, foldingRanges: FoldingRange[]): void { // {{{
		const tabSize = window.activeTextEditor ? Number.parseInt(`${window.activeTextEditor.options.tabSize ?? 4}`, 10) : 4;
		if(this.debugChannel) {
			this.debugChannel.appendLine(`[indentation] tabSize: ${tabSize}`);
		}

		const existingRanges: Record<string, boolean> = {};
		for(const range of foldingRanges) {
			existingRanges[range.start] = true;
		}

		const previousRegions: PreviousRegion[] = [{ indent: -1, begin: document.lineCount, end: document.lineCount }];

		for(let line = document.lineCount - 1; line >= 0; line--) {
			const lineContent = document.lineAt(line).text;
			const indent = computeIndentLevel(lineContent, tabSize);
			if(this.debugChannel) {
				this.debugChannel.appendLine(`[indentation] line: ${line + 1}, indent: ${indent}`);
			}

			let previous = previousRegions[previousRegions.length - 1];

			if(indent === -1) {
				if(this.indentation.offSide) {
					// for offSide languages, empty lines are associated to the previous block
					// note: the next block is already written to the results, so this only
					// impacts the end position of the block before
					previous.end = line;
				}

				continue; // only whitespace
			}

			if(previous.indent > indent) {
				// discard all regions with larger indent
				do {
					previousRegions.pop();
					previous = previousRegions[previousRegions.length - 1];
				}
				while(previous.indent > indent);

				let fold = true;

				if(this.indentation.filter) {
					fold = this.indentation.filter.test(lineContent);

					if(this.debugChannel) {
						this.debugChannel.appendLine(`[indentation] line: ${line + 1}, match(begin): ${fold ? 'yes' : 'no'}`);
					}
				}

				if(fold) {
					const endLineNumber = previous.end - 1;
					const block = endLineNumber - line >= 1;

					if(block && !existingRanges[line]) {
						foldingRanges.push(new FoldingRange(line, endLineNumber, FoldingRangeKind.Region));
					}
				}

				previousRegions.push({ indent, begin: line, end: line });
			}
			else if(previous.indent === indent) {
				previous.end = line;
			}
			else {
				previousRegions.push({ indent, begin: line, end: line });
			}
		}
	} // }}}
}
