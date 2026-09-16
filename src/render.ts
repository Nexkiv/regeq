// Turns check results into DOM, typeset like a textbook claim and proof.
import { visible, type CheckResult } from "./engine/check";

export function el(tag: string, cls: string, ...kids: (Node | string)[]): HTMLElement {
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

function subject(w: string[], capital: boolean): (Node | string)[] {
  const the = capital ? "The" : "the";
  if (w.length === 0) return [`${the} empty string `, el("i", "", "ε")];
  return [`${the} string `, el("span", "witness", w.map(visible).join(""))];
}

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

/** Marks the result as out of date while a slow check runs. */
export function setChecking(checking: boolean) {
  const region = $("result");
  region.setAttribute("aria-busy", String(checking));
  if (checking) setRemark("Checking…");
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
      `Over ${sigma}, a breadth-first search of the product automaton reaches ${explored.toLocaleString()} state ${explored === 1 ? "pair" : "pairs"}, and in none of them does exactly one expression accept.`,
    );
    return;
  }

  const { only1, only2 } = result;
  if (only1 && only2) {
    setClaim("ne", 1, "≠", 2);
    setProof(
      ...subject(only1, true),
      " is in ",
      lang(1),
      " but not in ",
      lang(2),
      ", and ",
      ...subject(only2, false),
      " is in ",
      lang(2),
      " but not in ",
      lang(1),
      `. Both are the shortest such strings over ${sigma}.`,
    );
    return;
  }

  const [big, small, w] = only1 ? ([1, 2, only1] as const) : ([2, 1, only2!] as const);
  if (result.partial) {
    // The other direction was never finished, so only inequality is proven.
    setClaim("ne", 1, "≠", 2);
    setProof(
      ...subject(w, true),
      " is in ",
      lang(big),
      " but not in ",
      lang(small),
      `, and it is the shortest such string over ${sigma}. The search stopped early, after ${explored.toLocaleString()} state pairs, so it did not check for strings in `,
      lang(small),
      " but not in ",
      lang(big),
      ".",
    );
    return;
  }
  setClaim("ne", small, "⊊", big);
  setProof(
    "Every string in ",
    lang(small),
    " is also in ",
    lang(big),
    ", but ",
    ...subject(w, false),
    " is in ",
    lang(big),
    " and not in ",
    lang(small),
    `. It is the shortest such string over ${sigma}.`,
  );
}

export function clearError(input: HTMLInputElement, box: HTMLElement) {
  input.classList.remove("invalid");
  box.hidden = true;
}

/** Shows `message` under the input and underlines the character at `pos`. */
export function showError(
  input: HTMLInputElement,
  box: HTMLElement,
  message: string,
  pos?: number,
) {
  input.classList.add("invalid");
  box.replaceChildren(message);
  if (pos !== undefined) {
    const chars = Array.from(input.value);
    const mark = el("mark", "", chars[pos] ?? " ");
    box.append(el("pre", "", chars.slice(0, pos).join(""), mark, chars.slice(pos + 1).join("")));
  }
  box.hidden = false;
}
