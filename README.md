# remap-css
[![](https://img.shields.io/npm/v/remap-css.svg?style=flat)](https://www.npmjs.org/package/remap-css) [![](https://img.shields.io/npm/dm/remap-css.svg)](https://www.npmjs.org/package/remap-css)
> Remap CSS rules based on declaration value

## Usage

```bash
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

Returns a `Promise` that resolves to a CSS string.

- `sources`: *Array* Array of sources
  - `source`: *Object*
    - `css`: *string* A CSS string
    - `prefix`: *string* A CSS selector to be prefixed to all output rules
    - `match`: *string* A array of plain CSS selectors that prevent a prefix addition on exact match
    - `name`: *string* Optional name used in comments
- `mappings`: *Object* CSS declaration value-to-value mapping. The key is either a exact match CSS declaration or a special rule starting with `$`. The value is the corresponding replacement declaration or a color in the case of a special rule.
- `options`: *Object*
  - `indentSize`: *number* Numbers of spaces to indent rules and declarations. Default: `2`.
  - `indentCss`: *number* Numbers of spaces to indent the output CSS. Default: `0`.
  - `lineLength`: *number* Number of characters after which to wrap lines. Default: `80`.
  - `ignoreSelectors`: *Array* of *RegExp* Regular expressions of selectors to ignore. Default: `[]`.
  - `comments`: *boolean* Whether to output comments. Default: `false`.
  - `stylistic`: *boolean* Whether to perform stylistic tweaks on selectors. Default: `false`.
  - `validate`: *boolean* Validate CSS property values and ignore declarations that fail it. Default: `false`.

There are special mapping keys supported to reduce the need for similar `border` and `background` rules:

- `$border: value`: Variations of border-colors
- `$background: value` Variations of background-colors
- `$color`: Any occurance of given color

On special rules, only specify the replacement value alone (not the declaration).

## Related

- [fetch-css](https://github.com/silverwind/fetch-css) - Extract CSS from websites and browser extensions

© [silverwind](https://github.com/silverwind), distributed under BSD licence
