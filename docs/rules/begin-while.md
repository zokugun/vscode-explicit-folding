# Begin/While Rule

## `begin`/`beginRegex`

The properties `begin` and `beginRegex` are indicating the beginning of a folding region. One of them is required.

## `while`/`whileRegex`

Starting the second line of the folding region, each line must match the properties `while` or `whileRegex`. One of the properties is required.

## `foldEOF`

The `foldEOF` property is a **boolean** (set to `false` by default).

If the value is `true`, when the end of file is reached, the folding range will be closed on the last line.

## `foldLastLine`/`foldLastLineRegex`

The `foldLastLine` property is a **boolean** or a **string** (set to `true` by default).

If the value is `true`, the folding range will include the last line.<br/>
If the value is `false`, the folding range will exclude the last line. In such case, the last line will remain visible when the range is closed.<br/>
If the value is a **string**, the folding range won't include the last line if it matches `foldLastLine`.

If `foldLastLineRegex` property is used, the folding range won't include the last line if it matches `foldLastLineRegex`.

## `kind`

The `kind` property indicates if the folding range is a `comment` or a `region` (set to `region` by default).

## `bypassProtection`

The `bypassProtection` property is a **boolean**.

If the value is `false`, by default, all **regex**es which are matching an empty string, are discarded. This is in order to protect against infinite loops.<br/>
If you want to match an empty line, you will need to disable the protection by setting this property to `true`.

## `autoFold`

The `autoFold` property is a **boolean** (set to `false` by default).

If the value is `true`, the folding range will be folded automatically.
