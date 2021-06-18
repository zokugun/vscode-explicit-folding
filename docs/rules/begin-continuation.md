# Begin/Continuation Rule

## `begin`/`beginRegex`

The properties `begin` and `beginRegex` are indicating the beginning of a folding region. One of them is required.

## `continuation`/`continuationRegex`

The properties `continuation` and `continuationRegex` are allowing single-line comments to contain line-continuation character. One of them is required.

```
"cpp": {
    "begin": "//",
    "continuation": "\\"
}
```

## `foldEOF`

The property `foldEOF` is a boolean (`false` by default).

If `true`, when the end of file is reached, the folding range will be closed on the last line.

## `foldLastLine`

The property `foldLastLine` is a boolean (`true` by default).

If `true`, the folding range will include the last line.

It `false`, the folding range won't include the last line. So the last line will stay visible when the range is closed.

## `kind`

The `kind` property indicates if the folding range is a `comment` or a `region` (`region` by default).
