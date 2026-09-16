import { describe, expect, it } from "vitest";
import { letters, parse, parseSigma } from "../src/engine/syntax";
import { syntaxError } from "./helpers";

describe("parse", () => {
  it("builds the expected tree", () => {
    expect(parse("a|bc*")).toEqual({
      type: "alt",
      alts: [
        { type: "sym", c: "a", pos: 0 },
        {
          type: "cat",
          items: [
            { type: "sym", c: "b", pos: 2 },
            { type: "star", a: { type: "sym", c: "c", pos: 3 } },
          ],
        },
      ],
    });
  });

  it("reads empty input, (), and empty union sides as ε", () => {
    expect(parse("")).toEqual({ type: "eps" });
    expect(parse("()")).toEqual({ type: "eps" });
    expect(parse("|")).toEqual({ type: "alt", alts: [{ type: "eps" }, { type: "eps" }] });
  });

  it("reads ε, Σ and escapes", () => {
    expect(parse("εΣ\\ε\\Σ\\ ")).toEqual({
      type: "cat",
      items: [
        { type: "eps" },
        { type: "any" },
        { type: "sym", c: "ε", pos: 2 },
        { type: "sym", c: "Σ", pos: 4 },
        { type: "sym", c: " ", pos: 6 },
      ],
    });
  });

  it("reads counts", () => {
    expect(parse("a^12")).toEqual({ type: "rep", a: { type: "sym", c: "a", pos: 0 }, n: 12 });
    expect(parse("a^{2}3")).toMatchObject({ type: "cat", items: [{ n: 2 }, { c: "3" }] });
    expect(parse("a^2 3")).toMatchObject({ type: "cat", items: [{ n: 2 }, { c: "3" }] });
  });

  it.each([
    ["1^{1 2}", "Spaces aren't allowed inside a count.", 5],
    ["1^{ 12}", "Spaces aren't allowed inside a count.", 4],
    ["1^{12 }", "Spaces aren't allowed inside a count.", 6],
    ["1^ 12", "Put the count right after ^.", 3],
    ["1^ {2}", "Put the count right after ^.", 3],
  ])("rejects the spaced count %s", (src, message, pos) => {
    expect(syntaxError(() => parse(src))).toEqual({ message, pos });
  });

  it("never reads an escaped character as part of a count", () => {
    expect(parse("1^2\\3")).toMatchObject({ type: "cat", items: [{ n: 2 }, { c: "3" }] });
    expect(syntaxError(() => parse("1^\\1"))).toEqual({
      message: "^ must be followed by a count, like ^3 or ^{3}.",
      pos: 2,
    });
    expect(syntaxError(() => parse("1^{2\\}"))).toEqual({
      message: "Expected a number and a closing } after ^{.",
      pos: 4,
    });
    expect(syntaxError(() => parse("1^\\{2}"))).toMatchObject({ pos: 2 });
  });

  it.each([
    ["a\\", "A backslash needs a character after it.", 1],
    ["a^", "^ must be followed by a count, like ^3 or ^{3}.", 2],
    ["a^{3", "Expected a number and a closing } after ^{.", 4],
    ["a^5001", "Repeat counts above 5000 aren't supported.", 1],
    ["(a", "This ( is never closed.", 0],
    ["a)", "This ) has no matching (.", 1],
    ["*a", "“*” needs something before it to apply to.", 0],
    ["a|^2", "“^” needs something before it to apply to.", 2],
    ["εε(Σ", "This ( is never closed.", 2],
    ["𝔸)", "This ) has no matching (.", 1],
  ])("rejects %s", (src, message, pos) => {
    expect(syntaxError(() => parse(src))).toEqual({ message, pos });
  });
});

describe("parseSigma", () => {
  it("accepts commas, spaces, braces and escapes", () => {
    expect([...parseSigma("{0, 1 2,\\,}")]).toEqual(["0", "1", "2", ","]);
  });

  it.each([
    ["ε", "ε can't be a letter here. Write \\ε for a literal ε.", 0],
    ["0, Σ", "Σ can't be a letter here. Write \\Σ for a literal Σ.", 3],
    ["0\\", "A backslash needs a character after it.", 1],
  ])("rejects %s", (src, message, pos) => {
    expect(syntaxError(() => parseSigma(src))).toEqual({ message, pos });
  });
});

describe("letters", () => {
  it("lists letter nodes in source order, skipping ε and Σ", () => {
    const found = [...letters(parse("(ab|εc)*Σd?e+f^2"))].map((n) => n.c);
    expect(found).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});
