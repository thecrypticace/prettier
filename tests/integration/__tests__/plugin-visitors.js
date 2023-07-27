import prettier from "../../config/prettier-entry.js";

test("Visitors from the same plugin can modify the AST", async () => {
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
        {
          parsers: {
            baz: { parse: () => ({ foo: "bar" }), astFormat: "baz-ast" },
          },
          visitors: { "baz-ast": append("1") },
          printers: { "baz-ast": { print: (ast) => ast.getNode().foo } },
        },
      ],
      parser: "baz",
    }),
  ]).toEqual(["bar1"]);
});

test("Visitors from other plugins can modify the AST", async () => {
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
        {
          parsers: {
            baz: { parse: () => ({ foo: "bar" }), astFormat: "baz-ast" },
          },
          printers: { "baz-ast": { print: (ast) => ast.getNode().foo } },
        },
        { visitors: { "baz-ast": append("1") } },
        { visitors: { "baz-ast": append("2") } },
      ],
      parser: "baz",
    }),
  ]).toEqual(["bar12"]);
});

test("Visitors can completely replace the AST", async () => {
  function wrapIn(key) {
    return { afterParse: (ast) => ({ [key]: ast }) };
  }

  expect([
    await prettier.format(".", {
      plugins: [
        {
          parsers: { baz: { parse: () => ({}), astFormat: "baz-ast" } },
          printers: {
            "baz-ast": { print: (ast) => JSON.stringify(ast.getNode()) },
          },
        },
        { visitors: { "baz-ast": wrapIn("foo") } },
        { visitors: { "baz-ast": wrapIn("bar") } },
      ],
      parser: "baz",
    }),
  ]).toEqual(['{"bar":{"foo":{}}}']);
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
        {
          parsers: { baz: { parse: () => ({}), astFormat: "baz-ast" } },
          printers: { "baz-ast": { print: (_, opts) => opts.originalText } },
        },
        { visitors: { "baz-ast": append("1") } },
        { visitors: { "baz-ast": append("2") } },
      ],
      parser: "baz",
    }),
  ]).toEqual([".12"]);
});

test("Visitors can require a specific parser", async () => {
  expect([
    await prettier.format(`<template><div>test</div></template>`, {
      parser: "vue",
      plugins: [
        {
          visitors: {
            html: {
              parser: "vue",
              afterParse: (ast) => {
                ast.children[0].children[0].name = "span";
              },
            },
          },
        },
      ],
    }),
  ]).toEqual([`<template><span>test</span></template>\n`]);
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
              estree: {
                parentParser: "vue",
                afterParse: (ast) => {
                  ast.node.properties[0].value.name = "baz";
                },
              },
            },
          },
        ],
      },
    ),
  ]).toEqual([`<template><div :style=\"{ foo: baz }\"></div></template>\n`]);
});
