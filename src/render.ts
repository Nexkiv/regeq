// Turns results into DOM, typeset like a textbook claim and proof.

export const show = (c: string) => (c === " " ? "␣" : c);

export function el(tag: string, cls: string, ...kids: (Node | string)[]): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  n.append(...kids);
  return n;
}

const $ = (id: string) => document.getElementById(id)!;

/** L(Rₙ) with italic variables. */
export const lang = (n: 1 | 2) =>
  el("span", "", el("i", "", "L"), "(", el("i", "", "R"), n === 1 ? "₁" : "₂", ")");

const envName = (name: string) => el("span", "env-name", name);

export function subject(w: string[], capital: boolean): (Node | string)[] {
  if (w.length === 0)
    return [capital ? "The empty string " : "the empty string ", el("i", "", "ε")];
  return [capital ? "The string " : "the string ", el("span", "witness", w.map(show).join(""))];
}

export function setClaim(cls: string, left: 1 | 2, rel: string, right: 1 | 2) {
  const c = $("claim");
  c.className = "claim " + cls;
  c.hidden = false;
  c.replaceChildren(envName("Claim."), lang(left), el("span", "rel", rel), lang(right), ".");
}

export function setProof(...parts: (Node | string)[]) {
  const p = $("proof");
  p.className = "proof";
  p.replaceChildren(envName("Proof."), ...parts, el("span", "qed", "∎"));
}

export function setRemark(text: string) {
  $("claim").hidden = true;
  const p = $("proof");
  p.className = "remark";
  p.replaceChildren(text);
}

export function clearError(input: HTMLInputElement, box: HTMLElement) {
  input.classList.remove("invalid");
  box.hidden = true;
}

/** Shows `message` under the input and underlines the character at `pos`. */
export function showError(
  input: HTMLInputElement,
  box: HTMLElement,
  e: { msg?: string; pos?: number },
) {
  input.classList.add("invalid");
  box.replaceChildren(e.msg || String(e));
  const src = input.value;
  if (typeof e.pos === "number" && src.trim()) {
    const chars = Array.from(src);
    const pre = document.createElement("pre");
    const m = document.createElement("mark");
    m.textContent = e.pos < chars.length ? chars[e.pos] : " ";
    pre.append(chars.slice(0, e.pos).join(""), m, chars.slice(e.pos + 1).join(""));
    box.appendChild(pre);
  }
  box.hidden = false;
}
