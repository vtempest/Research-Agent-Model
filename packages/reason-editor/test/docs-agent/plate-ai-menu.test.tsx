/**
 * Mounts the bubble menu's AI entry point over a real Plate editor: the button
 * `FloatingToolbarButtons` renders, and the panel it opens.
 *
 * The value is the wiring rather than any one control — the button, the
 * per-editor controller and the panel have to agree about the plugin key and
 * the captured range, and a mismatch there is invisible until someone selects
 * text in the browser.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Plate, usePlateEditor } from 'platejs/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AIMenu } from '@/docs-agent/plate/ui/ai-menu';
import { AIToolbarButton } from '@/docs-agent/plate/ui/ai-toolbar-button';
import { platePlugins } from '@/docs-agent/plate/plate-editor-config';
import { Toolbar } from '@/docs-agent/plate/ui/toolbar';

function AiHarness() {
  const editor = usePlateEditor({
    plugins: platePlugins,
    value: [{ children: [{ text: 'The cat sat on the mat.' }], type: 'p' }],
  });

  return (
    <Plate editor={editor}>
      {/* The button is a Radix toolbar item; the bubble menu is its real root. */}
      <Toolbar>
        <AIToolbarButton>Ask AI</AIToolbarButton>
      </Toolbar>
      <AIMenu />
    </Plate>
  );
}

/** The panel portals to `document.body`, not into the harness container. */
const panel = () => document.body.querySelector('[role="dialog"][aria-label="Ask AI"]');

describe('plate bubble menu AI', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root.render(<AiHarness />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the Ask AI button without a plugin or hook error', () => {
    const button = container.querySelector('button');

    expect(button).not.toBeNull();
    expect(button!.textContent).toContain('Ask AI');
  });

  it('opens the command panel on click, and closes it on Escape', async () => {
    expect(panel()).toBeNull();

    await act(async () => {
      container.querySelector('button')!.click();
    });

    const opened = panel();
    expect(opened).not.toBeNull();
    // The caret is collapsed, so only the caret-safe commands are offered.
    expect(opened!.textContent).toContain('Continue writing');
    expect(opened!.textContent).not.toContain('Improve writing');

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(panel()).toBeNull();
  });
});
