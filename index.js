"use strict";

const cssColorNames = require("css-color-names");
const cssMediaQuery = require("css-mediaquery");
const perfectionist = require("perfectionist");
const postcssSafeParser = require("postcss-safe-parser");
const splitCssSelector = require("split-css-selector");
const {isShorthand} = require("css-shorthand-properties");

const defaults = {
  indentDeclaration: 2,
  indentCss: 0,
  lineLength: 80,
  ignoreSelectors: [],
  limitSpecial: 25,
  deviceType: "screen",
  deviceWidth: "1024px",
  comments: false,
  stylistic: false,
  order: "mappings",
  combine: true,
};

function mediaMatches(query, opts) {
  const {deviceType: type, deviceWidth: width} = opts;
  try {
    return cssMediaQuery.match(query, {type, width});
  } catch {
    return true; // this library has a few bugs. In case of error, we include the rule.
  }
}

function getRuleNodes(nodes, opts) {
  const ret = [];
  for (const node of nodes) {
    if (node.type === "atrule" && node.name === "media" && mediaMatches(node.params, opts) && node.nodes && node.nodes.length) {
      ret.push(...getRuleNodes(node.nodes || [], opts));
    } else if (node.type === "rule") {
      ret.push(node);
    }
  }
  return ret;
}

function parseSource(source, props, indexData, opts) {
  const decls = {};
  const parsed = postcssSafeParser(source.css);
  const nodes = getRuleNodes(parsed.nodes, opts);

  for (const node of nodes) {
    parseRule(node, decls, props, indexData, source, opts);
  }

  return decls;
}

function parseRule(rule, decls, props, indexData, source, opts) {
  for (const {prop, value, important} of rule.nodes.filter(node => node.type === "decl") || []) {
    if (!props[prop] || !value) continue;
    const normalizedValue = normalize(value, prop);
    if (!props[prop][normalizedValue]) continue;
    const originalValue = props[prop][normalizedValue];
    const name = `${prop}: ${originalValue}${important ? " !important" : ""}`;

    if (!decls[name]) decls[name] = new Set();

    for (let selector of splitCssSelector(rule.selector)) {
      // Skip ignored selectors
      if (opts.ignoreSelectors.some(re => re.test(selector))) continue;

      indexData.indexes[selector] = indexData.index;
      indexData.index += 1;

      // stylistic tweaks
      if (opts.stylistic) {
        selector = selector
          .replace(/\+/g, " + ")
          .replace(/(~)([^=])/g, (_, m1, m2) => ` ${m1} ${m2}`)
          .replace(/>/g, " > ")
          .replace(/ {2,}/g, " ")
          .replace(/'/g, `"`)
          .replace(/([^:]):(before|after)/g, (_, m1, m2) => `${m1}::${m2}`); // css parser seems to emit "::" as ":"
      }

      // add prefix
      if (source.prefix) {
        // skip adding a prefix if it matches a selector in `match`
        let skip = false;
        if (source.match) {
          for (const match of source.match) {
            const first = selector.split(/\s+/)[0];
            if ((/^[.#]+/.test(first) && first === match) || first.startsWith(match)) {
              skip = true;
              break;
            }
          }
        }

        if (!skip) {
          // incomplete check to avoid generating invalid "html :root" selectors
          if (selector.startsWith(":root ") && source.prefix.startsWith("html")) {
            selector = `${source.prefix} ${selector.substring(":root ".length)}`;
          } else {
            selector = `${source.prefix} ${selector}`;
          }
        }
      }

      // add the selector to the selector list for this mapping
      decls[name].add(selector);
    }
  }
}

function normalizeHexColor(value) {
  if ([4, 5].includes(value.length)) {
    const [h, r, g, b, a] = value;
    return `${h}${r}${r}${g}${g}${b}${b}${a || "f"}${a || "f"}`;
  } else if (value.length === 7) {
    return `${value}ff`;
  }
  return value;
}

function normalize(value, prop) {
  const isImportant = value.trim().endsWith("!important");

  value = value
    // remove important
    .replace(/!important$/g, "").trim()
    // remove leading zeroes on values like 'rgba(27,31,35,0.075)'
    .replace(/0(\.[0-9])/g, (_, val) => val)
    // normalize 'linear-gradient(-180deg, #0679fc, #0361cc 90%)' to not have whitespace in parens
    .replace(/([a-z-]+\()(.+)(\))/g, (_, m1, m2, m3) => `${m1}${m2.replace(/,\s+/g, ",")}${m3}`);

  if (value in cssColorNames) {
    value = cssColorNames[value];
  }

  if (/^#[0-9a-f]+$/i.test(value)) {
    value = normalizeHexColor(value);
  }

  // treat values case-insensitively
  if (prop !== "content" && !value.startsWith("url(")) {
    value = value.toLowerCase();
  }

  // try to ignore order in shorthands. This will only work on simple cases as for example
  // `background` can take a comma-separated list which totally breaks this comparison.
  if (isShorthand(prop)) {
    value = value.split(" ").sort().join(" ");
  }

  return `${value}${isImportant ? " !important" : ""}`;
}

function addMapping(mappings, fromValue, toValue) {
  toValue = toValue.trim();
  if (!toValue) return;
  mappings[fromValue] = toValue;
  if (!fromValue.endsWith("!important")) {
    mappings[`${fromValue} !important`] = toValue;
  }
}

function prepareMappings(mappings, opts) {
  const ret = {};
  for (const [key, value] of Object.entries(mappings)) {
    if (key.startsWith("$border: ")) {
      const oldValue = key.substring("$border: ".length);
      addMapping(ret, `border-color: ${oldValue}`, `border-color: ${value}`);
      addMapping(ret, `border: solid ${oldValue}`, `border-color: ${value}`);
      addMapping(ret, `border: dashed ${oldValue}`, `border-color: ${value}`);
      addMapping(ret, `border-top-color: ${oldValue}`, `border-top-color: ${value}`);
      addMapping(ret, `border-bottom-color: ${oldValue}`, `border-bottom-color: ${value}`);
      addMapping(ret, `border-left-color: ${oldValue}`, `border-left-color: ${value}`);
      addMapping(ret, `border-right-color: ${oldValue}`, `border-right-color: ${value}`);
      for (let i = 1; i <= opts.limitSpecial; i++) {
        addMapping(ret, `border: ${i}px solid ${oldValue}`, `border-color: ${value}`);
        addMapping(ret, `border: ${i}px dashed ${oldValue}`, `border-color: ${value}`);
        addMapping(ret, `border-top: ${i}px solid ${oldValue}`, `border-top-color: ${value}`);
        addMapping(ret, `border-top: ${i}px dashed ${oldValue}`, `border-top-color: ${value}`);
        addMapping(ret, `border-bottom: ${i}px solid ${oldValue}`, `border-bottom-color: ${value}`);
        addMapping(ret, `border-bottom: ${i}px dashed ${oldValue}`, `border-bottom-color: ${value}`);
        addMapping(ret, `border-left: ${i}px solid ${oldValue}`, `border-left-color: ${value}`);
        addMapping(ret, `border-left: ${i}px dashed ${oldValue}`, `border-left-color: ${value}`);
        addMapping(ret, `border-right: ${i}px solid ${oldValue}`, `border-right-color: ${value}`);
        addMapping(ret, `border-right: ${i}px dashed ${oldValue}`, `border-right-color: ${value}`);
      }
    } else if (key.startsWith("$background: ")) {
      const oldValue = key.substring("$background: ".length);
      addMapping(ret, `background: ${oldValue}`, `background: ${value}`);
      addMapping(ret, `background: ${oldValue} none`, `background: ${value}`);
      addMapping(ret, `background: none ${oldValue}`, `background: ${value}`);
      addMapping(ret, `background-color: ${oldValue}`, `background-color: ${value}`);
      addMapping(ret, `background-image: ${oldValue}`, `background-image: ${value}`);
      addMapping(ret, `background-image: ${oldValue} none`, `background-image: ${value}`);
      addMapping(ret, `background-image: none ${oldValue}`, `background-image: ${value}`);
    } else {
      addMapping(ret, key, value);
    }
  }

  return ret;
}

// TODO: manually wrap long lines here
function format(css, opts) {
  const {indentDeclaration: indentSize, lineLength: maxSelectorLength} = opts;
  return String(perfectionist.process(css, {indentSize, maxSelectorLength}));
}

function getUnmergeables(selectors) {
  return selectors.filter(selector => /-(moz|ms|webkit)-.+/.test(selector));
}

function unmergeableRules(selectors, value, opts) {
  let ret = "";
  const moz = [];
  const webkit = [];
  const ms = [];
  const other = [];

  for (const selector of selectors) {
    if (selector.includes("-moz-")) moz.push(selector);
    else if (selector.includes("-webkit-")) webkit.push(selector);
    else if (selector.includes("-ms-")) ms.push(selector);
    else other.push(selector);
  }

  if (moz.length) ret += format(`${moz.join(", ")} {${value};}`, opts);
  if (webkit.length) ret += format(`${webkit.join(", ")} {${value};}`, opts);
  if (ms.length) ret += format(`${ms.join(", ")} {${value};}`, opts);
  if (other.length) ret += format(`${other.join(", ")} {${value};}`, opts);

  return ret;
}

function getNewValue(toValue, important) {
  let newValue = toValue.replace(/;$/, "");
  if (important) newValue = newValue.split(";").map(v => `${v} !important`).join(";");
  return newValue;
}

function generateOutput(selectors, fromValue, toValue, opts) {
  let output = "";
  if (!selectors || !selectors.length) return output;

  const unmergeables = getUnmergeables(selectors);
  if (unmergeables.length) selectors = selectors.filter(selector => !unmergeables.includes(selector));
  if (selectors.length || unmergeables.length) output += (opts.comments ? `/* remap-css rule for "${fromValue}" */\n` : "");

  const newValue =  getNewValue(toValue, fromValue.endsWith("!important"));
  if (selectors.length) output += format(`${selectors.join(",")} {${newValue};}`, opts);
  if (unmergeables.length) output += unmergeableRules(unmergeables, newValue, opts);

  return output;
}

function sortByIndex(selectors, indexes) {
  const sorted = selectors.sort((a, b) => {
    return indexes[a] - indexes[b];
  });
  return sorted;
}

function buildOutput(decls, mappings, indexData, opts) {
  const sourceOrder = opts.order === "source";
  let output = opts.comments ? "/* begin remap-css rules */\n" : "";

  for (let [fromValue, toValue] of Object.entries(sourceOrder ? decls : mappings)) {
    if (sourceOrder) toValue = mappings[fromValue];
    const selectors = Array.from(decls[fromValue] || []).sort();

    if (opts.combine) {
      output += generateOutput(selectors, fromValue, toValue, opts);
    } else {
      for (const selector of sortByIndex(selectors, indexData.indexes)) {
        output += generateOutput([selector], fromValue, toValue, opts);
      }
    }
  }
  output += (opts.comments ? "/* end remap-css rules */" : "");
  const indent = " ".repeat(opts.indentCss);
  return output.split("\n").filter(l => !!l).map(line => `${indent}${line}`).join("\n");
}

module.exports = async function remapCss(sources, mappingsArg, opts = {}) {
  opts = Object.assign({}, defaults, opts);
  const mappings = prepareMappings(mappingsArg, opts);

  const props = {};
  for (const mapping of Object.keys(mappings)) {
    const [prop, val] = mapping.split(": ");
    const normalizedVal = normalize(val, prop);
    if (!props[prop]) props[prop] = {};
    props[prop][normalizedVal] = val;
  }

  const decls = {};
  const indexData = {index: 0, indexes: {}};
  for (const source of sources) {
    for (const [key, values] of Object.entries(parseSource(source, props, indexData, opts))) {
      if (!decls[key]) decls[key] = new Set();
      for (const value of values) {
        decls[key].add(value);
      }
    }
  }

  return buildOutput(decls, mappings, indexData, opts);
};
