"use strict";

const cssColorNames = require("css-color-names");
const csstreeValidator = require("csstree-validator");
const memoize = require("nano-memoize");
const postcss = require("postcss");
const postcssDiscardDuplicates = require("postcss-discard-duplicates");
const postcssDiscardEmpty = require("postcss-discard-empty");
const postcssDiscardOverridden = require("postcss-discard-overridden");
const postcssMergeRules = require("postcss-merge-rules");
const postcssSafeParser = require("postcss-safe-parser");
const postcssUniqueSelectors = require("postcss-unique-selectors");
const prettier = require("prettier");
const splitString = require("split-string");
const {isShorthand} = require("css-shorthand-properties");

const defaults = {
  indentSize: 2,
  indentCss: 0,
  lineLength: 80,
  ignoreSelectors: [],
  limitSpecial: 25,
  comments: false,
  stylistic: false,
  validate: false,
};

const prefix = "source #";
const atRulesWithNoSelectors = new Set(["keyframes"]);
const splitDecls = memoize(str => splitString(str, {separator: ";", quotes: [`"`, `'`]}).map(s => s.trim()));
const splitSelectors = memoize(str => splitString(str, {separator: ",", quotes: [`"`, `'`]}).map(s => s.trim()));
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

const normalizeHexColor = memoize(value => {
  if ([4, 5].includes(value.length)) {
    const [h, r, g, b, a] = value;
    return `${h}${r}${r}${g}${g}${b}${b}${a || "f"}${a || "f"}`;
  } else if (value.length === 7) {
    return `${value}ff`;
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
const parseDecl = memoize((declString) => {
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

const isValidDeclaration = memoize((prop, value) => {
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

const plugin = postcss.plugin("remap-css", (src, preparedMappings, names, index, opts) => {
  const commentStart = srcName(src, index, opts);

  return async root => {
    root.walkRules(node => {
      const matchedDeclStrings = [];

      node.walkDecls(decl => {
        const declString = stringifyDecl({prop: decl.prop, value: decl.value, important: decl.important});
        const newDecls = [];
        if (preparedMappings[declString]) {
          for (const newDecl of preparedMappings[declString] || []) {
            const {prop, value, important, origValue} = newDecl;
            const newProp = prop;
            const newValue = origValue || value;
            const newImportant = Boolean(decl.important || important);
            if (opts.validate && !isValidDeclaration(newProp, newValue)) {
              return decl.remove();
            }
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
          decl.remove();
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
  const preparedMappings = prepareMappings(mappings, names, opts);
  const postcssOpts = {parser: postcssSafeParser, from: undefined};

  const results = await Promise.all(sources.map((src, index) => {
    const plug = plugin(src, preparedMappings, names, index, {...opts});
    return postcss([plug]).process(src.css, postcssOpts);
  }));

  let output = "";
  for (const {css} of results) {
    output += css;
  }

  // optimize
  const plugins = [
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
