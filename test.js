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

const makeTest = (sources, mappings, expected) => {
  return async () => {
    const output = await remapCss(sources, mappings, expected);
    return expect(unintend(output)).toEqual(unintend(expected));
  };
};

test("no input", makeTest([], {}, ""));

test("basic", makeTest([{css: "a {color: red;}"}], {"color: red": "color: blue"}, `
  a {
    color: blue;
  }
`));

test("special rule", makeTest([{css: "a {border-left-color: red;}"}], {"$border: red": "blue"}, `
  a {
    border-left-color: blue;
  }
`));
