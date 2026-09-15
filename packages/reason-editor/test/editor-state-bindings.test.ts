/**
 * Guards the editor shell against calling a state setter that no longer
 * exists.
 *
 * `useReasonDocsState` holds the workspace's UI state, and its setters are
 * plain locals — nothing type-checks this package before it ships, because
 * the library builds through Vite/esbuild, which transpiles without running
 * `tsc`. So when the `leftSplit`/`rightSplit` flags were dropped in favour of
 * inferring a split from the panel list, a leftover `setLeftSplit(true)` in a
 * mount effect survived the build and threw `ReferenceError: setLeftSplit is
 * not defined` on first render, taking the whole workspace tree down with it.
 *
 * The check is deliberately textual rather than a render test: the failure is
 * a dangling identifier, and every `setSomething(...)` call in these modules
 * has to resolve to a binding declared in the same file (a `useState` /
 * `useLocalStorage` tuple, a destructured prop, a parameter) or to a browser
 * global. Setters reached through an object — `state.setSplitViewDocId(...)`
 * — are somebody else's contract and are left alone.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const EDITOR_DIR = path.resolve(import.meta.dirname, '../src/editor');

/** Timer setters that are ambient globals, not module-local bindings. */
const GLOBAL_SETTERS = new Set(['setTimeout', 'setInterval', 'setImmediate']);

/** A bare (non-member) `setX` identifier reference. */
const SETTER_REFERENCE = /(?<![.\w$])(set[A-Z]\w*)/g;

/**
 * Blanks out comments and string/template literals so identifiers mentioned
 * in prose or in a storage key are not mistaken for code.
 */
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/**
 * Returns the setter names a module calls without ever declaring them.
 *
 * A name that appears somewhere other than immediately before `(` — as the
 * second half of a `useState` tuple, in a returned object, in a parameter
 * list — counts as declared; a name that only ever appears as a call is a
 * dangling reference.
 */
function unresolvedSetters(source: string): string[] {
  const code = stripCommentsAndStrings(source);
  const followers = new Map<string, Set<string>>();

  for (const match of code.matchAll(SETTER_REFERENCE)) {
    const name = match[1];
    const next = code.slice(match.index + match[0].length).trimStart().slice(0, 1);
    const seen = followers.get(name) ?? new Set<string>();
    seen.add(next);
    followers.set(name, seen);
  }

  const unresolved: string[] = [];
  for (const [name, seen] of followers) {
    const isCalled = seen.has('(');
    const isDeclared = [...seen].some((follower) => follower !== '(');
    if (isCalled && !isDeclared && !GLOBAL_SETTERS.has(name)) unresolved.push(name);
  }
  return unresolved.sort();
}

const editorModules = fs
  .readdirSync(EDITOR_DIR)
  .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'));

describe('editor state setters', () => {
  it('finds modules to check', () => {
    expect(editorModules).toContain('useReasonDocsState.ts');
  });

  it.each(editorModules)('%s calls only setters it declares', (name) => {
    const source = fs.readFileSync(path.join(EDITOR_DIR, name), 'utf8');

    expect(unresolvedSetters(source)).toEqual([]);
  });

  it('catches a setter left behind by a removed state hook', () => {
    const withDanglingSetter = `
      const [leftPanels, setLeftPanels] = useLocalStorage("panels", []);
      useEffect(() => {
        setLeftPanels(["openTabs"]);
        setLeftSplit(true);
      }, []);
    `;

    expect(unresolvedSetters(withDanglingSetter)).toEqual(['setLeftSplit']);
  });
});
