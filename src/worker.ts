// Runs checks off the main thread so large expressions never freeze the page.
import { check, type CheckResult } from "./engine/check";

export type CheckRequest = { id: number; r1: string; r2: string; sigma: string };
export type CheckResponse = { id: number; result: CheckResult } | { id: number; failed: true };

self.addEventListener("message", (event: MessageEvent<CheckRequest>) => {
  const { id, r1, r2, sigma } = event.data;
  let response: CheckResponse;
  try {
    response = { id, result: check(r1, r2, sigma) };
  } catch (error) {
    console.error(error);
    response = { id, failed: true };
  }
  // With the DOM lib, the worker's global scope is typed as Window.
  (self as unknown as Worker).postMessage(response);
});
