const rules = require("./rules");
const { colorize } = require("clio-highlight");
const chalk = require("chalk");

const unfinished = [
  "blockOpen",
  "addLhs",
  "mulLhs",
  "subLhs",
  "divLhs",
  "powLhs",
  "comparisonOpen",
  "logicalOpen",
  "export",
  "fnOpen",
];

const addLineNumber = (start, length) => (line, index) =>
  " " + (index + start + 1).toString().padStart(length, " ") + " | " + line;

const getMessage = ({ file, line, start, column, source, expecting, rhs }) => {
  const rawCode = source.split("\n").slice(start, line).join("\n");
  const highlighted = colorize(rawCode);
  const encountered = chalk.red(getRuleName(rhs.item.type));
  const lines = highlighted.split("\n");
  const { length } = (start + 1 + lines.length).toString();
  const code = lines.map(addLineNumber(start, length)).join("\n");
  const parseError = `Expecting one of:\n\n${expecting}\n\nbut encountered ${encountered}`;
  const message = [
    `Parsing error at ${file}[${line}:${column}]\n`,
    code,
    " ".repeat(column + length + 4) + "^",
    `\n${parseError}`,
  ].join("\n");
  return { message, parseError };
};

const getImportErrorMessage = ({
  file,
  line,
  start,
  column,
  source,
  importError,
}) => {
  const rawCode = source.split("\n").slice(start, line).join("\n");
  const highlighted = colorize(rawCode);
  const lines = highlighted.split("\n");
  const { length } = (start + 1 + lines.length).toString();
  const code = lines.map(addLineNumber(start, length)).join("\n");
  const message = [
    `Import error at ${file}[${line}:${column}]\n`,
    code,
    " ".repeat(column + length + 4) + "^",
    `\n${importError}`,
  ].join("\n");
  return { message };
};

class ParsingError extends Error {
  constructor(meta) {
    const { message, parseError } = getMessage(meta);
    super(message);
    this.meta = meta;
    this.meta.message = message;
    this.meta.parseError = parseError;
  }
}

class ImportError extends Error {
  constructor(meta) {
    const { message } = getImportErrorMessage(meta);
    super(message);
    this.meta = meta;
    this.meta.message = message;
  }
}
class LexingError extends Error {
  constructor(meta) {
    super(meta.message);
    this.meta = meta;
  }
}

const findFirstUnfinished = (tokens) => {
  let lhs = tokens.first;
  let rhs = tokens.first.next;
  const step = () => {
    lhs = rhs;
    rhs = lhs.next;
  };
  while (rhs.next && !unfinished.includes(lhs.item.type)) step();
  if (rhs.item.type === "clio" && rhs.item.content[0]) {
    const { meta } = rhs.item;
    const { node } = rhs.item.content[0];
    rhs = { meta, item: node };
  }
  return { lhs, rhs };
};

const ruleNames = {
  lineBreak: "White Space",
  ranger: "Range",
  rangeFull: "Range",
  rangeBy: "Range",
  byRange: "Range",
  formattedString: "String",
  hashmap: "Hash Map",
  propertyAccess: "Property",
  inCheck: "In Check",
  parallelFn: "Parallel Function",
};

const ruleGroups = {
  true: "Built-ins",
  false: "Built-ins",
  null: "Built-ins",
  string: "Primitives",
  formattedString: "Primitives",
  number: "Primitives",
  array: "Structural",
  set: "Structural",
  hashmap: "Structural",
  slice: "Structural",
  range: "Structural",
  ranger: "Structural",
  rangeFull: "Structural",
  rangeBy: "Structural",
  byRange: "Structural",
  symbol: "Names",
  propertyAccess: "Names",
  parameter: "Names",
};

const titleCase = (name) => name[0].toUpperCase() + name.slice(1);
const getRuleName = (rule) => ruleNames[rule] || titleCase(rule);

const formatExpectedRules = (expectedRules) => {
  const groups = {};
  for (const rule of expectedRules) {
    const name = getRuleName(rule);
    const group = ruleGroups[rule] || "Other";
    if (!groups[group]) {
      groups[group] = [name];
    } else if (!groups[group].includes(name)) {
      groups[group].push(name);
    }
  }
  return Object.entries(groups)
    .sort(([groupA], [groupB]) => {
      if (groupB === "Other") {
        return -Infinity;
      }
      return groupA.localeCompare(groupB);
    })
    .map(([group, rules]) => {
      const groupText = chalk.bold(group);
      const rulesText = rules.sort().join(", ");
      return `  ${groupText}:\t${rulesText}`;
    })
    .join("\n");
};

const parsingError = (source, file, tokens) => {
  const { lhs, rhs } = findFirstUnfinished(tokens);
  const expectedRules = Object.keys(rules[lhs.item.type] || {});
  const expecting = formatExpectedRules(expectedRules);
  const start = Math.max(0, rhs.item.line - 3);
  const location = rhs.item.meta?.location || rhs.item;
  const { line, column } = location;
  return new ParsingError({
    file,
    line,
    start,
    column,
    source,
    expecting,
    rhs,
  });
};

const importError = (source, file, error) => {
  const { line, column } = error.meta;
  const importError = error.meta.message;
  const start = Math.max(0, line - 3);
  return new ImportError({
    source,
    file,
    line,
    column,
    importError,
    start,
  });
};

module.exports.importError = importError;
module.exports.ImportError = ImportError;
module.exports.parsingError = parsingError;
module.exports.ParsingError = ParsingError;
module.exports.LexingError = LexingError;
