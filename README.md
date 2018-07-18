Explicit Folding
===============

**Experimental**

Manually controls how and where to fold your code

## Configuration

In your Settings
```
"folding": {
    "*": {
        "begin": "\\{\\{\\{",
        "end": "\\}\\}\\}"
    },
    "typescript": {
        "begin": "#region",
        "end": "#endregion"
    },
    "javascriptreact": [
        {
            "begin": "\\{/\\*",
            "end": "\\*/\\}"
        },
        {
            "begin": "<",
            "end": "/>"
        }
    ]
}
```

## Known Issues

- It's unable to remove existing folding

**Enjoy!**