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

### `foldLastLine` property

The `foldLastLine` property is a boolean (`true` by default).

If it's `true`, the folding range will incluse the last line.

It `false`, the last line will still be visible when the range is closed.

### `nested` property

The `nested` property is a boolean (`true` by default).

If it's `true`, the existing folding range will allow nested folding ranges.

It `false`, no new folding ranges can be created in the existing folding range (example: C/C++ block comment).

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

## Middle markers

With the `middle`/`middleRegex` markers, a folding block can be splitted into several sections.

```
"cpp": {
    "begin": "#if",
    "middle": "#else",
    "end": "#endif"
}
```

## Continuation markers

The `continuation`/`continuationRegex` markers are allowing single-line comments to contain line-continuation character.

```
"cpp": {
    "begin": "//",
    "continuation": "\\",
    "nested": false
}
```

## Docstring blocks

When `begin`/`beginRegex` and `end`/`endRegex` are identicals, the `middle` property, capturing groups and nested blocks aren't supported.

```
"python": {
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

## Usages

<table>
    <thead>
        <tr>
            <th>Language</th>
            <th>Config</th>
        </tr>
    </thead>
    <tboby>
        <tr>
            <th><i>Emacs</i></th>
            <td>
<pre><code>"*": {
    "begin": "{{{",
    "end": "}}}"
}</code></pre>
            </td>
        </tr>
        <tr>
            <th>C/C++</th>
            <td>
<pre><code>"cpp": [
    {
        "beginRegex": "#if(?:n?def)?",
        "middleRegex": "#el(?:se|if)",
        "endRegex": "#endif"
    },
    {
        "begin": "/*",
        "end": "*/",
        "nested": false
    },
    {
        "begin": "//",
        "continuation": "\\",
        "nested": false
    }
]</code></pre>
            </td>
        </tr>
        <tr>
            <th>Python</th>
            <td>
<pre><code>"python": {
    "beginRegex": "\"\"\"",
    "endRegex": "\"\"\""
}</code></pre>
            </td>
        </tr>
        <tr>
            <th>SASS</th>
            <td>
<pre><code>"scss": {
    "beginRegex": " \\{\\s*$",
    "endRegex": "^\\s*\\}"
}</code></pre>
            </td>
        </tr>
    </tobody>
</table>

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