# Begin/End Rule

## `begin`/`beginRegex`

The `begin` and `beginRegex` properties are indicating the beginning of a folding region. One of them is required.

## `end`/`endRegex`

The `end` and `endRegex` properties are indicating the ending of a folding region. One of them is required.

In the case that they are matched by the `begin`/`beginRegex` properties, no ending of a folding region will ever be generated because `begin`/`beginRegex` take precedence.

### docstring blocks

When the `begin`/`beginRegex` and `end`/`endRegex` properties are identical, the `middle` property, capturing groups, and nested blocks aren't supported.

```
"python": {
    "beginRegex": "\"\"\"",
    "endRegex": "\"\"\"",
}
```

### capturing groups

The `beginRegex` property supports capturing groups which can be matched to the `endRegex` property.

```
{
    "beginRegex": "#begin ([\\w]+)",
    "endRegex": "#end \\1"
}
```

## `middle`/`middleRegex`

With the `middle`/`middleRegex` property, the folding region can be split into several sections.

```
"cpp": {
	"begin": "#if",
	"middle": "#else",
	"end": "#endif"
}
```

## `foldEOF`

The `foldEOF` property is a **boolean** (set to `false` by default).

If the value is `true`, when the end of file is reached, the folding range will be closed on the last line.

## `foldBeforeFirstLine`

The `foldBeforeFirstLine` property is a **boolean** (set to `false` by default).

If the value is `true`, the folding range will include the line before the first line. In such case, the first line won't stay visible when the range is closed.<br/>
If the value is `false`, the folding range won't include the line before the first line.

## `foldLastLine`

The `foldLastLine` property is either a **boolean**, or an **array** of booleans (set to `true` by default).

If the value is `true`, the folding range will include the last line.<br/>
If the value is `false`, the folding range exclude the last line. In such case, the last line will stay visible when the range is closed.

### dynamic foldLastLine

The array of boolean is used in conjunction of the capture groups found in the property `endRegex`.

Each capture groups (`1...n`) in `endRegex` will require a boolean in `foldLastLine` (`1...n`).
`foldLastLine[0]` will be used as the default value.

```
"php": {
    "beginRegex": "(?:case|default)[^:]*:",
    "endRegex": "break;|(.)(?=case|default|\\})",
    "foldLastLine": [true, false]
}
```

## `kind`

The `kind` property indicates if the folding range is a `comment` or a `region` (set to `region` by default).

## `bypassProtection`

The `bypassProtection` property is a **boolean**.

If the value is `false`, by default, all **regex**es which are matching an empty string, are discarded. This is in order to protect against infinite loops.<br/>
If you want to match an empty line, you will need to disable the protection by setting this property to `true`.

## `autoFold`

The `autoFold` property is a **boolean** (set to `false` by default).

If the value is `true`, the folding range will be folded automatically.

## `name`
The `name` property is only used by the debug. It’s used to increase the readability of the debug logs.

## `nested`

The `nested` property is a **boolean** or an **array** of rules (set to `true` by default).

If the value is `true`, the existing folding range will allow nested folding ranges.<br/>
It the value is `false`, no new folding ranges can be created in the existing folding range (example: C/C++ block comment).

### nested rules

When the `nested` property is an **array**, it's listing the only rules you can find inside the folding region.

```
"jcl": {
	"beginRegex": "^\\/\\/[^*]\\S* +PROC(?: |$)",
	"endRegex": "^\\/\\/[^*]\\S* +PEND(?: |$)",
	"nested": [
		{
			"separatorRegex": "^\\/\\/[^*]\\S* +EXEC ",
			"nested": [
				{
					"separatorRegex": "^\\/\\/[^*]\\S* +DD ",
				}
			]
		}
	]
}
```

## `strict`

The `strict` property is a **boolean** or the **string** `never` (set to `true` by default). It's only relevant if the property `nested` is an array.

If the value is `true`, the rule can contain only folding regions directly defined in its property `nested`.<br/>
If the value is `false`, the rule can contain folding regions defined in its property `nested` or in the property `nested` of its children.<br/>
If the value is `never`, the default value of `strict` becomes `false` for itself and all its descendants.

## `consumeEnd`

The `consumeEnd` property is a **boolean** or an **array of boolean** (set to `true` by default) like the property `foldLastLine`.

If the value is `true`, the position will be moved after the matched `end`/`endRegex`.<br/>
If the value is `false`, the position will stay the same as when testing for `end`/`endRegex`.

```
"jcl": [
	{
		"name": "comment",
		"kind": "comment",
		"beginRegex": "^\\/\\/\\*",
		"endRegex": "^\\/\\/[^*]",
		"consumeEnd": false,
		"nested": false
	}
]
```
