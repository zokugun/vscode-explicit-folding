# Separator Rule
The properties `separator` and `separatorRegex` allow to fold a file based on a separator.
```
"cobol": {
	"separatorRegex": "(?<=^.{6}\\s{1,4})[A-Za-z0-9\\-_:]+(?=\\s+(?i:DIVISION))",
	"strict": "never",
	"nested": [
		{
			"separatorRegex": "(?<=^.{6}\\s{1,4})[A-Za-z0-9\\-_:]+(?=\\s+(?i:SECTION))"
		}
	]
}
```

## `foldBOF` property
The `foldBOF` property is a boolean (`true` by default).  
If the value is `true`, the first separator will create a folding range from the beginning of the file to its first line.

## `foldEOF`
The `foldEOF` property is a boolean (`true` by default).  
If the value is`true`, when the end of file is reached, the folding range will be closed on the last line.

## `kind`
The `kind` property indicates if the folding range is a `comment` or a `region` (`region` by default).

## `bypassProtection`
The `bypassProtection` property is a boolean.

If the value is `false`, by default, all **regex**es which are matching an empty string, are discarded. It’s to protect against infinite loop.  
If you want to match an empty line, you will need to disable the protection by setting the property to `true`.

## `autoFold`
The `autoFold` property is a boolean (`false` by default).  
If the value is `true`, the folding range will be automatically folded.

## `nested`
The `nested` property is a boolean or an array of rules (`true` by default).  
If the value is `true`, the existing folding range will allow nested folding ranges.  
It the value is `false`, no new folding ranges can be created in the existing folding range (example: C/C++ block comment).

### nested rules
When the `nested` property is an array, it’s listing the only rules you can find inside the folding region.

## `strict`
The `strict` property is a boolean or the string `never` (`true` by default). It’s only relevant if the property `nested` is an array.  
If the value is `true`, the rule can contain only folding regions directly defined in its property `nested`.  
If the value is `false`, the rule can contain folding regions defined in its property `nested` or in the property `nested` of its children.  
If the value is `never`, the default value of `strict` becomes `false` for itself and all its descendants.
