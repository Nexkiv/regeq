// Turns check results into DOM, typeset like a textbook claim and proof.
import { formatCount, visible, type CheckResult } from "./engine/check";
import { EXAMPLES, type Example } from "./examples";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  n.append(...kids);
  return n;
}

const $ = (id: string) => document.getElementById(id)!;

/** L(Rₙ) with italic variables. */
const lang = (n: 1 | 2) =>
  el("span", "", el("i", "", "L"), "(", el("i", "", "R"), n === 1 ? "₁" : "₂", ")");

const envName = (name: string) => el("span", "env-name", name);

type Article = "The" | "the";

/** "the string 10" or "the empty string ε". */
function subject(w: string[], article: Article): (Node | string)[] {
  if (w.length === 0) return [`${article} empty string `, el("i", "", "ε")];
  return [`${article} string `, el("span", "witness", w.map(visible).join(""))];
}

/** "L(Rₐ) but not in L(R_b)". */
const inNotIn = (a: 1 | 2, b: 1 | 2) => [lang(a), " but not in ", lang(b)];

/** "the string w is in L(Rₐ) but not in L(R_b)". */
const witness = (w: string[], article: Article, a: 1 | 2, b: 1 | 2) => [
  ...subject(w, article),
  " is in ",
  ...inNotIn(a, b),
];

function setClaim(cls: string, left: 1 | 2, rel: string, right: 1 | 2) {
  const c = $("claim");
  c.className = "claim " + cls;
  c.hidden = false;
  c.replaceChildren(envName("Claim."), lang(left), el("span", "rel", rel), lang(right), ".");
}

function setProof(...parts: (Node | string)[]) {
  const p = $("proof");
  p.className = "proof";
  p.replaceChildren(envName("Proof."), ...parts, el("span", "qed", "∎"));
}

/** Replaces the result with "Checking…" while a slow check runs. */
export function showChecking() {
  $("result").setAttribute("aria-busy", "true");
  setRemark("Checking…");
}

export function clearChecking() {
  $("result").setAttribute("aria-busy", "false");
}

export function setRemark(text: string) {
  $("claim").hidden = true;
  const p = $("proof");
  p.className = "remark";
  p.replaceChildren(text);
}

export function renderResult(result: CheckResult) {
  if ("message" in result) {
    setRemark(result.message);
    return;
  }
  const { alphabet, explored } = result;
  const sigma = alphabet.length ? `Σ = {${alphabet.map(visible).join(", ")}}` : "Σ = ∅";

  if (result.status === "equal") {
    setClaim("eq", 1, "=", 2);
    setProof(
      `Over ${sigma}, a breadth-first search of the product automaton reaches ${formatCount(explored)} state ${explored === 1 ? "pair" : "pairs"}, and in none of them does exactly one expression accept.`,
    );
    return;
  }

  const { only1, only2 } = result;
  if (only1 && only2) {
    setClaim("ne", 1, "≠", 2);
    setProof(
      ...witness(only1, "The", 1, 2),
      ", and ",
      ...witness(only2, "the", 2, 1),
      `. Both are the shortest such strings over ${sigma}.`,
    );
    return;
  }

  const [big, small, w] = only1 ? ([1, 2, only1] as const) : ([2, 1, only2!] as const);
  if (result.partial) {
    // The other direction was never finished, so only inequality is proven.
    setClaim("ne", 1, "≠", 2);
    setProof(
      ...witness(w, "The", big, small),
      `, and it is the shortest such string over ${sigma}. The search stopped early, after ${formatCount(explored)} state pairs. It found no string in `,
      ...inNotIn(small, big),
      " among those, but can't rule one out.",
    );
    return;
  }
  setClaim("ne", small, "⊊", big);
  setProof(
    "Every string in ",
    lang(small),
    " is also in ",
    lang(big),
    ", and ",
    ...witness(w, "the", big, small),
    `. It is the shortest such string over ${sigma}.`,
  );
}

export function clearError(input: HTMLInputElement, box: HTMLElement) {
  input.classList.remove("invalid");
  box.hidden = true;
}

/** Shows `message` under the input and underlines the character at `pos` of `text`. */
export function showError(
  input: HTMLInputElement,
  box: HTMLElement,
  text: string,
  message: string,
  pos?: number,
) {
  input.classList.add("invalid");
  box.replaceChildren(message);
  if (pos !== undefined) {
    const chars = Array.from(text);
    const mark = el("mark", "", chars[pos] ?? " ");
    box.append(el("pre", "", chars.slice(0, pos).join(""), mark, chars.slice(pos + 1).join("")));
  }
  box.hidden = false;
}

export function renderExamples(tbody: HTMLElement, onLoad: (example: Example) => void) {
  for (const example of EXAMPLES) {
    const { r1, r2, sigma, shows } = example;
    const load = el("button", "load", "Load");
    load.type = "button";
    load.setAttribute("aria-label", `Load ${r1} and ${r2}`);
    load.addEventListener("click", () => onLoad(example));
    tbody.append(
      el(
        "tr",
        "",
        el("td", "expr", r1),
        el("td", "expr", r2),
        el("td", "expr", sigma ? `{${sigma}}` : ""),
        el("td", "dim", shows),
        el("td", "act", load),
      ),
    );
  }
}

/** Symbols that are awkward to type, offered as insert buttons next to each expression box. */
const INSERT_KEYS = [
  { text: "ε", className: "key eps" },
  { text: "Σ", className: "key" },
];

export function renderKeys(
  container: HTMLElement,
  label: string,
  onInsert: (text: string) => void,
) {
  for (const { text, className } of INSERT_KEYS) {
    const key = el("button", className, text);
    key.type = "button";
    key.title = `Insert ${text}`;
    key.setAttribute("aria-label", `Insert ${text} into ${label}`);
    key.addEventListener("click", () => onInsert(text));
    container.append(key);
  }
}
