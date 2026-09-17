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
  | { type: "any"; pos: number }
  | { type: "alt"; alts: Node[] }
  | { type: "cat"; items: Node[] }
  | { type: "star" | "plus" | "opt"; a: Node }
  | { type: "rep"; a: Node; n: number };

export const MAX_REPEAT = 5000;
/** Deepest allowed parenthesis nesting; keeps the recursive parser well within the stack. */
export const MAX_PARENS = 500;
/** Deepest allowed expression tree; keeps the recursive automaton builders within the stack. */
export const MAX_HEIGHT = 1000;

/** A problem in what the user typed; `pos` is a code-point index into the input, if known. */
export class RegexSyntaxError extends Error {
  readonly pos: number | undefined;
  constructor(message: string, pos?: number) {
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
  let parens = 0;
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

  const UNARY = { "*": "star", "+": "plus", "?": "opt" } as const;

  // Repeated postfix operators collapse exactly: a** is a*, a+? is a*, (a^2)^3 is a^6.
  function postfix(): Node {
    let node = atom();
    for (;;) {
      const t = peek();
      if (t?.kind !== "op" || !(t.v in UNARY || t.v === "^")) return node;
      i++;
      if (t.v === "^") {
        const n = count(t);
        node = node.type === "rep" ? { ...node, n: node.n * n } : { type: "rep", a: node, n };
      } else {
        const type = UNARY[t.v as keyof typeof UNARY];
        if (node.type === "star" || node.type === "plus" || node.type === "opt")
          node = { type: node.type === type ? type : "star", a: node.a };
        else node = { type, a: node };
      }
    }
  }

  function count(caret: Token): number {
    const rejectSpace = (t: Token) => {
      if (t.space) throw new RegexSyntaxError("Spaces aren't allowed inside a count.", t.pos);
    };
    let digits = "";
    const first = peek();
    if (first?.space && (isDigit(first) || isSym(first, "{")))
      throw new RegexSyntaxError("Put the count right after ^.", first.pos);
    if (isSym(first, "{")) {
      i++;
      while (isDigit(peek())) {
        rejectSpace(toks[i]);
        digits += toks[i++].v;
      }
      const close = peek();
      if (!close || !isSym(close, "}"))
        throw new RegexSyntaxError("Expected a number and a closing } after ^{.", posOf(close));
      rejectSpace(close);
      i++;
    } else {
      // A space ends an unbraced count, so 1^2 3 is 113.
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
      if (++parens > MAX_PARENS)
        throw new RegexSyntaxError("Parentheses are nested too deeply.", t.pos);
      const inner = union();
      parens--;
      if (!isOp(peek(), ")")) throw new RegexSyntaxError("This ( is never closed.", t.pos);
      i++;
      return inner;
    }
    if (t.kind === "sym") return { type: "sym", c: t.v, pos: t.pos };
    if (t.kind === "eps") return { type: "eps" };
    if (t.kind === "any") return { type: "any", pos: t.pos };
    throw new RegexSyntaxError(`“${t.v}” needs something before it to apply to.`, t.pos);
  }

  const ast = union();
  // union() stops only at the end or at a ) with no matching (.
  if (i < toks.length) throw new RegexSyntaxError("This ) has no matching (.", toks[i].pos);
  if (height(ast) > MAX_HEIGHT) throw new RegexSyntaxError("This expression is nested too deeply.");
  return ast;
}

/**
 * The Σ box: letters separated by spaces or commas, optionally in braces. Any other character,
 * operators included, is a letter; escapes work as in expressions.
 */
export function parseSigma(src: string): Set<string> {
  const { toks } = tokenize(src);
  const isSeparator = (t: Token | undefined) =>
    !!t && !t.escaped && (t.v === "," || t.v === "{" || t.v === "}");
  const out = new Set<string>();
  toks.forEach((t, k) => {
    if (t.kind === "eps" || t.kind === "any")
      throw new RegexSyntaxError(
        `${t.v} can't be a letter here. Write \\${t.v} for a literal ${t.v}.`,
        t.pos,
      );
    if (isSeparator(t)) return;
    const [prev, next] = [toks[k - 1], toks[k + 1]];
    // Only a dash written tight between two letters (a-z) looks like a range.
    const tight = !t.space && !next?.space;
    if (
      t.v === "-" &&
      !t.escaped &&
      tight &&
      prev &&
      next &&
      !isSeparator(prev) &&
      !isSeparator(next)
    )
      throw new RegexSyntaxError(
        "Ranges aren't supported. List each letter, or write \\- for a dash.",
        t.pos,
      );
    out.add(t.v);
  });
  return out;
}

function children(node: Node): Node[] {
  switch (node.type) {
    case "sym":
    case "eps":
    case "any":
      return [];
    case "alt":
      return node.alts;
    case "cat":
      return node.items;
    case "star":
    case "plus":
    case "opt":
    case "rep":
      return [node.a];
    default:
      return assertNever(node);
  }
}

/** Every node of the expression, parents before children, in source order. */
export function* walk(root: Node): Generator<Node> {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    yield node;
    // Push one at a time: spreading a huge child list into push() overflows the stack.
    const kids = children(node);
    for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k]);
  }
}

/** Number of nodes on the longest root-to-leaf path (computed without recursion). */
function height(root: Node): number {
  let max = 0;
  const stack: [Node, number][] = [[root, 1]];
  while (stack.length) {
    const [node, depth] = stack.pop()!;
    max = Math.max(max, depth);
    for (const child of children(node)) stack.push([child, depth + 1]);
  }
  return max;
}

/** Every letter node of the expression, in source order. */
export const letters = (node: Node): SymNode[] =>
  [...walk(node)].filter((n): n is SymNode => n.type === "sym");
