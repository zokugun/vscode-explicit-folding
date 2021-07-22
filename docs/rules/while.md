# While Rule

## `while`/`whileRegex`

Each line of a folding region must match the properties `while` or `whileRegex`. One of the properties is required.

```
"jcl": {
    "kind": "comment",
    "whileRegex": "^\\/\\/\\*"
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

## `bypassProtection`

The property `bypassProtection` is a boolean.

If `false`, by default, all regexes which are matching an empty string, are discarded. It's to protect against infinite loop.<br/>
If you want to match an empty line, you will need to disable the protection by setting the property to `true`.

## `autoFold`

The property `autoFold` is a boolean (`false` by default).

If `true`, the folding range will be automatically folded.
