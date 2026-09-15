/**
 * Coverage for the tab-close arithmetic behind the Open Tabs panel's
 * "Close Tabs Below" and "Close Other Tabs" actions, which close a batch of
 * tabs at once and must leave the right tab active.
 */

import { describe, expect, it } from 'vitest';

import { closeTabs } from '@/editor/tabState';

describe('closeTabs', () => {
  it('removes every requested tab in one pass', () => {
    const result = closeTabs(['a', 'b', 'c', 'd'], 'a', ['b', 'c', 'd']);

    expect(result.openTabs).toEqual(['a']);
    expect(result.closed).toEqual(['b', 'c', 'd']);
  });

  it('leaves the active tab alone when it survives', () => {
    const result = closeTabs(['a', 'b', 'c'], 'a', ['b', 'c']);

    expect(result.activeTabId).toBe('a');
  });

  it('activates the nearest tab to the left when the active tab is closed', () => {
    const result = closeTabs(['a', 'b', 'c', 'd'], 'd', ['c', 'd']);

    expect(result.activeTabId).toBe('b');
  });

  it('falls back to the right when nothing survives to the left', () => {
    const result = closeTabs(['a', 'b', 'c'], 'a', ['a', 'b']);

    expect(result.activeTabId).toBe('c');
  });

  it('clears the active tab when every tab is closed', () => {
    const result = closeTabs(['a', 'b'], 'b', ['a', 'b']);

    expect(result.openTabs).toEqual([]);
    expect(result.activeTabId).toBeNull();
  });

  it('reports closed tabs in display order regardless of request order', () => {
    const result = closeTabs(['a', 'b', 'c'], 'a', ['c', 'b']);

    expect(result.closed).toEqual(['b', 'c']);
  });

  it('ignores IDs that are not open and leaves state untouched', () => {
    const openTabs = ['a', 'b'];
    const result = closeTabs(openTabs, 'a', ['ghost']);

    expect(result.closed).toEqual([]);
    expect(result.openTabs).toBe(openTabs);
    expect(result.activeTabId).toBe('a');
  });

  it('handles a single close the same way as the old one-tab path', () => {
    const result = closeTabs(['a', 'b', 'c'], 'b', ['b']);

    expect(result.openTabs).toEqual(['a', 'c']);
    expect(result.activeTabId).toBe('a');
  });
});
