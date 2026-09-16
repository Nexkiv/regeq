// Tokenizer and parser for the RegEq expression syntax, and the Σ-box parser.

export type Token = {
  kind: "sym" | "op" | "eps" | "any";
  v: string;
  /** Code-point index of the token (of the backslash, for an escape). */
  pos: number;
  /** Whether whitespace came right before this token. */
  space: boolean;
  /** Written with a backslash, so always a plain letter. */
  escaped: boolean;
};

export type SymNode = { type: "sym"; c: string; pos: number };
export type Node =
  | SymNode
  | { type: "eps" }
  | { type: "any" }
  | { type: "alt"; alts: Node[] }
  | { type: "cat"; items: Node[] }
  | { type: "star" | "plus" | "opt"; a: Node }
  | { type: "rep"; a: Node; n: number };

export const MAX_REPEAT = 5000;

/** A problem in what the user typed; `pos` is a code-point index into the input. */
export class RegexSyntaxError extends Error {
  readonly pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.name = "RegexSyntaxError";
    this.pos = pos;
  }
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}

const OPS = new Set(["|", "*", "+", "?", "(", ")", "^"]);

export function tokenize(src: string): { toks: Token[]; len: number } {
  const chars = Array.from(src);
  const toks: Token[] = [];
  let space = false;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      space = true;
      continue;
    }
    const pos = i;
    let kind: Token["kind"] = "sym";
    let v = c;
    const escaped = c === "\\";
    if (escaped) {
      if (i + 1 >= chars.length)
        throw new RegexSyntaxError("A backslash needs a character after it.", i);
      v = chars[++i];
    } else if (c === "ε") kind = "eps";
    else if (c === "Σ") kind = "any";
    else if (OPS.has(c)) kind = "op";
    toks.push({ kind, v, pos, space, escaped });
    space = false;
  }
  return { toks, len: chars.length };
}

export function parse(src: string): Node {
  const { toks, len } = tokenize(src);
  let i = 0;
  const peek = (): Token | undefined => toks[i];
  const isOp = (t: Token | undefined, v: string) => t?.kind === "op" && t.v === v;
  // Count syntax (digits and braces after ^) only uses unescaped characters.
  const isSym = (t: Token | undefined, v: string) => t?.kind === "sym" && !t.escaped && t.v === v;
  const isDigit = (t: Token | undefined) => t?.kind === "sym" && !t.escaped && /^[0-9]$/.test(t.v);
  const posOf = (t: Token | undefined) => (t ? t.pos : len);

  function union(): Node {
    const alts = [concat()];
    while (isOp(peek(), "|")) {
      i++;
      alts.push(concat());
    }
    return alts.length === 1 ? alts[0] : { type: "alt", alts };
  }

  // concat() only calls postfix() when a token exists that is neither | nor ).
  function concat(): Node {
    const items: Node[] = [];
    while (peek() && !isOp(peek(), "|") && !isOp(peek(), ")")) items.push(postfix());
    if (items.length === 0) return { type: "eps" };
    return items.length === 1 ? items[0] : { type: "cat", items };
  }

  function postfix(): Node {
    let node = atom();
    for (;;) {
      const t = peek();
      if (isOp(t, "*")) node = { type: "star", a: node };
      else if (isOp(t, "+")) node = { type: "plus", a: node };
      else if (isOp(t, "?")) node = { type: "opt", a: node };
      else if (t && isOp(t, "^")) {
        i++;
        node = { type: "rep", a: node, n: count(t) };
        continue;
      } else return node;
      i++;
    }
  }

  function count(caret: Token): number {
    let digits = "";
    if (isSym(peek(), "{")) {
      i++;
      while (isDigit(peek())) digits += toks[i++].v;
      if (!isSym(peek(), "}"))
        throw new RegexSyntaxError("Expected a number and a closing } after ^{.", posOf(peek()));
      i++;
    } else {
      if (isDigit(peek())) digits += toks[i++].v;
      while (isDigit(peek()) && !peek()!.space) digits += toks[i++].v;
    }
    if (!digits)
      throw new RegexSyntaxError("^ must be followed by a count, like ^3 or ^{3}.", posOf(peek()));
    const n = parseInt(digits, 10);
    if (n > MAX_REPEAT)
      throw new RegexSyntaxError(`Repeat counts above ${MAX_REPEAT} aren't supported.`, caret.pos);
    return n;
  }

  function atom(): Node {
    const t = peek()!;
    i++;
    if (isOp(t, "(")) {
      const inner = union();
      if (!isOp(peek(), ")")) throw new RegexSyntaxError("This ( is never closed.", t.pos);
      i++;
      return inner;
    }
    if (t.kind === "sym") return { type: "sym", c: t.v, pos: t.pos };
    if (t.kind === "eps") return { type: "eps" };
    if (t.kind === "any") return { type: "any" };
    throw new RegexSyntaxError(`“${t.v}” needs something before it to apply to.`, t.pos);
  }

  const ast = union();
  // union() stops only at the end or at a ) with no matching (.
  if (i < toks.length) throw new RegexSyntaxError("This ) has no matching (.", toks[i].pos);
  return ast;
}

/** Explicit alphabet: every character except spaces, commas and braces is a letter. */
export function parseSigma(src: string): Set<string> {
  const chars = Array.from(src);
  const out = new Set<string>();
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c) || c === "," || c === "{" || c === "}") continue;
    if (c === "\\") {
      if (i + 1 >= chars.length)
        throw new RegexSyntaxError("A backslash needs a character after it.", i);
      out.add(chars[++i]);
    } else if (c === "ε" || c === "Σ") {
      throw new RegexSyntaxError(
        `${c} can't be a letter here. Write \\${c} for a literal ${c}.`,
        i,
      );
    } else {
      out.add(c);
    }
  }
  return out;
}

/** Every letter node in the expression, in source order. */
export function* letters(node: Node): Generator<SymNode> {
  switch (node.type) {
    case "sym":
      yield node;
      return;
    case "eps":
    case "any":
      return;
    case "alt":
      for (const n of node.alts) yield* letters(n);
      return;
    case "cat":
      for (const n of node.items) yield* letters(n);
      return;
    case "star":
    case "plus":
    case "opt":
    case "rep":
      yield* letters(node.a);
      return;
    default:
      assertNever(node);
  }
}
