export type FoldingConfig = {
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
	foldBOF?: boolean,
	foldEOF?: boolean,
	nested?: boolean | FoldingConfig[],
	descendants?: FoldingConfig[],
	strict?: boolean | string,
	name?: string,
	kind?: 'comment' | 'region'
}
