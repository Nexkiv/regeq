// The one entry point the UI uses: parse all three inputs, apply the alphabet rules, and compare.
import {
  buildNFA,
  findDistinguishingWords,
  lazyDFA,
  MAX_NFA_COST,
  MAX_STATE_PAIRS,
  nfaCost,
} from "./automata";
import { letters, parse, parseSigma, RegexSyntaxError, walk, type Node } from "./syntax";

export type Field = "r1" | "r2" | "sigma";
type FieldError = { field: Field; message: string; pos?: number };

export type CheckResult =
  /** Nothing to compare yet, or input errors; `message` explains what to do. */
  | { status: "prompt" | "invalid" | "tooBig"; message: string; errors: FieldError[] }
  | { status: "equal"; alphabet: string[]; explored: number; errors: [] }
  | {
      status: "differ";
      alphabet: string[];
      explored: number;
      /** Shortest strings in L(R₁) but not L(R₂), and vice versa; null if there are none. */
      only1: string[] | null;
      only2: string[] | null;
      /** The search hit the state-pair limit: the missing side is unknown, not proven empty. */
      partial: boolean;
      errors: [];
    };

const SIGMA_SEPARATORS = new Set([",", "{", "}"]);
export const LABEL: Record<Field, string> = { r1: "R₁", r2: "R₂", sigma: "Σ" };

export function check(
  r1: string,
  r2: string,
  sigmaText: string,
  limit = MAX_STATE_PAIRS,
): CheckResult {
  const errors: FieldError[] = [];
  const attempt = <T>(field: Field, fn: () => T): T | null => {
    try {
      return fn();
    } catch (e) {
      if (!(e instanceof RegexSyntaxError)) throw e;
      errors.push({ field, message: e.message, pos: e.pos });
      return null;
    }
  };
  const prompt = (message: string): CheckResult => ({ status: "prompt", message, errors });
  const invalid = (message: string): CheckResult => ({ status: "invalid", message, errors });

  const ast1 = r1.trim() ? attempt("r1", () => parse(r1)) : null;
  const ast2 = r2.trim() ? attempt("r2", () => parse(r2)) : null;
  // A Σ box with no letters (blank, or only separators like "{}") counts as empty.
  const parsedSigma = sigmaText.trim() ? attempt("sigma", () => parseSigma(sigmaText)) : null;
  const given = parsedSigma?.size ? parsedSigma : null;

  if (!r1.trim() && !r2.trim()) return prompt("Enter two regular expressions to compare them.");
  if (errors.some((e) => e.field === "sigma"))
    return invalid(`Fix the error in ${LABEL.sigma} to see a result.`);
  if (given)
    errors.push(
      ...foreignLetterErrors("r1", ast1, given),
      ...foreignLetterErrors("r2", ast2, given),
    );
  if (errors.length) return invalid(`Fix the error in ${which(errors)} to see a result.`);

  // Errors returned above, so a missing tree means a blank box.
  if (!ast1 || !ast2) return prompt(`Enter ${LABEL[ast1 ? "r2" : "r1"]} to compare.`);

  const alphabet = [
    ...(given ?? new Set([...letters(ast1), ...letters(ast2)].map((n) => n.c))),
  ].sort();

  const sigmaErrors = given ? [] : sigmaWithoutLetterErrors(alphabet, { r1: ast1, r2: ast2 });
  if (sigmaErrors.length)
    return {
      status: "invalid",
      message: "Enter an alphabet in the Σ box to see a result.",
      errors: sigmaErrors,
    };

  if ([ast1, ast2].some((ast) => nfaCost(ast, alphabet.length) > MAX_NFA_COST))
    return {
      status: "tooBig",
      message: "This expression is too large to check (too many repeats).",
      errors: [],
    };

  const { only1, only2, explored, cutOff } = findDistinguishingWords(
    lazyDFA(buildNFA(ast1, alphabet)),
    lazyDFA(buildNFA(ast2, alphabet)),
    alphabet,
    limit,
  );
  if (only1 || only2)
    return { status: "differ", alphabet, explored, only1, only2, partial: cutOff, errors: [] };
  if (cutOff)
    return {
      status: "tooBig",
      message: `These expressions are too large to check: the search reached ${formatCount(limit)} state pairs without finishing. Try shorter or simpler expressions.`,
      errors: [],
    };

  return { status: "equal", alphabet, explored, errors: [] };
}

/** "R₁", "R₂" or "both expressions", for the expression fields that have errors. */
function which(errors: FieldError[]): string {
  const fields = new Set(errors.map((e) => e.field));
  return fields.has("r1") && fields.has("r2") ? "both expressions" : LABEL[errors[0].field];
}

/** An error for the first letter of the expression that isn't in Σ, if any. */
function foreignLetterErrors(field: Field, ast: Node | null, sigma: Set<string>): FieldError[] {
  const bad = ast && letters(ast).find((n) => !sigma.has(n.c));
  if (!bad) return [];
  const message = SIGMA_SEPARATORS.has(bad.c)
    ? `“${bad.c}” isn't in Σ. In the Σ box, write it as \\${bad.c} (a plain ${bad.c} separates letters there).`
    : `“${visible(bad.c)}” isn't in Σ. Add it to Σ, or clear Σ to use the letters in the expressions.`;
  return [{ field, message, pos: bad.pos }];
}

/** Errors pointing at each Σ that has no letters to stand for (an inferred, empty alphabet). */
function sigmaWithoutLetterErrors(
  alphabet: string[],
  asts: Record<"r1" | "r2", Node>,
): FieldError[] {
  if (alphabet.length) return [];
  return (["r1", "r2"] as const).flatMap((field) => {
    const sigma = [...walk(asts[field])].find((n) => n.type === "any");
    if (!sigma) return [];
    const message = "Σ has no letters to stand for, because neither expression contains a letter.";
    return [{ field, message, pos: sigma.pos }];
  });
}

/** Makes whitespace visible in messages and witnesses: ␣ for a space, U+XXXX for others. */
export function visible(c: string): string {
  if (c === " ") return "␣";
  if (!/\s/.test(c)) return c;
  return "U+" + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
}

/** Formats counts the same way everywhere, whatever the browser's locale. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
