import colorConvert from "color-convert";
import cssSelectorSplitter from "css-selector-splitter";
import cssSelectorTokenizer from "css-selector-tokenizer";
import {validate} from "csstree-validator";
import knownCssProperties from "known-css-properties";
import perfectionist from "perfectionist";
import postcss from "postcss";
import postcssDiscardDuplicates from "postcss-discard-duplicates";
import postcssDiscardEmpty from "postcss-discard-empty";
import postcssDiscardOverridden from "postcss-discard-overridden";
import postcssMergeLonghand from "postcss-merge-longhand";
import postcssMergeRules from "postcss-merge-rules";
import postcssSafeParser from "postcss-safe-parser";
import postcssUniqueSelectors from "postcss-unique-selectors";
import postcssValueParser from "postcss-value-parser";
import splitString from "split-string";
import {expandShorthandProperty} from "css-property-parser";
import {isShorthand} from "css-shorthand-properties";
import type {AtRule, ChildNode, Comment, Declaration, Plugin} from "postcss";
import type {ValueNode} from "postcss-value-parser";

const cssColorNames: Record<string, string> = {
  "aliceblue": "#f0f8ff",
  "antiquewhite": "#faebd7",
  "aqua": "#00ffff",
  "aquamarine": "#7fffd4",
  "azure": "#f0ffff",
  "beige": "#f5f5dc",
  "bisque": "#ffe4c4",
  "black": "#000000",
  "blanchedalmond": "#ffebcd",
  "blue": "#0000ff",
  "blueviolet": "#8a2be2",
  "brown": "#a52a2a",
  "burlywood": "#deb887",
  "cadetblue": "#5f9ea0",
  "chartreuse": "#7fff00",
  "chocolate": "#d2691e",
  "coral": "#ff7f50",
  "cornflowerblue": "#6495ed",
  "cornsilk": "#fff8dc",
  "crimson": "#dc143c",
  "cyan": "#00ffff",
  "darkblue": "#00008b",
  "darkcyan": "#008b8b",
  "darkgoldenrod": "#b8860b",
  "darkgray": "#a9a9a9",
  "darkgreen": "#006400",
  "darkgrey": "#a9a9a9",
  "darkkhaki": "#bdb76b",
  "darkmagenta": "#8b008b",
  "darkolivegreen": "#556b2f",
  "darkorange": "#ff8c00",
  "darkorchid": "#9932cc",
  "darkred": "#8b0000",
  "darksalmon": "#e9967a",
  "darkseagreen": "#8fbc8f",
  "darkslateblue": "#483d8b",
  "darkslategray": "#2f4f4f",
  "darkslategrey": "#2f4f4f",
  "darkturquoise": "#00ced1",
  "darkviolet": "#9400d3",
  "deeppink": "#ff1493",
  "deepskyblue": "#00bfff",
  "dimgray": "#696969",
  "dimgrey": "#696969",
  "dodgerblue": "#1e90ff",
  "firebrick": "#b22222",
  "floralwhite": "#fffaf0",
  "forestgreen": "#228b22",
  "fuchsia": "#ff00ff",
  "gainsboro": "#dcdcdc",
  "ghostwhite": "#f8f8ff",
  "goldenrod": "#daa520",
  "gold": "#ffd700",
  "gray": "#808080",
  "green": "#008000",
  "greenyellow": "#adff2f",
  "grey": "#808080",
  "honeydew": "#f0fff0",
  "hotpink": "#ff69b4",
  "indianred": "#cd5c5c",
  "indigo": "#4b0082",
  "ivory": "#fffff0",
  "khaki": "#f0e68c",
  "lavenderblush": "#fff0f5",
  "lavender": "#e6e6fa",
  "lawngreen": "#7cfc00",
  "lemonchiffon": "#fffacd",
  "lightblue": "#add8e6",
  "lightcoral": "#f08080",
  "lightcyan": "#e0ffff",
  "lightgoldenrodyellow": "#fafad2",
  "lightgray": "#d3d3d3",
  "lightgreen": "#90ee90",
  "lightgrey": "#d3d3d3",
  "lightpink": "#ffb6c1",
  "lightsalmon": "#ffa07a",
  "lightseagreen": "#20b2aa",
  "lightskyblue": "#87cefa",
  "lightslategray": "#778899",
  "lightslategrey": "#778899",
  "lightsteelblue": "#b0c4de",
  "lightyellow": "#ffffe0",
  "lime": "#00ff00",
  "limegreen": "#32cd32",
  "linen": "#faf0e6",
  "magenta": "#ff00ff",
  "maroon": "#800000",
  "mediumaquamarine": "#66cdaa",
  "mediumblue": "#0000cd",
  "mediumorchid": "#ba55d3",
  "mediumpurple": "#9370db",
  "mediumseagreen": "#3cb371",
  "mediumslateblue": "#7b68ee",
  "mediumspringgreen": "#00fa9a",
  "mediumturquoise": "#48d1cc",
  "mediumvioletred": "#c71585",
  "midnightblue": "#191970",
  "mintcream": "#f5fffa",
  "mistyrose": "#ffe4e1",
  "moccasin": "#ffe4b5",
  "navajowhite": "#ffdead",
  "navy": "#000080",
  "oldlace": "#fdf5e6",
  "olive": "#808000",
  "olivedrab": "#6b8e23",
  "orange": "#ffa500",
  "orangered": "#ff4500",
  "orchid": "#da70d6",
  "palegoldenrod": "#eee8aa",
  "palegreen": "#98fb98",
  "paleturquoise": "#afeeee",
  "palevioletred": "#db7093",
  "papayawhip": "#ffefd5",
  "peachpuff": "#ffdab9",
  "peru": "#cd853f",
  "pink": "#ffc0cb",
  "plum": "#dda0dd",
  "powderblue": "#b0e0e6",
  "purple": "#800080",
  "rebeccapurple": "#663399",
  "red": "#ff0000",
  "rosybrown": "#bc8f8f",
  "royalblue": "#4169e1",
  "saddlebrown": "#8b4513",
  "salmon": "#fa8072",
  "sandybrown": "#f4a460",
  "seagreen": "#2e8b57",
  "seashell": "#fff5ee",
  "sienna": "#a0522d",
  "silver": "#c0c0c0",
  "skyblue": "#87ceeb",
  "slateblue": "#6a5acd",
  "slategray": "#708090",
  "slategrey": "#708090",
  "snow": "#fffafa",
  "springgreen": "#00ff7f",
  "steelblue": "#4682b4",
  "tan": "#d2b48c",
  "teal": "#008080",
  "thistle": "#d8bfd8",
  "tomato": "#ff6347",
  "turquoise": "#40e0d0",
  "violet": "#ee82ee",
  "wheat": "#f5deb3",
  "white": "#ffffff",
  "whitesmoke": "#f5f5f5",
  "yellow": "#ffff00",
  "yellowgreen": "#9acd32",
};

/** A CSS source to remap. */
export type Source = {
  /** A CSS string. */
  css: string,
  /** A CSS selector to be prefixed to all output rules. */
  prefix?: string,
  /** An array of plain CSS selectors that prevent a prefix addition on exact match. */
  match?: Array<string>,
  /** Optional name used in comments. */
  name?: string,
};

/** Options for `remapCss`. */
export type Options = {
  /** Number of spaces to indent rules and declarations. Default: `2`. */
  indentSize?: number,
  /** Number of spaces to indent the output. Default: `0`. */
  indentCss?: number,
  /** Number of characters after which to wrap lines. Default: `80`. */
  lineLength?: number,
  /** Regular expressions of selectors to ignore. Default: `[]`. */
  ignoreSelectors?: Array<RegExp>,
  /** Whether to output comments. Default: `false`. */
  comments?: boolean,
  /** Whether to perform stylistic tweaks on selectors. Default: `false`. */
  stylistic?: boolean,
  /** Validate properties and discard ones that fail. Default: `false`. */
  validate?: boolean,
  /** Retain non-matching declarations in the output. Default: `false`. */
  keep?: boolean,
};

type ResolvedOptions = Required<Options>;

/** A parsed declaration with normalized property and value. */
type Decl = {
  prop: string,
  value: string,
  important: boolean,
  origValue?: string,
};

/** Maps a normalized declaration string to its replacement declarations. */
type DeclMappings = Record<string, Array<Decl>>;
/** Maps a normalized color value to its replacement value. */
type ColorMappings = Record<string, string>;

const defaults: ResolvedOptions = {
  indentSize: 2,
  indentCss: 0,
  lineLength: 80,
  ignoreSelectors: [],
  comments: false,
  stylistic: false,
  validate: false,
  keep: false,
};

function memoize<Result>(fn: (arg: string) => Result): (arg: string) => Result {
  const cache = new Map<string, Result>();
  return arg => {
    let result = cache.get(arg);
    if (result === undefined) {
      result = fn(arg);
      cache.set(arg, result);
    }
    return result;
  };
}

const atRulesWithNoSelectors = new Set(["keyframes"]);
const splitDecls = (str: string) => splitString(str, {separator: ";", quotes: [`"`, `'`]}).map(s => s.trim());
const uniq = (arr: Array<string | Array<string>>) => Array.from(new Set(arr));
const varRe = /var\(--(?!uso-var-expanded).+?\)/;
const knownProperties = new Set(knownCssProperties.all);

// https://github.com/postcss/postcss/issues/1426
function getProperty(decl: Declaration): string {
  const before = decl.raws.before?.trim();
  if (before === "*" || before === "_") {
    return `${before}${decl.prop}`;
  } else {
    return decl.prop;
  }
}

const selectorsIntersect = memoize((a: string) => memoize((b: string): boolean => {
  try {
    const {nodes: nodesA} = cssSelectorTokenizer.parse(a);
    const {nodes: nodesB} = cssSelectorTokenizer.parse(b);

    for (const a of nodesA[0].nodes) {
      for (const b of nodesB[0].nodes) {
        if (!a.type || !b.type || !a.name || !b.name) return false;
        if (a.type === b.type && a.name === b.name) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}));

function isRootSelector(selector: string): boolean {
  return selector.startsWith("html") || selector.startsWith(":root");
}

const typeNodeTypes = new Set(["element", "universal"]);
const unrepeatableNodeTypes = new Set([...typeNodeTypes, "pseudo-element", "invalid"]);
const legacyPseudoElements = new Set(["before", "after", "first-line", "first-letter"]);

// repeat the leading compound of `first` for weight, leaving out parts that can not repeat
function repeatFirstCompound(selector: string, first: string): string {
  const [{nodes}] = cssSelectorTokenizer.parse(first).nodes;
  const operatorIndex = nodes.findIndex(node => node.type === "operator");
  const compound = operatorIndex === -1 ? nodes : nodes.slice(0, operatorIndex);
  const typeSelector = typeNodeTypes.has(compound[0].type!) ? cssSelectorTokenizer.stringify(compound[0]) : "";
  const repeated = compound
    .filter(node => !unrepeatableNodeTypes.has(node.type!) && !(node.type === "pseudo-class" && legacyPseudoElements.has(node.name!)))
    .map(node => cssSelectorTokenizer.stringify(node))
    .join("");
  return `${typeSelector}${repeated}${selector.substring(typeSelector.length)}`;
}

function rewriteSelectors(selectors: Array<string>, opts: ResolvedOptions, src: Source): Array<string> {
  const ret: Array<string> = [];

  for (let selector of selectors) {
    if (opts.stylistic) {
      selector = selector
        .replace(/\+/g, " + ")
        .replace(/(~)([^=])/g, (_, m1, m2) => ` ${m1} ${m2}`)
        .replace(/>/g, " > ")
        .replace(/ {2,}/g, " ")
        .replace(/'/g, `"`)
        .replace(/([^:]):(before|after)/g, (_, m1, m2) => `${m1}::${m2}`);
    }

    if (src.prefix && !/^[0-9]+%$/.test(selector)) { // ignore keyframes steps
      const [first] = selector.split(/\s+/);
      if (isRootSelector(first) && isRootSelector(src.prefix)) {
        selector = `${src.prefix} ${selector.substring(first.length).trim()}`;
      } else if (src.match?.some(match => selectorsIntersect(first)(match))) {
        selector = repeatFirstCompound(selector, first);
      } else {
        selector = `${src.prefix} ${selector}`;
      }
    }

    ret.push(selector);
  }

  return ret;
}

function normalizeHexColor(value: string): string {
  if ([4, 5].includes(value.length)) {
    const [h, r, g, b, a] = value;
    return `${h}${r}${r}${g}${g}${b}${b}${a || "f"}${a || "f"}`;
  } else if (value.length === 7) {
    return `${value}ff`;
  }
  return value;
}

function alphaToHex(alpha: string | undefined): string | null {
  if (alpha === undefined) return "";
  let value = alpha.endsWith("%") ? Number(alpha.slice(0, -1)) / 100 : Number(alpha);
  if (Number.isNaN(value)) return null;
  if (value > 1) value = 1;
  if (value < 0) value = 0;
  return Math.floor(value * 255).toString(16).padStart(2, "0");
}

const cssValueKeywords = new Set([
  "currentcolor",
  "inherit",
  "initial",
  "none",
  "revert",
  "transparent",
  "unset",
]);

const isColor = memoize((value: string): boolean => {
  value = value.toLowerCase();
  if (Object.hasOwn(cssColorNames, value)) return true;
  if (cssValueKeywords.has(value)) return true;
  if (/^#[0-9a-f]{3,4}$/.test(value)) return true;
  if (/^#[0-9a-f]{6}$/.test(value)) return true;
  if (/^#[0-9a-f]{8}$/.test(value)) return true;
  if (/^rgb\([0-9]+\s*,\s*[0-9]+\s*,\s*[0-9]\)/.test(value)) return true;
  if (/^rgba\([0-9]+\s*,\s*[0-9]+\s*,\s*[0-9]\s*,\s*[0-9.]+\)/.test(value)) return true;
  if (/^hsl\([0-9]+\s*,\s*[0-9]%+\s*,\s*[0-9]%\)/.test(value)) return true;
  if (/^hsla\([0-9]+\s*,\s*[0-9]%+\s*,\s*[0-9]%\s*,\s*[0-9.]+\)/.test(value)) return true;
  return false;
});

const rgbFunctions = new Set(["rgb", "rgba"]);
const hslFunctions = new Set(["hsl", "hsla"]);

function hexFromColorFunction(node: ValueNode): string | null {
  if (rgbFunctions.has(node.value)) {
    const [r, g, b, a] = node.nodes.filter(node => node.type === "word").map(node => node.value);
    const [rNum, gNum, bNum] = [r, g, b].map(Number);
    const alpha = alphaToHex(a);
    if (![rNum, gNum, bNum].every(Number.isFinite) || alpha === null) return null;
    return normalizeHexColor(`#${colorConvert.rgb.hex(rNum, gNum, bNum).toLowerCase()}${alpha}`);
  } else if (hslFunctions.has(node.value)) {
    const [h, s, l, a] = node.nodes.filter(node => node.type === "word").map(node => node.value);
    const [hNum, sNum, lNum] = [h, s, l].map(channel => Number(channel?.replace("%", "")));
    const alpha = alphaToHex(a);
    if (![hNum, sNum, lNum].every(Number.isFinite) || alpha === null) return null;
    return normalizeHexColor(`#${colorConvert.hsl.hex(hNum, sNum, lNum).toLowerCase()}${alpha}`);
  }
  return null;
}

const normalizeColor = memoize((value: string): string => {
  value = value.toLowerCase();

  if (Object.hasOwn(cssColorNames, value)) {
    value = cssColorNames[value];
  }

  if (value === "transparent") {
    value = "#00000000";
  }

  if (/^#[0-9a-f]{3,8}$/i.test(value)) {
    value = normalizeHexColor(value);
    if (value.substring(7) === "00") return "#00000000";
    return value;
  }

  const parsed = postcssValueParser(value);
  const node = parsed.nodes[0];

  if (node && node.type === "function") {
    const newValue = hexFromColorFunction(node);
    if (newValue) value = newValue;
  }

  return value;
});

function normalizeDecl({prop, value, important}: {prop: string, value: string, important?: boolean}): Decl {
  prop = prop.toLowerCase();

  const origValue = value;

  value = value
    // remove leading zeroes on values like 'rgba(27,31,35,0.075)'
    .replace(/(?<![0-9])0(\.[0-9])/g, (_, val) => val)
    // normalize 'linear-gradient(-180deg, #0679fc, #0361cc 90%)' to not have whitespace in parens
    .replace(/([a-z-]+\()(.+)(\))/g, (_, m1, m2, m3) => `${m1}${m2.replace(/,\s+/g, ",")}${m3}`);

  value = normalizeColor(value);

  // treat values case-insensitively
  if (prop !== "content" && !value.startsWith("url(")) {
    value = value.toLowerCase();
  }

  // try to ignore order in shorthands. This will only work on simple cases as for example
  // `background` can take a comma-separated list which totally breaks this comparison.
  if (isShorthand(prop)) {
    value = value.split(" ").sort().join(" ");
  }

  return {prop, value, important: Boolean(important), origValue};
}

const parseDecl = memoize((declString: string): Array<Decl> => {
  declString = declString.trim().replace(/;+$/, "").trim();

  const ret: Array<Decl> = [];
  for (const str of splitDecls(declString)) {
    const parts = str.split(":");
    const important = parts[parts.length - 1].toLowerCase() === "!important";
    if (important) parts.pop();
    const prop = parts.shift()!.trim();
    const value = parts.join(":").trim();
    ret.push(normalizeDecl({prop, value, important}));
  }
  return ret;
});

function stringifyDecl(decl: {prop: string, value: string, important?: boolean}): string {
  const {prop, value, important} = normalizeDecl(decl);
  return `${prop}: ${value}${important ? " !important" : ""}`;
}

function addMapping(mappings: DeclMappings, names: Record<string, string>, fromStringDecl: string, toStringDecl: string): void {
  const fromDecl = parseDecl(fromStringDecl)[0]; // can only be single declaration
  const toDecl = parseDecl(toStringDecl);
  if (!toStringDecl) return;

  const newName = stringifyDecl(fromDecl);
  names[newName] = fromStringDecl;
  mappings[newName] = toDecl;

  if (!fromDecl.important) {
    const newNameImportant = stringifyDecl({prop: fromDecl.prop, value: fromDecl.value, important: true});
    names[newNameImportant] = `${fromStringDecl} !important`;
    mappings[newNameImportant] = toDecl;
  }
}

function prepareMappings(mappings: Record<string, string>, names: Record<string, string>): [DeclMappings, ColorMappings, ColorMappings, ColorMappings, ColorMappings] {
  const declMappings: DeclMappings = {};
  const colorMappings: ColorMappings = {};
  const borderMappings: ColorMappings = {};
  const boxShadowMappings: ColorMappings = {};
  const backgroundMappings: ColorMappings = {};
  const specialMappings: Array<[string, ColorMappings]> = [
    ["$border: ", borderMappings],
    ["$background: ", backgroundMappings],
    ["$box-shadow: ", boxShadowMappings],
    ["$value: ", colorMappings],
  ];

  for (const [key, newValue] of Object.entries(mappings)) {
    const special = specialMappings.find(([keyPrefix]) => key.startsWith(keyPrefix));
    if (special) {
      const value = key.substring(special[0].length);
      special[1][(value.startsWith("$") ? value : normalizeColor(value)).toLowerCase()] = newValue;
    } else {
      addMapping(declMappings, names, key, newValue);
    }
  }

  return [declMappings, colorMappings, borderMappings, boxShadowMappings, backgroundMappings];
}

function hasDeclarations(node: ChildNode): boolean {
  return node.type === "decl" || ("nodes" in node && Boolean(node.nodes?.some(child => hasDeclarations(child))));
}

function usoVarToCssVar(value: string): string {
  return value.replace(/\/\*\[\[(.+?)\]\]\*\//g, (_, name) => `var(--uso-var-expanded-${name})`);
}

function cssVarToUsoVars(value: string): string {
  return value.replace(/var\(--uso-var-expanded-(.+?)\)/g, (_, name) => `/*[[${name}]]*/`);
}

const isValidDeclaration = memoize((prop: string) => memoize((value: string): boolean => {
  if (!knownProperties.has(prop) && !/^--./.test(prop)) {
    return false;
  }

  try {
    return !validate(`a{${prop}: ${usoVarToCssVar(value)}}`).length;
  } catch {
    return false;
  }
}));

// this may add extra newlines, but those are trimmed off later
function makeComment(text: string): Comment {
  return postcss.comment({
    raws: {before: "\n", after: "\n", left: " ", right: " "},
    text,
  });
}

function assignNewColor(normalizedColor: string, newValue: string): string | null {
  if (newValue === "$invert") {
    const channels = /^#(..)(..)(..)(..)$/.exec(normalizedColor);
    if (!channels) return null;
    const [r, g, b, alpha] = channels.slice(1);
    return `#${[r, g, b].map(hex => (255 - Number.parseInt(hex, 16)).toString(16).padStart(2, "0")).join("")}${alpha}`;
  } else {
    return newValue;
  }
}

function getNewColorValue(normalizedValue: string, colorMappings: ColorMappings): string | null {
  if (colorMappings[normalizedValue]) {
    return colorMappings[normalizedValue];
  } else if (colorMappings.$monochrome && /^#[0-9a-f]{8}$/.test(normalizedValue)) {
    const [r, g, b] = colorConvert.hex.rgb(normalizedValue);
    if (r === g && g === b) {
      return assignNewColor(normalizedValue, colorMappings.$monochrome);
    }
  }

  return null;
}

const borderColorProps = new Set([
  "border",
  "border-top",
  "border-left",
  "border-right",
  "border-bottom",
  "border-color",
  "border-top-color",
  "border-left-color",
  "border-right-color",
  "border-bottom-color",
  "border-image",
]);

const backgroundColorProps = new Set([
  "background",
  "background-color",
  "background-image",
]);

const colorShorthands = new Set([
  "border",
  "border-top",
  "border-left",
  "border-right",
  "border-bottom",
  "background",
]);

function replaceColorsInValue(prop: string, value: string, colorMappings: ColorMappings, borderMappings: ColorMappings, boxShadowMappings: ColorMappings, backgroundMappings: ColorMappings): {newValue: string | null, oldColors: Array<string>} {
  const {nodes} = postcssValueParser(value);
  const oldColors = new Set<string>();

  postcssValueParser.walk(nodes, node => {
    let normalizedValue: string | undefined;
    if (node.type === "word" && isColor(node.value)) {
      normalizedValue = normalizeColor(node.value);
    } else if (node.type === "function") {
      normalizedValue = normalizeColor(postcssValueParser.stringify(node));
    }
    if (!normalizedValue) return;
    const newValue = (borderColorProps.has(prop) && getNewColorValue(normalizedValue, borderMappings)) ||
      (backgroundColorProps.has(prop) && getNewColorValue(normalizedValue, backgroundMappings)) ||
      (prop === "box-shadow" && getNewColorValue(normalizedValue, boxShadowMappings)) ||
      getNewColorValue(normalizedValue, colorMappings);
    if (!newValue) return;
    oldColors.add(node.type === "word" ? node.value : postcssValueParser.stringify([node]));
    node.value = newValue;
    node.type = "word";
    delete (node as {nodes?: Array<ValueNode>}).nodes;
  });

  return {
    newValue: oldColors.size ? usoVarToCssVar(postcssValueParser.stringify(nodes)) : null,
    oldColors: Array.from(oldColors),
  };
}

const plugin = (src: Source, declMappings: DeclMappings, colorMappings: ColorMappings, borderMappings: ColorMappings, boxShadowMappings: ColorMappings, backgroundMappings: ColorMappings, names: Record<string, string>, index: number, opts: ResolvedOptions): Plugin => {
  const commentStart = src.name || `source #${index}`;

  return {
    postcssPlugin: "remap-css",
    Root: root => {
      root.walkRules(node => {
        const matchedDeclStrings: Array<string | Array<string>> = [];

        node.walkDecls(decl => {
          const declString = stringifyDecl(decl);
          const mappedDecls = declMappings[declString];
          if (mappedDecls) {
            const newDecls: Array<Declaration> = [];
            for (const {prop, value, important, origValue} of mappedDecls) {
              const newValue = origValue || value;
              if (opts.validate && !isValidDeclaration(prop)(newValue)) {
                decl.remove();
                return;
              }
              newDecls.push(decl.clone({
                prop,
                value: newValue,
                important: decl.important || important,
                raws: {_replaced: true},
              }));
              matchedDeclStrings.push(`"${names[declString]}"`);
            }

            decl.replaceWith(...newDecls);
            node.raws.semicolon = true;
          } else {
            const {newValue, oldColors} = replaceColorsInValue(decl.prop, decl.value, colorMappings, borderMappings, boxShadowMappings, backgroundMappings);

            if (!newValue) {
              if (!opts.keep) decl.remove();
              return;
            }

            if (opts.validate && !isValidDeclaration(getProperty(decl))(newValue)) {
              decl.remove();
              return;
            }

            if (colorShorthands.has(decl.prop)) {
              try {
                // workaround expandShorthandProperty not supporting css vars
                const cssVar = varRe.exec(newValue)?.[0];
                const expanded = expandShorthandProperty(decl.prop, cssVar ? newValue.replace(varRe, "rgba(255,0,255,0)") : newValue);
                let numReplaced = 0;
                for (const [prop, value] of Object.entries(expanded)) {
                  if (!prop.includes("color")) continue;
                  if (numReplaced === 0) {
                    decl.prop = prop;
                    decl.value = cssVar || value;
                  } else {
                    decl.cloneBefore({prop, value: cssVar || value});
                  }
                  numReplaced += 1;
                }
              } catch { // expandShorthandProperty may throw on multiple borders
                decl.value = newValue;
              }
            } else {
              decl.value = newValue;
            }
            decl.raws._replaced = true;
            matchedDeclStrings.push(oldColors.map(color => `"${color}"`));
          }
        });

        if (matchedDeclStrings.length) {
          const newSelectors = rewriteSelectors(node.selectors, opts, src)
            .filter(selector => opts.ignoreSelectors.every(re => !re.test(selector)));

          if (newSelectors.length) {
            if (opts.comments) {
              const targetNode = node.parent?.type === "atrule" ? node.parent as AtRule : node;
              const prevNode = targetNode.prev();

              if (prevNode?.type === "comment" && prevNode.text.startsWith(commentStart)) {
                const prevDeclStrings = prevNode.text.match(/".+?"/g)!;
                prevNode.text = `${commentStart}: ${uniq([...prevDeclStrings, ...matchedDeclStrings]).join(", ")}`;
              } else {
                targetNode.before(makeComment(`${commentStart}: ${uniq(matchedDeclStrings).join(", ")}`));
              }
            }

            if (node.selector && (!node.parent || node.parent.type !== "atrule" || !atRulesWithNoSelectors.has((node.parent as AtRule).name))) {
              node.selector = newSelectors.join(", ");
            }
          } else {
            node.remove();
          }
        }
      });

      root.walkAtRules(node => {
        node.walkDecls(decl => {
          if (!decl.raws._replaced && !opts.keep) {
            decl.remove();
          }
        });
      });

      root.walk(node => {
        if (node.type === "decl") return;
        if (node.type === "comment") {
          if (!node.text.startsWith(commentStart)) node.remove();
        } else if (!hasDeclarations(node)) {
          node.remove();
        } else if (node.type === "rule") {
          // remove duplicate props (those are actual errors in the sources)
          const decls: Array<Declaration> = [];

          node.walkDecls(decl => {
            if (!decl.raws._replaced) decls.push(decl);
          });

          for (const propDecls of Map.groupBy(decls, decl => decl.prop).values()) {
            if (propDecls.length > 1) {
              for (const decl of propDecls.slice(0, -1)) {
                decl.remove();
              }
            }
          }
        }
      });
    },
  };
};

/**
 * Remap CSS rules based on declaration value. Returns a `Promise` that resolves to a CSS string.
 *
 * @param sources Array of CSS sources to remap.
 * @param mappings CSS declaration value-to-value mapping. The key is either an exact match CSS
 *   declaration or a special rule starting with `$`. The value is a replacement declaration or, for
 *   special rules, a replacement value.
 * @param opts Output options.
 */
export default async function remapCss(sources: Array<Source>, mappings: Record<string, string>, opts: Options = {}): Promise<string> {
  const resolvedOpts: ResolvedOptions = {...defaults, ...opts};

  const names: Record<string, string> = {};
  const [declMappings, colorMappings, borderMappings, boxShadowMappings, backgroundMappings] = prepareMappings(mappings, names);
  const postcssOpts = {parser: postcssSafeParser, from: undefined};

  const results = await Promise.all(sources.map((src, index) => {
    return postcss([plugin(src, declMappings, colorMappings, borderMappings, boxShadowMappings, backgroundMappings, names, index, resolvedOpts)]).process(src.css, postcssOpts);
  }));

  // optimize
  const plugins = [
    postcssUniqueSelectors,
    postcssDiscardDuplicates,
    postcssDiscardEmpty,
    postcssDiscardOverridden,
    postcssMergeLonghand,
    postcssMergeRules,
    postcssUniqueSelectors,
  ];
  let output = (await postcss(plugins).process(results.map(({css}) => css).join(""), postcssOpts)).css;

  // format
  const formatOpts = {
    cascade: false,
    colorShorthand: true,
    indentSize: resolvedOpts.indentSize,
    maxAtRuleLength: resolvedOpts.lineLength,
    maxSelectorLength: resolvedOpts.lineLength,
    maxValueLength: resolvedOpts.lineLength,
    trimLeadingZero: true,
    trimTrailingZeros: true,
    zeroLengthNoUnit: true,
  };
  try {
    output = (await perfectionist.process(output, formatOpts)).css;
  } catch { // perfectionist's postcss 5 parser fails on some valid css, like `@` in values
    output = (await perfectionist.process(output, {...formatOpts, parser: postcss.parse})).css;
  }

  // move comments to their own line
  output = output.replace(/\} \/\*/g, "}\n/*");

  // put selectors on the same line
  output = output.replace(/,\n( *)/g, (_, m1) => `,${m1.trim()} `);

  // wrap selector lists at lineLength
  output = output.replace(/^( *)(\S.+?) \{/gm, (_, whitespace, content) => {
    let newContent = "";
    const parts = cssSelectorSplitter(content).filter(Boolean);
    const lastIndex = parts.length - 1;
    for (const [index, part] of parts.entries()) {
      const currentLength = /.*$/.exec(newContent)![0].length;
      const requiredLength = resolvedOpts.lineLength - part.length - whitespace.length;
      if (requiredLength < currentLength) {
        newContent = newContent.replace(/ $/g, "");
        newContent += `\n${whitespace}`;
      }
      newContent += `${part.trim()}${index !== lastIndex ? ", " : ""}`;
    }
    return `${whitespace}${newContent.trim()} {`;
  });

  // add space before declaration leading comments
  output = output.replace(/:\/\*/g, ": /*");

  // remove empty lines
  output = output.replace(/\n{2,}/g, "\n").trim();

  // remove obsolete comments
  output = output.replace(/\* .+\/[\n ]\//g, "");

  output = cssVarToUsoVars(output);

  if (resolvedOpts.indentCss > 0) {
    output = output.replace(/^/gm, " ".repeat(resolvedOpts.indentCss));
  }

  return output;
}
