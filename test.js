"use strict";

const remapCss = require(".");
const {test, expect} = global;

function u(str) {
  str = str.replace(/^\n/, "").replace(/\n +$/g, "\n");
  const indent = (/^ +/.exec(str.split(/\n/)[0]) || [[]])[0].length;
  const re = new RegExp(`^ {${indent}}`);
  str = str.split(/\n/).map(line => line.replace(re, "")).join(/\n/);
  return str;
}

test("remaps correctly", async () => {
  {
    const sources = [{css: "a {color: red;}"}];
    const mappings = {"color: red": "color: blue"};
    const expected = `
      a {
        color: blue;
      }
    `;
    expect(u(await remapCss(sources, mappings))).toEqual(u(expected));
  }
  {
    const sources = [{css: "a {border-left-color: red;}"}];
    const mappings = {"$border: red": "blue"};
    const expected = `
      a {
        border-left-color: blue;
      }
    `;
    expect(u(await remapCss(sources, mappings))).toEqual(u(expected));
  }
});
