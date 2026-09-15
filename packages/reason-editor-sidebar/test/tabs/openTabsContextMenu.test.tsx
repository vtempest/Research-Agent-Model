/**
 * Regression coverage for the Open Tabs context menu's bulk actions.
 * "Close Tabs Below" and "Close Other Tabs" must hand every affected tab
 * over in a single `onTabsClose` call — closing them one at a time through
 * `onTabClose` made each close read the same pre-close tab list, so only the
 * last one stuck and the rest of the tabs stayed open.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarContent } from '../../src/SidebarContent';
import type { OpenTabItem } from '../../src/layout/sidebar/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const TABS: OpenTabItem[] = [
  { id: 'a', title: 'Alpha', kind: 'file' },
  { id: 'b', title: 'Beta', kind: 'file' },
  { id: 'c', title: 'Gamma', kind: 'file' },
  { id: 'chat-1', title: 'A chat', kind: 'chat' },
];

interface RenderOptions {
  activeTab?: string | null;
  onTabsClose?: (ids: string[]) => void;
  onTabClose?: (id: string) => void;
  onTabChange?: (id: string) => void;
}

const renderPanel = ({ activeTab = 'a', onTabsClose, onTabClose, onTabChange }: RenderOptions) => {
  act(() => {
    root.render(
      <SidebarContent
        panels={['openTabs']}
        persistenceKey="test"
        activeDocuments={[]}
        activeId={activeTab ?? null}
        tabItems={TABS}
        activeTab={activeTab}
        onTabsClose={onTabsClose}
        onTabClose={onTabClose}
        onTabChange={onTabChange}
        onSelect={() => {}}
        onAdd={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onMove={() => {}}
      />,
    );
  });
};

/** Opens the context menu for `title`'s tab row and clicks `itemLabel`. */
const runMenuItem = (title: string, itemLabel: string) => {
  const row = Array.from(container.querySelectorAll('span[data-state] > div'))
    .find((el) => el.textContent === title);
  if (!row) throw new Error(`No tab row for "${title}"`);

  act(() => {
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });

  const item = Array.from(document.querySelectorAll('[role="menuitem"]'))
    .find((el) => el.textContent?.trim() === itemLabel) as HTMLElement | undefined;
  if (!item) throw new Error(`No "${itemLabel}" menu item`);

  act(() => {
    item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  return item;
};

describe('Open Tabs bulk close actions', () => {
  it('closes every tab below the target in one call', () => {
    const onTabsClose = vi.fn();
    renderPanel({ onTabsClose });

    runMenuItem('Beta', 'Close Tabs Below');

    expect(onTabsClose).toHaveBeenCalledTimes(1);
    expect(onTabsClose).toHaveBeenCalledWith(['c', 'chat-1']);
  });

  it('closes every other tab, files and chats alike, in one call', () => {
    const onTabsClose = vi.fn();
    renderPanel({ onTabsClose });

    runMenuItem('Beta', 'Close Other Tabs');

    expect(onTabsClose).toHaveBeenCalledTimes(1);
    expect(onTabsClose).toHaveBeenCalledWith(['a', 'c', 'chat-1']);
  });

  it('activates the surviving tab when the batch closes the active one', () => {
    const onTabChange = vi.fn();
    renderPanel({ activeTab: 'a', onTabsClose: vi.fn(), onTabChange });

    runMenuItem('Beta', 'Close Other Tabs');

    expect(onTabChange).toHaveBeenCalledWith('b');
  });

  it('leaves the active tab alone when it survives the batch', () => {
    const onTabChange = vi.fn();
    renderPanel({ activeTab: 'a', onTabsClose: vi.fn(), onTabChange });

    runMenuItem('Beta', 'Close Tabs Below');

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('falls back to per-tab closes when the host has no batch handler', () => {
    const onTabClose = vi.fn();
    renderPanel({ onTabClose });

    runMenuItem('Beta', 'Close Other Tabs');

    expect(onTabClose.mock.calls.map(([id]) => id)).toEqual(['a', 'c', 'chat-1']);
  });

  it('disables the bulk actions when there is nothing to close', () => {
    renderPanel({ onTabsClose: vi.fn() });

    const item = runMenuItem('A chat', 'Close Tabs Below');
    expect(item.getAttribute('data-disabled')).not.toBeNull();
  });
});
