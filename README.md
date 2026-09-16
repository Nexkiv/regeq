# RegEq with digits

Checks whether two regular expressions describe the same language. If they don't, it shows the shortest string that tells them apart.

**Live:** https://nexkiv.github.io/regeq/

Based on [RegEq](https://bakkot.github.io/dfa-lib/regeq.html) by Kevin Gibbons (Stanford CS103). The original treats digits as repeat counts only. In this version, digits are ordinary letters, and:

- `a^N` still repeats `a` N times. Write `a^{N}` or `a^N ` (with a trailing space) when a digit letter comes right after the count.
- `ε` is the empty string (`\ε` for a literal ε).
- `\x` makes any character a literal, e.g. `\*`, `\|`, `\ `.

It's a single static `index.html` with no build step or dependencies (fonts come from Google Fonts).
