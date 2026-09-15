/**
 * @fileoverview Guards the package's two entry points against each other.
 *
 * `research-agent-ui` (root) is the app *without* the REASON editor;
 * `research-agent-ui/workspace` is the same app *with* it. That split only
 * means anything if the root entry's import graph genuinely never reaches
 * `react-reason-editor` — a single stray import anywhere under it would drag
 * the editor's (very large) dependency tree into every chat-only consumer's
 * bundle, silently, with nothing else failing.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/** Extensions tried when resolving an extensionless relative import. */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Resolves a relative import the way the bundler does, or `null` if it is not a module we can follow. */
function resolveRelative(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => resolve(base, 'index' + ext)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every `from '…'` / `import('…')` specifier in a source file. */
function readSpecifiers(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const patterns = [
    /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1]),
  );
}

/**
 * Walks the whole static import graph reachable from `entry`, returning every
 * bare (npm) specifier it depends on, directly or transitively.
 */
function collectBareImports(entry: string): Set<string> {
  const bare = new Set<string>();
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    for (const spec of readSpecifiers(file)) {
      if (!spec.startsWith('.')) {
        bare.add(spec);
        continue;
      }
      const target = resolveRelative(file, spec);
      // Non-module relative imports (`.css`, `.svg`) have nothing to follow.
      if (target && /\.[jt]sx?$/.test(target)) queue.push(target);
    }
  }

  return bare;
}

const isEditorImport = (spec: string) => spec.startsWith('react-reason-editor');

describe('entry boundaries', () => {
  it('never reaches the REASON editor from the root entry', () => {
    const leaked = [...collectBareImports(resolve(SRC, 'index.ts'))].filter(isEditorImport);

    expect(leaked).toEqual([]);
  });

  it('does reach the REASON editor and its sidebar from the workspace entry', () => {
    // The inverse assertion: without it, the check above would still pass if
    // the walker silently stopped resolving anything.
    const imports = [...collectBareImports(resolve(SRC, 'workspace.ts'))];

    expect(imports).toContain('react-reason-editor/reason-docs');
    expect(imports).toContain('react-reason-editor-sidebar');
  });

  it('re-exports the whole root entry from the workspace entry', () => {
    // Hosts that want documents should need only one import path.
    const workspace = readFileSync(resolve(SRC, 'workspace.ts'), 'utf8');

    expect(workspace).toMatch(/export \* from '\.\/index'/);
  });
});
