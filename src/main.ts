// Per-weight files carry unicode-range, so browsers download only the subsets a page uses.
import "@fontsource/stix-two-text/400.css";
import "@fontsource/stix-two-text/400-italic.css";
import "@fontsource/stix-two-text/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles.css";

import { LABEL, type CheckResult, type Field } from "./engine/check";
import {
  clearChecking,
  clearError,
  renderExamples,
  renderKeys,
  renderResult,
  setRemark,
  showChecking,
  showError,
} from "./render";
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
/** The most recent request; only its reply is shown. */
let latest: CheckRequest = { id: 0, r1: "", r2: "", sigma: "" };
let busy = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let checkingTimer: ReturnType<typeof setTimeout> | undefined;

function startWorker(): Worker {
  const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  w.addEventListener("message", (event: MessageEvent<CheckResponse>) => {
    if (event.data.id !== latest.id) return;
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
  clearChecking();
}

function clearErrors() {
  for (const { input, error } of Object.values(fields)) clearError(input, error);
}

function fail() {
  clearErrors();
  setRemark("Something went wrong checking these expressions.");
}

function show(result: CheckResult) {
  clearErrors();
  // Underline against the text that was checked, which may differ from what's typed by now.
  for (const { field, message, pos } of result.errors) {
    const { input, error } = fields[field];
    showError(input, error, latest[field], message, pos);
  }
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
  checkingTimer = setTimeout(() => {
    clearErrors();
    showChecking();
  }, SHOW_CHECKING_AFTER_MS);
  latest = {
    id: latest.id + 1,
    r1: fields.r1.input.value,
    r2: fields.r2.input.value,
    sigma: fields.sigma.input.value,
  };
  worker.postMessage(latest);
}

/** Checks the current input right away. */
function runNow() {
  clearTimeout(debounceTimer);
  send();
}

/** Checks the current input once typing pauses. */
function runSoon() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(send, DEBOUNCE_MS);
}

// ---- Wiring ----

renderExamples($("examples"), ({ r1, r2, sigma }) => {
  fields.r1.input.value = r1;
  fields.r2.input.value = r2;
  fields.sigma.input.value = sigma;
  runNow();
  window.scrollTo({
    top: 0,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
});

for (const field of ["r1", "r2"] as const) {
  const { input } = fields[field];
  renderKeys($(`keys-${field}`), LABEL[field], (text) => {
    input.setRangeText(text, input.selectionStart!, input.selectionEnd!, "end");
    input.focus();
    runNow();
  });
}

for (const { input } of Object.values(fields)) input.addEventListener("input", runSoon);
runNow();
