"use strict";

const remapCss = require(".");
const {test, expect} = global;

function unintend(str) {
  str = str.replace(/^\n/, "").replace(/\n +$/g, "\n");
  const indent = (/^ +/.exec(str.split(/\n/)[0]) || [[]])[0].length;
  const re = new RegExp(`^ {${indent}}`);
  str = str.split(/\n/).filter(l => !!l).map(line => line.replace(re, "")).join("\n");
  return str;
}

const makeTest = ({sources, mappings, opts, expected, expectedExact}) => {
  return async () => {
    const output = await remapCss(sources, mappings, opts);
    if (expected) expect(unintend(output)).toEqual(unintend(expected));
    if (expectedExact) expect(output).toEqual(expectedExact);
  };
};

test("no input", makeTest({
  sources: [],
  mappings: {},
  expected: "",
}));

test("no mappings", makeTest({
  sources: [{css: "a {color: red}"}],
  mappings: {},
  expected: "",
}));

test("basic", makeTest({
  sources: [{css: `
    a {color: red;}
  `}],
  mappings: {
    "color: red": "color: blue",
  },
  expected: `
    a {
      color: blue;
    }
`}));

test("multiple sources", makeTest({
  sources: [
    {css: `a {color: red;}`},
    {css: `b {color: red;}`},
  ],
  mappings: {
    "color: red": "color: blue",
  },
  expected: `
    a {
      color: blue;
    }
    b {
      color: blue;
    }
`}));

test("multiple selectors", makeTest({
  sources: [{css: `
    a,b {color: red;}
  `}],
  mappings: {
    "color: red": "color: blue",
  },
  expected: `
    a, b {
      color: blue;
    }
`}));

test("single selectors", makeTest({
  sources: [{css: `
    a {color: red;}
    b {color: red;}
  `}],
  mappings: {
    "color: red": "color: blue",
  },
  expected: `
    a {
      color: blue;
    }
    b {
      color: blue;
    }
`}));

test("duplicate rules", makeTest({
  sources: [{css: `
    b {color: red;}
    a, b {color: red;}
  `}],
  mappings: {
    "color: red": "color: blue",
  },
  expected: `
    b {
      color: blue;
    }
    a, b {
      color: blue;
    }
`}));

test("special rule", makeTest({
  sources: [{css: `
    a {border-left-color: red;}
  `}],
  mappings: {
    "$border: red": "blue",
  },
  expected: `
    a {
      border-left-color: blue;
    }
`}));

test("important", makeTest({
  sources: [{css: `
    a {background: red;}
    b {background: red !important;}
    a {background: yellow !important;}
    b {background: yellow !important;}
  `}],
  mappings: {
    "background: yellow": "background: green",
    "background: red": "background: blue",
  },
  expected: `
    a {
      background: blue;
    }
    b {
      background: blue !important;
    }
    a {
      background: green !important;
    }
    b {
      background: green !important;
    }
`}));

test("order", makeTest({
  sources: [{css: `
    a {background: red;}
    b {background: yellow;}
    c {background: yellow;}
    d {background: red;}
  `}],
  mappings: {
    "background: yellow": "background: green",
    "background: red": "background: blue",
  },
  expected: `
    a {
      background: blue;
    }
    b {
      background: green;
    }
    c {
      background: green;
    }
    d {
      background: blue;
    }
`}));

test("indentSize 0", makeTest({
  sources: [{css: `a {color: red;}`}],
  mappings: {
    "color: red": "color: blue",
  },
  opts: {
    indentSize: 0,
  },
  expectedExact: `a {\ncolor: blue;\n}`,
}));

test("indentSize 0, comments: true", makeTest({
  sources: [{css: `a {color: red;}`}],
  mappings: {
    "color: red": "color: blue",
  },
  opts: {
    indentSize: 0,
    comments: true,
  },
  expectedExact: `/* remap-css rule for "color: red" */\na {\ncolor: blue;\n}`,
}));

test("special mapping name", makeTest({
  sources: [{css: `a {background: red;}`}],
  mappings: {
    "$background: red": "blue",
  },
  opts: {
    indentSize: 0,
    comments: true,
  },
  expectedExact: `/* remap-css rule for "background: red" */\na {\nbackground: blue;\n}`,
}));

test("ignore atrules", makeTest({
  sources: [{css: `
    a {
      background: red;
    }
    @font-face {
      font-family: 'font';
    }
  `}],
  mappings: {
    "$background: red": "blue",
  },
  opts: {
    indentSize: 0,
    comments: true,
  },
  expectedExact: `/* remap-css rule for "background: red" */\na {\nbackground: blue;\n}`,
}));

test("atrules", makeTest({
  sources: [{css: `
    @media screen {
      a {
        background: red;
      }
    }
  `}],
  mappings: {
    "$background: red": "blue",
  },
  expected: `
    @media screen {
      a {
        background: blue;
      }
    }
`}));

test("atrules comments", makeTest({
  sources: [{css: `
    @media screen {
      a {
        background: red;
      }
      b {
        background: green;
      }
    }
  `}],
  mappings: {
    "$background: red": "blue",
    "$background: green": "yellow",
  },
  opts: {
    comments: true,
  },
  expectedExact: `/* remap-css rule for "background: red", "background: green" */\n@media screen {\n  a {\n    background: blue;\n  }\n  b {\n    background: yellow;\n  }\n}`,
}));
