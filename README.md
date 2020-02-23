# remap-css
[![](https://img.shields.io/npm/v/remap-css.svg?style=flat)](https://www.npmjs.org/package/remap-css) [![](https://img.shields.io/npm/dm/remap-css.svg)](https://www.npmjs.org/package/remap-css) [![](https://api.travis-ci.org/silverwind/remap-css.svg?style=flat)](https://travis-ci.org/silverwind/remap-css)
> Remap CSS rules based on declaration value

## Usage

```console
npm i remap-css
```

```js
const remapCss = require("remap-css");
const css = await remapCss([{css: "a {color: red;}"}], {"color: red": "color: blue"});
// a {
//   color: blue;
// }
```

## API

### `remapCss(sources, mappings, [opts])`

- `sources`: *Array* Array of sources
  - `source`: *Object*
    - `css`: *string* A CSS string
    - `prefix`: *string* A CSS selector to be prefixed to all output rules
    - `match`: *string* A array of plain CSS selectors that prevent a prefix addition on exact match
- `mappings`: *Object* Array of CSS declaration value-to-value mapping. The object key is a exact match CSS declaration and value is the corresponding replacement declaration.
- `options`: *Object*
  - `indentDeclaration`: *number* Numbers of spaces to indent declarations. Default: `2`.
  - `indentCss`: *number* Numbers of spaces to indent the output CSS. Default: `0`.
  - `lineLength`: *number* Number of characters after which to wrap lines. Default: `80`.
  - `ignoreSelectors`: *Array* of *RegExp* Array of RegExp for selectors to ignore. Default: `[]`.
  - `limitSpecial`: *number* Maximum amount of iteration per special mappings. Default: `25`.
  - `deviceType`: *string* CSS media query device type to match. Default: `"screen"`.
  - `deviceWidth`: "string" CSS media query device width to match. Default: `"1024px"`.
  - `comments`: *boolean* Whether to output comments. Default: `false`.

There are special mapping keys supported to reduce the need for similar `border` and `background` rules:

- `$border: value`: Variations of border-colors
- `$background: value` Variations of background-colors

On special rules, only specify the replacement value alone (not the declaration).

Returns a promise that resolves to a CSS string.

## Related

- [fetch-css](https://github.com/silverwind/fetch-css) - Extract CSS from websites and browser extensions


© [silverwind](https://github.com/silverwind), distributed under BSD licence
