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
	middle: RegExp,
	end: RegExp,
	foldLastLine: boolean,
	kind: FoldingRangeKind
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
				regex = {
					begin: new RegExp(configuration.beginRegex),
					middle: new RegExp(configuration.middleRegex || 'a^'),
					end: new RegExp(configuration.endRegex),
					foldLastLine: typeof configuration.foldLastLine === "boolean" ? configuration.foldLastLine : true,
					kind: configuration.kind === 'comment' ? FoldingRangeKind.Comment : FoldingRangeKind.Region
				};
			} else if (configuration.begin && configuration.end) {
				regex = {
					begin: new RegExp(escapeRegex(configuration.begin)),
					middle: new RegExp(configuration.middle ? escapeRegex(configuration.middle) : 'a^'),
					end: new RegExp(escapeRegex(configuration.end)),
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

			return `(?<_${Marker.BEGIN}_${index}>${regex.begin.source})|(?<_${Marker.MIDDLE}_${index}>${regex.middle.source})|(?<_${Marker.END}_${index}>${regex.end.source})`;
		} else {
			return '';
		}
	}

	private *findOfRegexp(line: string) {
		let left = 0;

		while (true) {
			const res = this.masterRegex.exec(line.substring(left || 0)) as { groups?: { [key: string]: string }, index?: number, [key: number]: string };

			if (res && res.groups) {
				left = left + (res.index || 0) + res[0].length;

				for (const key in res.groups) {
					if (res.groups[key]) {
						const keys = key.split('_').map(x => parseInt(x));

						yield {
							type: keys[1],
							index: keys[2]
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
		const stack: { r: FoldingRegex, i: number }[] = [];

		for (let i = 0; i < document.lineCount; i++) {
			for (const { type, index } of this.findOfRegexp(document.lineAt(i).text)) {
				const regex = this.regexes[index]

				switch (type) {
					case Marker.BEGIN:
						stack.unshift({ r: regex, i: i });
						break;
					case Marker.MIDDLE:
						if (stack[0]) {
							const start = stack[0].i;
							const end = i;

							if (start != end) {
								foldingRanges.push(new FoldingRange(start, end - 1, regex.kind));
							}

							stack.shift();
						}

						stack.unshift({ r: regex, i: i });
						break;
					case Marker.END:
						if (stack[0]) {
							const start = stack[0].i;
							const end = i;

							if (start != end) {
								foldingRanges.push(new FoldingRange(start, regex.foldLastLine ? end : end - 1, regex.kind));
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