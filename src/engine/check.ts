// The one entry point the UI uses: parse all three inputs, apply the alphabet rules, and compare.
import {
  buildNFA,
  findDistinguishingWords,
  lazyDFA,
  MAX_NFA_COST,
  MAX_STATE_PAIRS,
  nfaCost,
} from "./automata";
import { letters, parse, parseSigma, RegexSyntaxError, type Node } from "./syntax";

export type Field = "r1" | "r2" | "sigma";
export type FieldError = { field: Field; message: string; pos?: number };

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
      errors: [];
    };

const LABEL: Record<Field, string> = { r1: "R₁", r2: "R₂", sigma: "Σ" };

export function check(
  r1: string,
  r2: string,
  sigmaText: string,
  limit = MAX_STATE_PAIRS,
): CheckResult {
  if (!r1.trim() && !r2.trim())
    return {
      status: "prompt",
      message: "Enter two regular expressions to compare them.",
      errors: [],
    };

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

  let ast1 = attempt("r1", () => parse(r1));
  let ast2 = attempt("r2", () => parse(r2));
  const given = sigmaText.trim() ? attempt("sigma", () => parseSigma(sigmaText)) : null;
  if (errors.some((e) => e.field === "sigma"))
    return { status: "invalid", message: "Fix the error in Σ to see a result.", errors };

  // With Σ given, every letter in the expressions must belong to it.
  if (given) {
    const foreign = (ast: Node | null, field: Field) => {
      const bad = ast && [...letters(ast)].find((n) => !given.has(n.c));
      if (!bad) return ast;
      errors.push({
        field,
        message: `“${visible(bad.c)}” isn't in Σ. Add it to Σ, or clear Σ to use the letters in the expressions.`,
        pos: bad.pos,
      });
      return null;
    };
    ast1 = foreign(ast1, "r1");
    ast2 = foreign(ast2, "r2");
  }

  if (!ast1 || !ast2) {
    const broken = (["r1", "r2"] as const).filter((f) => errors.some((e) => e.field === f));
    const which = broken.length === 2 ? "both expressions" : LABEL[broken[0]];
    return { status: "invalid", message: `Fix the error in ${which} to see a result.`, errors };
  }

  const alphabet = [
    ...(given ?? new Set([...letters(ast1), ...letters(ast2)].map((n) => n.c))),
  ].sort();

  if (nfaCost(ast1) > MAX_NFA_COST || nfaCost(ast2) > MAX_NFA_COST)
    return {
      status: "tooBig",
      message: "This expression is too large to check (too many repeats).",
      errors: [],
    };

  const search = findDistinguishingWords(
    lazyDFA(buildNFA(ast1, alphabet)),
    lazyDFA(buildNFA(ast2, alphabet)),
    alphabet,
    limit,
  );
  if (search.cutOff)
    return {
      status: "tooBig",
      message: `These expressions are too large to check: the combined automaton passes ${limit.toLocaleString("en-US")} states. Try smaller repeat counts.`,
      errors: [],
    };

  const { only1, only2, explored } = search;
  if (!only1 && !only2) return { status: "equal", alphabet, explored, errors: [] };
  return { status: "differ", alphabet, explored, only1, only2, errors: [] };
}

/** Shows a space as ␣ so it is visible in messages and witnesses. */
export const visible = (c: string) => (c === " " ? "␣" : c);
