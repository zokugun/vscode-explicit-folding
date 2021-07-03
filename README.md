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

In your settings:

```
"explicitFolding.rules": {
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

## Rules

The property `explicitFolding.rules` is defining how to fold the code.

Here the list of possible rules:
- [begin/end](https://github.com/zokugun/vscode-explicit-folding/blob/master/docs/rules/begin-end.md)
- [begin/continuation](https://github.com/zokugun/vscode-explicit-folding/blob/master/docs/rules/begin-continuation.md)
- [begin/while](https://github.com/zokugun/vscode-explicit-folding/blob/master/docs/rules/begin-while.md)
- [while](https://github.com/zokugun/vscode-explicit-folding/blob/master/docs/rules/while.md)
- [separator](https://github.com/zokugun/vscode-explicit-folding/blob/master/docs/rules/separator.md)
- [indentation](https://github.com/zokugun/vscode-explicit-folding/blob/master/docs/rules/indentation.md)

### Global scope

When used in the global scope, the rules must be regrouped by language.

```
"explicitFolding.rules": {
    "cpp": [
        {
            "beginRegex": "#if(?:n?def)?",
            "middleRegex": "#el(?:se|if)",
            "endRegex": "#endif"
        }
    ]
}
```

### Language scope

```
"[cpp]": {
    "explicitFolding.rules": [
        {
            "beginRegex": "#if(?:n?def)?",
            "middleRegex": "#el(?:se|if)",
            "endRegex": "#endif"
        }
    ]
}
```

### Regex Syntax

Via VSCode's editor, the extension supports [ES2018 regexes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).

In addition, the following PCRE2 syntaxes are supported:

- `(?i)x`: `x` becomes case insensitive
- `(?i:x)y`: only `x` is case insensitive

## Auto Fold

You can define the automatic folding of the ranges with the property `explicitFolding.autoFold` (an enum, `none` by default).<br/>
Each rule can overwrite that property with its own property `autoFold` (a boolean, `false` by default).

So you can auto fold only the imports with:
```
"[javascript]": {
    "explicitFolding.rules": [
        {
            "beginRegex": "^import\\b",
            "whileRegex": "^(?:import\\b|\\/\\/)",
            "autoFold": true
        }
    ],
    "explicitFolding.autoFold": "none"
}
```

[enum values](https://github.com/zokugun/vscode-explicit-folding/blob/master/docs/properties/auto-fold.md)

## Debugging

If the property `explicitFolding.debug` (`false` by default) is `true`, the extension will print out debug informations into the channel `Folding` of the panel `Output` (menu: `View` / `Output`).

## Priority/Delay

VSCode is scoring each folding providers based on the scheme and language. When the scores are identicals, the providers which have been registered the latest have an higher priority.<br/>
When starting up, VSCode loads the extensions. When reading a file, VSCode will load the folding provider of the file's language (only once per language).

The property `explicitFolding.delay` (in ms, `1000` by default) is used so that this extension's folding provider has a higher priority than the one of the language provider.

## Notification

The property `explicitFolding.notification` (`minor` by default) indicates when to show the update notification.

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

### VSCode/VSCodium

VSCode is using the folding ranges provided:
- by the folding range provider defined by the setting `editor.foldingStrategy` (`auto` or `indentation`)
- <ins>**and**</ins>, by the folding range provider defined by this extension if `editor.foldingStrategy` is set to **`auto`**

### MrCode

[MrCode](https://github.com/zokugun/MrCode) is using the folding ranges provided:
- by the folding range provider defined by the setting `editor.foldingStrategy` (`auto` or `indentation`)
- <ins>**or**</ins> by the folding range provider defined by this extension if `editor.foldingStrategy` is set to **`explicit`**

The long-standing [PR](https://github.com/microsoft/vscode/pull/54200) tries to bring this new behaviour to VSCode.

**Enjoy!**
