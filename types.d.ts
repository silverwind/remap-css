declare module "css-selector-splitter" {
  /** Split a CSS selector string into its top-level comma-separated parts. */
  export default function splitSelectors(selector: string): Array<string>;
}

declare module "css-selector-tokenizer" {
  interface SelectorNode {
    type?: string,
    name?: string,
    nodes: Array<SelectorNode>,
  }
  interface ParseResult {
    type: string,
    nodes: Array<SelectorNode>,
  }
  export function parse(selector: string): ParseResult;
  const cssSelectorTokenizer: {
    parse: typeof parse,
  };
  export default cssSelectorTokenizer;
}

declare module "css-shorthand-properties" {
  /** Whether the given property is a CSS shorthand property. */
  export function isShorthand(property: string): boolean;
}

declare module "csstree-validator" {
  interface ValidationError {
    name: string,
    message: string,
    property?: string,
  }
  /** Validate a CSS string, returning an array of errors. */
  export function validate(css: string, filename?: string): Array<ValidationError>;
}

declare module "perfectionist" {
  interface PerfectionistOptions {
    cascade?: boolean,
    colorShorthand?: boolean,
    indentSize?: number,
    maxAtRuleLength?: number | false,
    maxSelectorLength?: number | false,
    maxValueLength?: number | false,
    trimLeadingZero?: boolean,
    trimTrailingZeros?: boolean,
    zeroLengthNoUnit?: boolean,
  }
  interface PerfectionistResult {
    css: string,
  }
  const perfectionist: {
    process(css: string, options?: PerfectionistOptions): Promise<PerfectionistResult>,
  };
  export default perfectionist;
}

declare module "split-string" {
  interface SplitStringOptions {
    brackets?: Record<string, string> | boolean,
    quotes?: Array<string> | boolean,
    separator?: string,
    strict?: boolean,
  }
  /** Split a string on a separator, respecting quotes and brackets. */
  export default function splitString(input: string, options?: SplitStringOptions): Array<string>;
}

declare module "postcss-safe-parser" {
  import type {Parser, Root} from "postcss";
  const parse: Parser<Root>;
  export default parse;
}

declare module "postcss-value-parser" {
  export interface ValueNode {
    type: string,
    value: string,
    before?: string,
    after?: string,
    nodes: Array<ValueNode>,
    sourceIndex?: number,
  }
  export interface ParsedValue {
    nodes: Array<ValueNode>,
  }
  interface PostcssValueParser {
    (value: string): ParsedValue,
    walk(nodes: Array<ValueNode>, callback: (node: ValueNode, index: number, nodes: Array<ValueNode>) => boolean | void, bubble?: boolean): void,
    stringify(nodes: ValueNode | Array<ValueNode>, custom?: (node: ValueNode) => string | undefined): string,
  }
  const postcssValueParser: PostcssValueParser;
  export default postcssValueParser;
}
