/**
 * @module html-to-content/prism-global
 * @description Owns the Prism instance: publishes it on `globalThis`, then
 * registers the language grammars that prismjs' own entry point leaves out —
 * without ever depending on module evaluation order.
 *
 * The `prismjs/components/*` files are plain browser scripts, not modules:
 * `prism-markup.js` literally opens with `Prism.languages.markup = {...}`,
 * resolving `Prism` as a free variable off the global object. Someone has to
 * put it there first. prismjs' own entry point does that for `window`
 * (browser) and `global` (Node); on Cloudflare Workers / edge runtimes it sees
 * neither, which is what the assignment below is for.
 *
 * Publishing it is only half the job, though: it has to happen *before* the
 * grammar scripts run, and a static `import "prismjs/components/..."` cannot
 * promise that once a bundler is in the loop. Those files declare no
 * dependency on Prism — reading a global is invisible to the module graph — so
 * nothing pins them after whoever publishes it, and a bundler is free to hoist
 * them, split them into another chunk, or drop the publishing statement as a
 * dead `globalThis` write. When that happens the chunk dies on load with
 * `ReferenceError: Prism is not defined`, which takes down the whole route
 * that lazily imported it rather than just the syntax highlighting.
 *
 * So the grammars are loaded with `import()` from inside `loadPrismGrammars()`
 * instead. The global is published by a statement earlier in that same
 * function body, which makes the ordering a runtime fact rather than a promise
 * the bundler has to keep.
 */
import Prism from "prismjs";
/**
 * Registers the grammars above, once per runtime. Cheap to call repeatedly —
 * callers are meant to invoke it wherever they are about to highlight, so that
 * the work does not hinge on a module-level statement surviving tree-shaking.
 *
 * Never rejects: a grammar that fails to load just leaves its language out of
 * `Prism.languages`, which every caller already treats as "render this block
 * unhighlighted".
 */
export declare function loadPrismGrammars(): Promise<void>;
export default Prism;
