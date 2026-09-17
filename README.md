# RegEq with digits

Checks whether two regular expressions describe the same language. If they don't, it shows the shortest string that tells them apart.

**Live:** https://nexkiv.github.io/regeq/

Based on [RegEq](https://bakkot.github.io/dfa-lib/regeq.html) by Kevin Gibbons (Stanford CS103). Compared with the original:

- **Digits are letters.** A count still follows `^` (`a^3`); write `a^{3}` or `a^3 ` (with a space) when a digit letter comes right after it.
- **`ε`** is the empty string, and **`Σ`** is any one letter of the alphabet.
- **An optional Σ box** sets the alphabet by hand. Left empty, Σ is every letter used in either expression.
- **`\x`** always means the character `x` itself.

The full syntax is in the **Syntax** section on the page (`index.html`), which is the reference.

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

`check()` parses both expressions into trees, builds a Thompson NFA for each, and searches the product of their (lazily built) DFAs breadth-first for a string accepted by exactly one. Breadth-first order makes each counterexample the shortest possible, and the first in character-code order among those. Very large inputs are refused, and the search stops at a fixed number of state pairs (`MAX_STATE_PAIRS`).

### Deployment

GitHub Actions (`.github/workflows/ci.yml`) runs the format check, lint, tests, and build on every push and pull request. Pushes to `main` then publish `dist/` to GitHub Pages. Versions that fail never go live.

### Picking this up later

The dependency versions are pinned in `package-lock.json`, so `npm ci` rebuilds the same toolchain. If CI fails after a long break, update the Node version in `.nvmrc` and the action versions in `ci.yml` first.

## License

[MIT](LICENSE)
