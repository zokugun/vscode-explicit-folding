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

`offSide` (default: false) decide whether empty lines belong to the previous or the next block.
Used by the default indentation provider and defined by language’s configuration (not accessible by an extension).

Another quirk is that the default indentation provider use the tab size given given with the document, but an extension doesn’t have access to that info.
So the extension use the tab size of the active document (most likely the document that is being parsed).

Even if it's a little outside the scope of the extension, I believe it will be helpful to some users.
