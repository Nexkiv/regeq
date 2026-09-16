import { check } from "../src/engine/check";
import { RegexSyntaxError } from "../src/engine/syntax";

/** check() with witnesses joined into strings, for compact assertions. */
export function compare(r1: string, r2: string, sigma = "", limit?: number) {
  const r = check(r1, r2, sigma, limit);
  if (r.status !== "differ") return r;
  return { ...r, only1: r.only1?.join("") ?? null, only2: r.only2?.join("") ?? null };
}

/** The message and position of the RegexSyntaxError that `fn` throws. */
export function syntaxError(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof RegexSyntaxError) return { message: e.message, pos: e.pos };
    throw e;
  }
  throw new Error("expected a RegexSyntaxError");
}
