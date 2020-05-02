"use strict";

const cssColorNames = require("css-color-names");
const postcss = require("postcss");
const postcssSafeParser = require("postcss-safe-parser");
const prettier = require("prettier");
const splitString = require("split-string");
const {isShorthand} = require("css-shorthand-properties");
const pkg = require("./package.json");

const defaults = {
  indentSize: 2,
  indentCss: 0,
  lineLength: 80,
  ignoreSelectors: [],
  limitSpecial: 25,
  comments: false,
  stylistic: false,
};

const splitDecls = str => splitString(str, {separator: ";", quotes: [`"`, `'`]});
const splitSelectors = str => splitString(str, {separator: ",", quotes: [`"`, `'`]});
const joinSelectors = selectors => selectors.join(", ");

function rewriteSelectors(selectors, opts) {
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
    if (opts.prefix) {
      // skip adding a prefix if it matches a selector in `match`
      let skip = false;
      if (opts.match) {
        for (const match of opts.match) {
          const first = selector.split(/\s+/)[0];
          if ((/^[.#]+/.test(first) && first === match) || first.startsWith(match)) {
            skip = true;
            break;
          }
        }
      }

      if (!skip) {
        // incomplete check to avoid generating invalid "html :root" selectors
        if (selector.startsWith(":root ") && opts.prefix.startsWith("html")) {
          selector = `${opts.prefix} ${selector.substring(":root ".length)}`;
        } else {
          selector = `${opts.prefix} ${selector}`;
        }
      }
    }

    ret.push(selector);
  }

  return ret;
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

function normalizeDecl({prop, value, important}) {
  prop = prop.toLowerCase();

  const origValue = value;

  value = value
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

  return {prop, value, important, origValue};
}

// returns an array of declarations
function parseDecl(declString) {
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
}

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

function prepareMappings(mappings, names, opts) {
  const ret = {};
  for (const [key, value] of Object.entries(mappings)) {
    if (key.startsWith("$border: ")) {
      const oldValue = key.substring("$border: ".length);
      addMapping(ret, names, `border-color: ${oldValue}`, `border-color: ${value}`);
      addMapping(ret, names, `border: solid ${oldValue}`, `border-color: ${value}`);
      addMapping(ret, names, `border: dashed ${oldValue}`, `border-color: ${value}`);
      addMapping(ret, names, `border-top-color: ${oldValue}`, `border-top-color: ${value}`);
      addMapping(ret, names, `border-bottom-color: ${oldValue}`, `border-bottom-color: ${value}`);
      addMapping(ret, names, `border-left-color: ${oldValue}`, `border-left-color: ${value}`);
      addMapping(ret, names, `border-right-color: ${oldValue}`, `border-right-color: ${value}`);
      for (let i = 1; i <= opts.limitSpecial; i++) {
        addMapping(ret, names, `border: ${i}px solid ${oldValue}`, `border-color: ${value}`);
        addMapping(ret, names, `border: ${i}px dashed ${oldValue}`, `border-color: ${value}`);
        addMapping(ret, names, `border-top: ${i}px solid ${oldValue}`, `border-top-color: ${value}`);
        addMapping(ret, names, `border-top: ${i}px dashed ${oldValue}`, `border-top-color: ${value}`);
        addMapping(ret, names, `border-bottom: ${i}px solid ${oldValue}`, `border-bottom-color: ${value}`);
        addMapping(ret, names, `border-bottom: ${i}px dashed ${oldValue}`, `border-bottom-color: ${value}`);
        addMapping(ret, names, `border-left: ${i}px solid ${oldValue}`, `border-left-color: ${value}`);
        addMapping(ret, names, `border-left: ${i}px dashed ${oldValue}`, `border-left-color: ${value}`);
        addMapping(ret, names, `border-right: ${i}px solid ${oldValue}`, `border-right-color: ${value}`);
        addMapping(ret, names, `border-right: ${i}px dashed ${oldValue}`, `border-right-color: ${value}`);
      }
    } else if (key.startsWith("$background: ")) {
      const oldValue = key.substring("$background: ".length);
      addMapping(ret, names, `background: ${oldValue}`, `background: ${value}`);
      addMapping(ret, names, `background: ${oldValue} none`, `background: ${value}`);
      addMapping(ret, names, `background: none ${oldValue}`, `background: ${value}`);
      addMapping(ret, names, `background-color: ${oldValue}`, `background-color: ${value}`);
      addMapping(ret, names, `background-image: ${oldValue}`, `background-image: ${value}`);
      addMapping(ret, names, `background-image: ${oldValue} none`, `background-image: ${value}`);
      addMapping(ret, names, `background-image: none ${oldValue}`, `background-image: ${value}`);
    } else {
      addMapping(ret, names, key, value);
    }
  }

  return ret;
}

function hasDeclarations(root) {
  if (root.type === "decl") return true;
  if (!root.nodes || !root.nodes.length) return false;
  for (const node of root.nodes || []) {
    if (hasDeclarations(node)) return true;
  }

  return false;
}

// this may add extra newlines, but those are trimmed off later
function makeComment(text) {
  return postcss.comment({
    raws: {before: "\n", after: "\n", left: " ", right: " "},
    text,
  });
}

const plugin = postcss.plugin(pkg.name, (mappings, opts) => {
  return async root => {
    const names = {};
    const preparedMappings = prepareMappings(mappings, names, opts);

    root.walkRules(node => {
      const matchedDeclStrings = [];

      node.walkDecls(decl => {
        const declString = stringifyDecl({prop: decl.prop, value: decl.value, important: decl.important});
        const newDecls = [];
        if (preparedMappings[declString]) {
          matchedDeclStrings.push(`"${names[declString]}"`);
          for (const newDecl of preparedMappings[declString] || []) {
            const {value, important, origValue} = newDecl;
            newDecls.push(decl.clone({
              value: origValue || value,
              important: Boolean(decl.important || important),
              raws: {
                _replaced: true,
              },
            }));
          }
          decl.replaceWith(...newDecls);
        } else {
          decl.remove();
        }
      });

      if (matchedDeclStrings.length) {
        const selectors = splitSelectors(node.selector);
        const newSelectors = rewriteSelectors(selectors, opts).filter(selector => {
          for (const re of opts.ignoreSelectors) {
            if (re.test(selector)) return false;
          }
          return true;
        });

        if (newSelectors.length) {
          if (opts.comments) {
            root.insertBefore(node, makeComment(`${pkg.name} rule for ${matchedDeclStrings.join(", ")}`));
          }
          node.selector = joinSelectors(newSelectors);
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
        if (node.text.startsWith(`${pkg.name} rule for`)) return;
        node.remove();
      }
      if (!hasDeclarations(node)) node.remove();
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

  let output = "";
  for (const {css, prefix, match} of sources) {
    const result = await postcss([plugin(mappings, {...opts, prefix, match})]).process(css, {parser: postcssSafeParser, from: undefined});
    output += result.css;
  }

  output = prettierFormat(output, opts);

  // move comments to their own line
  output = output.replace(/} \/\*/g, "}\n/*");

  // remove empty lines
  output = output.replace(/\n{2,}/g, "\n").trim();

  // put selectors on the same line
  output = output.replace(/,\n( *)/g, (_, m1) => `,${m1.trim()} `);

  // wrap selector lists at lineLength
  output = output.replace(/^( *)(.+?) {/gm, (_, whitespace, content) => {
    let newContent = "";
    for (const part of content.split(", ").filter(p => !!p)) {
      const currentLength = /.*$/.exec(newContent)[0].length;
      const requiredLength = opts.lineLength - part.length - whitespace.length;
      if (requiredLength < currentLength) newContent += `\n${whitespace}`;
      newContent += `${part}, `;
    }
    return `${whitespace}${newContent.replace(/, $/, "")} {`;
  });

  // indent everything
  if (opts.indentCss && opts.indentCss > 0) {
    output = output.replace(/^(.*)/gm, (_, m1) => `${" ".repeat(opts.indentCss)}${m1}`);
  }

  return output;
};
