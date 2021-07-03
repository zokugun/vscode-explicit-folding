# Begin/End Rule

## `begin`/`beginRegex`

The properties `begin` and `beginRegex` are indicating the beginning of a folding region. One of them is required.

## `end`/`endRegex`

The properties `end` and `endRegex` are indicating the ending of a folding region. One of them is required.

### docstring blocks

When `begin`/`beginRegex` and `end`/`endRegex` are identicals, the `middle` property, capturing groups and nested blocks aren't supported.

```
"python": {
    "beginRegex": "\"\"\"",
    "endRegex": "\"\"\"",
}
```

### capturing groups

The property `beginRegex` supports capturing groups which can be matched to the property `endRegex`.

```
{
    "beginRegex": "#begin ([\\w]+)",
    "endRegex": "#end \\1"
}
```

Internally, the reference `\1` is replaced by its source from `beginRegex`, so `endRegex` becomes `#end [\\w]+`.

You have to make sure that the replacement don't generate a conflict in the `endRegex`, like this example:

```
{
    "beginRegex": "\"([^\\(]{0,16})\\(",
    "endRegex": "\\)\\1\""
}
```

- `"` also needs to be excluded in `[^\\(]`.

## `middle`/`middleRegex`

With the property `middle`/`middleRegex`, the folding region can be splitted into several sections.

```
"cpp": {
    "begin": "#if",
    "middle": "#else",
    "end": "#endif"
}
```

## `foldEOF`

The property `foldEOF` is a boolean (`false` by default).

If `true`, when the end of file is reached, the folding range will be closed on the last line.

## `foldLastLine`

The property `foldLastLine` is a boolean or an array of boolean (`true` by default).

If `true`, the folding range will include the last line.

It `false`, the folding range won't include the last line. So the last line will stay visible when the range is closed.

### dynamic foldLastLine

The array of boolean is used in conjection of the capture groups found in the property `endRegex`.

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

The `kind` property indicates if the folding range is a `comment` or a `region` (`region` by default).

## `autoFold`

The property `autoFold` is a boolean (`false` by default).

If `true`, the folding range will be automatically folded.

## `name`

The `name` property is only used by the debug. It's used to increase the readability of the debug logs.

## `nested`

The property `nested` is a boolean or an array of rules (`true` by default).

If `true`, the existing folding range will allow nested folding ranges.

It `false`, no new folding ranges can be created in the existing folding range (example: C/C++ block comment).

### nested rules

When the property `nested` is an array, it's listing the only rules you can find inside the folding region.

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

The property `strict` is a boolean or the string `never` (`true` by default). It's only relevant if the property `nested` is an array.

If `true`, the rule can contain only folding regions directly defined in its property `nested`.

If `false`, the rule can contain folding regions defined in its property `nested` or in the property `nested` of its children.

If `never`, the default value of `strict` becomes `false` for itself and all its descendants.

## `consumeEnd`

The property `consumeEnd` is a boolean or an array of boolean (`true` by default) like the property `foldLastLine`.

It's indicating at which position the testing for the next possible matching rule will begin.

If `true`, the position will be moved after the matched `end`/`endRegex`.

If `false`, the position will stay the same as when testing for `end`/`endRegex`.

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
