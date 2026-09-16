// Thompson NFA construction, lazy subset construction, and the product-automaton search.
import type { Node } from "./syntax";

export type NFA = { eps: number[][]; trans: [string, number][][]; start: number; final: number };
export type DFA = {
  start: number;
  step: (id: number, c: string) => number;
  accepts: (id: number) => boolean;
};
export type SearchResult =
  | { tooBig: true; explored: number }
  | { tooBig?: false; only1: string[] | null; only2: string[] | null; explored: number };

/** Approximate Thompson-NFA size, to refuse huge expressions before building them. */
export function size(node: Node): number {
  switch (node.type) {
    case "sym":
    case "eps":
    case "any":
      return 2;
    case "alt":
      return 2 + node.alts.reduce((s, n) => s + size(n), 0);
    case "cat":
      return node.items.reduce((s, n) => s + size(n), 0);
    case "star":
    case "plus":
    case "opt":
      return 2 + size(node.a);
    case "rep":
      return 2 + node.n * size(node.a);
  }
}

/** "any" (Σ) becomes one transition per letter of the shared alphabet. */
export function buildNFA(ast: Node, alphabet: string[]): NFA {
  if (size(ast) > 400000)
    throw { msg: "This expression is too large to check (too many repeats)." };
  const eps: number[][] = [];
  const trans: [string, number][][] = [];
  const add = () => {
    eps.push([]);
    trans.push([]);
    return eps.length - 1;
  };
  function build(n: Node): { s: number; e: number } {
    const s = add();
    const e = add();
    switch (n.type) {
      case "eps":
        eps[s].push(e);
        break;
      case "sym":
        trans[s].push([n.c, e]);
        break;
      case "any":
        for (const c of alphabet) trans[s].push([c, e]);
        break;
      case "alt":
        for (const a of n.alts) {
          const f = build(a);
          eps[s].push(f.s);
          eps[f.e].push(e);
        }
        break;
      case "cat": {
        let prev = s;
        for (const a of n.items) {
          const f = build(a);
          eps[prev].push(f.s);
          prev = f.e;
        }
        eps[prev].push(e);
        break;
      }
      case "star": {
        const f = build(n.a);
        eps[s].push(f.s, e);
        eps[f.e].push(f.s, e);
        break;
      }
      case "plus": {
        const f = build(n.a);
        eps[s].push(f.s);
        eps[f.e].push(f.s, e);
        break;
      }
      case "opt": {
        const f = build(n.a);
        eps[s].push(f.s, e);
        eps[f.e].push(e);
        break;
      }
      case "rep": {
        let prev = s;
        for (let k = 0; k < n.n; k++) {
          const f = build(n.a);
          eps[prev].push(f.s);
          prev = f.e;
        }
        eps[prev].push(e);
        break;
      }
    }
    return { s, e };
  }
  const { s, e } = build(ast);
  return { eps, trans, start: s, final: e };
}

/** Lazy subset construction: interns each reachable state set and caches its moves. */
export function lazyDFA(nfa: NFA): DFA {
  const ids = new Map<string, number>();
  const sets: number[][] = [];
  const accepting: boolean[] = [];
  const moves: Map<string, number>[] = [];
  const mark = new Uint32Array(nfa.eps.length);
  let stamp = 0;
  function closure(seed: number[]): number {
    stamp++;
    const stack: number[] = [];
    const out: number[] = [];
    for (const q of seed)
      if (mark[q] !== stamp) {
        mark[q] = stamp;
        stack.push(q);
      }
    while (stack.length) {
      const q = stack.pop()!;
      out.push(q);
      for (const r of nfa.eps[q])
        if (mark[r] !== stamp) {
          mark[r] = stamp;
          stack.push(r);
        }
    }
    out.sort((a, b) => a - b);
    return intern(out);
  }
  function intern(set: number[]): number {
    const key = set.join(",");
    let id = ids.get(key);
    if (id === undefined) {
      id = sets.length;
      ids.set(key, id);
      sets.push(set);
      accepting.push(set.includes(nfa.final));
      moves.push(new Map());
    }
    return id;
  }
  function step(id: number, c: string): number {
    const cache = moves[id];
    let to = cache.get(c);
    if (to === undefined) {
      const seed: number[] = [];
      for (const q of sets[id]) for (const [a, r] of nfa.trans[q]) if (a === c) seed.push(r);
      to = closure(seed);
      cache.set(c, to);
    }
    return to;
  }
  return { start: closure([nfa.start]), step, accepts: (id) => accepting[id] };
}

/** Breadth-first search of the product automaton: first hits are shortlex-minimal. */
export function compare(d1: DFA, d2: DFA, alphabet: string[]): SearchResult {
  const LIMIT = 250000;
  const seen = new Map<string, number>();
  const nodes = [{ a: d1.start, b: d2.start, parent: -1, c: "" }];
  seen.set(d1.start + ":" + d2.start, 0);
  let only1: string[] | null = null;
  let only2: string[] | null = null;
  const word = (k: number) => {
    const w: string[] = [];
    while (k > 0) {
      w.push(nodes[k].c);
      k = nodes[k].parent;
    }
    return w.reverse();
  };
  for (let k = 0; k < nodes.length; k++) {
    const { a, b } = nodes[k];
    const x = d1.accepts(a);
    const y = d2.accepts(b);
    if (x && !y && !only1) only1 = word(k);
    if (y && !x && !only2) only2 = word(k);
    if (only1 && only2) break;
    for (const c of alphabet) {
      const na = d1.step(a, c);
      const nb = d2.step(b, c);
      const key = na + ":" + nb;
      if (!seen.has(key)) {
        if (nodes.length >= LIMIT) return { tooBig: true, explored: nodes.length };
        seen.set(key, nodes.length);
        nodes.push({ a: na, b: nb, parent: k, c });
      }
    }
  }
  return { only1, only2, explored: nodes.length };
}
