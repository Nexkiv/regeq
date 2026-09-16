// Characterization tests: they pin the behavior of the engine as ported from the single-file page.
import { describe, expect, it } from "vitest";
import { buildNFA, compare, lazyDFA } from "../src/engine/automata";
import { firstForeign, parse, parseSigma, symbols } from "../src/engine/syntax";

/** Mirrors the page's comparison logic; returns the witnesses as strings. */
function run(r1: string, r2: string, sigma = "") {
  const a = parse(r1);
  const b = parse(r2);
  const given = sigma.trim() ? parseSigma(sigma) : null;
  const alphabet = [...(given ?? symbols(a, symbols(b, new Set())))].sort();
  const res = compare(lazyDFA(buildNFA(a, alphabet)), lazyDFA(buildNFA(b, alphabet)), alphabet);
  if (res.tooBig) return { tooBig: true };
  return {
    only1: res.only1 && res.only1.join(""),
    only2: res.only2 && res.only2.join(""),
    alphabet,
  };
}

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected an error");
};

describe("equivalence", () => {
  it.each([
    ["(0|1)*0", "(1*0)+"],
    ["(0|ε)1*", "0?1*"],
    ["Σ*1Σ*", "0*1(0|1)*"],
    ["1^{2}3", "113"],
    ["1^2 3", "113"],
    ["(01)*", "0(10)*1|"],
    ["()", "ε"],
    ["a|", "a?"],
    ["Σ^2", "(0|1)(0|1)"],
    ["\\*\\|", "(\\*)(\\|)"],
  ])("%s = %s", (r1, r2) => {
    expect(run(r1, r2)).toMatchObject({ only1: null, only2: null });
  });

  it("finds a shortest witness on each side", () => {
    expect(run("0*", "1*")).toMatchObject({ only1: "0", only2: "1" });
  });

  it("reports a proper subset with one witness", () => {
    expect(run("(0|1)*", "0*1*")).toMatchObject({ only1: "10", only2: null });
    expect(run("0*1*", "(0|1)*")).toMatchObject({ only1: null, only2: "10" });
  });

  it("picks the alphabetically first witness among the shortest", () => {
    expect(run("(0|1)^3", "000|001|010|011|100|101|110")).toMatchObject({ only1: "111" });
    expect(run("(a|b)(a|b)", "bb")).toMatchObject({ only1: "aa" });
  });

  it("uses ε as a witness", () => {
    expect(run("0*", "0+")).toMatchObject({ only1: "", only2: null });
  });

  it("uses an explicit Σ", () => {
    expect(run("Σ*", "0*")).toMatchObject({ only1: null, only2: null, alphabet: ["0"] });
    expect(run("Σ*", "0*", "0, 1")).toMatchObject({ only1: "1", alphabet: ["0", "1"] });
    expect(run("Σ", "0|1|2", "{0 1 2}")).toMatchObject({ only1: null, only2: null });
  });

  it("gives up past the state-pair limit", () => {
    expect(run("(0|1)*1(0|1)^17", "(0|1)*1(0|1)^17|2")).toEqual({ tooBig: true });
  });
});

describe("parse errors", () => {
  it.each([
    ["a\\", "A backslash needs a character after it.", 1],
    ["a^", "^ must be followed by a count, like ^3 or ^{3}.", 2],
    ["a^{3", "Expected a number and a closing } after ^{.", 4],
    ["a^5001", "Repeat counts above 5000 aren't supported.", 1],
    ["(a", "This ( is never closed.", 0],
    ["a)", "This ) has no matching (.", 1],
    ["*a", "“*” needs something before it to apply to.", 0],
    ["εε(Σ", "This ( is never closed.", 2],
  ])("%s", (src, msg, pos) => {
    expect(errorOf(() => parse(src))).toEqual({ msg, pos });
  });

  it("counts positions in code points", () => {
    expect(errorOf(() => parse("𝔸)"))).toEqual({ msg: "This ) has no matching (.", pos: 1 });
  });

  it("refuses huge expressions", () => {
    expect(errorOf(() => buildNFA(parse("(a^5000)^5000"), ["a"]))).toEqual({
      msg: "This expression is too large to check (too many repeats).",
    });
  });
});

describe("Σ box", () => {
  it("accepts commas, spaces, braces and escapes", () => {
    expect([...parseSigma("{0, 1 2,\\,}")]).toEqual(["0", "1", "2", ","]);
  });

  it.each([
    ["ε", "ε can't be a letter here. Write \\ε for a literal ε.", 0],
    ["0, Σ", "Σ can't be a letter here. Write \\Σ for a literal Σ.", 3],
    ["0\\", "A backslash needs a character after it.", 1],
  ])("rejects %s", (src, msg, pos) => {
    expect(errorOf(() => parseSigma(src))).toEqual({ msg, pos });
  });

  it("finds the first letter outside Σ", () => {
    expect(firstForeign(parse("0(1|2)3"), new Set(["0", "1"]))).toEqual({
      type: "sym",
      c: "2",
      pos: 4,
    });
    expect(firstForeign(parse("0*1"), new Set(["0", "1"]))).toBeNull();
  });
});
