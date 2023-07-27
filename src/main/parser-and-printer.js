import { ConfigError } from "../common/errors.js";

// TODO: Improve coverage

function getParserPluginByParserName(plugins, parserName) {
  /* c8 ignore start */
  if (!parserName) {
    throw new Error("parserName is required.");
  }
  /* c8 ignore stop */

  /*
  Loop from end to allow plugins override builtin plugins,
  this is how `resolveParser` works in v2.
  This is a temporarily solution, see #13729
  */
  for (let index = plugins.length - 1; index >= 0; index--) {
    const plugin = plugins[index];
    if (plugin.parsers && Object.hasOwn(plugin.parsers, parserName)) {
      return plugin;
    }
  }

  /* c8 ignore start */
  let message = `Couldn't resolve parser "${parserName}".`;
  if (process.env.PRETTIER_TARGET === "universal") {
    message += " Plugins must be explicitly added to the standalone bundle.";
  }

  throw new ConfigError(message);
  /* c8 ignore stop */
}

function getPrinterPluginByAstFormat(plugins, astFormat) {
  /* c8 ignore start */
  if (!astFormat) {
    throw new Error("astFormat is required.");
  }
  /* c8 ignore stop */

  // Loop from end to consistent with parser resolve logic
  for (let index = plugins.length - 1; index >= 0; index--) {
    const plugin = plugins[index];
    if (plugin.printers && Object.hasOwn(plugin.printers, astFormat)) {
      return plugin;
    }
  }

  /* c8 ignore start */
  let message = `Couldn't find plugin for AST format "${astFormat}".`;
  if (process.env.PRETTIER_TARGET === "universal") {
    message += " Plugins must be explicitly added to the standalone bundle.";
  }

  throw new ConfigError(message);
  /* c8 ignore stop */
}

function getVisitorsByAstFormat(plugins, astFormat) {
  /* c8 ignore start */
  if (!astFormat) {
    throw new Error("astFormat is required.");
  }
  /* c8 ignore stop */

  // Having no visitor plugins for a given AST is okay
  plugins = plugins.filter(
    (plugin) => plugin.visitors && Object.hasOwn(plugin.visitors, astFormat),
  );

  return plugins.map((plugin) => plugin.visitors[astFormat]);
}

function resolveParser({ plugins, parser }) {
  const plugin = getParserPluginByParserName(plugins, parser);
  return initParser(plugin, parser);
}

async function resolveVisitors(plugins, astFormat) {
  let visitors = getVisitorsByAstFormat(plugins, astFormat);
  visitors = await Promise.all(visitors.map(initVisitor));
  return visitors.flat();
}

function initParser(plugin, parserName) {
  const parserOrParserInitFunction = plugin.parsers[parserName];
  return typeof parserOrParserInitFunction === "function"
    ? parserOrParserInitFunction()
    : parserOrParserInitFunction;
}

function initPrinter(plugin, astFormat) {
  const printerOrPrinterInitFunction = plugin.printers[astFormat];
  return typeof printerOrPrinterInitFunction === "function"
    ? printerOrPrinterInitFunction()
    : printerOrPrinterInitFunction;
}

function initVisitor(visitorOrVisitorInitFunction) {
  return typeof visitorOrVisitorInitFunction === "function"
    ? visitorOrVisitorInitFunction()
    : visitorOrVisitorInitFunction;
}

export {
  getParserPluginByParserName,
  getPrinterPluginByAstFormat,
  resolveParser,
  resolveVisitors,
  initParser,
  initPrinter,
};
