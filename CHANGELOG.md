## v0.8.2
- fix `continuation` marker when first match doesn't include the line-continuation character
- fix looping on configuration

## v0.8.1
- improve handling of non-nested rules to test only necessary regexes

## v0.8.0
- add `continuation` marker
- fix infinity loop due to zero-length regexes
- fix capturing groups

## v0.7.1
- add `nested` property

## v0.7.0
- support docstring blocks

## v0.6.0
- add `separator` property

## v0.5.1
- fix missing dependency

## v0.5.0
- support capturing groups
- fix known issue only for [MrCode](https://github.com/zokugun/MrCode)

## v0.4.0
- fix bug when `begin` and `end` markers are on the same line
- add `middle` marker
- add `foldLastLine` property
- add `kind` property to indicate if the range is a `comment` or a `region`

## v0.3.2
- show message when the extension is updated
- update dependencies due to security issue

## v0.3.1
- catch error due to bad regexes

## v0.3.0
- change configuration's properties `begin` and `end` as regular string (**not regex**)
- add configuration's properties `beginRegex` and `endRegex` to be able to use **regex**

## v0.2.1
- rename repository

## v0.2.0
- rename extension
- support multiple markers for a language
- rename configuration's property `start` to `begin`

## v0.1.1
- fix error in settings
- update foldings on configuration changes
- fix formatting

## v0.1.0
- Initial release
