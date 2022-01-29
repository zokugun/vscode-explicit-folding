# Changelog

## 2021-11-08 — v0.20.0
- it's a web extension

## 2021-10-26 — v0.19.3
- correctly register language whose settings are defined by another extension

## 2021-08-27 — v0.19.2
- improve activation events
- add capabilities

## 2021-08-24 — v0.19.1
- fix renamed files after linting the project

## 2021-08-24 — v0.19.0
- add `additionalSchemes` property to support schemes created by extensions

## 2021-07-22 — v0.18.2
- add `bypassProtection` property to be able to match an empty line

## 2021-07-21 — v0.18.1
- fix not-nested rules with capture groups

## 2021-07-20 — v0.18.0
- fix capture groups in nested rules
- `endRegex` with refs are generated on the run
- update icon

## 2021-07-15 — v0.17.0
- add API to support external rules

## 2021-07-03 — v0.16.0
- fix indented languages by avoiding to define the folding provider
- add the configuration `explicitFolding.wildcardExclusions`

## 2021-07-03 — v0.15.0
- add the configuration `explicitFolding.autoFold` to automatically fold ranges when opening a file

## 2021-06-25 — v0.14.8
- fix new conflict between rules when `foldLastLine` and `nested` are `false`
- better explanation of `consumeEnd` in the doc

## 2021-06-25 — v0.14.7
- fix how to calculate next offset
- fix consumeEnd with begin and end on same line
- exit secondary loop at the end of the match, not at the next line

## 2021-06-25 — v0.14.6
- manually published on Visual Studio Marketplace

## 2021-06-24 — v0.14.5
- fix issue with repeated `"strict": "never"`
- change icon

## 2021-06-21 — v0.14.4
- fix conflict between rules when `foldLastLine` and `nested` are `false`
- add icon

## 2021-06-20 — v0.14.3
- fix infinity loop with single-line and not-nested region

## 2021-06-18 — v0.14.2
- fix global `explicitFolding.rules`

## 2021-06-18 — v0.14.1
- fix how to determine that the configuration `folding` isn't used

## 2021-06-18 — v0.14.0
- rename the configuration `folding` to `explicitFolding.rules` (`folding` is supported until July 1, 2022)
- rename the configuration `startupDelay` to `explicitFolding.delay`
- the configurations `explicitFolding.rules`, `explicitFolding.debug` or `explicitFolding.delay` can be placed in a language section.
- the property `descendants` is regrouped with the property `nested`
- the `begin/end` rule is fully supporting the property `nested` as an array of rules
- add `begin/while` rule
- add `while` rule
- add documentation for each rules and their applicable properties

## 2021-05-18 — v0.13.1
- fix `^` in the alternative loop for non-nested blocks
- improve debug messages

## 2021-05-14 — v0.13.0
- using deferred provider so that the real folding provider is loaded after the language's folding provider. By doing so, the folding ranges provided by the extension are given an higher importance, so VSCode is using them instead of the ones from the language's folding provider (if there is a conflict).

## 2021-05-12 — v0.12.1
- fix need to reload VSCode when changing `explicitFolding.debug`

## 2021-05-12 — v0.12.0
- add the configuration `explicitFolding.debug` to print out debug information into the channel `Folding` of the panel `Output`
- add `foldEOF` property which will close the folding at the end of the file
- add `foldBOF` property, only for separators
- add `descendants` property, only for separators
- add `strict` property, only for separators
- `^` is correctly matching the beginning of a line
- use new regex parser to support `(?<=y)x`, `(?<!y)x`, `(?i)x` and `(?i:x)`
- add unit tests

## 2021-02-20 — v0.11.0
- add `indentation` property
- add flag indicating that the extension is managing how to fold the last line (only for [MrCode](https://github.com/zokugun/MrCode))

## 2021-02-16 — v0.10.0
- add dynamic `foldLastLine`

## 2021-02-12 — v0.9.2
- register provider to all applicable schemes

## 2020-12-24 — v0.9.1
- allows provider on all schemes
- fix README

## 2020-08-20 — v0.9.0
- add the configuration `explicitFolding.startupDelay` which will delay the registration of the folding providers when starting up (1000 ms by default). This fixes the issue where the editor wasn't using the correct folding providers at startup.
- add the configuration `explicitFolding.notification` to manage the notifications. By default, the notifications will be shown only for minor revisions.

## 2020-05-27 — v0.8.2
- fix `continuation` marker when first match doesn't include the line-continuation character
- fix looping on configuration

## 2020-05-26 — v0.8.1
- improve handling of non-nested rules to test only necessary regular expressions

## 2020-05-26 — v0.8.0
- add `continuation` marker
- fix infinity loop due to zero-length regular expressions
- fix capturing groups

## 2020-05-22 — v0.7.1
- add `nested` property

## 2020-05-12 — v0.7.0
- support docstring blocks

## 2020-04-14 — v0.6.0
- add `separator` property

## 2020-03-20 — v0.5.1
- fix missing dependency

## 2020-03-20 — v0.5.0
- support capturing groups
- fix known issue only for [MrCode](https://github.com/zokugun/MrCode)

## 2020-03-18 — v0.4.0
- fix bug when `begin` and `end` markers are on the same line
- add `middle` marker
- add `foldLastLine` property
- add `kind` property to indicate if the range is a `comment` or a `region`

## 2019-06-08 — v0.3.2
- show message when the extension is updated
- update dependencies due to security issue

## 2019-04-04 — v0.3.1
- catch error due to bad regex

## 2019-04-03 — v0.3.0
- change configuration's properties `begin` and `end` as regular string (**not regex**)
- add configuration's properties `beginRegex` and `endRegex` to be able to use **regex**

## 2018-07-18 — v0.2.1
- rename repository

## 2018-07-18 — v0.2.0
- rename extension
- support multiple markers for a language
- rename configuration's property `start` to `begin`

## 2018-07-16 — v0.1.1
- fix an error in the settings
- update folding controls upon changes in the configuration 
- fix formatting

## 2018-07-09 — v0.1.0
- initial release
