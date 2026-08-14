import type { Manipulator } from "../../types/karabiner";
import { SHELL_ENV } from "../../data/constants/env";

export { SHELL_ENV };

/**
 * Encloses a string in quotes (single or double), escaping internal quote characters.
 */
export function wrapQuotes(str: string, useSingle: boolean = false): string {
  if (useSingle) {
    return `'${str.replace(/'/g, "'\"'\"'")}'`;
  }
  return `"${str.replace(/"/g, '\\"')}"`;
}

/**
 * Formats path strings containing environment variables so that variable references
 * (e.g. $HOME, ${HOME}, $XDG_CONFIG_HOME) remain outside single quotes for shell expansion.
 * Accepts environment variable names with or without the preceding `$`.
 */
export function formatPathWithEnvVars(
  pathStr: string,
  envVars: string[] = SHELL_ENV
): string {
  let clean = pathStr;
  if (clean.startsWith("~/")) {
    clean = `$HOME/${clean.slice(2)}`;
  }

  const names = envVars.map((v) => (v.startsWith("$") ? v.slice(1) : v));

  const hasEnvVar = names.some(
    (name) => clean.includes(`$${name}`) || clean.includes(`\${${name}}`)
  );

  if (!hasEnvVar) {
    return wrapQuotes(clean, true);
  }

  let quoted = `'${clean.replace(/'/g, "'\"'\"'")}'`;

  for (const name of names) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dollarRegex = new RegExp(`\\$${escapedName}\\b`, "g");
    const bracedRegex = new RegExp(`\\$\\{${escapedName}\\}`, "g");

    quoted = quoted
      .replace(dollarRegex, "'$$" + name + "'")
      .replace(bracedRegex, "'$${" + name + "}'");
  }

  quoted = quoted
    .replace(/^''/, "")
    .replace(/''$/, "")
    .replace(/''/g, "");

  return quoted;
}

/** Helper to format path strings containing $HOME or ${HOME} so the env var is outside quotes. */
export function formatPathWithHome(pathStr: string): string {
  return formatPathWithEnvVars(pathStr, ["HOME"]);
}

/** Encloses a string in single quotes, escaping internal single quotes. */
export function shellSingleQuote(str: string): string {
  const norm = normalizeShellPath(str);
  if (SHELL_ENV.some((v) => norm.includes(`$${v.replace(/^\$/, "")}`))) {
    return formatPathWithEnvVars(norm);
  }
  return wrapQuotes(norm, true);
}

/** Encloses a string in double quotes, escaping internal double quotes. */
export function shellDoubleQuote(str: string): string {
  return wrapQuotes(str, false);
}

/** Normalizes a shell file-system path by expanding leading `~/` to `$HOME/`. */
export function normalizeShellPath(inputPath: string): string {
  if (inputPath.startsWith("~/")) {
    return `$HOME/${inputPath.slice(2)}`;
  }
  return inputPath;
}

/** Normalizes and quotes a file-system path for shell execution. */
export function normalizePathForShell(path: string): string {
  const norm = normalizeShellPath(path);
  if (SHELL_ENV.some((v) => norm.includes(`$${v.replace(/^\$/, "")}`))) {
    return formatPathWithEnvVars(norm);
  }
  return shellDoubleQuote(norm);
}

/** Checks whether a shell command token represents a file-system path. */
export function isPathToken(token: string): boolean {
  const clean = token.replace(/^['"]+|['"]+$/g, "");
  if (!clean) return false;

  if (
    clean.startsWith("/") ||
    clean.startsWith("~/") ||
    clean === "~" ||
    clean.startsWith("$") ||
    clean.startsWith("./") ||
    clean.startsWith("../")
  ) {
    return true;
  }

  if (
    clean.includes("/") &&
    !clean.includes("://") &&
    !clean.startsWith("-") &&
    !/\s\/\s/.test(clean)
  ) {
    return true;
  }

  return false;
}

/**
 * Splits a shell command string into discrete tokens (arguments, operators, whitespace),
 * preserving single and double quoted argument boundaries.
 */
export function tokenizeShellCommand(cmdStr: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < cmdStr.length; i++) {
    const char = cmdStr[i]!;
    const prevChar = i > 0 ? cmdStr[i - 1]! : "";

    if (char === "'" && !inDouble && prevChar !== "\\") {
      inSingle = !inSingle;
      current += char;
    } else if (char === '"' && !inSingle && prevChar !== "\\") {
      inDouble = !inDouble;
      current += char;
    } else if (/\s/.test(char) && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      tokens.push(char);
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Ensures that any file-system paths in a shell command string are enclosed in a single set of quotes,
 * removing duplicate/nested quoting and adding missing quotes to unquoted paths.
 */
export function ensurePathQuotingInCommand(
  commandStr: string,
  envVars: string[] = SHELL_ENV
): string {
  if (!commandStr) return commandStr;

  const tokens = tokenizeShellCommand(commandStr);
  const normalizedTokens = tokens.map((token) => {
    if (/^\s+$/.test(token) || /^(&&|\|\||;|\|)$/.test(token)) {
      return token;
    }

    const leadingMatch = token.match(/^['"]+/);
    const trailingMatch = token.match(/['"]+$/);

    const leadingQuotes = leadingMatch ? leadingMatch[0] : "";
    const trailingQuotes = trailingMatch ? trailingMatch[0] : "";

    const inner = token.slice(
      leadingQuotes.length,
      token.length - trailingQuotes.length
    );

    if (!isPathToken(inner) && !isPathToken(token)) {
      return token;
    }

    const names = envVars.map((v) => (v.startsWith("$") ? v.slice(1) : v));
    const hasEnvVar = names.some(
      (name) => inner.includes(`$${name}`) || inner.includes(`\${${name}}`)
    );

    if (hasEnvVar || inner.startsWith("~/")) {
      return formatPathWithEnvVars(inner, envVars);
    }

    if (
      leadingQuotes.length === 1 &&
      trailingQuotes.length === 1 &&
      leadingQuotes === trailingQuotes
    ) {
      return token;
    }

    return `"${inner}"`;
  });

  return normalizedTokens.join("");
}

/**
 * Recursively visits all `shell_command` properties across any data structure
 * (Manipulators, ToEvents, Actions, Cases, Bindings) and applies the transformer.
 */
export function transformShellCommands<T>(
  node: T,
  transformer: (cmd: string) => string,
): T {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((item) => transformShellCommands(item, transformer)) as unknown as T;
  }

  const record = node as Record<string, unknown>;
  const result: Record<string, unknown> = { ...record };
  for (const key of Object.keys(result)) {
    if (key === "shell_command" && typeof result[key] === "string") {
      result[key] = transformer(result[key] as string);
    } else if (result[key] && typeof result[key] === "object") {
      result[key] = transformShellCommands(result[key], transformer);
    }
  }

  return result as T;
}

/**
 * Ensures that any file-system paths in manipulators (or any AST nodes) are enclosed in a single set of quotes.
 */
export function ensurePathQuotingInManipulators<
  T extends Manipulator | Manipulator[]
>(input: T): T {
  return transformShellCommands(input, ensurePathQuotingInCommand);
}

export const ensurePathQuoting = ensurePathQuotingInManipulators;
