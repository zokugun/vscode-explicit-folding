import fs from 'fs';
import path from 'path';
import { EndOfLine, Position, Range, TextDocument, TextLine, Uri } from 'vscode';

export class Line implements TextLine {
	private readonly _line: number;
	private readonly _text: string;
	private readonly _isLastLine: boolean;

	constructor(line: number, text: string, isLastLine: boolean) {
		this._line = line;
		this._text = text;
		this._isLastLine = isLastLine;
	}

	public get lineNumber(): number {
		return this._line;
	}

	public get text(): string {
		return this._text;
	}

	public get range(): Range {
		return new Range(this._line, 0, this._line, this._text.length);
	}

	public get rangeIncludingLineBreak(): Range {
		if(this._isLastLine) {
			return this.range;
		}

		return new Range(this._line, 0, this._line + 1, 0);
	}

	public get firstNonWhitespaceCharacterIndex(): number {
		return /^(\s*)/.exec(this._text)![1].length;
	}

	public get isEmptyOrWhitespace(): boolean {
		return this.firstNonWhitespaceCharacterIndex === this._text.length;
	}
}

export class Document implements TextDocument {
	uri: Uri;
	fileName: string;
	isUntitled: boolean;
	languageId: string;
	version: number;
	isDirty: boolean;
	isClosed: boolean;
	eol: EndOfLine;
	lineCount: number;
	private readonly _lines: Line[];

	constructor(file: string) {
		this.uri = Uri.parse(`file://${file}`);
		this.fileName = path.basename(file);
		this.isUntitled = false;
		this.languageId = 'text';
		this.version = 0;
		this.isDirty = false;
		this.isClosed = false;
		this.eol = EndOfLine.LF;

		const code = fs.readFileSync(file, 'utf8');

		const lines = code.split(/\n/g);
		this.lineCount = lines.length;
		this._lines = lines.map((line, index) => new Line(index, line, index + 1 === lines.length));
	}

	lineAt(line: number | Position): TextLine {
		if(line instanceof Position) {
			line = line.line;
		}

		return this._lines[line];
	}

	/* eslint-disable @typescript-eslint/no-unused-vars */
	getText(range?: Range): string {
		throw new Error('Method not implemented.');
	}

	getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined {
		throw new Error('Method not implemented.');
	}

	offsetAt(position: Position): number {
		throw new Error('Method not implemented.');
	}

	positionAt(offset: number): Position {
		throw new Error('Method not implemented.');
	}

	save(): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}

	validateRange(range: Range): Range {
		throw new Error('Method not implemented.');
	}

	validatePosition(position: Position): Position {
		throw new Error('Method not implemented.');
	}
	/* eslint-enable @typescript-eslint/no-unused-vars */
}
