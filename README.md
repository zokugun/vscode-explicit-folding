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

It not, the last line will still be visible when the range is closed.

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

## Docstring blocks

When `begin`/`beginRegex` and `end`/`endRegex` are identicals, the `middle` property, capturing groups and nested blocks aren't supported.

```
"py": {
    "beginRegex": "\"\"\"",
    "endRegex": "\"\"\"",
}
```

## Separator

The `separator` or `separatorRegex` properties allow to fold a file based on a separator.

In this mode, the `foldLastLine` property and capturing groups are not supported.

```
"folding": {
    "log": {
        "separator": "process"
    }
}
```

## Editors support

### VSCode

VSCode is using the folding ranges provided:
- by the folding range provider defined by the setting `editor.foldingStrategy` (`auto` or `indentation`)
- <ins>**and**</ins> by the folding range provider defined by this extension

### MrCode

[MrCode](https://github.com/zokugun/MrCode) is using the folding ranges provided:
- by the folding range provider defined by the setting `editor.foldingStrategy` (`auto` or `indentation`)
- <ins>**or**</ins> by the folding range provider defined by this extension if `editor.foldingStrategy` is set to `explicit`

The long-standing [PR](https://github.com/microsoft/vscode/pull/54200) tries to bring this new behaviour to VSCode.

**Enjoy!**