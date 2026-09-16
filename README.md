# RegEq with digits

Checks whether two regular expressions describe the same language. If they don't, it shows the shortest string that tells them apart.

**Live:** https://nexkiv.github.io/regeq/

Based on [RegEq](https://bakkot.github.io/dfa-lib/regeq.html) by Kevin Gibbons (Stanford CS103). The original reserves digits for repeat counts. Here digits are ordinary letters, and a few things are added.

## Syntax

From loosest to tightest binding:

| Write            | Meaning                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `a \| b`         | Union. Either side may be empty, so `a\|` matches `a` or nothing.     |
| `a b`            | Concatenation.                                                        |
| `a?`, `a*`, `a+` | Zero or one, zero or more, one or more.                               |
| `a^N`            | Exactly N copies. Every digit right after `^` is part of N.           |
| `a^{N}`          | The same, but the braces end the count: `1^{2}3` is `113`.            |
| `(a)`            | Grouping. `()` is the empty string.                                   |
| `ε`              | The empty string.                                                     |
| `Σ`              | Any one letter of the alphabet. If Σ = {0, 1}, `Σ` means `(0\|1)`.    |
| `\x`             | The character `x` itself, e.g. `\*`, `\ε`, `\Σ`, or `\ ` for a space. |
| anything else    | A letter, including digits and `{ } [ ] . -`.                         |

Spaces are ignored, except around counts. A space ends an unbraced count (`1^2 3` is `113`), and a count can't start with or contain a space.

**The alphabet.** Σ is every letter that appears in either expression. The optional **Σ =** box sets it by hand instead: list letters separated by commas or spaces, like `0, 1, 2` (braces are optional). Ranges like `0-9` aren't supported; write `\-` for a dash.

## Development

Requires Node.js (the version in `.nvmrc`).

```sh
npm ci              # install exact dependency versions
npm run dev         # local server at http://localhost:5173/regeq/
npm test            # unit tests (Vitest)
npm run lint        # ESLint
npm run format      # Prettier (format:check to verify only)
npm run build       # type-check and build to dist/
npm run preview     # serve the built site
```

### Layout

```
index.html              page markup
src/main.ts             wires the page to the checker
src/worker.ts           runs checks in a background thread
src/render.ts           shows results as a claim and proof
src/examples.ts         the Examples table and the ε/Σ insert keys
src/styles.css          styles (light and dark)
src/engine/syntax.ts    tokenizer, parser, Σ-box parser
src/engine/automata.ts  NFA/DFA construction and the search for a distinguishing string
src/engine/check.ts     check(): the one function the page calls
test/                   unit tests for the engine
```

### How it works

`check()` parses both expressions into trees, builds a Thompson NFA for each, and searches the product of their (lazily built) DFAs breadth-first for a string accepted by exactly one. Breadth-first order makes each counterexample the shortest possible, and the alphabetically first among those. Very large inputs are refused, or the search stops after 250,000 state pairs.

### Deployment

GitHub Actions (`.github/workflows/ci.yml`) runs the format check, lint, tests, and build on every push and pull request. Pushes to `main` then publish `dist/` to GitHub Pages. Versions that fail never go live.

### Picking this up later

The dependency versions are pinned in `package-lock.json`, so `npm ci` rebuilds the same toolchain. If CI fails after a long break, update the Node version in `.nvmrc` and the action versions in `ci.yml` first.

## License

[MIT](LICENSE)
