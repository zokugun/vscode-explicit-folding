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

## Migrate from v0.2 to v0.3

The configuration's properties `begin` and `end` should be renamed as `beginRegex` and `endRegex`.

## Known Issues

- It's unable to remove existing folding

**Enjoy!**