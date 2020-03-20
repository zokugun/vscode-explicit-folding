Explicit Folding
================

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/zokugun.explicit-folding.svg)](https://marketplace.visualstudio.com/items?itemName=zokugun.explicit-folding)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/zokugun.explicit-folding.svg)](https://marketplace.visualstudio.com/items?itemName=zokugun.explicit-folding)

Manually controls how and where to fold your code

## Configuration

In your Settings:

```
"folding": {
    "*": {
        "begin": "{{{",
        "end": "}}}"
    },
    "typescript": {
        "begin": "#region",
        "end": "#endregion"
    },
    "javascriptreact": [
        {
            "begin": "{/*",
            "end": "*/}"
        },
        {
            "begin": "<",
            "end": "/>"
        }
    ]
}
```

or with **regex**:

```
"folding": {
    "*": {
        "beginRegex": "\\{\\{\\{",
        "endRegex": "\\}\\}\\}"
    },
    "typescript": {
        "beginRegex": "#region",
        "endRegex": "#endregion"
    },
    "javascriptreact": [
        {
            "beginRegex": "\\{/\\*",
            "endRegex": "\\*/\\}"
        },
        {
            "begin": "<",
            "end": "/>"
        }
    ]
}
```

### `middle` & `middleRegex` properties

```
"folding": {
	"*": {
		"begin": "#if",
		"middle": "#else",
		"end": "#endif"
	}
}
```

It will allow VSCode to fold the following code:

```cpp
#if test
	code1()
#else
	code2()
#endif
```

### `foldLastLine` property

The `foldLastLine` property is a boolean (`true` by default).

If it's true the folding range will incluse the last line.
It not, the last line will still be visiable when the range is closed.

### `kind` property

The `kind` property indicates if the folding range is a `comment` or a `region` (`region` by default).

## Capturing Groups

`beginRegex` supports capturing groups which can be matched in `endRegex`.

```
{
	"beginRegex": "#begin ([\\w]+)",
	"endRegex": "#end \\1"
}
```

## Known Issue

- In VSCode, it's unable to remove existing folding.

## MrCode

[MrCode](https://github.com/zokugun/MrCode) is my own spin of VSCode with the [PR](https://github.com/microsoft/vscode/pull/54200). It fixes the known issue.

In [MrCode](https://github.com/zokugun/MrCode), by setting `editor.foldingStrategy = 'explicit'`, only the folding ranges of this extension are used.

**Enjoy!**