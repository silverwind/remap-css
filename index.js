import colorConvert from "color-convert";
import cssSelectorSplitter from "css-selector-splitter";
import cssSelectorTokenizer from "css-selector-tokenizer";
import {validate} from "csstree-validator";
import knownCssProperties from "known-css-properties";
import memo from "nano-memoize";
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

const cssColorNames = {
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
  "yellowgreen": "#9acd32"
};

const defaults = {
  indentSize: 2,
  indentCss: 0,
  lineLength: 80,
  ignoreSelectors: [],
  comments: false,
  stylistic: false,
  validate: false,
  keep: false,
};

const prefix = "source #";
const atRulesWithNoSelectors = new Set(["keyframes"]);
const splitDecls = memo(str => splitString(str, {separator: ";", quotes: [`"`, `'`]}).map(s => s.trim()));
const splitSelectors = memo(str => splitString(str, {separator: ",", quotes: [`"`, `'`]}).map(s => s.trim()));
const joinSelectors = selectors => selectors.join(", ");
const uniq = arr => Array.from(new Set(arr));
const varRe = /var\(--(?!uso-var-expanded).+?\)/;
const knownProperties = new Set(knownCssProperties.all);

// https://github.com/postcss/postcss/issues/1426
function getProperty(decl) {
  const before = decl.raws && decl.raws.before && decl.raws.before.trim();
  if (before === "*" || before === "_") {
    return `${before}${decl.prop}`;
  } else {
    return decl.prop;
  }
}

const selectorsIntersect = memo((a, b) => {
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
});

function isRootSelector(selector) {
  return selector.startsWith("html") || selector.startsWith(":root");
}

function rewriteSelectors(selectors, opts, src) {
  const ret = [];

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

    // add prefix
    if (src.prefix) {
      // don't add whitespace after prefix if matches a selector in `match`
      let intersects = false;
      let skip = false;
      const [first] = selector.split(/\s+/);

      if (src.match) {
        for (const match of src.match) {
          if (selectorsIntersect(first, match)) {
            intersects = true;
            break;
          }
        }
      }

      // ignore keyframes steps
      if (/^[0-9]+%$/.test(selector)) {
        skip = true;
      }

      if (!skip) {
        if (isRootSelector(first) && isRootSelector(src.prefix)) {
          selector = `${src.prefix} ${selector.substring(first.length).trim()}`;
        } else if (intersects) {
          selector = `${first}${selector}`;
        } else {
          selector = `${src.prefix} ${selector}`;
        }
      }
    }

    ret.push(selector);
  }

  return ret;
}

const normalizeHexColor = memo(value => {
  if ([4, 5].includes(value.length)) {
    const [h, r, g, b, a] = value;
    return `${h}${r}${r}${g}${g}${b}${b}${a || "f"}${a || "f"}`;
  } else if (value.length === 7) {
    return `${value}ff`;
  }
  return value;
});

const alphaToHex = memo(alpha => {
  if (alpha === undefined) return "";
  if (alpha > 1) alpha = 1;
  if (alpha < 0) alpha = 0;
  return Math.floor(alpha * 255).toString(16).padStart(2, "0");
});

const cssValueKeywords = new Set([
  "currentcolor",
  "inherit",
  "initial",
  "none",
  "revert",
  "transparent",
  "unset",
]);

const isColor = memo(value => {
  value = value.toLowerCase();
  if (cssColorNames[value]) return true;
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

function hexFromColorFunction(node) {
  if (rgbFunctions.has(node.value)) {
    const [r, g, b, a] = node.nodes.filter(node => node.type === "word").map(node => Number(node.value));
    if (!r || !g || !b) return null;
    return normalizeHexColor(`#${colorConvert.rgb.hex(r, g, b).toLowerCase()}${alphaToHex(a)}`);
  } else if (hslFunctions.has(node.value)) {
    let [h, s, l, a] = node.nodes.filter(node => node.type === "word").map(node => String(node.value));
    if (!h || !s || !l) return null;
    h = Number(h);
    s = Number(s.replace("%", ""));
    l = Number(l.replace("%", ""));
    return normalizeHexColor(`#${colorConvert.hsl.hex(h, s, l).toLowerCase()}${alphaToHex(a)}`);
  }
  return null;
}

const normalizeColor = memo(value => {
  value = value.toLowerCase();

  if (value in cssColorNames) {
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

function normalizeDecl({prop, raws, value, important}) {
  prop = getProperty({prop, raws}).toLowerCase();

  const origValue = value;

  value = value
    // remove leading zeroes on values like 'rgba(27,31,35,0.075)'
    .replace(/0(\.[0-9])/g, (_, val) => val)
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

  return {prop, value, important, origValue};
}

// returns an array of declarations
const parseDecl = memo((declString) => {
  declString = declString.trim().replace(/;+$/, "").trim();

  const ret = [];
  for (const str of splitDecls(declString)) {
    const parts = str.split(":");
    const important = parts[parts.length - 1].toLowerCase() === "!important";
    if (important) parts.pop();
    const prop = parts.shift().trim();
    const value = parts.join(",").trim();
    ret.push(normalizeDecl({prop, value, important}));
  }
  return ret;
});

function stringifyDecl(decl) {
  const {prop, value, important} = normalizeDecl(decl);
  return `${prop}: ${value}${important ? " !important" : ""}`;
}

function addMapping(mappings, names, fromStringDecl, toStringDecl) {
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

function prepareMappings(mappings, names) {
  const declMappings = {};
  const colorMappings = {};
  const borderMappings = {};
  const boxShadowMappings = {};
  const backgroundMappings = {};

  for (const [key, newValue] of Object.entries(mappings)) {
    if (key.startsWith("$border: ")) {
      const value = key.substring("$border: ".length);
      const oldValue = (value.startsWith("$") ? value : normalizeColor(value)).toLowerCase();
      borderMappings[oldValue] = newValue;
    } else if (key.startsWith("$background: ")) {
      const value = key.substring("$background: ".length);
      const oldValue = (value.startsWith("$") ? value : normalizeColor(value)).toLowerCase();
      backgroundMappings[oldValue] = newValue;
    } else if (key.startsWith("$box-shadow: ")) {
      const value = key.substring("$box-shadow: ".length);
      const oldValue = (value.startsWith("$") ? value : normalizeColor(value)).toLowerCase();
      boxShadowMappings[oldValue] = newValue;
    } else if (key.startsWith("$value: ")) {
      const value = key.substring("$value: ".length);
      const oldValue = (value.startsWith("$") ? value : normalizeColor(value)).toLowerCase();
      colorMappings[oldValue] = newValue;
    } else {
      addMapping(declMappings, names, key, newValue);
    }
  }

  return [declMappings, colorMappings, borderMappings, boxShadowMappings, backgroundMappings];
}

function hasDeclarations(root) {
  if (root.type === "decl") return true;
  if (!root.nodes || !root.nodes.length) return false;
  for (const node of root.nodes || []) {
    if (hasDeclarations(node)) return true;
  }

  return false;
}

const usoVarToCssVar = memo(value => {
  return value.replace(/\/\*\[\[(.+?)\]\]\*\//g, (_, name) => `var(--uso-var-expanded-${name})`);
});

const cssVarToUsoVars = memo(value => {
  return value.replace(/var\(--(uso-var-expanded-)(.+?)\)/g, (_, _prefix, name) => `/*[[${name}]]*/`);
});

const isValidDeclaration = memo((prop, value) => {
  if (!knownProperties.has(prop) && !/^--./i.test(prop)) {
    return false;
  }

  try {
    value = usoVarToCssVar(value);
    return !(validate(`a{${prop}: ${value}}`)).length;
  } catch {
    return false;
  }
});

// this may add extra newlines, but those are trimmed off later
function makeComment(text) {
  return postcss.comment({
    raws: {before: "\n", after: "\n", left: " ", right: " "},
    text,
  });
}

const assignNewColor = memo((normalizedColor, newValue) => {
  if (newValue === "$invert") {
    let [_, r, g, b, a] = /^#(..)(..)(..)(..)$/.exec(normalizedColor);
    r = (255 - parseInt(r, 16)).toString(16).padStart(2, "0");
    g = (255 - parseInt(g, 16)).toString(16).padStart(2, "0");
    b = (255 - parseInt(b, 16)).toString(16).padStart(2, "0");
    return `#${r}${g}${b}${a}`;
  } else {
    return newValue;
  }
});

function getNewColorValue(normalizedValue, colorMappings) {
  if (colorMappings[normalizedValue]) {
    return colorMappings[normalizedValue];
  } else if (colorMappings.$monochrome) {
    const [r, g, b] = colorConvert.hex.rgb(normalizedValue);
    if (r === g && g === b) {
      return assignNewColor(normalizedValue, colorMappings.$monochrome);
    }
  }

  return null; // did not match
}

function doReplace(node, oldColors, newValue) {
  oldColors.add(node.type === "word" ? node.value : postcssValueParser.stringify([node]));
  node.value = newValue;
  node.type = "word";
  delete node.nodes;
  return true;
}

const borderColorShorthands = new Set([
  "border",
  "border-top",
  "border-left",
  "border-right",
  "border-bottom",
  "border-color",
]);

const borderColorLonghands = new Set([
  "border-top-color",
  "border-left-color",
  "border-right-color",
  "border-bottom-color",
]);

const backgroundColorShorthands = new Set([
  "background",
]);

const backgroundColorLonghands = new Set([
  "background-color",
]);

const borderColorVars = new Set([...borderColorShorthands, ...borderColorLonghands]);
const backgroundColorVars = new Set([...backgroundColorShorthands, ...backgroundColorLonghands]);

function checkNode(node, prop, normalizedValue, oldColors, colorMappings, borderMappings, boxShadowMappings, backgroundMappings) {
  if (borderColorVars.has(prop) || prop === "border-image") {
    const newValue = getNewColorValue(normalizedValue, borderMappings);
    if (newValue) return doReplace(node, oldColors, newValue);
  }
  if (backgroundColorVars.has(prop) || prop === "background-image") {
    const newValue = getNewColorValue(normalizedValue, backgroundMappings);
    if (newValue) return doReplace(node, oldColors, newValue);
  }
  if (prop === "box-shadow") {
    const newValue = getNewColorValue(normalizedValue, boxShadowMappings);
    if (newValue) return doReplace(node, oldColors, newValue);
  }
  const newValue = getNewColorValue(normalizedValue, colorMappings);
  if (newValue) return doReplace(node, oldColors, newValue);
}

function replaceColorsInValue(prop, value, colorMappings, borderMappings, boxShadowMappings, backgroundMappings) {
  const {nodes} = postcssValueParser(value);
  const oldColors = new Set([]);
  let replaced = false;

  postcssValueParser.walk(nodes, node => {
    let normalizedValue;
    if (node.type === "word" && isColor(node.value)) {
      normalizedValue = normalizeColor(node.value);
    } else if (node.type === "function") {
      const valueString = postcssValueParser.stringify(node);
      normalizedValue = normalizeColor(valueString);
    }
    if (!normalizedValue) return;
    const success = checkNode(node, prop, normalizedValue, oldColors, colorMappings, borderMappings, boxShadowMappings, backgroundMappings);
    if (success) replaced = true;
  });

  return {
    newValue: replaced ? usoVarToCssVar(postcssValueParser.stringify(nodes)) : null,
    oldColors: Array.from(oldColors),
  };
}

const plugin = (src, declMappings, colorMappings, borderMappings, boxShadowMappings, backgroundMappings, names, index, opts) => {
  const commentStart = src.name || `${prefix}${index}`;

  return {
    postcssPlugin: "remap-css",
    Root: root => {
      root.walkRules(node => {
        const matchedDeclStrings = [];

        node.walkDecls(decl => {
          const declString = stringifyDecl({prop: decl.prop, value: decl.value, important: decl.important});
          const newDecls = [];
          if (declMappings[declString]) {
            for (const newDecl of declMappings[declString] || []) {
              const {prop, value, important, origValue} = newDecl;
              const newProp = prop;
              const newValue = origValue || value;
              const newImportant = Boolean(decl.important || important);
              if (opts.validate && !isValidDeclaration(newProp, newValue)) return decl.remove();
              newDecls.push(decl.clone({
                prop: newProp,
                value: newValue,
                important: newImportant,
                raws: {_replaced: true},
              }));
              matchedDeclStrings.push(`"${names[declString]}"`);
            }

            decl.replaceWith(...newDecls);

            if (!node.raws.semicolon) {
              node.raws.semicolon = true; // ensure semicolon at the end of the rule
            }
          } else {
            const {newValue, oldColors} = replaceColorsInValue(decl.prop, decl.value, colorMappings, borderMappings, boxShadowMappings, backgroundMappings);

            if (!newValue) {
              if (!opts.keep) decl.remove();
              return;
            }

            if (opts.validate && !isValidDeclaration(getProperty(decl), newValue)) {
              decl.remove();
              return;
            }

            if ((borderColorShorthands.has(decl.prop) && decl.prop !== "border-color") || (backgroundColorShorthands.has(decl.prop) && decl.prop !== "background-color")) {
              try {
                // workaround expandShorthandProperty not supporting css vars
                const containsVar = varRe.test(newValue);
                const expanded = expandShorthandProperty(decl.prop, containsVar ? newValue.replace(varRe, "rgba(255,0,255,0)") : newValue);
                let numReplaced = 0;
                for (let [prop, value] of Object.entries(expanded)) {
                  if (containsVar) value = newValue.match(varRe)[0];
                  if (!prop.includes("color")) continue;
                  if (numReplaced === 0) {
                    decl.prop = prop;
                    decl.value = value;
                  } else {
                    decl.cloneBefore({prop, value});
                  }
                  numReplaced += 1;
                }
              } catch { // expandShorthandProperty may throw on multiple borders
                decl.value = newValue;
              }
            } else { // simple replace
              decl.value = newValue;
            }
            decl.raws._replaced = true;
            matchedDeclStrings.push(oldColors.map(color => `"${color}"`));
          }
        });

        if (matchedDeclStrings.length) {
          const selectors = splitSelectors(node.selector);
          const newSelectors = rewriteSelectors(selectors, opts, src).filter(selector => {
            for (const re of opts.ignoreSelectors) {
              if (re.test(selector)) return false;
            }
            return true;
          });

          if (newSelectors.length) {
            if (opts.comments) {
              const targetNode = node.parent.type === "atrule" ? node.parent : node;
              const prevNode = targetNode.prev();

              if (prevNode && prevNode.type === "comment" && prevNode.text && prevNode.text.startsWith(commentStart)) {
                const prevDeclStrings = prevNode.text.match(/".+?"/g);
                prevNode.text = `${commentStart}: ${uniq([...prevDeclStrings, ...matchedDeclStrings]).join(", ")}`;
              } else {
                root.insertBefore(targetNode, makeComment(`${commentStart}: ${uniq(matchedDeclStrings).join(", ")}`));
              }
            }

            if (node.selector && !(node.parent && node.parent.type === "atrule" && atRulesWithNoSelectors.has(node.parent.name))) {
              node.selector = joinSelectors(newSelectors);
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
          if (node.text.startsWith(commentStart)) return;
          node.remove();
        }
        if (!hasDeclarations(node)) node.remove();
        if (node.type === "rule") {
          // remove duplicate props (those are actual errors in the sources)
          const seen = {};

          node.walkDecls(decl => {
            if (decl.raws._replaced) return;
            if (!seen[decl.prop]) seen[decl.prop] = [];
            seen[decl.prop].push(decl);
          });

          for (const nodes of Object.values(seen)) {
            if (nodes.length > 1) {
              for (const node of nodes.slice(0, -1)) {
                node.remove();
              }
            }
          }
        }
      });
    },
  };
};
plugin.postcss = true;

async function format(css, opts) {
  return (await perfectionist.process(css, {
    cascade: false,
    colorShorthand: true,
    indentSize: opts.indentSize,
    maxAtRuleLength: opts.lineLength,
    maxSelectorLength: opts.lineLength,
    maxValueLength: opts.lineLength,
    trimLeadingZero: true,
    trimTrailingZeros: true,
    zeroLengthNoUnit: true,
  })).css;
}

export default async function remapCss(sources, mappings, opts = {}) {
  opts = {...defaults, ...opts};

  const names = {};
  const [declMappings, colorMappings, borderMappings, boxShadowMappings, backgroundMappings] = prepareMappings(mappings, names);
  const postcssOpts = {parser: postcssSafeParser, from: undefined};

  const results = await Promise.all(sources.map((src, index) => {
    const plug = plugin(src, declMappings, colorMappings, borderMappings, boxShadowMappings, backgroundMappings, names, index, {...opts});
    return postcss([plug]).process(src.css, postcssOpts);
  }));

  let output = "";
  for (const {css} of results) {
    output += css;
  }

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
  output = (await postcss(plugins).process(output, postcssOpts)).css;

  // format
  output = await format(output, opts);

  // move comments to their own line
  output = output.replace(/} \/\*/g, "}\n/*");

  // put selectors on the same line
  output = output.replace(/,\n( *)/g, (_, m1) => `,${m1.trim()} `);

  // wrap selector lists at lineLength
  output = output.replace(/^( *)(.+?) {/gm, (_, whitespace, content) => {
    let newContent = "";
    const parts = cssSelectorSplitter(content).filter(Boolean);
    const lastIndex = parts.length - 1;
    for (const [index, part] of Object.entries(parts)) {
      const currentLength = /.*$/.exec(newContent)[0].length;
      const requiredLength = opts.lineLength - part.length - whitespace.length;
      if (requiredLength < currentLength) {
        newContent = newContent.replace(/ $/g, "");
        newContent += `\n${whitespace}`;
      }
      newContent += `${part.trim()}${Number(index) !== lastIndex ? ", " : ""}`;
    }
    return `${whitespace}${newContent.trim()} {`;
  });

  // add space before declaration leading comments
  output = output.replace(/:\/\*/g, ": /*");

  // remove empty lines
  output = output.replace(/\n{2,}/g, "\n").trim();

  // remove obsolete comments
  output = output.replace(/\* .+\/[\n ]\//gm, "");

  // restore uso vars
  output = cssVarToUsoVars(output);

  // indent everything
  if (opts.indentCss && opts.indentCss > 0) {
    output = output.replace(/^(.*)/gm, (_, m1) => `${" ".repeat(opts.indentCss)}${m1}`);
  }

  return output;
}
