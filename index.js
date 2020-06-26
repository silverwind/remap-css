"use strict";

const convert = require("color-convert");
const cssColorNames = require("css-color-names");
const csstreeValidator = require("csstree-validator");
const memo = require("nano-memoize");
const postcss = require("postcss");
const postcssDiscardDuplicates = require("postcss-discard-duplicates");
const postcssDiscardEmpty = require("postcss-discard-empty");
const postcssDiscardOverridden = require("postcss-discard-overridden");
const postcssMergeRules = require("postcss-merge-rules");
const postcssSafeParser = require("postcss-safe-parser");
const postcssUniqueSelectors = require("postcss-unique-selectors");
const postcssValueParser = require("postcss-value-parser");
const prettier = require("prettier");
const splitString = require("split-string");
const {isShorthand} = require("css-shorthand-properties");

const defaults = {
  indentSize: 2,
  indentCss: 0,
  lineLength: 80,
  ignoreSelectors: [],
  comments: false,
  stylistic: false,
  validate: false,
};

const prefix = "source #";
const atRulesWithNoSelectors = new Set(["keyframes"]);
const splitDecls = memo(str => splitString(str, {separator: ";", quotes: [`"`, `'`]}).map(s => s.trim()));
const splitSelectors = memo(str => splitString(str, {separator: ",", quotes: [`"`, `'`]}).map(s => s.trim()));
const joinSelectors = selectors => selectors.join(", ");
const uniq = arr => Array.from(new Set(arr));

function srcName(src, index) {
  return src.name || `${prefix}${index}`;
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
      // skip adding a prefix if it matches a selector in `match`
      let skip = false;
      if (src.match) {
        for (const match of src.match) {
          const first = selector.split(/\s+/)[0];
          if ((/^[.#]+/.test(first) && first === match) || first.startsWith(match)) {
            skip = true;
            break;
          }
        }
      }

      if (!skip) {
        // incomplete check to avoid generating invalid "html :root" selectors
        if (selector.startsWith(":root ") && src.prefix.startsWith("html")) {
          selector = `${src.prefix} ${selector.substring(":root ".length)}`;
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
  if (!alpha === undefined) return "";
  if (alpha > 1) alpha = 1;
  if (alpha < 0) alpha = 0;
  return Math.floor(alpha * 255).toString(16).padStart(2, "0");
});

const cssSpecialValues = new Set([
  "0",
  "currentcolor",
  "inherit",
  "initial",
  "none",
  "transparent",
]);

const isColor = memo(value => {
  value = value.toLowerCase();
  if (cssColorNames[value]) return true;
  if (cssSpecialValues.has(value)) return true;
  if (/^#[0-9a-f]{3,4}$/.test(value)) return true;
  if (/^#[0-9a-f]{6}$/.test(value)) return true;
  if (/^#[0-9a-f]{8}$/.test(value)) return true;
  if (/^rgb\([0-9]+\s*,\s*[0-9]+\s*,\s*[0-9]\)/.test(value)) return true;
  if (/^rgba\([0-9]+\s*,\s*[0-9]+\s*,\s*[0-9]\s*,\s*[0-9.]+\)/.test(value)) return true;
  if (/^hsl\([0-9]+\s*,\s*[0-9]%+\s*,\s*[0-9]%\)/.test(value)) return true;
  if (/^hsla\([0-9]+\s*,\s*[0-9]%+\s*,\s*[0-9]%\s*,\s*[0-9.]+\)/.test(value)) return true;
  return false;
});

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
    if (["rgb", "rgba"].includes(node.value)) {
      const [r, g, b, a] = node.nodes.filter(node => node.type === "word").map(node => Number(node.value));
      value = normalizeHexColor(`#${convert.rgb.hex(r, g, b).toLowerCase()}${alphaToHex(a)}`);
    } else if (["hsl", "hsla"].includes(node.value)) {
      let [h, s, l, a] = node.nodes.filter(node => node.type === "word").map(node => String(node.value));
      h = Number(h);
      s = Number(s.replace("%", ""));
      l = Number(l.replace("%", ""));
      value = normalizeHexColor(`#${convert.hsl.hex(h, s, l).toLowerCase()}${alphaToHex(a)}`);
    }
  }

  return value;
});

function normalizeDecl({prop, value, important}) {
  prop = prop.toLowerCase();

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
    const value = parts.join().trim();
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
    } else if (key.startsWith("$color: ")) {
      const value = key.substring("$color: ".length);
      const oldValue = (value.startsWith("$") ? value : normalizeColor(value)).toLowerCase();
      colorMappings[oldValue] = newValue;
    } else {
      addMapping(declMappings, names, key, newValue);
    }
  }

  return [declMappings, colorMappings, borderMappings, backgroundMappings];
}

function hasDeclarations(root) {
  if (root.type === "decl") return true;
  if (!root.nodes || !root.nodes.length) return false;
  for (const node of root.nodes || []) {
    if (hasDeclarations(node)) return true;
  }

  return false;
}

const isValidDeclaration = memo((prop, value) => {
  try {
    value = value.replace(/\/\*\[\[.+?\]\]\*\//g, "var(--name)");
    const rule = `a{${prop}: ${value}}`;
    const result = csstreeValidator.validateString(rule);
    const hadError = result["<unknown>"] && result["<unknown>"][0] && result["<unknown>"][0].error instanceof Error;
    return !hadError;
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
    const [r, g, b] = convert.hex.rgb(normalizedValue);
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

function checkNode(node, prop, normalizedValue, oldColors, colorMappings, borderMappings, backgroundMappings) {
  if (prop.startsWith("border") && !prop.includes("radius")) {
    const newValue = getNewColorValue(normalizedValue, borderMappings);
    if (newValue) return doReplace(node, oldColors, newValue);
  }
  if (prop.startsWith("background")) {
    const newValue = getNewColorValue(normalizedValue, backgroundMappings);
    if (newValue) return doReplace(node, oldColors, newValue);
  }
  const newValue = getNewColorValue(normalizedValue, colorMappings);
  if (newValue) return doReplace(node, oldColors, newValue);
}

function replaceColorsInValue(prop, value, colorMappings, borderMappings, backgroundMappings) {
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
    const success = checkNode(node, prop, normalizedValue, oldColors, colorMappings, borderMappings, backgroundMappings);
    if (success) replaced = true;
  });

  return {
    newValue: replaced ? postcssValueParser.stringify(nodes) : null,
    oldColors: Array.from(oldColors),
  };
}

const plugin = postcss.plugin("remap-css", (src, declMappings, colorMappings, borderMappings, backgroundMappings, names, index, opts) => {
  const commentStart = srcName(src, index, opts);

  return async root => {
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
          const {newValue, oldColors} = replaceColorsInValue(decl.prop, decl.value, colorMappings, borderMappings, backgroundMappings);
          if (!newValue) return decl.remove();
          if (opts.validate && !isValidDeclaration(decl.prop, newValue)) return decl.remove();
          decl.value = newValue;
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
        if (!decl.raws._replaced) {
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
  };
});

function prettierFormat(css, opts) {
  return prettier.format(css, {
    parser: "css",
    tabWidth: opts.indentSize,
    printWidth: Infinity,
    useTabs: false,
    singleQuote: false,
  });
}

module.exports = async function remapCss(sources, mappings, opts = {}) {
  opts = Object.assign({}, defaults, opts);

  const names = {};
  const [declMappings, colorMappings, borderMappings, backgroundMappings] = prepareMappings(mappings, names);
  const postcssOpts = {parser: postcssSafeParser, from: undefined};

  const results = await Promise.all(sources.map((src, index) => {
    const plug = plugin(src, declMappings, colorMappings, borderMappings, backgroundMappings, names, index, {...opts});
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
    postcssMergeRules,
    postcssUniqueSelectors,
  ];
  output = (await postcss(plugins).process(output, postcssOpts)).css;

  // format
  output = prettierFormat(output, opts);

  // move comments to their own line
  output = output.replace(/} \/\*/g, "}\n/*");

  // put selectors on the same line
  output = output.replace(/,\n( *)/g, (_, m1) => `,${m1.trim()} `);

  // wrap selector lists at lineLength
  output = output.replace(/^( *)(.+?) {/gm, (_, whitespace, content) => {
    let newContent = "";
    const parts = content.split(", ").filter(p => !!p);
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

  // indent everything
  if (opts.indentCss && opts.indentCss > 0) {
    output = output.replace(/^(.*)/gm, (_, m1) => `${" ".repeat(opts.indentCss)}${m1}`);
  }

  return output;
};
