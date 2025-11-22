import { basename } from 'path';
import { escape, parse, translate, visit, Flavor, type Token, TokenType } from '@daiyam/regexp';
import type API from '@zokugun/vscode.explicit-folding-api';
import { err, ok, type Result } from '@zokugun/xtry';
import { commands, FoldingRange, FoldingRangeKind, type FoldingRangeProvider, type OutputChannel, type ProviderResult, type TextDocument, window } from 'vscode';
import { getDebugChannel } from './utils/settings.js';

type EndMatch = {
	index: number;
	regex: string;
};
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

type MatchTester = (offset?: number, ...args: string[]) => boolean;

type GroupContext = {
	index: number;
};

type IndentationConfig = {
	enabled: boolean;
	filter?: RegExp;
	nestedRegex?: RegExp;
	offSide: boolean;
};

type PreviousRegion = {
	begin: number;
	end: number;
	indent: number;
};

type Position = {
	line: number;
	offset: number;
};

type Rule = {
	index: number;
	begin?: RegExp;
	middle?: RegExp;
	end?: RegExp;
	loopRegex?: RegExp;
	while?: RegExp;
	continuation?: boolean;
	consumeEnd?: MatchTester;
	foldLastLine: MatchTester;
	foldBeforeFirstLine: Boolean;
	foldBOF: boolean;
	foldEOF: boolean;
	nested: boolean;
	kind: FoldingRangeKind;
	endMatcher?: EndMatcher;
	parents?: number[];
	strict?: boolean;
	name?: string;
	autoFold?: boolean;
	label: string;
};

type StackItem = {
	rule: Rule;
	line: number;
	continuation?: number;
	endIndex?: number;
	separator?: boolean;
};

const TAB = 9;
const SPACE = 32;
const VARIABLE_REGEX = /{{(:|!)(\w+)}}/;

function computeIndentLevel(line: string, tabSize: number): number { // {{{
	let indent = 0;
	let index = 0;
	const length = line.length;

	while(index < length) {
		const chCode = line.codePointAt(index);

		if(chCode === SPACE) {
			indent++;
		}
		else if(chCode === TAB) {
			indent = indent - (indent % tabSize) + tabSize;
		}
		else {
			break;
		}

		index++;
	}

	if(index === length) {
		return -1; // line only consists of whitespace
	}

	return indent;
} // }}}

function id<T>(value: T): () => T { // {{{
	return () => value;
} // }}}

function shouldMatchCapturedGroups(foldLastLine: boolean[], groupIndex: number, endGroupCount: number): MatchTester { // {{{
	return (offset, ...args) => {
		for(let i = groupIndex + 1, l = groupIndex + endGroupCount; i < l; ++i) {
			if(args[i + offset!] !== undefined) {
				return foldLastLine[i - groupIndex];
			}
		}

		return foldLastLine[0];
	};
} // }}}

function shouldMatchRegex(matcher: RegExp): MatchTester { // {{{
	return (_offset, ...args) => {
		for(const argument of args) {
			if(matcher.test(argument)) {
				return true;
			}
		}

		return false;
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
	private readonly variables = new Map<string, string>();

	constructor(configuration: API.Config[], debugChannel: OutputChannel | undefined, documents: TextDocument[]) { // {{{
		this.debugChannel = debugChannel;
		this.autoFoldDocuments = documents;

		const groupContext = { index: 0 };

		let source = '';

		for(const value of configuration) {
			if(value.variables) {
				for(const key in value.variables) {
					if(Object.hasOwn(value.variables, key)) {
						this.variables.set(key, value.variables[key]);
					}
				}
			}
			else {
				const result = this.addRegex(value, groupContext, true, []);

				if(result.fails) {
					const channel = debugChannel ?? getDebugChannel(true);

					channel.appendLine(result.error);
				}
				else if(result.value.length > 0) {
					if(source.length > 0) {
						source += '|';
					}

					source += result.value;
				}
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

		this.debugChannel?.appendLine(`[document] foldings: ${JSON.stringify(foldingRanges)}`);

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

	private addRegex(configuration: API.UnkownRule, groupContext: GroupContext, strict: boolean, parents: number[]): Result<string, string> { // {{{
		const ruleIndex = this.rules.length;

		try {
			const bypassProtection = configuration.bypassProtection ?? false;

			let begin: RegExp | undefined;

			if(configuration.beginRegex) {
				const result = this.toRegex(configuration.beginRegex, true, false);
				if(result.fails) {
					return result;
				}

				begin = result.value;

				if(configuration.beginRegex === configuration.endRegex) {
					return this.addDocstringRegex(configuration as API.BeginEndRule, ruleIndex, begin, groupContext);
				}
			}
			else if(configuration.begin) {
				const result = this.toRegex(configuration.begin, false, false);
				if(result.fails) {
					return result;
				}

				begin = result.value;

				if(configuration.begin === configuration.end) {
					return this.addDocstringRegex(configuration as API.BeginEndRule, ruleIndex, begin, groupContext);
				}
			}

			if(configuration.indentation) {
				const indentationConfig = configuration as API.IndentationRule;

				this.indentation.enabled = true;
				this.indentation.offSide = indentationConfig.offSide ?? false;

				if(begin) {
					this.indentation.filter = begin;
				}

				this.debugChannel?.appendLine(JSON.stringify(configuration));

				if(Array.isArray(indentationConfig.nested)) {
					const regexes: string[] = [];

					for(const config of indentationConfig.nested) {
						const result = this.addRegex(config, groupContext, false, []);
						if(result.fails) {
							return result;
						}

						if(result.value.length > 0) {
							regexes.push(result.value);
						}
					}

					const source = regexes.join('|');

					this.indentation.nestedRegex = source.length === 0 ? /a^/ : new RegExp(source, 'g');
				}
			}

			if(begin) {
				let continuation: RegExp | undefined;
				let end: RegExp | undefined;
				let whileRegex: RegExp | undefined;

				if(configuration.endRegex) {
					const result = this.toRegex(configuration.endRegex, true, false);
					if(result.fails) {
						return result;
					}

					end = result.value;
				}
				else if(configuration.end) {
					const result = this.toRegex(configuration.end, false, false);
					if(result.fails) {
						return result;
					}

					end = result.value;
				}
				else if(configuration.continuationRegex) {
					const result = this.toRegex(configuration.continuationRegex, true, true);
					if(result.fails) {
						return result;
					}

					continuation = result.value;
				}
				else if(configuration.continuation) {
					const result = this.toRegex(configuration.continuation, false, true);
					if(result.fails) {
						return result;
					}

					continuation = result.value;
				}
				else if(configuration.whileRegex) {
					const result = this.toRegex(configuration.whileRegex, true, false);
					if(result.fails) {
						return result;
					}

					whileRegex = result.value;
				}
				else if(configuration.while) {
					const result = this.toRegex(configuration.while, false, false);
					if(result.fails) {
						return result;
					}

					whileRegex = result.value;
				}

				if(end) {
					let middle: RegExp | undefined;

					if(configuration.middleRegex) {
						const result = this.toRegex(configuration.middleRegex, true, false);
						if(result.fails) {
							return result;
						}

						middle = result.value;
					}
					else if(configuration.middle) {
						const result = this.toRegex(configuration.middle, false, false);
						if(result.fails) {
							return result;
						}

						middle = result.value;
					}

					if(this.isSupportedRegex(bypassProtection, begin, middle, end)) {
						return this.addBeginEndRegex(configuration as API.BeginEndRule, ruleIndex, begin, middle, end, groupContext, strict, parents);
					}
				}
				else if(continuation) {
					if(this.isSupportedRegex(bypassProtection, begin, continuation)) {
						return this.addContinuationRegex(configuration as API.BeginContinuationRule, ruleIndex, begin, continuation, groupContext);
					}
				}
				else if(whileRegex && this.isSupportedRegex(bypassProtection, begin, whileRegex)) {
					return this.addBeginWhileRegex(configuration as API.BeginWhileRule, ruleIndex, begin, whileRegex, groupContext);
				}
			}
			else if(configuration.whileRegex) {
				const result = this.toRegex(configuration.whileRegex, true, false);
				if(result.fails) {
					return result;
				}

				if(this.isSupportedRegex(bypassProtection, result.value)) {
					return this.addWhileRegex(configuration as API.WhileRule, ruleIndex, result.value, groupContext);
				}
			}
			else if(configuration.while) {
				const result = this.toRegex(configuration.while, false, false);
				if(result.fails) {
					return result;
				}

				if(this.isSupportedRegex(bypassProtection, result.value)) {
					return this.addWhileRegex(configuration as API.WhileRule, ruleIndex, result.value, groupContext);
				}
			}
			else if(configuration.separatorRegex) {
				const result = this.toRegex(configuration.separatorRegex, true, false);
				if(result.fails) {
					return result;
				}

				if(this.isSupportedRegex(bypassProtection, result.value)) {
					return this.addSeparatorRegex(configuration as API.SeparatorRule, ruleIndex, result.value, groupContext, strict, parents);
				}
			}
			else if(configuration.separator) {
				const result = this.toRegex(configuration.separator, false, false);
				if(result.fails) {
					return result;
				}

				if(this.isSupportedRegex(bypassProtection, result.value)) {
					return this.addSeparatorRegex(configuration as API.SeparatorRule, ruleIndex, result.value, groupContext, strict, parents);
				}
			}
		}
		catch (error: unknown) {
			this.debugChannel?.appendLine(String(error));
		}

		return ok('');
	} // }}}

	private addBeginEndRegex(configuration: API.BeginEndRule, ruleIndex: number, begin: RegExp, middle: RegExp | undefined, end: RegExp, groupContext: GroupContext, strict: boolean, parents: number[]): Result<string, string> { // {{{
		const rule: Rule = {
			index: ruleIndex,
			label: configuration.name?.length ? `, ${configuration.name}` : '',
			begin,
			middle,
			end,
			consumeEnd: typeof configuration.consumeEnd === 'boolean' ? id(configuration.consumeEnd) : id(true),
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBeforeFirstLine: typeof configuration.foldBeforeFirstLine === 'boolean' ? configuration.foldBeforeFirstLine : false,
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : !Array.isArray(configuration.nested),
			strict: typeof configuration.strict === 'boolean' ? configuration.strict : (configuration.strict === 'never' ? false : strict),
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		let source = `(?<_${Marker.BEGIN}_${ruleIndex}>${rule.begin!.source})`;

		const groups = this.listCaptureGroups(begin.source);
		const beginGroupCount = 1 + groups.length;
		const middleGroupCount = rule.middle ? 1 + this.getCaptureGroupCount(middle!.source) : 0;
		const endGroupCount = 1 + this.getCaptureGroupCount(end.source);

		if(groups.length > 0) {
			let index = groupContext.index + 1;
			const captures = configuration.endRegex!.split(/\\(\d+)/g);

			if(captures.length > 0) {
				const last = captures.length - 1;

				let regexSource = '""';

				for(let i = 0; i <= last; i += 2) {
					if(i === last) {
						if(captures[i].length > 0) {
							regexSource += ` + "${escape(captures[i]).replaceAll('"', '\\"')}"`;
						}
					}
					else {
						regexSource += ` + "${escape(captures[i]).replaceAll('"', '\\"')}" + escape(args[${++index} + offset])`;
					}
				}

				// eslint-disable-next-line no-eval
				rule.endMatcher = eval('(function(){return function(escape, offset, ...args) { return ' + regexSource + ';};})()') as EndMatcher;
			}
		}

		groupContext.index += beginGroupCount;

		if(Array.isArray(configuration.consumeEnd) && configuration.consumeEnd.length === endGroupCount) {
			const consumeEnd = configuration.consumeEnd;
			const groupIndex = 1 + (rule.nested ? groupContext.index : 0) + middleGroupCount;

			rule.consumeEnd = shouldMatchCapturedGroups(consumeEnd, groupIndex, endGroupCount);
		}

		if(Array.isArray(configuration.foldLastLine) && configuration.foldLastLine.length === endGroupCount) {
			const foldLastLine = configuration.foldLastLine;
			const groupIndex = 1 + (rule.nested ? groupContext.index : 0) + middleGroupCount;

			rule.foldLastLine = shouldMatchCapturedGroups(foldLastLine, groupIndex, endGroupCount);
		}

		if(rule.nested) {
			if(rule.middle) {
				source += `|(?<_${Marker.MIDDLE}_${ruleIndex}>${rule.middle.source})`;

				groupContext.index += middleGroupCount;
			}

			if(!rule.endMatcher) {
				source += `|(?<_${Marker.END}_${ruleIndex}>${rule.end!.source})`;

				groupContext.index += endGroupCount;
			}
		}
		else {
			rule.name = configuration.name ?? `loop=${ruleIndex}`;

			if(Array.isArray(configuration.nested)) {
				const strictParent = configuration.strict === 'never' ? false : strict;
				const nestedParents = [...parents, ruleIndex];

				if(!strictParent) {
					const regexes: string[] = [];

					for(const config of configuration.nested) {
						const result = this.addRegex(config, groupContext, false, nestedParents);
						if(result.fails) {
							return result;
						}

						if(result.value.length > 0) {
							regexes.push(result.value);
						}
					}

					source += `|${regexes.join('|')}`;
				}

				const subgroupContext = { index: 1 };
				const regexes: string[] = [];

				for(const config of configuration.nested) {
					const result = this.addRegex(config, subgroupContext, strictParent, nestedParents);
					if(result.fails) {
						return result;
					}

					if(result.value.length > 0) {
						regexes.push(result.value);
					}
				}

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

		return ok(source);
	} // }}}

	private addBeginWhileRegex(configuration: API.BeginWhileRule, ruleIndex: number, begin: RegExp, whileRegex: RegExp, groupContext: GroupContext): Result<string, string> { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(begin.source);

		let foldLastLine: MatchTester;

		if(typeof configuration.foldLastLine === 'string') {
			const matcher = new RegExp(escape(configuration.foldLastLine));

			foldLastLine = shouldMatchRegex(matcher);
		}
		else if(typeof configuration.foldLastLineRegex === 'string') {
			const matcher = new RegExp(translate(configuration.foldLastLineRegex, Flavor.ES2018));

			foldLastLine = shouldMatchRegex(matcher);
		}
		else {
			foldLastLine = typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true);
		}

		const rule = {
			index: ruleIndex,
			label: configuration.name?.length ? `, ${configuration.name}` : '',
			begin,
			while: whileRegex,
			foldLastLine,
			foldBeforeFirstLine: typeof configuration.foldBeforeFirstLine === 'boolean' ? configuration.foldBeforeFirstLine : false,
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: false,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		return ok(`(?<_${Marker.BEGIN}_${ruleIndex}>${rule.begin.source})`);
	} // }}}

	private addContinuationRegex(configuration: API.BeginContinuationRule, ruleIndex: number, begin: RegExp, whileRegex: RegExp, groupContext: GroupContext): Result<string, string> { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(begin.source);

		const rule = {
			index: ruleIndex,
			label: configuration.name?.length ? `, ${configuration.name}` : '',
			begin,
			while: whileRegex,
			continuation: true,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBeforeFirstLine: typeof configuration.foldBeforeFirstLine === 'boolean' ? configuration.foldBeforeFirstLine : false,
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: false,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		return ok(`(?<_${Marker.BEGIN}_${ruleIndex}>${rule.begin.source})`);
	} // }}}

	private addDocstringRegex(configuration: API.BeginEndRule, ruleIndex: number, begin: RegExp, groupContext: GroupContext): Result<string, string> { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(begin.source);

		const rule = {
			index: ruleIndex,
			label: configuration.name?.length ? `, ${configuration.name}` : '',
			begin,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBeforeFirstLine: typeof configuration.foldBeforeFirstLine === 'boolean' ? configuration.foldBeforeFirstLine : false,
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: typeof configuration.nested === 'boolean' ? configuration.nested : true,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		return ok(`(?<_${Marker.DOCSTRING}_${ruleIndex}>${rule.begin.source})`);
	} // }}}

	private addSeparatorRegex(configuration: API.SeparatorRule, ruleIndex: number, separator: RegExp, groupContext: GroupContext, strict: boolean, parents: number[]): Result<string, string> { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(separator.source);

		const rule = {
			index: ruleIndex,
			label: configuration.name?.length ? `, ${configuration.name}` : '',
			begin: separator,
			foldLastLine: id(false),
			foldBeforeFirstLine: false,
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
			const regexes: string[] = [];
			const nestedStrict = configuration.strict === 'never' ? false : strict;
			const nestedParents = [...parents, ruleIndex];

			for(const config of nested) {
				const result = this.addRegex(config, groupContext, nestedStrict, nestedParents);
				if(result.fails) {
					return result;
				}

				if(result.value.length > 0) {
					regexes.push(result.value);
				}
			}

			return ok(`(?<_${Marker.SEPARATOR}_${ruleIndex}>${rule.begin.source})|${regexes.join('|')}`);
		}

		return ok(`(?<_${Marker.SEPARATOR}_${ruleIndex}>${rule.begin.source})`);
	} // }}}

	private addWhileRegex(configuration: API.WhileRule, ruleIndex: number, whileRegex: RegExp, groupContext: GroupContext): Result<string, string> { // {{{
		groupContext.index += 1 + this.getCaptureGroupCount(whileRegex.source);

		const rule = {
			index: ruleIndex,
			label: configuration.name?.length ? `, ${configuration.name}` : '',
			while: whileRegex,
			foldLastLine: typeof configuration.foldLastLine === 'boolean' ? id(configuration.foldLastLine) : id(true),
			foldBeforeFirstLine: typeof configuration.foldBeforeFirstLine === 'boolean' ? configuration.foldBeforeFirstLine : false,
			foldBOF: false,
			foldEOF: configuration.foldEOF ?? false,
			nested: false,
			kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region,
			autoFold: configuration.autoFold ?? false,
		};

		this.rules.push(rule);

		return ok(`(?<_${Marker.WHILE}_${ruleIndex}>${rule.while.source})`);
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

	private doWhile(document: TextDocument, foldingRanges: FoldingRange[], name: string, rule: Rule, line: number, continuation: boolean, foldLines: number[]): Position { // {{{
		const begin = line;

		while(++line < document.lineCount) {
			const text = document.lineAt(line).text;

			if(!rule.while!.test(text)) {
				const end = line - (continuation ? 0 : 1);

				this.debugChannel?.appendLine(`[${name}] line: ${line + 1}, offset: 0, type: ${continuation ? 'END-CONTINUE' : 'END-WHILE'}, regex: ${rule.while}`);

				if(rule.foldLastLine(0, text)) {
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

		this.debugChannel?.appendLine(`[${name}] line: ${line + 1}, offset: 0, type: ${continuation ? 'END-CONTINUE' : 'END-WHILE'}, regex: ${rule.while}`);

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

	private * findOfRegexp(regex: RegExp, line: string, offset: number): Generator<{ type: Marker; index: number; match: RegExpExecArray; nextOffset: number }> { // {{{
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

	private resolveExplicitRange(document: TextDocument, foldingRanges: FoldingRange[], loopLabel: string, regexp: RegExp, stack: StackItem[], endMatches: EndMatches, matchOffset: number, secondaryLoop: boolean, line: number, offset: number, foldLines: number[]): Position { // {{{
		const text = document.lineAt(line).text;

		for(const { type, index, match, nextOffset } of this.findOfRegexp(regexp, text, offset)) {
			const rule = this.rules[index];

			this.debugChannel?.appendLine(`[${loopLabel}${rule.label}] line: ${line + 1}, offset: ${offset}, type: ${Marker[type]}, match: ${match[0]}, regex: ${index}`);

			switch(type) {
				case Marker.BEGIN: {
					if(stack.length === 0 || stack[0].rule.nested) {
						if(!rule.nested && (rule.loopRegex ?? rule.endMatcher)) {
							let loopRegex: RegExp;
							if(rule.endMatcher) {
								let source = rule.loopRegex ? rule.loopRegex.source : '';
								if(source) {
									source += '|';
								}

								source += `(?<_${Marker.END}_${index}>${rule.endMatcher(escape, matchOffset, ...match)})`;

								loopRegex = new RegExp(source, 'g');
							}
							else {
								loopRegex = rule.loopRegex!;
							}

							const name = rule.name!;

							this.debugChannel?.appendLine(`[${name}] regex: ${loopRegex.toString()}`);

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
							endMatches[rule.index] ||= [];

							const endMatch = endMatches[rule.index];
							const end = rule.endMatcher(escape, matchOffset, ...match);

							let nf = true;
							let endIndex = endMatch.length + 1;
							for(const match of endMatch) {
								if(end === match.regex) {
									endIndex = match.index;
									nf = false;
								}
							}

							let loopRegex: RegExp;
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

							let position = this.resolveExplicitRange(document, foldingRanges, loopLabel, loopRegex, loopStack, endMatches, matchOffset, true, line, nextOffset, foldLines);

							while(loopStack.length > 0 && position.line < document.lineCount) {
								position = this.resolveExplicitRange(document, foldingRanges, loopLabel, loopRegex, loopStack, endMatches, matchOffset, true, position.line, position.offset, foldLines);
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

							return this.doWhile(document, foldingRanges, loopLabel, rule, line, true, foldLines);
						}

						if(rule.while) {
							return this.doWhile(document, foldingRanges, loopLabel, rule, line, false, foldLines);
						}

						stack.unshift({ rule, line });
					}

					break;
				}

				case Marker.MIDDLE: {
					if(stack.length > 0 && stack[0].rule === rule) {
						const begin = rule.foldBeforeFirstLine && stack[0].line > 0 && stack[0].line !== line ? stack[0].line - 1 : stack[0].line;
						const end = line;

						if(end > begin + 1) {
							this.pushNewRange(rule, begin, end - 1, foldingRanges, foldLines);
						}

						stack[0].line = line;
					}

					break;
				}

				case Marker.END: {
					if(secondaryLoop) {
						const last = stack.length > 0 && stack.at(-1);
						if(last && last.rule === rule) {
							if(last.endIndex && match.groups && !match.groups[`_${Marker.END}_${rule.index}_${last.endIndex}`]) {
								stack.pop();

								return { line, offset };
							}

							const begin = rule.foldBeforeFirstLine && last.line > 0 && last.line !== line ? last.line - 1 : last.line;
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
						const begin = rule.foldBeforeFirstLine && stack[0].line > 0 && stack[0].line !== line ? stack[0].line - 1 : stack[0].line;
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
				}

				case Marker.DOCSTRING: {
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
				}

				case Marker.SEPARATOR: {
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
						while(stack.length > 0 && stack[0].rule.parents?.includes(index)) {
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
								const parent = rule.parents.at(-1)!;

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
				}

				case Marker.WHILE: {
					return this.doWhile(document, foldingRanges, loopLabel, rule, line, false, foldLines);
				}
			}
		}

		return { line: line + 1, offset: 0 };
	} // }}}

	private resolveIndentationRange(document: TextDocument, foldingRanges: FoldingRange[]): void { // {{{
		const tabSize = window.activeTextEditor ? Number.parseInt(`${window.activeTextEditor.options.tabSize ?? 4}`, 10) : 4;

		this.debugChannel?.appendLine(`[indentation] tabSize: ${tabSize}`);

		const existingRanges: Record<string, boolean> = {};
		for(const range of foldingRanges) {
			existingRanges[range.start] = true;
		}

		const previousRegions: PreviousRegion[] = [{ indent: -1, begin: document.lineCount, end: document.lineCount }];

		for(let line = document.lineCount - 1; line >= 0; line--) {
			const lineContent = document.lineAt(line).text;
			const indent = computeIndentLevel(lineContent, tabSize);

			this.debugChannel?.appendLine(`[indentation] line: ${line + 1}, indent: ${indent}`);

			let previous = previousRegions.at(-1)!;

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
					previous = previousRegions.at(-1)!;
				}
				while(previous.indent > indent);

				let fold = true;

				if(this.indentation.filter) {
					fold = this.indentation.filter.test(lineContent);

					this.debugChannel?.appendLine(`[indentation] line: ${line + 1}, match(begin): ${fold ? 'yes' : 'no'}`);
				}

				if(fold) {
					const endLineNumber = previous.end - 1;
					const block = endLineNumber - line >= 1;

					if(block && !existingRanges[line]) {
						foldingRanges.push(new FoldingRange(line, endLineNumber, FoldingRangeKind.Region));

						if(this.indentation.nestedRegex) {
							const foldLines: number[] = [];

							const stack: StackItem[] = [];
							const endMatches = {};

							let position: Position = { line: line + 1, offset: 0 };
							let targetIndent = -1;

							while(position.line < endLineNumber) {
								const lineContent = document.lineAt(position.line).text;
								const newIndent = computeIndentLevel(lineContent, tabSize);

								if(newIndent > indent) {
									targetIndent = newIndent;
									break;
								}
								else {
									position.line += 1;
								}
							}

							while(position.line < endLineNumber) {
								const lineContent = document.lineAt(position.line).text;
								const newIndent = computeIndentLevel(lineContent, tabSize);

								if(newIndent === targetIndent) {
									position = this.resolveExplicitRange(document, foldingRanges, 'indentation', this.indentation.nestedRegex, stack, endMatches, 0, false, position.line, position.offset, foldLines);
								}
								else {
									position.line += 1;
									position.offset = 0;
								}
							}

							while(stack[0]) {
								if(stack[0].rule.foldEOF) {
									const begin = stack[0].line;

									if(endLineNumber > begin + 1) {
										this.pushNewRange(stack[0].rule, begin, endLineNumber, foldingRanges, foldLines);
									}
								}

								stack.shift();
							}
						}
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

	toRegex(value: string, isRegex: boolean, isEnder: boolean): Result<RegExp, string> { // {{{
		let match: RegExpExecArray | null;

		while((match = VARIABLE_REGEX.exec(value))) {
			const [{ length }, type, key] = match;

			if(!this.variables.has(key)) {
				return err(`can't find the variable: '${key}'`);
			}

			let replacement = this.variables.get(key)!;

			if(type === ':') {
				if(isRegex) {
					replacement = escape(replacement);
				}
			}
			else {
				if(!isRegex) {
					return err('non-regex property don\'t support raw replacement');
				}
			}

			value = value.slice(0, match.index) + replacement + value.slice(match.index + length);
		}

		const source = isRegex ? translate(value, Flavor.ES2018) : escape(value);
		const regex = new RegExp(isEnder ? `${source}$` : source);

		return ok(regex);
	} // }}}
}
