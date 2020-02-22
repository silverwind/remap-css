"use strict";

const css = require("css");
const cssMediaQuery = require("css-mediaquery");
const cssColorNames = require("css-color-names");
const perfectionist = require("perfectionist");
const {isShorthand} = require("css-shorthand-properties");

const defaultOpts = {
  indentDeclaration: 2,
  indentCss: 0,
  lineLength: 80,
  ignoreSelectors: [],
  limitSpecial: 25,
  deviceType: "screen",
  deviceWidth: "1024px",
  comments: false,
};

function mediaMatches(query, opts) {
  const {deviceType: type, deviceWidth: width} = opts;
  try {
    return cssMediaQuery.match(query, {type, width});
  } catch (err) {
    return true; // this library has a few bugs. In case of error, we include the rule.
  }
}

function parseDeclarations(source, props, opts) {
  const decls = {};
  const stylesheet = css.parse(source.css).stylesheet;

  stylesheet.rules.forEach(rule => {
    if (rule.type === "media" && mediaMatches(rule.media, opts)) {
      rule.rules.forEach(rule => parseRule(decls, rule, props, source, opts));
    }

    if (!rule.selectors || rule.selectors.length === 0) return;
    parseRule(decls, rule, props, source, opts);
  });

  return decls;
}

function parseRule(decls, rule, props, source, opts) {
  for (const {value, property} of rule.declarations || []) {
    if (!props[property] || !value) continue;
    const normalizedValue = normalize(value, property);
    if (!props[property][normalizedValue]) continue;
    const originalValue = props[property][normalizedValue];

    let name = `${property}: ${originalValue}`;
    if (value.trim().endsWith("!important")) {
      name = `${name} !important`;
    }

    if (!decls[name]) decls[name] = new Set();

    rule.selectors.forEach(selector => {
      // Skip ignored selectors
      if (opts.ignoreSelectors.some(re => re.test(selector))) return;

      // stylistic tweaks
      selector = selector
        .replace(/\+/g, " + ")
        .replace(/~/g, " ~ ")
        .replace(/>/g, " > ")
        .replace(/ {2,}/g, " ")
        .replace(/'/g, `"`)
        .replace(/([^:]):(before|after)/g, (_, m1, m2) => `${m1}::${m2}`); // css parser seems to emit "::" as ":"

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
    });
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
  value = value
    // remove !important and trim whitespace
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

  return value;
}

function prepareMappings(mappings, opts) {
  const newMappings = {};
  for (const [key, value] of Object.entries(mappings)) {
    if (key.startsWith("$border: ")) {
      const oldValue = key.substring("$border: ".length);
      newMappings[`border-color: ${oldValue}`] = `border-color: ${value}`;
      newMappings[`border: solid ${oldValue}`] = `border-color: ${value}`;
      newMappings[`border-top-color: ${oldValue}`] = `border-top-color: ${value}`;
      newMappings[`border-bottom-color: ${oldValue}`] = `border-bottom-color: ${value}`;
      newMappings[`border-left-color: ${oldValue}`] = `border-left-color: ${value}`;
      newMappings[`border-right-color: ${oldValue}`] = `border-right-color: ${value}`;
      for (let i = 1; i < opts.limitSpecial; i++) {
        newMappings[`border: ${i}px solid ${oldValue}`] = `border-color: ${value}`;
        newMappings[`border: ${i}px dashed ${oldValue}`] = `border-color: ${value}`;
        newMappings[`border-top: ${i}px solid ${oldValue}`] = `border-top-color: ${value}`;
        newMappings[`border-bottom: ${i}px solid ${oldValue}`] = `border-bottom-color: ${value}`;
        newMappings[`border-left: ${i}px solid ${oldValue}`] = `border-left-color: ${value}`;
        newMappings[`border-right: ${i}px solid ${oldValue}`] = `border-right-color: ${value}`;
      }
    } else if (key.startsWith("$background: ")) {
      const oldValue = key.substring("$background: ".length);
      newMappings[`background: ${oldValue}`] = `background: ${value}`;
      newMappings[`background-color: ${oldValue}`] = `background-color: ${value}`;
      newMappings[`background-image: ${oldValue}`] = `background-image: ${value}`;
    } else {
      newMappings[key] = value;
    }
  }
  return newMappings;
}

// TODO: manually wrap long lines here
function format(css, opts) {
  const {indentDeclaration: indentSize, lineLength: maxSelectorLength} = opts;
  return String(perfectionist.process(css, {indentSize, maxSelectorLength}));
}

function unmergeables(selectors) {
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

function buildOutput(decls, mappings, opts) {
  let output = opts.comments ? "/* begin remap-css rules */\n" : "";

  for (const [fromValue, toValue] of Object.entries(mappings)) {
    let normalSelectors = Array.from(decls[fromValue] || []);
    let importantSelectors = Array.from(decls[`${fromValue} !important`] || []);

    if (normalSelectors && normalSelectors.length) {
      const newValue = toValue.trim().replace(/;$/, "");
      const normalUnmergeables = unmergeables(normalSelectors);

      if (normalUnmergeables.length) {
        normalSelectors = normalSelectors.filter(selector => !normalUnmergeables.includes(selector));
      }
      if (normalSelectors.length || normalUnmergeables.length) {
        output += opts.comments ? `/* remap-css rule for "${fromValue}" */\n` : "";
      }
      if (normalSelectors.length) output += format(`${normalSelectors.join(",")} {${newValue};}`, opts);
      if (normalUnmergeables.length) output += unmergeableRules(normalUnmergeables, newValue, opts);
    }

    if (importantSelectors && importantSelectors.length) {
      const newValue = toValue.trim().replace(/;$/, "").split(";").map(v => `${v} !important`).join(";");
      const importantUnmergeables = unmergeables(importantSelectors);

      if (importantUnmergeables.length) {
        importantSelectors = importantSelectors.filter(selector => !importantUnmergeables.includes(selector));
      }
      if (importantSelectors.length || importantUnmergeables.length) {
        output += opts.comments ? `/* remap-css rule for "${fromValue} !important" */\n` : 0;
      }
      if (importantSelectors.length) output += format(`${importantSelectors.join(",")} {${newValue};}`, opts);
      if (importantUnmergeables.length) output += unmergeableRules(importantUnmergeables, newValue, opts);
    }
  }
  output += opts.comments ? "/* end remap-css rules */" : "";
  const indent = " ".repeat(opts.indentCss);
  return output.split("\n").map(line => `${indent}${line}`).join("\n");
}

module.exports = async function remapCss(sources, mappingsArg, opts = {}) {
  opts = Object.assign({}, defaultOpts, opts);
  const mappings = prepareMappings(mappingsArg, opts);

  const props = {};
  for (const mapping of Object.keys(mappings)) {
    const [prop, val] = mapping.split(": ");
    const normalizedVal = normalize(val, prop);
    if (!props[prop]) props[prop] = {};
    props[prop][normalizedVal] = val;
  }

  const decls = {};
  for (const source of sources) {
    for (const [key, values] of Object.entries(parseDeclarations(source, props, opts))) {
      if (!decls[key]) decls[key] = new Set();
      for (const value of values) {
        decls[key].add(value);
      }
    }
  }

  return buildOutput(decls, mappings, opts);
};
