"use strict";

const remapCss = require(".");
const {test, expect} = global;

function unintend(str) {
  str = str.replace(/^\n/, "").replace(/\n +$/g, "\n");
  const indent = (/^ +/.exec(str.split(/\n/)[0]) || [[]])[0].length;
  const re = new RegExp(`^ {${indent}}`);
  str = str.split(/\n/).map(line => line.replace(re, "")).join(/\n/);
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

test("mappings order", makeTest({
  sources: [{css: `
    a {background: red;}
    b {background: red;}
    a {background: yellow;}
    b {background: yellow;}
  `}],
  mappings: {
    "background: yellow": "background: green",
    "background: red": "background: blue",
  },
  expected: `
    a, b {
      background: green;
    }
    a, b {
      background: blue;
    }
`}));

test("source order", makeTest({
  sources: [{css: `
    a {background: red;}
    b {background: red;}
    a {background: yellow;}
    b {background: yellow;}
  `}],
  mappings: {
    "background: yellow": "background: green",
    "background: red": "background: blue",
  },
  opts: {
    order: "source",
  },
  expected: `
    a, b {
      background: blue;
    }
    a, b {
      background: green;
    }
`}));

test("source order, no combine", makeTest({
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
  opts: {
    order: "source",
    combine: false,
  },
  expected: `
    a {
      background: blue;
    }
    d {
      background: blue;
    }
    b {
      background: green;
    }
    c {
      background: green;
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
  expectedExact: "a {\n  color: blue;\n}\n",
}));
