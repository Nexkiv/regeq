import "@fontsource/stix-two-text/latin-400.css";
import "@fontsource/stix-two-text/latin-400-italic.css";
import "@fontsource/stix-two-text/latin-600.css";
import "@fontsource/stix-two-text/latin-ext-400.css";
import "@fontsource/stix-two-text/greek-400.css";
import "@fontsource/stix-two-text/greek-400-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles.css";

import type { CheckResult, Field } from "./engine/check";
import { renderExamples, renderKeys } from "./examples";
import { clearError, renderResult, setChecking, setRemark, showError } from "./render";
import type { CheckRequest, CheckResponse } from "./worker";

const DEBOUNCE_MS = 150;
const SHOW_CHECKING_AFTER_MS = 250;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const fields: Record<Field, { input: HTMLInputElement; error: HTMLElement }> = {
  r1: { input: $("regex-1"), error: $("err-1") },
  r2: { input: $("regex-2"), error: $("err-2") },
  sigma: { input: $("sigma"), error: $("err-sigma") },
};

// ---- Background checks ----
// Each request gets a new id; only the reply to the latest one is shown. A worker that is still
// busy with an older request is terminated rather than left running.

let worker: Worker | null = null;
let latest = 0;
let busy = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let checkingTimer: ReturnType<typeof setTimeout> | undefined;

function startWorker(): Worker {
  const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  w.addEventListener("message", (event: MessageEvent<CheckResponse>) => {
    if (event.data.id !== latest) return;
    settle();
    if ("failed" in event.data) fail();
    else show(event.data.result);
  });
  w.addEventListener("error", (event) => {
    console.error(event);
    w.terminate();
    if (worker === w) worker = null;
    settle();
    fail();
  });
  return w;
}

function settle() {
  busy = false;
  clearTimeout(checkingTimer);
  setChecking(false);
}

function fail() {
  setRemark("Something went wrong checking these expressions.");
}

function show(result: CheckResult) {
  for (const { input, error } of Object.values(fields)) clearError(input, error);
  for (const { field, message, pos } of result.errors)
    showError(fields[field].input, fields[field].error, message, pos);
  renderResult(result);
}

function send() {
  if (busy) {
    worker?.terminate();
    worker = null;
  }
  worker ??= startWorker();
  busy = true;
  clearTimeout(checkingTimer);
  checkingTimer = setTimeout(() => setChecking(true), SHOW_CHECKING_AFTER_MS);
  const request: CheckRequest = {
    id: ++latest,
    r1: fields.r1.input.value,
    r2: fields.r2.input.value,
    sigma: fields.sigma.input.value,
  };
  worker.postMessage(request);
}

/** Checks the current input, after a short pause unless `now` is set. */
function run(now = false) {
  clearTimeout(debounceTimer);
  if (now) send();
  else debounceTimer = setTimeout(send, DEBOUNCE_MS);
}

// ---- Wiring ----

renderExamples($("examples"), ({ r1, r2, sigma }) => {
  fields.r1.input.value = r1;
  fields.r2.input.value = r2;
  fields.sigma.input.value = sigma;
  run(true);
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
    run(true);
  });
}

for (const { input } of Object.values(fields)) input.addEventListener("input", () => run());
run(true);
