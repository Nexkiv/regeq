import type { CheckResult } from "./engine/check";
import { el } from "./render";

export type Example = {
  r1: string;
  r2: string;
  sigma: string;
  shows: string;
  expected: CheckResult["status"];
};

export const EXAMPLES: Example[] = [
  { r1: "(0|1)*0", r2: "(1*0)+", sigma: "", shows: "strings ending in 0", expected: "equal" },
  { r1: "(0|1)*", r2: "0*1*", sigma: "", shows: "a proper subset", expected: "differ" },
  { r1: "(0|ε)1*", r2: "0?1*", sigma: "", shows: "ε inside a union", expected: "equal" },
  { r1: "Σ*1Σ*", r2: "0*1(0|1)*", sigma: "", shows: "Σ as any letter", expected: "equal" },
  { r1: "Σ*", r2: "0*", sigma: "0, 1", shows: "Σ set by hand", expected: "differ" },
  { r1: "1^{2}3", r2: "113", sigma: "", shows: "braces ending a count", expected: "equal" },
  {
    r1: "(0|1)^3",
    r2: "000|001|010|011|100|101|110",
    sigma: "",
    shows: "one missing string",
    expected: "differ",
  },
];

/** Symbols that are awkward to type, offered as insert buttons next to each expression box. */
export const INSERT_KEYS = [
  { text: "ε", className: "key eps" },
  { text: "Σ", className: "key" },
];

export function renderExamples(tbody: HTMLElement, onLoad: (example: Example) => void) {
  for (const example of EXAMPLES) {
    const { r1, r2, sigma, shows } = example;
    const load = el("button", "load", "Load") as HTMLButtonElement;
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

export function renderKeys(
  container: HTMLElement,
  label: string,
  onInsert: (text: string) => void,
) {
  for (const { text, className } of INSERT_KEYS) {
    const key = el("button", className, text) as HTMLButtonElement;
    key.type = "button";
    key.title = `Insert ${text}`;
    key.setAttribute("aria-label", `Insert ${text} into ${label}`);
    key.addEventListener("click", () => onInsert(text));
    container.append(key);
  }
}
