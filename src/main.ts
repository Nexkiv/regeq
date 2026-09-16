import "@fontsource/stix-two-text/latin-400.css";
import "@fontsource/stix-two-text/latin-400-italic.css";
import "@fontsource/stix-two-text/latin-600.css";
import "@fontsource/stix-two-text/latin-ext-400.css";
import "@fontsource/stix-two-text/greek-400.css";
import "@fontsource/stix-two-text/greek-400-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles.css";

import { buildNFA, compare, lazyDFA } from "./engine/automata";
import { firstForeign, parse, parseSigma, symbols, type Node } from "./engine/syntax";
import { EXAMPLES } from "./examples";
import {
  clearError,
  lang,
  setClaim,
  setProof,
  setRemark,
  show,
  showError,
  subject,
} from "./render";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const inputs = [$<HTMLInputElement>("regex-1"), $<HTMLInputElement>("regex-2")];
const errs = [$("err-1"), $("err-2")];
const sigmaInput = $<HTMLInputElement>("sigma");
const sigmaErr = $("err-sigma");
const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const exBody = $("examples");
for (const { r1: a, r2: b, sigma: sig, shows: what } of EXAMPLES) {
  const tr = document.createElement("tr");
  const cell = (text: string, cls: string) => {
    const td = document.createElement("td");
    td.className = cls;
    td.textContent = text;
    tr.appendChild(td);
    return td;
  };
  cell(a, "expr");
  cell(b, "expr");
  cell(sig ? `{${sig}}` : "", "expr");
  cell(what, "dim");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "load";
  btn.textContent = "Load";
  btn.setAttribute("aria-label", `Load ${a} and ${b}`);
  btn.addEventListener("click", () => {
    inputs[0].value = a;
    inputs[1].value = b;
    sigmaInput.value = sig;
    run();
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  });
  cell("", "act").appendChild(btn);
  exBody.appendChild(tr);
}

document.querySelectorAll<HTMLButtonElement>(".key").forEach((key) => {
  key.addEventListener("click", () => {
    const x = $<HTMLInputElement>(key.dataset.target!);
    const start = x.selectionStart ?? x.value.length;
    const end = x.selectionEnd ?? x.value.length;
    x.setRangeText(key.dataset.insert!, start, end, "end");
    x.focus();
    run();
  });
});

function run() {
  [0, 1].forEach((k) => clearError(inputs[k], errs[k]));
  clearError(sigmaInput, sigmaErr);

  if (inputs.every((x) => !x.value.trim())) {
    setRemark("Enter two regular expressions to compare them.");
    return;
  }

  const asts: (Node | null)[] = inputs.map((input, k) => {
    try {
      return parse(input.value);
    } catch (e) {
      showError(input, errs[k], e as { msg: string; pos?: number });
      return null;
    }
  });

  let given: Set<string> | null = null;
  if (sigmaInput.value.trim()) {
    try {
      given = parseSigma(sigmaInput.value);
    } catch (e) {
      showError(sigmaInput, sigmaErr, e as { msg: string; pos?: number });
      setRemark("Fix the error in Σ to see a result.");
      return;
    }
  }

  // With Σ given, every letter in the expressions must belong to it.
  if (given) {
    asts.forEach((ast, k) => {
      const bad = ast && firstForeign(ast, given);
      if (bad) {
        showError(inputs[k], errs[k], {
          msg: `“${show(bad.c)}” isn't in Σ. Add it to Σ, or clear Σ to use the letters in the expressions.`,
          pos: bad.pos,
        });
        asts[k] = null;
      }
    });
  }

  const [ast1, ast2] = asts;
  if (!ast1 || !ast2) {
    const which = !ast1 && !ast2 ? "both expressions" : !ast1 ? "R₁" : "R₂";
    setRemark(`Fix the error in ${which} to see a result.`);
    return;
  }

  const alphabet = [...(given || symbols(ast1, symbols(ast2, new Set())))].sort(byCode);

  let result;
  try {
    const d1 = lazyDFA(buildNFA(ast1, alphabet));
    const d2 = lazyDFA(buildNFA(ast2, alphabet));
    result = compare(d1, d2, alphabet);
  } catch (e) {
    setRemark((e as { msg?: string }).msg || String(e));
    return;
  }
  if (result.tooBig) {
    setRemark(
      "These expressions are too large to check: the combined automaton passes 250,000 states. Try smaller repeat counts.",
    );
    return;
  }

  const sigma = alphabet.length ? `Σ = {${alphabet.map(show).join(", ")}}` : "Σ = ∅";
  const pairs = result.explored.toLocaleString();
  const { only1, only2 } = result;

  if (!only1 && !only2) {
    setClaim("eq", 1, "=", 2);
    setProof(
      `Over ${sigma}, a breadth-first search of the product automaton reaches ${pairs} state ${result.explored === 1 ? "pair" : "pairs"}, and in none of them does exactly one expression accept.`,
    );
  } else if (only1 && only2) {
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
  } else {
    const [big, small, w] = only1 ? ([1, 2, only1] as const) : ([2, 1, only2!] as const);
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
}

[...inputs, sigmaInput].forEach((x) => x.addEventListener("input", run));
run();
