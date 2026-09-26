import remapCss from "./index.ts";
import type {Options, Source} from "./index.ts";

function unintend(str: string): string {
  str = str.replace(/^\n/, "").replace(/\n +$/g, "\n");
  const indent = (/^ +/.exec(str.split(/\n/)[0]) || [[]])[0].length;
  const re = new RegExp(`^ {${indent}}`);
  str = str.split(/\n/).filter(Boolean).map(line => line.replace(re, "")).join("\n");
  return str;
}

type TestCase = {
  sources: Array<Source>,
  mappings: Record<string, string>,
  opts?: Options,
  expected: string,
};

const makeTest = ({sources, mappings, opts, expected}: TestCase) => async () => {
  expect(await remapCss(sources, mappings, opts)).toEqual(unintend(expected));
};

test("no input", makeTest({sources: [], mappings: {}, expected: ""}));

test("no mappings", makeTest({sources: [{css: "a {color: red}"}], mappings: {}, expected: ""}));

test("basic", makeTest({
  sources: [{css: `
    a {color: red;}
  `}],
  mappings: {"color: red": "color: blue"},
  expected: `
    a {
      color: blue;
    }
`}));

test.each(Object.entries({
  "multiple sources": [{css: `a {color: red;}`}, {css: `b {color: red;}`}],
  "multiple selectors": [{css: `
    a,b {color: red;}
  `}],
  "single selectors": [{css: `
    a {color: red;}
    b {color: red;}
  `}],
  "duplicate rules": [{css: `
    b {color: red;}
    a, b {color: red;}
  `}],
}))("%s", (_name, sources) => makeTest({sources, mappings: {"color: red": "color: blue"}, expected: `
  a, b {
    color: blue;
  }
`})());

test("special rule", makeTest({
  sources: [{css: `
    a {border-left: 1px solid red;}
  `}],
  mappings: {"$border: red": "blue"},
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
  mappings: {"background: yellow": "background: green", "background: red": "background: blue"},
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
  mappings: {"background: yellow": "background: green", "background: red": "background: blue"},
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
  mappings: {"color: red": "color: blue"},
  opts: {indentSize: 0},
  expected: `a {\ncolor: blue;\n}`,
}));

test("indentSize 0, comments: true", makeTest({
  sources: [{css: `a {color: red;}`}],
  mappings: {"color: red": "color: blue"},
  opts: {indentSize: 0, comments: true},
  expected: `/* source #0: "color: red" */\na {\ncolor: blue;\n}`,
}));

test.each(Object.entries({
  "special mapping name": `a {background: red;}`,
  "ignore atrules": `
    a {
      background: red;
    }
    @font-face {
      font-family: 'font';
    }
  `,
}))("%s", (_name, css) => makeTest({
  sources: [{css}],
  mappings: {"$background: red": "blue"},
  opts: {indentSize: 0, comments: true},
  expected: `/* source #0: "red" */\na {\nbackground-color: blue;\n}`,
})());

test("atrules", makeTest({
  sources: [{css: `
    @media screen {
      a {
        background: red;
      }
    }
  `}],
  mappings: {"$background: red": "blue"},
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
    @supports (display: grid) {
      e {
        background: green;
      }
      @media print {
        c {
          background: red;
        }
      }
    }
    d {
      background: green;
    }
  `}],
  mappings: {"$background: red": "blue", "$background: green": "yellow"},
  opts: {comments: true},
  expected: `/* source #0: "red", "green" */\n@media screen {\n  a {\n    background-color: blue;\n  }\n  b {\n    background-color: yellow;\n  }\n}\n/* source #0: "green" */\n@supports (display: grid) {\n  e {\n    background-color: yellow;\n  }\n  /* source #0: "red" */\n  @media print {\n    c {\n      background-color: blue;\n    }\n  }\n}\n/* source #0: "green" */\nd {\n  background-color: yellow;\n}`,
}));

test("keyframe atrule, no prefix", makeTest({
  sources: [{css: `
    @keyframes blink {
      50% {
        background: none;
      }
    }
  `, prefix: "prefix"}],
  mappings: {"$background: none": "blue"},
  expected: `
    @keyframes blink {
      50% {
        background-color: blue;
      }
    }
`}));

test("match repeats the matched compound instead of prefixing", makeTest({
  sources: [{css: `
    body .a {color: red;}
    body.foo .b {color: red;}
    .foo>.c {color: red;}
    .foo::before {color: red;}
    .d {color: red;}
    [data-x].foo .e {color: red;}
    .d>.foo {color: red;}
  `, prefix: "body.foo", match: ["body", ".foo"]}],
  mappings: {"color: red": "color: blue"},
  expected: `
    .foo.foo::before, .foo.foo>.c, [data-x].foo[data-x].foo .e, body .a, body.foo .d,
    body.foo .d>.foo, body.foo.foo .b {
      color: blue;
    }
`}));

test("prop replacement", makeTest({
  sources: [{css: `
    a {
      background: red;
    }
    b {
      width: 10.5px;
      color: green;
    }
  `}],
  mappings: {
    "background: red": "background-color: blue",
    "width: 1.5px": "width: 3px",
    "color: green": "background-image: url(https://example.com/a.png); list-style-image: url(data:image/png;base64,AA); font-family: \\5FAE",
  },
  expected: `
    a {
      background-color: blue;
    }
    b {
      background-image: url(https://example.com/a.png);
      list-style-image: url(data:image/png;base64,AA);
      font-family: \\5FAE;
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
  mappings: {"background: green": "background-color: yellow", "background: red": "background-color: blue"},
  expected: `
    a {
      background-color: yellow;
      background-color: blue;
    }
`}));

test("duplicate props 2", makeTest({
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
  opts: {validate: true},
  expected: `
    a {
      color: blue;
    }
`}));

test("sourceNames", makeTest({
  sources: [{css: `a {color: red;}`, name: "test"}],
  mappings: {"color: red": "color: blue"},
  opts: {indentSize: 0, comments: true},
  expected: `/* test: "color: red" */\na {\ncolor: blue;\n}`,
}));

test("$border 0", makeTest({sources: [{css: `a {border: 0;}`}], mappings: {"$border: 0": "0"}, expected: ""}));

const gradientSources = [{css: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, rgb(255,255,255,0))
    }
  `}];

test("$value in gradient hex", makeTest({
  sources: gradientSources,
  mappings: {"$value: #1074e7": "#123"},
  expected: `
  a:hover {
    background: linear-gradient(to bottom, #123, rgb(255, 255, 255, 0));
  }
`}));

test("$value in gradient rgb", makeTest({
  sources: gradientSources,
  mappings: {"$value: rgb(255,255,255,0)": "#123"},
  expected: `
  a:hover {
    background: linear-gradient(to bottom, #1074e7, #123);
  }
`}));

test("$value hsla", makeTest({
  sources: [{css: `
    a:hover {
      background: linear-gradient(to bottom, hsla(0,0%,100%,.125), rgb(255,255,255,0))
    }
  `}],
  mappings: {"$value: hsla(0,0%,100%,.125)": "#123"},
  expected: `
  a:hover {
    background: linear-gradient(to bottom, #123, rgb(255, 255, 255, 0));
  }
`}));

test("$value: $monochrome", makeTest({
  sources: [{css: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, rgb(255,255,255,0));
      color: inherit;
      width: calc(1px);
    }
  `}],
  mappings: {"$value: $monochrome": "#123"},
  expected: `
  a:hover {
    background: linear-gradient(to bottom, #1074e7, #123);
  }
`}));

test("$value: $monochrome - $invert", makeTest({
  sources: [{css: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, rgb(40,40,40,0), currentcolor)
    }
  `}],
  mappings: {"$value: $monochrome": "$invert"},
  expected: `
    a:hover {
      background: linear-gradient(to bottom, #1074e7, #d7d7d700, currentcolor);
    }
`}));

test("currentcolor", makeTest({
  sources: [{css: `
    a {
      border-color: currentColor !important;
      border-top: 1px solid !important;
    }
  `}],
  mappings: {"$border: currentcolor": "currentcolor"},
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
  mappings: {"$value: red": "blue", "$value: green": "yellow"},
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
  mappings: {"$border: #fff": "#222", "$border: #eee": "#333", "$value: red": "#444"},
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
  mappings: {"$border: rgba(27,31,35,.15)": "#222"},
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
  mappings: {"$background: linear-gradient(#54a3ff,#006eed)": "linear-gradient(#111,#111)"},
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
  mappings: {"$value: hsla(0,10%,10%,.5)": "#111"},
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
  mappings: {"$box-shadow: hsla(0,10%,10%,.5)": "#111"},
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
  mappings: {"$box-shadow: rgba(27,31,35,.15)": "#111"},
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
  mappings: {"$border: blue": "red", "$border: green": "yellow"},
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
  mappings: {"$border: red": "yellow"},
  expected: `
    a {
      border-color: yellow;
    }
`}));

test("border 3", makeTest({
  sources: [{css: `
    a {
      border:1px solid red;
    }
  `}],
  mappings: {"$value: red": "yellow"},
  expected: `
    a {
      border-color: yellow;
    }
`}));

test.each(Object.entries({
  "border 4": "border:1px solid red;",
  "border 5": "border-color: red;",
}))("%s", (_name, declaration) => makeTest({
  sources: [{css: `
    @media (min-width:544px) {
      a {
        ${declaration}
      }
    }
  `}],
  mappings: {"$value: red": "yellow"},
  expected: `
    @media (min-width:544px) {
      a {
        border-color: yellow;
      }
    }
`})());

const precedenceSources = [{css: `
    @media (min-width:544px) {
      a {
        border-color: red;
        background-color: red;
      }
    }
  `}];

test("precedence 1", makeTest({
  sources: precedenceSources,
  mappings: {"$value: red": "yellow", "$border: red": "green", "$background: red": "green"},
  expected: `
    @media (min-width:544px) {
      a {
        border-color: green;
        background-color: green;
      }
    }
`}));

test("precedence 2", makeTest({
  sources: precedenceSources,
  mappings: {
    "$value: red": "blue",
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
  mappings: {"$value: red": "blue", "$border: red": "green"},
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
  mappings: {"$value: red": "green"},
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
  mappings: {"$value: transparent": "transparent"},
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
  mappings: {"$value: #fff": "#222", "$value: transparent": "transparent"},
  expected: `
    a {
      background-image: linear-gradient(180deg, #222, rgba(245, 245, 245, 0));
    }
`}));

test.each(Object.entries({
  "uso placeholder": "/*[[base-color]]*/",
  "no whitespace after uso var": "20/*[[base-color]]*/20",
  "whitespace after uso var": "20 /*[[base-color]]*/ 20",
}))("%s", (_name, value) => makeTest({
  sources: [{css: `
    a {
      background: red;
    }
  `}],
  mappings: {"$value: red": value},
  expected: `a {\n  background: ${value};\n}`,
})());

test("whitespace after uso important", makeTest({
  sources: [{css: `
    a {
      background: red !important;
    }
  `}],
  mappings: {"$value: red": "/*[[base-color]]*/"},
  expected: `
    a {
      background: /*[[base-color]]*/ !important;
    }
`}));

test("complex uso var", makeTest({
  sources: [{css: `
    a {
      box-shadow: 2px 0 0 red inset;
    }
  `}],
  mappings: {"$value: red": "/*[[base-color]]*/"},
  expected: `
    a {
      box-shadow: 2px 0 0 /*[[base-color]]*/ inset;
    }
`}));

test("color functions with percentage alpha and unparsed hue", makeTest({
  sources: [{css: `
    @media (min-width: 777px) {
      a {
        background-color: rgba(234, 234, 0, .22);
        color: rgb(234 234 1 / 22%);
        border-color: hsl(120deg, 50%, 50%);
      }
    }
  `}],
  mappings: {
    "$value: rgba(234, 234, 0, .22)": "rgba(36, 36, 36, .22)",
    "$value: rgba(234, 234, 1, .22)": "red",
    "$value: #404040": "red",
  },
  expected: `
    @media (min-width: 777px) {
      a {
        background-color: rgba(36, 36, 36, .22);
        color: red;
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
    "$value: #123": "color: red",
    "$value: hsla(0, 0%, 100%, .5)": "color: green",
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
  mappings: {"$border: #fff": "var(--border-color)"},
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
  mappings: {"$background: #ffffff": "var(--border-color)"},
  expected: `
    @media (min-width: 777px) {
      a {
        background: radial-gradient(var(--border-color) 40%, transparent 40%) no-repeat;
      }
    }
`}));

test("keep, including prototype names and @ in values", makeTest({
  sources: [{css: `
    @media (min-width: 777px) {
      a {
        color: blue;
        background: radial-gradient(white 40%, transparent 40%) no-repeat;
        border-color: rgb(var(--a), var(--b), var(--c));
        animation-name: constructor;
        constructor: red;
        grid-area: x@y}
    }
  `}],
  mappings: {"$background: #ffffff": "var(--border-color)"},
  opts: {keep: true},
  expected: `
    @media (min-width: 777px) {
      a {
        color: blue;
        background: radial-gradient(var(--border-color) 40%, transparent 40%) no-repeat;
        border-color: rgb(var(--a), var(--b), var(--c));
        animation-name: constructor;
        constructor: red;
        grid-area: x@y;
      }
    }
`}));

test("unknown properties", makeTest({
  sources: [{css: `
    a {
      *background: red;
    }
  `}],
  mappings: {"$value: red": "green"},
  opts: {validate: true},
  expected: "",
}));

test("css vars", makeTest({
  sources: [{css: `
    a {
      --var: red;
    }
  `}],
  mappings: {"$value: red": "green"},
  opts: {validate: true},
  expected: `
    a {
      --var: green;
    }
`}));

test("css vars 2", makeTest({
  sources: [{css: `
    :root {
      --red: red;
      --blue: blue;
    }
    a {
      color: var(--red);
    }
    a.blue {
      color: var(--blue);
    }
  `}],
  mappings: {"$value: red": "green", "$value: blue": "yellow"},
  opts: {validate: true},
  expected: `
    :root {
      --red: green;
      --blue: yellow;
    }
`}));

const invalidPropertySources = [{css: `
    a {
      border: 1px solid red;
      *background: red;
      _background: red;
      !background: red;
    }
  `}];

test("invalid property - validate", makeTest({
  sources: invalidPropertySources,
  mappings: {"$value: red": "yellow"},
  opts: {validate: true},
  expected: `
    a {
      border-color: yellow;
    }
`}));

test("invalid property - no validate", makeTest({
  sources: invalidPropertySources,
  mappings: {"$value: red": "yellow"},
  expected: `
    a {
      border-color: yellow;
      *background-color: yellow;
      _background-color: yellow;
      !background: yellow;
    }
`}));

test("whitespace after uso var 2", makeTest({
  sources: [{css: `
    a {
      border-color: var(--border-color);
    }
  `}],
  mappings: {"$value: var(--border-color)": "var(--border-color)"},
  expected: `
    a {
      border-color: var(--border-color);
    }
`}));

test("selector split", makeTest({
  sources: [{css: `
    html.octotree-gh[data-octotree-theme]:not([data-octotree-theme=sidebar]) main [style="background: linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0));"], :is(.ignored, .kept) .a, :not(.b,.c), .w-1\\/2, .x\\>y, [title='a>b'], d>e {
      color: red;
    }
  `}],
  mappings: {"$value: red": "blue"},
  opts: {ignoreSelectors: [/\.ignored/], stylistic: true},
  expected: `
    .w-1\\/2, .x\\>y, :not(.b, .c), [title="a>b"], d > e,
    html.octotree-gh[data-octotree-theme]:not([data-octotree-theme=sidebar]) main [style="background: linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0));"] {
      color: blue;
    }
`}));
