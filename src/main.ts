import "@fontsource/stix-two-text/latin-400.css";
import "@fontsource/stix-two-text/latin-400-italic.css";
import "@fontsource/stix-two-text/latin-600.css";
import "@fontsource/stix-two-text/latin-ext-400.css";
import "@fontsource/stix-two-text/greek-400.css";
import "@fontsource/stix-two-text/greek-400-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles.css";

import { check, type Field } from "./engine/check";
import { renderExamples, renderKeys } from "./examples";
import { clearError, renderResult, setRemark, showError } from "./render";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const fields: Record<Field, { input: HTMLInputElement; error: HTMLElement }> = {
  r1: { input: $("regex-1"), error: $("err-1") },
  r2: { input: $("regex-2"), error: $("err-2") },
  sigma: { input: $("sigma"), error: $("err-sigma") },
};

function run() {
  for (const { input, error } of Object.values(fields)) clearError(input, error);
  let result;
  try {
    result = check(fields.r1.input.value, fields.r2.input.value, fields.sigma.input.value);
  } catch (e) {
    console.error(e);
    setRemark("Something went wrong checking these expressions.");
    return;
  }
  for (const { field, message, pos } of result.errors)
    showError(fields[field].input, fields[field].error, message, pos);
  renderResult(result);
}

renderExamples($("examples"), ({ r1, r2, sigma }) => {
  fields.r1.input.value = r1;
  fields.r2.input.value = r2;
  fields.sigma.input.value = sigma;
  run();
  window.scrollTo({
    top: 0,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
});

for (const [field, label] of [
  ["r1", "R₁"],
  ["r2", "R₂"],
] as const) {
  const { input } = fields[field];
  renderKeys($(`keys-${field}`), label, (text) => {
    input.setRangeText(text, input.selectionStart!, input.selectionEnd!, "end");
    input.focus();
    run();
  });
}

for (const { input } of Object.values(fields)) input.addEventListener("input", run);
run();
