# Begin/While Rule

## `begin`/`beginRegex`

The properties `begin` and `beginRegex` are indicating the beginning of a folding region. One of them is required.

## `while`/`whileRegex`

Starting the second line of the folding region, each line must match the properties `while` or `whileRegex`. One of the properties is required.

## `foldEOF`

The property `foldEOF` is a boolean (`false` by default).

If `true`, when the end of file is reached, the folding range will be closed on the last line.

## `foldLastLine`

The property `foldLastLine` is a boolean (`true` by default).

If `true`, the folding range will include the last line.

It `false`, the folding range won't include the last line. So the last line will stay visible when the range is closed.

## `kind`

The `kind` property indicates if the folding range is a `comment` or a `region` (`region` by default).

## `autoFold`

The property `autoFold` is a boolean (`false` by default).

If `true`, the folding range will be automatically folded.
