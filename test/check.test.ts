import { describe, expect, it } from "vitest";
import { buildNFA, lazyDFA, nfaCost } from "../src/engine/automata";
import { check } from "../src/engine/check";
import { parse } from "../src/engine/syntax";
import { EXAMPLES } from "../src/examples";
import { compare } from "./helpers";

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
    ["a^0b", "b"],
  ])("%s = %s", (r1, r2) => {
    expect(compare(r1, r2)).toMatchObject({ status: "equal" });
  });

  it("finds a shortest witness on each side", () => {
    expect(compare("0*", "1*")).toMatchObject({
      status: "differ",
      partial: false,
      only1: "0",
      only2: "1",
    });
  });

  it("reports a proper subset in either direction", () => {
    expect(compare("(0|1)*", "0*1*")).toMatchObject({ only1: "10", only2: null });
    expect(compare("0*1*", "(0|1)*")).toMatchObject({ only1: null, only2: "10" });
  });

  it("picks the alphabetically first witness among the shortest", () => {
    expect(compare("(0|1)^3", "000|001|010|011|100|101|110")).toMatchObject({ only1: "111" });
    expect(compare("(a|b)(a|b)", "bb")).toMatchObject({ only1: "aa" });
  });

  it("uses ε as a witness", () => {
    expect(compare("0*", "0+")).toMatchObject({ only1: "", only2: null });
  });

  it("counts explored state pairs", () => {
    expect(check("0", "0", "")).toMatchObject({ status: "equal", explored: 3 });
  });
});

describe("alphabet", () => {
  it("is inferred from both expressions when Σ is empty", () => {
    expect(compare("Σ*", "0*")).toMatchObject({ status: "equal", alphabet: ["0"] });
    expect(compare("b", "a|c")).toMatchObject({ alphabet: ["a", "b", "c"] });
  });

  it("comes from the Σ box when given", () => {
    expect(compare("Σ*", "0*", "0, 1")).toMatchObject({ only1: "1", alphabet: ["0", "1"] });
    expect(compare("Σ", "0|1|2", "{0 1 2}")).toMatchObject({ status: "equal" });
  });

  it("rejects letters that are not in Σ", () => {
    expect(check("0(1|2)3", "0", "0, 1")).toEqual({
      status: "invalid",
      message: "Fix the error in R₁ to see a result.",
      errors: [
        {
          field: "r1",
          message: "“2” isn't in Σ. Add it to Σ, or clear Σ to use the letters in the expressions.",
          pos: 4,
        },
      ],
    });
  });

  it("infers Σ when the box has no letters", () => {
    expect(compare("a", "b", "{}")).toMatchObject({ status: "differ", alphabet: ["a", "b"] });
  });

  it("tells users to escape separators they want as letters", () => {
    expect(check("{", "a{", "a, {")).toMatchObject({
      errors: [
        {
          field: "r1",
          message:
            "“{” isn't in Σ. In the Σ box, write it as \\{ (a plain { separates letters there).",
        },
        { field: "r2", pos: 1 },
      ],
    });
    expect(compare("{,", "{,", "\\{ \\,")).toMatchObject({ status: "equal" });
  });

  it("reports Σ-box errors", () => {
    expect(check("0", "0", "ε")).toMatchObject({
      status: "invalid",
      message: "Fix the error in Σ to see a result.",
      errors: [{ field: "sigma", pos: 0 }],
    });
  });
});

describe("prompts and errors", () => {
  it("asks for input when both boxes are empty", () => {
    expect(check("", "  ", "")).toEqual({
      status: "prompt",
      message: "Enter two regular expressions to compare them.",
      errors: [],
    });
  });

  it("asks for the other expression when one box is empty", () => {
    expect(check("0", "", "")).toEqual({
      status: "prompt",
      message: "Enter R₂ to compare.",
      errors: [],
    });
    expect(check(" ", "0", "")).toMatchObject({
      status: "prompt",
      message: "Enter R₁ to compare.",
    });
  });

  it("still shows errors while a box is empty", () => {
    expect(check("(", "", "")).toMatchObject({
      status: "invalid",
      errors: [{ field: "r1", message: "This ( is never closed.", pos: 0 }],
    });
    expect(check("", "", "ε")).toMatchObject({
      status: "prompt",
      message: "Enter two regular expressions to compare them.",
      errors: [{ field: "sigma", pos: 0 }],
    });
  });

  it("asks for an alphabet when Σ has no letters to stand for", () => {
    expect(check("Σ*", "ε", "")).toEqual({
      status: "invalid",
      message: "Enter an alphabet in the Σ box to see a result.",
      errors: [
        {
          field: "r1",
          message: "Σ has no letters to stand for, because neither expression contains a letter.",
          pos: 0,
        },
      ],
    });
    expect(check("ε", "(Σ|Σ)", "")).toMatchObject({ errors: [{ field: "r2", pos: 1 }] });
    // A Σ box with no letters counts as empty.
    expect(check("Σ*", "ε", "{}")).toMatchObject({ status: "invalid", errors: [{ field: "r1" }] });
    expect(check("Σ*", "ε", " , ")).toMatchObject({ status: "invalid", errors: [{ field: "r1" }] });
  });

  it("names the expressions that have errors", () => {
    expect(check("(", "0", "")).toMatchObject({
      message: "Fix the error in R₁ to see a result.",
    });
    expect(check("0", ")", "")).toMatchObject({
      message: "Fix the error in R₂ to see a result.",
      errors: [{ field: "r2", message: "This ) has no matching (.", pos: 0 }],
    });
    expect(check("(", ")", "")).toMatchObject({
      message: "Fix the error in both expressions to see a result.",
    });
  });

  it("refuses expressions that are too large to build", () => {
    expect(check("(a^5000)^5000", "a", "")).toEqual({
      status: "tooBig",
      message: "This expression is too large to check (too many repeats).",
      errors: [],
    });
  });

  it("counts Σ's width when refusing large expressions", () => {
    const sigma = Array.from({ length: 50 }, (_, k) => String.fromCharCode(0x100 + k)).join(",");
    expect(check("(Σ^100)^100", "Ā", sigma)).toMatchObject({ status: "tooBig" });
  });

  it("handles very long expressions", () => {
    expect(check("a".repeat(150_000), "a", "")).toMatchObject({ status: "differ" });
  });

  it("handles very long operator chains", () => {
    expect(check("a" + "*".repeat(100_000), "a*", "")).toMatchObject({ status: "equal" });
    expect(check("a" + "^1*".repeat(2000), "a*", "")).toMatchObject({
      status: "invalid",
      errors: [{ field: "r1", message: "This expression is nested too deeply." }],
    });
  });

  it("keeps a witness found before the state-pair limit", () => {
    expect(compare("(0|1)*1(0|1)^5", "(0|1)*1(0|1)^5|2", "", 20)).toMatchObject({
      status: "differ",
      partial: true,
      only1: null,
      only2: "2",
      explored: 20,
    });
    expect(compare("(0|1)*1(0|1)^17", "(0|1)*1(0|1)^17|2")).toMatchObject({
      status: "differ",
      partial: true,
      only2: "2",
    });
  });

  it("gives up past the state-pair limit", () => {
    expect(check("(0|1)*1(0|1)^5", "(0|1)*1(0|1)^5", "", 20)).toMatchObject({
      status: "tooBig",
      message:
        "These expressions are too large to check: the combined automaton passes 20 states. Try smaller repeat counts.",
    });
  });
});

describe("automata", () => {
  it("estimates NFA size", () => {
    expect(nfaCost(parse("a"), 1)).toBe(2);
    expect(nfaCost(parse("(ab|c)*"), 3)).toBe(2 + 2 + 4 + 2);
    expect(nfaCost(parse("a^3"), 1)).toBe(2 + 3 * 2);
  });

  it("counts Σ as one transition per letter", () => {
    expect(nfaCost(parse("Σ"), 50)).toBe(52);
    expect(nfaCost(parse("Σ*"), 0)).toBe(4);
  });

  it("builds an automaton that accepts the right strings", () => {
    const dfa = lazyDFA(buildNFA(parse("(ab)+|Σ"), ["a", "b"]));
    const accepts = (w: string) => dfa.accepts([...w].reduce(dfa.step, dfa.start));
    expect(["a", "b", "ab", "abab"].map(accepts)).toEqual([true, true, true, true]);
    expect(["", "aa", "aba", "ba"].map(accepts)).toEqual([false, false, false, false]);
  });
});

describe("examples", () => {
  it.each(EXAMPLES)("$r1 vs $r2 is $expected", ({ r1, r2, sigma, expected }) => {
    expect(check(r1, r2, sigma).status).toBe(expected);
  });
});
