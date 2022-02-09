# Changelog

## v0.21.0 — 2022-02-09
- Refactored incorrec: `explicitFolding.wilcardExclusions` has been replaced with `explicitFolding.wildcardExclusions` (with a `d`).
- Improved documentation thanks to @OCRenkist.

## v0.20.0 — 2021-11-08
- It's a web extension.

## v0.19.3 — 2021-10-26
- Correctly register language whose settings are defined by another extension.

## v0.19.2 — 2021-08-27
- Improve activation events.
- Add capabilities.

## v0.19.1 — 2021-08-24
- Fix renamed files after linting the project.

## v0.19.0 — 2021-08-24
- Add `additionalSchemes` property to support schemes created by extensions.

## v0.18.2 — 2021-07-22
- Add `bypassProtection` property to be able to match an empty line.

## v0.18.1 — 2021-07-21
- Fix not-nested rules with capture groups.

## v0.18.0 — 2021-07-20
- Fix capture groups in nested rules.
- `endRegex` with refs are generated on the run.
- update icon.

## v0.17.0 — 2021-07-15
- Add API to support external rules.

## v0.16.0 — 2021-07-03
- Fix indented languages by avoiding to define the folding provider.
- Add the configuration `explicitFolding.wilcardExclusions`.

## v0.15.0 — 2021-07-03
- Add the configuration `explicitFolding.autoFold` to automatically fold ranges when opening a file.

## v0.14.8 — 2021-06-25
- Fix new conflict between rules when `foldLastLine` and `nested` are `false`.
- Better explanation of `consumeEnd` in the doc.

## v0.14.7 — 2021-06-25
- Fix how to calculate next offset.
- Fix consumeEnd with begin and end on same line.
- Exit secondary loop at the end of the match, not at the next line.

## v0.14.6 — 2021-06-25
- Manually published on Visual Studio Marketplace.

## v0.14.5 — 2021-06-24
- Fix issue with repeated `"strict": "never"`.
- Change icon.

## v0.14.4 — 2021-06-21
- Fix conflict between rules when `foldLastLine` and `nested` are `false`.
- Add icon.

## v0.14.3 — 2021-06-20
- Fix infinity loop with single-line and not-nested region.

## v0.14.2 — 2021-06-18
- Fix global `explicitFolding.rules`.

## v0.14.1 — 2021-06-18
- Fix how to determine that the configuration `folding` isn't used.

## v0.14.0 — 2021-06-18
- Rename the configuration `folding` to `explicitFolding.rules` (`folding` is supported until July 1, 2022).
- Rename the configuration `startupDelay` to `explicitFolding.delay`.
- The configurations `explicitFolding.rules`, `explicitFolding.debug` or `explicitFolding.delay` can be placed in a language section.
- The property `descendants` is regrouped with the property `nested`.
- The `begin/end` rule is fully supporting the property `nested` as an array of rules.
- Add `begin/while` rule.
- Add `while` rule.
- Add documentation for each rules and their applicable properties.

## v0.13.1 — 2021-05-18
- Fix `^` in the alternative loop for non-nested blocks.
- Improve debug messages.

## v0.13.0 — 2021-05-14
- Using deferred provider so that the real folding provider is loaded after the language's folding provider. By doing so, the folding ranges provided by the extension are given an higher importance, so VSCode is using them instead of the ones from the language's folding provider (if there is a conflict).

## v0.12.1 — 2021-05-12
- Fix need to reload VSCode when changing `explicitFolding.debug`.

## v0.12.0 — 2021-05-12
- Add the configuration `explicitFolding.debug` to print out debug information into the channel `Folding` of the panel `Output`.
- Add `foldEOF` property which will close the folding at the end of the file.
- Add `foldBOF` property, only for separators.
- Add `descendants` property, only for separators.
- Add `strict` property, only for separators.
- `^` is correctly matching the beginning of a line.
- Use new regex parser to support `(?<=y)x`, `(?<!y)x`, `(?i)x` and `(?i:x)`.
- Add unit tests.

## v0.11.0 — 2021-02-20
- Add `indentation` property.
- Add flag indicating that the extension is managing how to fold the last line (only for [MrCode](https://github.com/zokugun/MrCode)).

## v0.10.0 — 2021-02-16
- Add dynamic `foldLastLine`.

## v0.9.2 — 2021-02-12
- Register provider to all applicable schemes.

## v0.9.1 — 2020-12-24
- Allows provider on all schemes.
- Fix README.

## v0.9.0 — 2020-08-20
- Add the configuration `explicitFolding.startupDelay` which will delay the registration of the folding providers when starting up (1000 ms by default). This fixes the issue where the editor wasn't using the correct folding providers at startup.
- Add the configuration `explicitFolding.notification` to manage the notifications. By default, the notifications will be shown only for minor revisions.

## v0.8.2 — 2020-05-27
- Fix `continuation` marker when first match doesn't include the line-continuation character.
- Fix looping on configuration.

## v0.8.1 — 2020-05-26
- Improve handling of non-nested rules to test only necessary regular expressions.

## v0.8.0 — 2020-05-26
- Add `continuation` marker.
- Fix infinity loop due to zero-length regular expressions.
- Fix capturing groups.

## v0.7.1 — 2020-05-22
- Add `nested` property.

## v0.7.0 — 2020-05-12
- Support docstring blocks.

## v0.6.0 — 2020-04-14
- Add `separator` property.

## v0.5.1 — 2020-03-20
- Fix missing dependency.

## v0.5.0 — 2020-03-20
- Support capturing groups.
- Fix known issue only for [MrCode](https://github.com/zokugun/MrCode).

## v0.4.0 — 2020-03-18
- Fix bug when `begin` and `end` markers are on the same line.
- Add `middle` marker.
- Add `foldLastLine` property.
- Add `kind` property to indicate if the range is a `comment` or a `region`.

## v0.3.2 — 2019-06-08
- Show message when the extension is updated.
- Update dependencies due to security issue.

## v0.3.1 — 2019-04-04
- Catch error due to bad regex.

## v0.3.0 — 2019-04-03
- Change configuration's properties `begin` and `end` as regular string (**not regex**).
- Add configuration's properties `beginRegex` and `endRegex` to be able to use **regex**.

## v0.2.1 — 2018-07-18
- Rename repository.

## v0.2.0 — 2018-07-18
- Rename extension.
- Support multiple markers for a language.
- Rename configuration's property `start` to `begin`.

## v0.1.1 — 2018-07-16
- Fix an error in the settings.
- Update folding controls upon changes in the configuration.
- Fix formatting.

## v0.1.0 — 2018-07-09
- Initial release.
