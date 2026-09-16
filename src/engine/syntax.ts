// Tokenizer and parser for the RegEq expression syntax.

export type Token = {
  kind: "sym" | "op" | "eps" | "any";
  v: string;
  pos: number;
  /** Whether whitespace came right before this token. */
  space: boolean;
};

export type Node =
  | { type: "sym"; c: string; pos: number }
  | { type: "eps" }
  | { type: "any" }
  | { type: "alt"; alts: Node[] }
  | { type: "cat"; items: Node[] }
  | { type: "star" | "plus" | "opt"; a: Node }
  | { type: "rep"; a: Node; n: number };

/** A syntax error in an expression or the Σ box; `pos` is a code-point index. */
export type SyntaxErrorInfo = { msg: string; pos?: number };

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
    if (c === "\\") {
      if (i + 1 >= chars.length)
        throw { msg: "A backslash needs a character after it.", pos: i } as SyntaxErrorInfo;
      toks.push({ kind: "sym", v: chars[i + 1], pos: i, space });
      i++;
    } else if (c === "ε") {
      toks.push({ kind: "eps", v: c, pos: i, space });
    } else if (c === "Σ") {
      toks.push({ kind: "any", v: c, pos: i, space });
    } else if (OPS.has(c)) {
      toks.push({ kind: "op", v: c, pos: i, space });
    } else {
      toks.push({ kind: "sym", v: c, pos: i, space });
    }
    space = false;
  }
  return { toks, len: chars.length };
}

export function parse(src: string): Node {
  const { toks, len } = tokenize(src);
  let i = 0;
  const peek = (): Token | undefined => toks[i];
  const isOp = (t: Token | undefined, v: string) => !!t && t.kind === "op" && t.v === v;
  const isDigit = (t: Token | undefined) => !!t && t.kind === "sym" && /^[0-9]$/.test(t.v);
  const posOf = (t: Token | undefined) => (t ? t.pos : len);

  function union(): Node {
    const alts = [concat()];
    while (isOp(peek(), "|")) {
      i++;
      alts.push(concat());
    }
    return alts.length === 1 ? alts[0] : { type: "alt", alts };
  }
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
      if (isOp(t, "*")) {
        i++;
        node = { type: "star", a: node };
      } else if (isOp(t, "+")) {
        i++;
        node = { type: "plus", a: node };
      } else if (isOp(t, "?")) {
        i++;
        node = { type: "opt", a: node };
      } else if (t && isOp(t, "^")) {
        i++;
        node = { type: "rep", a: node, n: count(t) };
      } else return node;
    }
  }
  function count(caret: Token): number {
    let digits = "";
    const t0 = peek();
    if (t0 && t0.kind === "sym" && t0.v === "{") {
      i++;
      while (isDigit(peek())) digits += toks[i++].v;
      const t1 = peek();
      if (!(t1 && t1.kind === "sym" && t1.v === "}"))
        throw { msg: "Expected a number and a closing } after ^{.", pos: posOf(t1) };
      i++;
    } else {
      if (isDigit(peek())) digits += toks[i++].v;
      while (isDigit(peek()) && !peek()!.space) digits += toks[i++].v;
    }
    if (!digits)
      throw { msg: "^ must be followed by a count, like ^3 or ^{3}.", pos: posOf(peek()) };
    const n = parseInt(digits, 10);
    if (n > 5000) throw { msg: "Repeat counts above 5000 aren't supported.", pos: caret.pos };
    return n;
  }
  function atom(): Node {
    const t = peek();
    if (!t) throw { msg: "Expression ends where a letter or ( was expected.", pos: len };
    if (isOp(t, "(")) {
      i++;
      const inner = union();
      if (!isOp(peek(), ")")) throw { msg: "This ( is never closed.", pos: t.pos };
      i++;
      return inner;
    }
    if (t.kind === "sym") {
      i++;
      return { type: "sym", c: t.v, pos: t.pos };
    }
    if (t.kind === "eps") {
      i++;
      return { type: "eps" };
    }
    if (t.kind === "any") {
      i++;
      return { type: "any" };
    }
    if (isOp(t, ")")) throw { msg: "This ) has no matching (.", pos: t.pos };
    throw { msg: `“${t.v}” needs something before it to apply to.`, pos: t.pos };
  }

  const ast = union();
  if (i < toks.length) {
    const t = toks[i];
    throw {
      msg: isOp(t, ")") ? "This ) has no matching (." : `Unexpected “${t.v}”.`,
      pos: t.pos,
    };
  }
  return ast;
}

/** First letter node (in source order) that is not in the given alphabet. */
export function firstForeign(
  node: Node,
  sigma: Set<string>,
): Extract<Node, { type: "sym" }> | null {
  switch (node.type) {
    case "sym":
      return sigma.has(node.c) ? null : node;
    case "alt":
    case "cat":
      for (const n of node.type === "alt" ? node.alts : node.items) {
        const f = firstForeign(n, sigma);
        if (f) return f;
      }
      return null;
    case "star":
    case "plus":
    case "opt":
    case "rep":
      return firstForeign(node.a, sigma);
    default:
      return null;
  }
}

/** Explicit alphabet: every character except spaces, commas and braces is a letter. */
export function parseSigma(src: string): Set<string> {
  const chars = Array.from(src);
  const out = new Set<string>();
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c) || c === "," || c === "{" || c === "}") continue;
    if (c === "\\") {
      if (i + 1 >= chars.length) throw { msg: "A backslash needs a character after it.", pos: i };
      out.add(chars[++i]);
    } else if (c === "ε" || c === "Σ") {
      throw { msg: `${c} can't be a letter here. Write \\${c} for a literal ${c}.`, pos: i };
    } else {
      out.add(c);
    }
  }
  return out;
}

export function symbols(node: Node, out: Set<string>): Set<string> {
  switch (node.type) {
    case "sym":
      out.add(node.c);
      break;
    case "alt":
      node.alts.forEach((n) => symbols(n, out));
      break;
    case "cat":
      node.items.forEach((n) => symbols(n, out));
      break;
    case "star":
    case "plus":
    case "opt":
    case "rep":
      symbols(node.a, out);
      break;
  }
  return out;
}
