Explicit Folding
================

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/zokugun.explicit-folding.svg)](https://marketplace.visualstudio.com/items?itemName=zokugun.explicit-folding)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/zokugun.explicit-folding.svg)](https://marketplace.visualstudio.com/items?itemName=zokugun.explicit-folding)
[![License](https://img.shields.io/badge/donate-ko--fi-green)](https://ko-fi.com/daiyam)
[![License](https://img.shields.io/badge/donate-liberapay-green)](https://liberapay.com/daiyam/donate)
[![License](https://img.shields.io/badge/donate-paypal-green)](https://paypal.me/daiyam99)

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

### `foldEOF` property

The `foldEOF` property is a boolean (`false` by default).

If it's `true`, when the end of file is reached, the folding range will be closed on the last line.

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

By default, the `foldEOF` property is `true`.

### `foldBOF` property

The `foldBOF` property is a boolean (`true` by default).

If it's `true`, the first separator will create a folding range from the beginning of the file to its first line.

### `descendants` property

```
"folding": {
    "cobol": {
        "separatorRegex": "\\S+\\s+(?i:DIVISION)",
        "descendants": [
            {
                "separatorRegex": "\\S+\\s+(?i:SECTION)"
            }
        ]
    }
}
```

### `strict` property

The `strict` property is a boolean (`true` by default).

If it's `true`, the descendants can only be inside a parent.
If `false`, the descendants can be inside a parent or a great-parent.

## Dynamic foldLastLine

When used with `endRegex`, `foldLastLine` can be an array of boolean.

Each capture groups (`1...n`) in `endRegex` will require a boolean in `foldLastLine` (`1...n`).
`foldLastLine[0]` will be used as the default value.

```
"php": {
    "beginRegex": "(?:case|default)[^:]*:",
    "endRegex": "break;|(.)(?=case|default|\\})",
    "foldLastLine": [true, false]
}
```

## Indentation

The builtin indentation provider is only used when there no other folding providers.

```
"folding": {
    "python": [
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

With the previous config, a python file can be folded by its indentation **and** with docstrings.

`offSide` (default: false) decide whether empty lines belong to the previous or the next block.
Used by the default indentation provider and defined by language's configuration (not accessible by an extension).

Another quirk is that the default indentation provider use the tab size given given with the document, but an extension doesn't have access to that info.
So the extension use the tab size of the active document (most likely the document that is being parsed).

Even if it's a little outside the scope of the extension, I believe it will be helpfull to some users.

## Regex Syntax

Via Visual Studio Code's editor, the extension supports [ES2018 regexes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).

In addition, with the help of the [regex parser/translator](https://www.npmjs.com/package/@daiyam/regexp), the following PCRE2 syntax is also supported:

- `(?i)x`: `x` becomes case insensitive
- `(?i:x)y`: only `x` is case insensitive

## Debugging

You can get some debug informations with the configuration `explicitFolding.debug`.
When `true`, the extension will print out the debug informations into the channel `Folding` of the panel `Output` (menu: `View` / `Output`).

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
            <th>HTML</th>
            <td>
<pre><code>"html": {
   "beginRegex": "<(?!area|base|br|col|embed|hr|img|input|link|menuitem|meta|param|source|track|wbr)([a-zA-Z]+)[^>\\/]*>",
   "endRegex": "<\\/\\1>"
}</code></pre>
            </td>
        </tr>
        <tr>
            <th>PHP</th>
            <td>
<pre><code>"php": [
    {
        "beginRegex": "(?:case|default)[^:]*:",
        "endRegex": "break;|(.)(?=case|default|\\})",
        "foldLastLine": [true, false]
    },
    {
        "beginRegex": "\\{",
        "middleRegex": "\\}[^}]+\\{",
        "endRegex": "\\}"
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

## FAQ

**Q:** Why don't I see the foldings ?

**A:** Firstly, make sure you have the setting `"editor.showFoldingControls": "always"` and that you don't have `"editor.foldingStrategy": "indentation"`. Then, verify your config :wink:

## Donations

Support this project by becoming a financial contributor.

<table>
    <tr>
        <td><img src="https://raw.githubusercontent.com/daiyam/assets/master/icons/256/funding_kofi.png" alt="Ko-fi" width="80px" height="80px"></td>
        <td><a href="https://ko-fi.com/daiyam" target="_blank">ko-fi.com/daiyam</a></td>
    </tr>
    <tr>
        <td><img src="https://raw.githubusercontent.com/daiyam/assets/master/icons/256/funding_liberapay.png" alt="Liberapay" width="80px" height="80px"></td>
        <td><a href="https://liberapay.com/daiyam/donate" target="_blank">liberapay.com/daiyam/donate</a></td>
    </tr>
    <tr>
        <td><img src="https://raw.githubusercontent.com/daiyam/assets/master/icons/256/funding_paypal.png" alt="PayPal" width="80px" height="80px"></td>
        <td><a href="https://paypal.me/daiyam99" target="_blank">paypal.me/daiyam99</a></td>
    </tr>
</table>

## Editors support

### VSCode

VSCode is using the folding ranges provided:
- by the folding range provider defined by the setting `editor.foldingStrategy` (`auto` or `indentation`)
- <ins>**and**</ins>, by the folding range provider defined by this extension if `editor.foldingStrategy` is set to **`auto`**

### MrCode

[MrCode](https://github.com/zokugun/MrCode) is using the folding ranges provided:
- by the folding range provider defined by the setting `editor.foldingStrategy` (`auto` or `indentation`)
- <ins>**or**</ins> by the folding range provider defined by this extension if `editor.foldingStrategy` is set to **`explicit`**

The long-standing [PR](https://github.com/microsoft/vscode/pull/54200) tries to bring this new behaviour to VSCode.

**Enjoy!**
