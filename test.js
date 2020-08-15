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
    a, b {
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
    a, b {
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
    a, b {
      color: blue;
    }
`}));

test("special rule", makeTest({
  sources: [{css: `
    a {border-left: 1px solid red;}
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
    a, b {
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
    b, c {
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
  expectedExact: `/* source #0: "color: red" */\na {\ncolor: blue;\n}`,
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
  expectedExact: `/* source #0: "red" */\na {\nbackground-color: blue;\n}`,
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
  expectedExact: `/* source #0: "red" */\na {\nbackground-color: blue;\n}`,
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
        background-color: blue;
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
  expectedExact: `/* source #0: "red", "green" */\n@media screen {\n  a {\n    background-color: blue;\n  }\n  b {\n    background-color: yellow;\n  }\n}`,
}));

test("keyframe atrule, no prefix", makeTest({
  sources: [{css: `
    @keyframes blink {
      50% {
        background: none;
      }
    }
  `}],
  mappings: {
    "$background: none": "blue",
  },
  opts: {
    prefix: "prefix",
  },
  expected: `
    @keyframes blink {
      50% {
        background-color: blue;
      }
    }
`}));

test("prop replacement", makeTest({
  sources: [{css: `
    a {
      background: red;
    }
  `}],
  mappings: {
    "background: red": "background-color: blue",
  },
  expected: `
    a {
      background-color: blue;
    }
`}));

test("duplicate props", makeTest({
  sources: [{css: `
    a {
      background: green;
      background: green;
      background: red;
      background: red;
    }
  `}],
  mappings: {
    "background: green": "background-color: yellow",
    "background: red": "background-color: blue",
  },
  expected: `
    a {
      background-color: yellow;
      background-color: blue;
    }
`}));

test("duplicate props", makeTest({
  sources: [{css: `
    .link-mktg:hover {
      color: #0366d6;
      box-shadow: 0 1px 0 0 #1074e7
    }
  `}],
  mappings: {
    "color: #0366d6": "color: /*[[base-color]]*/ #4f8cc9",
    "box-shadow: 0 1px 0 0 #1074e7": `
      box-shadow: 0 1px 0 0 #4f8cc9;
      box-shadow: 0 1px 0 0 /*[[base-color]]*/
    `,
  },
  expected: `
    .link-mktg:hover {
      color: /*[[base-color]]*/ #4f8cc9;
      box-shadow: 0 1px 0 0 #4f8cc9;
      box-shadow: 0 1px 0 0 /*[[base-color]]*/;
    }
`}));

test("validate", makeTest({
  sources: [{css: `
    a {
      color: red;
      background-color: linear-gradient(red, blue);
    }
  `}],
  mappings: {
    "color: red": "color: blue",
    "$background: linear-gradient(red, blue)": "linear-gradient(-180deg, #202020 0%, #181818 90%)",
  },
  opts: {
    validate: true,
  },
  expected: `
    a {
      color: blue;
    }
`}));

test("sourceNames", makeTest({
  sources: [{css: `a {color: red;}`, name: "test"}],
  mappings: {
    "color: red": "color: blue",
  },
  opts: {
    indentSize: 0,
    comments: true,
  },
  expectedExact: `/* test: "color: red" */\na {\ncolor: blue;\n}`,
}));

test("$border 0", makeTest({
  sources: [{css: `a {border: 0;}`}],
  mappings: {
    "$border: 0": "0",
  },
  expected: ``}));

test("$color in gradient hex", makeTest({
  sources: [{css: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, rgb(255,255,255,0))
    }
  `}],
  mappings: {
    "$color: #1074e7": "#123",
  },
  expected: `
  a:hover {
    background: linear-gradient(to bottom, #123, rgb(255, 255, 255, 0));
  }
`}));

test("$color in gradient rgb", makeTest({
  sources: [{css: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, rgb(255,255,255,0))
    }
  `}],
  mappings: {
    "$color: rgb(255,255,255,0)": "#123",
  },
  expected: `
  a:hover {
    background: linear-gradient(to bottom, #1074e7, #123);
  }
`}));

test("$color in gradient rgb", makeTest({
  sources: [{css: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, rgb(255,255,255,0))
    }
  `}],
  mappings: {
    "$color: rgb(255,255,255,0)": "#123",
  },
  expected: `
  a:hover {
    background: linear-gradient(to bottom, #1074e7, #123);
  }
`}));

test("$color hsla", makeTest({
  sources: [{css: `
    a:hover {
      background: linear-gradient(to bottom, hsla(0,0%,100%,.125), rgb(255,255,255,0))
    }
  `}],
  mappings: {
    "$color: hsla(0,0%,100%,.125)": "#123",
  },
  expected: `
  a:hover {
    background: linear-gradient(to bottom, #123, rgb(255, 255, 255, 0));
  }
`}));

test("$color: $monochrome", makeTest({
  sources: [{css: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, rgb(255,255,255,0))
    }
  `}],
  mappings: {
    "$color: $monochrome": "#123",
  },
  expected: `
  a:hover {
    background: linear-gradient(to bottom, #1074e7, #123);
  }
`}));

test("$color: $monochrome - $invert", makeTest({
  sources: [{css: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, rgb(40,40,40,0))
    }
  `}],
  mappings: {
    "$color: $monochrome": "$invert",
  },
  expected: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, #d7d7d700);
    }
`}));

test("currentcolor", makeTest({
  sources: [{css: `
    a {
      border-color: currentColor !important;
      border-top: 1px solid !important;
    }
  `}],
  mappings: {
    "$border: currentcolor": "currentcolor",
  },
  expected: `
    a {
      border-color: currentcolor !important;
    }
`}));

test("multivalue", makeTest({
  sources: [{css: `
    a {
      border-color: red red green;
    }
  `}],
  mappings: {
    "$color: red": "blue",
    "$color: green": "yellow",
  },
  expected: `
    a {
      border-color: blue blue yellow;
    }
`}));

test("multivalue 2", makeTest({
  sources: [{css: `
    a {
      border-color: #eee #eee #fff red;
    }
  `}],
  mappings: {
    "$border: #fff": "#222",
    "$border: #eee": "#333",
    "$color: red": "#444",
  },
  expected: `
    a {
      border-color: #333 #333 #222 #444;
    }
`}));

test("border rgba", makeTest({
  sources: [{css: `
    a {
      border-color: rgba(27,31,35,.15);
    }
  `}],
  mappings: {
    "$border: rgba(27,31,35,.15)": "#222",
  },
  expected: `
    a {
      border-color: #222;
    }
`}));

test("gradient", makeTest({
  sources: [{css: `
    a {
      background-image: linear-gradient(#54a3ff,#006eed);
    }
  `}],
  mappings: {
    "$background: linear-gradient(#54a3ff,#006eed)": "linear-gradient(#111,#111)",
  },
  expected: `
    a {
      background-image: linear-gradient(#111, #111);
    }
`}));

test("gradient hsla", makeTest({
  sources: [{css: `
    a {
      background-image: linear-gradient(hsla(0,10%,10%,.5),#222);
    }
  `}],
  mappings: {
    "$color: hsla(0,10%,10%,.5)": "#111",
  },
  expected: `
    a {
      background-image: linear-gradient(#111, #222);
    }
`}));

test("$box-shadow", makeTest({
  sources: [{css: `
    a {
      box-shadow: 0 0 1px linear-gradient(hsla(0,10%,10%,.5),#222);
    }
  `}],
  mappings: {
    "$box-shadow: hsla(0,10%,10%,.5)": "#111",
  },
  expected: `
    a {
      box-shadow: 0 0 1px linear-gradient(#111, #222);
    }
`}));

test("$box-shadow 2", makeTest({
  sources: [{css: `
    a {
      box-shadow: 0 1px 15px rgba(27,31,35,.15) !important;
    }
  `}],
  mappings: {
    "$box-shadow: rgba(27,31,35,.15)": "#111",
  },
  expected: `
    a {
      box-shadow: 0 1px 15px #111 !important;
    }
`}));

test("border-bottom-color", makeTest({
  sources: [{css: `
    a {
      border-bottom-color: blue;
      border-top: 1px solid green;
    }
  `}],
  mappings: {
    "$border: blue": "red",
    "$border: green": "yellow",
  },
  expected: `
    a {
      border-bottom-color: red;
      border-top-color: yellow;

    }
`}));

test("border 2", makeTest({
  sources: [{css: `
    a {
      font-size: 12px;
      border: 1px solid red;
      border-radius: 6px;
    }
  `}],
  mappings: {
    "$border: red": "yellow",
  },
  expected: `
    a {
      border-color: yellow;
    }
`}));

test("border 2", makeTest({
  sources: [{css: `
    a {
      border:1px solid red;
    }
  `}],
  mappings: {
    "$color: red": "yellow",
  },
  expected: `
    a {
      border-color: yellow;
    }
`}));

test("border 3", makeTest({
  sources: [{css: `
    @media (min-width:544px) {
      a {
        border:1px solid red;
      }
    }
  `}],
  mappings: {
    "$color: red": "yellow",
  },
  expected: `
    @media (min-width:544px) {
      a {
        border-color: yellow;
      }
    }
`}));

test("border 4", makeTest({
  sources: [{css: `
    @media (min-width:544px) {
      a {
        border-color: red;
      }
    }
  `}],
  mappings: {
    "$color: red": "yellow",
  },
  expected: `
    @media (min-width:544px) {
      a {
        border-color: yellow;
      }
    }
`}));

test("precedence 1", makeTest({
  sources: [{css: `
    @media (min-width:544px) {
      a {
        border-color: red;
        background-color: red;
      }
    }
  `}],
  mappings: {
    "$color: red": "yellow",
    "$border: red": "green",
    "$background: red": "green",
  },
  expected: `
    @media (min-width:544px) {
      a {
        border-color: green;
        background-color: green;
      }
    }
`}));

test("precedence 2", makeTest({
  sources: [{css: `
    @media (min-width:544px) {
      a {
        border-color: red;
        background-color: red;
      }
    }
  `}],
  mappings: {
    "$color: red": "blue",
    "$border: red": "green",
    "$background: red": "green",
    "border-color: red": "border-color: yellow",
    "background-color: red": "background-color: yellow",
  },
  expected: `
    @media (min-width:544px) {
      a {
        border-color: yellow;
        background-color: yellow;
      }
    }
`}));

test("precedence 3", makeTest({
  sources: [{css: `
    @media (min-width:544px) {
      a {
        border-left-color: red;
      }
    }
  `}],
  mappings: {
    "$color: red": "blue",
    "$border: red": "green",
  },
  expected: `
    @media (min-width:544px) {
      a {
        border-left-color: green;
      }
    }
`}));

test("background longhand", makeTest({
  sources: [{css: `
    @media (min-width:544px) {
      a {
        background: red url("/assets/images/octicons/search.svg") no-repeat 6px;
      }
    }
  `}],
  mappings: {
    "$color: red": "green",
  },
  expected: `
    @media (min-width:544px) {
      a {
        background-color: green;
      }
    }
`}));

test("transparency", makeTest({
  sources: [{css: `
    a {
      color: transparent;
      background-color: rgba(255,255,255,0);
    }
  `}],
  mappings: {
    "$color: transparent": "transparent",
  },
  expected: `
    a {
      color: transparent;
    }
`}));

test("transparency 2", makeTest({
  sources: [{css: `
    a {
      background-image: linear-gradient(180deg, #fff, rgba(245, 245, 245, 0));
    }
  `}],
  mappings: {
    "$color: #fff": "#222",
    "$color: transparent": "transparent",
  },
  expected: `
    a {
      background-image: linear-gradient(180deg, #222, rgba(245, 245, 245, 0));
    }
`}));

test("uso placeholder", makeTest({
  sources: [{css: `
    a {
      background: red;
    }
  `}],
  mappings: {
    "$color: red": "/*[[base-color]]*/",
  },
  expected: `
    a {
      background: /*[[base-color]]*/;
    }
`}));

test("whitespace after uso important", makeTest({
  sources: [{css: `
    a {
      background: red !important;
    }
  `}],
  mappings: {
    "$color: red": "/*[[base-color]]*/",
  },
  expected: `
    a {
      background: /*[[base-color]]*/ !important;
    }
`}));

test("no whitespace after uso var", makeTest({
  sources: [{css: `
    a {
      background: red;
    }
  `}],
  mappings: {
    "$color: red": "20/*[[base-color]]*/20",
  },
  expected: `
    a {
      background: 20/*[[base-color]]*/20;
    }
`}));

test("whitespace after uso var", makeTest({
  sources: [{css: `
    a {
      background: red;
    }
  `}],
  mappings: {
    "$color: red": "20 /*[[base-color]]*/ 20",
  },
  expected: `
    a {
      background: 20 /*[[base-color]]*/ 20;
    }
`}));

test("complex uso var", makeTest({
  sources: [{css: `
    a {
      box-shadow: 2px 0 0 red inset;
    }
  `}],
  mappings: {
    "$color: red": "/*[[base-color]]*/",
  },
  expected: `
    a {
      box-shadow: 2px 0 0 /*[[base-color]]*/ inset;
    }
`}));

test("rgba", makeTest({
  sources: [{css: `
    @media (min-width: 777px) {
      a {
        background-color: rgba(234, 234, 0, .22);
      }
    }
  `}],
  mappings: {
    "$color: rgba(234, 234, 0, .22)": "rgba(36, 36, 36, .22)",
  },
  expected: `
    @media (min-width: 777px) {
      a {
        background-color: rgba(36, 36, 36, .22);
      }
    }
`}));

test("box-shadow exact precedence", makeTest({
  sources: [{css: `
    @media (min-width: 777px) {
      a {
        box-shadow: 0 1px 0 #123, inset 0 1px 0 hsla(0, 0%, 100%, .5);
      }
    }
  `}],
  mappings: {
    "box-shadow: 0 1px 0 #123, inset 0 1px 0 hsla(0, 0%, 100%, .5);": "box-shadow: none",
    "$color: #123": "color: red",
    "$color: hsla(0, 0%, 100%, .5)": "color: green",
  },
  expected: `
    @media (min-width: 777px) {
      a {
        box-shadow: none;
      }
    }
`}));

test("vars", makeTest({
  sources: [{css: `
    @media (min-width: 777px) {
      a {
        border-top: 1px solid #fff;
      }
    }
  `}],
  mappings: {
    "$border: #fff": "var(--border-color)",
  },
  expected: `
    @media (min-width: 777px) {
      a {
        border-top-color: var(--border-color);
      }
    }
`}));

test("radial with var", makeTest({
  sources: [{css: `
    @media (min-width: 777px) {
      a {
        background: radial-gradient(white 40%, transparent 40%) no-repeat;
      }
    }
  `}],
  mappings: {
    "$background: #ffffff": "var(--border-color)",
  },
  expected: `
    @media (min-width: 777px) {
      a {
        background: radial-gradient(var(--border-color) 40%, transparent 40%) no-repeat;
      }
    }
`}));

test("keep", makeTest({
  sources: [{css: `
    @media (min-width: 777px) {
      a {
        color: blue;
        background: radial-gradient(white 40%, transparent 40%) no-repeat;
      }
    }
  `}],
  mappings: {
    "$background: #ffffff": "var(--border-color)",
  },
  opts: {
    keep: true,
  },
  expected: `
    @media (min-width: 777px) {
      a {
        color: blue;
        background: radial-gradient(var(--border-color) 40%, transparent 40%) no-repeat;
      }
    }
`}));
