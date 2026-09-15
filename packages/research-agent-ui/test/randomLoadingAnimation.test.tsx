/**
 * @fileoverview Render tests for the chat's randomized "thinking" loader:
 * that it mounts an SVG spinner, a `<Spinner>` variant, or the quantum sphere
 * depending on the pick, and exposes a status role for screen readers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RandomLoadingAnimation from '../src/components/ChatConversation/RandomLoadingAnimation';
import {
    QUANTUM_SPHERE_ANIMATION,
    SPINNER_ANIMATION_PREFIX,
    SVG_LOADING_ANIMATIONS,
    getRandomLoadingAnimation,
} from '../src/components/ChatConversation/loading-animations';
import { SPINNER_VARIANTS } from '../src/ui/spinner';

// The picker is random by design, so stub it to force each branch.
vi.mock('../src/components/ChatConversation/loading-animations', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../src/components/ChatConversation/loading-animations')
    >()),
    getRandomLoadingAnimation: vi.fn(),
}));

/** Forces the next mount onto one specific animation. */
const pick = (name: string) => {
    vi.mocked(getRandomLoadingAnimation).mockReturnValue(name);
};

beforeEach(() => {
    pick(Object.keys(SVG_LOADING_ANIMATIONS)[0]);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('RandomLoadingAnimation', () => {
    it('renders a sized SVG spinner for an SVG pick', () => {
        pick('loadingSpinner');

        const { container } = render(<RandomLoadingAnimation size={64} />);

        expect(getRandomLoadingAnimation).toHaveBeenCalled();
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute('width')).toBe('64px');
        // loadingSpinner is the multi-colour rotating dial.
        expect(container.innerHTML).toContain('animateTransform');
    });

    it.each(SPINNER_VARIANTS)(
        'renders the %s <Spinner> variant when that is the pick',
        (variant) => {
            pick(`${SPINNER_ANIMATION_PREFIX}${variant}`);

            const { container } = render(<RandomLoadingAnimation size={48} />);

            const svg = container.querySelector('svg');
            expect(svg).toBeTruthy();
            expect(svg?.getAttribute('width')).toBe('48');
            // Spinner draws in the surrounding text colour rather than a fixed hex.
            expect(svg?.getAttribute('stroke')).toBe('currentColor');
            // Every variant animates, by CSS rotation or by SMIL.
            expect(
                container.innerHTML.includes('animate-spin') ||
                    container.innerHTML.includes('<animate'),
            ).toBe(true);
        },
    );

    it('renders the quantum sphere when that is the pick', () => {
        pick(QUANTUM_SPHERE_ANIMATION);

        const { container } = render(<RandomLoadingAnimation />);

        // The orbital sphere is built from CSS-animated divs, not an SVG.
        expect(container.innerHTML).toContain('orbitalSpin');
        expect(container.querySelector('svg')).toBeNull();
    });

    it('exposes a labelled status region for screen readers', () => {
        render(<RandomLoadingAnimation />);

        expect(screen.getByRole('status')).toHaveProperty('ariaLabel', 'Loading');
    });
});
