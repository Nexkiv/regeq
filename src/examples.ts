export type Example = { r1: string; r2: string; sigma: string; shows: string };

export const EXAMPLES: Example[] = [
  { r1: "(0|1)*0", r2: "(1*0)+", sigma: "", shows: "strings ending in 0" },
  { r1: "(0|1)*", r2: "0*1*", sigma: "", shows: "a proper subset" },
  { r1: "(0|ε)1*", r2: "0?1*", sigma: "", shows: "ε inside a union" },
  { r1: "Σ*1Σ*", r2: "0*1(0|1)*", sigma: "", shows: "Σ as any letter" },
  { r1: "Σ*", r2: "0*", sigma: "0, 1", shows: "Σ set by hand" },
  { r1: "1^{2}3", r2: "113", sigma: "", shows: "braces ending a count" },
  { r1: "(0|1)^3", r2: "000|001|010|011|100|101|110", sigma: "", shows: "one missing string" },
];
