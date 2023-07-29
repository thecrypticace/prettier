import prettier from "../../config/prettier-entry.js";

test("Visitors can modify the text before its passed to parse", async () => {
  function append(text) {
    return {
      beforeParse: (raw) => `${raw}${text}`,
    };
  }

  expect([
    await prettier.format("bar", {
      plugins: [
        { visitors: { "baz-ast": [append("0")] } },
        {
          parsers: {
            baz: {
              parse: (text) => ({ foo: text }),
              astFormat: "baz-ast",
            },
          },
          visitors: { "baz-ast": [append("1")] },
          printers: { "baz-ast": { print: (ast) => ast.getNode().foo } },
        },
        { visitors: { "baz-ast": [append("2")] } },
        { visitors: { "baz-ast": [append("3")] } },
      ],
      parser: "baz",
    }),
  ]).toEqual(["bar0123"]);
});

test("Visitors can modify the AST", async () => {
  function append(text) {
    return {
      afterParse: (ast) => {
        ast.foo += text;
      },
    };
  }

  expect([
    await prettier.format(".", {
      plugins: [
        { visitors: { "baz-ast": [append("0")] } },
        {
          parsers: {
            baz: { parse: () => ({ foo: "bar" }), astFormat: "baz-ast" },
          },
          visitors: { "baz-ast": [append("1")] },
          printers: { "baz-ast": { print: (ast) => ast.getNode().foo } },
        },
        { visitors: { "baz-ast": [append("2")] } },
        { visitors: { "baz-ast": [append("3")] } },
      ],
      parser: "baz",
    }),
  ]).toEqual(["bar0123"]);
});

test("Visitors can completely replace the AST", async () => {
  function wrapIn(key) {
    return { afterParse: (ast) => ({ [key]: ast }) };
  }

  expect([
    await prettier.format(".", {
      plugins: [
        { visitors: { "baz-ast": [wrapIn("foo")] } },
        {
          parsers: { baz: { parse: () => ({}), astFormat: "baz-ast" } },
          visitors: { "baz-ast": [wrapIn("bar")] },
          printers: {
            "baz-ast": { print: (ast) => JSON.stringify(ast.getNode()) },
          },
        },
        { visitors: { "baz-ast": [wrapIn("baz")] } },
        { visitors: { "baz-ast": [wrapIn("qux")] } },
      ],
      parser: "baz",
    }),
  ]).toEqual(['{"qux":{"baz":{"bar":{"foo":{}}}}}']);
});

test("Visitors can modify existing options before being passed to the printer", async () => {
  function append(text) {
    return {
      afterParse: (_, opts) => {
        opts.originalText += text;
      },
    };
  }

  expect([
    await prettier.format(".", {
      plugins: [
        { visitors: { "baz-ast": [append("0")] } },
        {
          parsers: { baz: { parse: () => ({}), astFormat: "baz-ast" } },
          visitors: { "baz-ast": [append("1")] },
          printers: { "baz-ast": { print: (_, opts) => opts.originalText } },
        },
        { visitors: { "baz-ast": [append("2")] } },
        { visitors: { "baz-ast": [append("3")] } },
      ],
      parser: "baz",
    }),
  ]).toEqual([".0123"]);
});

test("Visitors work on embedded documents", async () => {
  expect([
    await prettier.format(
      `<template><div :style="{foo:bar}"></div></template>`,
      {
        parser: "vue",
        plugins: [
          {
            visitors: {
              estree: [
                {
                  beforeParse: (text) => text.toLocaleUpperCase(),
                  afterParse: (ast) => {
                    ast.node.properties[0].value.name = "baz";
                  },
                },
              ],
            },
          },
        ],
      },
    ),
  ]).toEqual([`<template><div :style=\"{ FOO: baz }\"></div></template>\n`]);
});

test("Visitors can require a specific parser or parent parser", async () => {
  let input = `# Title

\`\`\`js
let test = {foo:bar};
\`\`\`

\`\`\`vue
<template><div :style="{foo:bar}"></div></template>
\`\`\`
`;
  let output = `# Title

\`\`\`js
let test = { foo: baz };
\`\`\`

\`\`\`vue
<template><div :style="{ foo: qux }"></div></template>
\`\`\`
`;

  expect([
    await prettier.format(input, {
      parser: "markdown",
      plugins: [
        {
          visitors: {
            estree: [
              // markdown -> code block (js)
              {
                parser: "babel",
                afterParse: (ast) => {
                  ast.program.body[0].declarations[0].init.properties[0].value.name =
                    "baz";
                },
              },

              // markdown -> code block (vue) -> :style expression
              {
                parentParser: "vue",
                afterParse: (ast) => {
                  ast.node.properties[0].value.name = "qux";
                },
              },
            ],
          },
        },
      ],
    }),
  ]).toEqual([output]);
});
