/**
 * @fileoverview The provider boundary that took the site down.
 *
 * `QwkSearchProviders` mounts some chrome beside the page rather than inside
 * it — the dock, the toaster, the cookie banner, the spotlight palette. The
 * palette reads `useMainView()`, and for one release it sat *outside*
 * `MainViewProvider`: the hook threw during SSR, and because the provider
 * stack lives in the root layout, every route answered 500 — `/`, `/login`,
 * `/docs`, `/legal`, all of them.
 *
 * `spotlightPalette.test.tsx` could not catch it: that test wraps the palette
 * in `MainViewProvider` itself, so it proves the component works *given* the
 * context and says nothing about whether the shell actually supplies it.
 *
 * Two guards, because the fix has two halves:
 *
 *  - the structural one asserts the mount is on the right side of the
 *    provider, scanning the source in the same shape as
 *    `entryBoundaries.test.ts` — it is a decision about a tree, not about a
 *    rendered DOM, and it covers every consumer the shell mounts, including
 *    ones added later;
 *  - the behavioural one asserts that getting it wrong again degrades to
 *    inert chrome instead of a thrown error, so a single stray consumer can
 *    never again cost every route.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { useMainView } from '../src/app/MainViewProvider';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const PROVIDERS = join(SRC, 'app/QwkSearchProviders.tsx');

/** Every `.ts`/`.tsx` source file in the package, recursively. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

/**
 * The components that call `useMainView()`, by the name they are exported
 * under — derived from the source rather than listed, so a consumer added
 * after this test still has to land inside the provider.
 */
function mainViewConsumers(): string[] {
  return sourceFiles(SRC).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    // The provider's own module defines the hook; it is not a consumer.
    if (file === join(SRC, 'app/MainViewProvider.tsx')) return [];
    if (!/\buseMainView\s*\(/.test(source)) return [];
    return [...source.matchAll(/export\s+(?:function|const)\s+([A-Z]\w*)/g)].map(
      (match) => match[1],
    );
  });
}

describe('MainViewProvider boundary', () => {
  it('mounts every useMainView consumer inside MainViewProvider', () => {
    const source = readFileSync(PROVIDERS, 'utf8');

    const open = source.indexOf('<MainViewProvider');
    const close = source.indexOf('</MainViewProvider>');
    expect(open, 'QwkSearchProviders no longer mounts MainViewProvider').toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);

    const offenders = mainViewConsumers().filter((name) => {
      const mounted = source.indexOf(`<${name}`, source.indexOf('return ('));
      // Not mounted by this shell at all — someone else's tree to get right.
      if (mounted === -1) return false;
      return mounted < open || mounted > close;
    });

    expect(
      offenders,
      `${offenders.join(', ')} read useMainView() but are mounted outside ` +
        `MainViewProvider in ${relative(SRC, PROVIDERS)}. That throws during ` +
        `SSR, and the provider stack is in the root layout, so it answers 500 ` +
        `on every route — not just the one the component appears on.`,
    ).toEqual([]);
  });

  it('keeps the page itself inside the provider', () => {
    const source = readFileSync(PROVIDERS, 'utf8');
    const open = source.indexOf('<MainViewProvider');
    const close = source.indexOf('</MainViewProvider>');

    // The app's own pages consume the context too (the web app's home stack
    // reads `activeView`), so `children` is subject to the same rule. Anchored
    // on the scroll root to find the page's own mount rather than the
    // `PassThrough` helper's `{children}` further up the file.
    const page = source.indexOf('{children}', source.indexOf('app-scroll-root'));
    expect(page, 'the page is no longer mounted inside the scroll root').toBeGreaterThan(-1);
    expect(page).toBeGreaterThan(open);
    expect(page).toBeLessThan(close);
  });

  it('renders a detached consumer inert instead of throwing', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Detached() {
      const { activeView, docsEnabled, setActiveView, requestFilesSidebar } = useMainView();
      return (
        <button type="button" onClick={() => setActiveView('docs')}>
          {`${activeView}:${docsEnabled}:${typeof requestFilesSidebar}`}
        </button>
      );
    }

    // No provider anywhere above it — the exact shape of the outage.
    expect(() => render(<Detached />)).not.toThrow();
    expect(screen.getByRole('button').textContent).toBe('research:false:function');

    warn.mockRestore();
  });
});
