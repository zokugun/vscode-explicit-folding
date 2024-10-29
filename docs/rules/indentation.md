# Indentation Rule

The builtin indentation provider is only used when there no other folding providers.

```
"[python]": {
	"explicitFolding.rules": [
		{
			"beginRegex": "\"\"\"",
			"endRegex": "\"\"\""
		},
		{
			"indentation": true,
			"offSide": true
		}
	]
}
```

With the previous config, a python file can be folded by its **indentation** **and** with **docstring**s.

### `offSide`

The `offSide` property is a **boolean** (set to `false` by default).

It decides whether empty lines belong to the previous or the next block.
Used by the default indentation provider and defined by language’s configuration (not accessible by an extension).

Another quirk is that the default indentation provider use the tab size given given with the document, but an extension doesn’t have access to that info.
So the extension use the tab size of the active document (most likely the document that is being parsed).

### `begin`/`beginRegex`

The `begin` and `beginRegex` properties are indicating the beginning of a folding region.<br />
When used, the first line of the folding region needs to be matched be the regex.

```
"[nim]": {
    "explicitFolding.rules": {
        "indentation": true,
        "beginRegex": "^\\s*(?:proc|template)"
    }
}
```

### nested rules

When the `nested` property is an **array**, it lists the rules generating new foldings. Only the lines with the same indentation are matched together.

```
"[python]": {
    "explicitFolding.rules": [
        {
            "indentation": true,
            "nested": [
                {
                    "separatorRegex": "#\\s+::\\s+",
                    "foldBOF": false,
                },
            ],
        },
    ],
}
```
