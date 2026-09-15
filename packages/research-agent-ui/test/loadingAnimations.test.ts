/**
 * @fileoverview Unit tests for the chat loader pool: the spinner registry read
 * off `grab-url/animations`, the `<Spinner>` variants folded in beside it, the
 * random picker, and SVG rendering.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    LOADING_ANIMATION_NAMES,
    QUANTUM_SPHERE_ANIMATION,
    SPINNER_ANIMATION_PREFIX,
    SPINNER_LOADING_ANIMATIONS,
    SVG_LOADING_ANIMATIONS,
    getRandomLoadingAnimation,
    getSpinnerVariant,
    renderLoadingAnimation,
} from '../src/components/ChatConversation/loading-animations';
import { SPINNER_VARIANTS } from '../src/ui/spinner';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('SVG_LOADING_ANIMATIONS', () => {
    it('collects the spinner factories exported by grab-url/animations', () => {
        const names = Object.keys(SVG_LOADING_ANIMATIONS);

        expect(names.length).toBeGreaterThan(1);
        expect(names.every((name) => name.startsWith('loading'))).toBe(true);
        expect(
            Object.values(SVG_LOADING_ANIMATIONS).every(
                (factory) => typeof factory === 'function',
            ),
        ).toBe(true);
    });

    it('drops the SVG twins of the <Spinner> variants', () => {
        expect(Object.keys(SVG_LOADING_ANIMATIONS)).not.toContain('loadingSpokes');
        expect(Object.keys(SVG_LOADING_ANIMATIONS)).not.toContain(
            'loadingEqualizerBars',
        );
    });
});

describe('SPINNER_LOADING_ANIMATIONS', () => {
    it('names every <Spinner> variant with the spinner prefix', () => {
        expect(SPINNER_LOADING_ANIMATIONS).toHaveLength(SPINNER_VARIANTS.length);
        expect(
            SPINNER_LOADING_ANIMATIONS.every((name) =>
                name.startsWith(SPINNER_ANIMATION_PREFIX),
            ),
        ).toBe(true);
    });
});

describe('getSpinnerVariant', () => {
    it('reads the variant back out of a spinner pool name', () => {
        for (const variant of SPINNER_VARIANTS) {
            expect(getSpinnerVariant(`${SPINNER_ANIMATION_PREFIX}${variant}`)).toBe(
                variant,
            );
        }
    });

    it('returns undefined for anything that is not a spinner pick', () => {
        expect(getSpinnerVariant(QUANTUM_SPHERE_ANIMATION)).toBeUndefined();
        expect(getSpinnerVariant('loadingSpinner')).toBeUndefined();
        expect(getSpinnerVariant(`${SPINNER_ANIMATION_PREFIX}nope`)).toBeUndefined();
    });
});

describe('LOADING_ANIMATION_NAMES', () => {
    it('includes the quantum sphere and every spinner, SVG and React alike', () => {
        expect(LOADING_ANIMATION_NAMES).toContain(QUANTUM_SPHERE_ANIMATION);
        expect(LOADING_ANIMATION_NAMES).toEqual(
            expect.arrayContaining(SPINNER_LOADING_ANIMATIONS),
        );
        expect(LOADING_ANIMATION_NAMES).toHaveLength(
            Object.keys(SVG_LOADING_ANIMATIONS).length +
                SPINNER_LOADING_ANIMATIONS.length +
                1,
        );
    });

    it('has no duplicates', () => {
        expect(new Set(LOADING_ANIMATION_NAMES).size).toBe(
            LOADING_ANIMATION_NAMES.length,
        );
    });
});

describe('getRandomLoadingAnimation', () => {
    it('always returns a name from the pool', () => {
        for (let i = 0; i < 50; i++) {
            expect(LOADING_ANIMATION_NAMES).toContain(getRandomLoadingAnimation());
        }
    });

    it('stays in range when the RNG bottoms out', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);

        expect(LOADING_ANIMATION_NAMES).toContain(getRandomLoadingAnimation());
    });

    it('stays in range when the RNG tops out', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.999999);

        expect(LOADING_ANIMATION_NAMES).toContain(getRandomLoadingAnimation());
    });

    it('never repeats the previous pick', () => {
        let previous = getRandomLoadingAnimation();

        for (let i = 0; i < 50; i++) {
            const next = getRandomLoadingAnimation();
            expect(next).not.toBe(previous);
            previous = next;
        }
    });

    it('eventually returns more than two distinct animations', () => {
        const seen = new Set(
            Array.from({ length: 200 }, () => getRandomLoadingAnimation()),
        );

        expect(seen.size).toBeGreaterThan(2);
    });
});

describe('renderLoadingAnimation', () => {
    it('renders a sized, animated svg for a known spinner', () => {
        const name = Object.keys(SVG_LOADING_ANIMATIONS)[0];

        const svg = renderLoadingAnimation(name, 64);

        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('width="64px"');
        expect(svg).toContain('height="64px"');
    });

    it('returns an empty string for a name it does not render', () => {
        expect(renderLoadingAnimation('nope', 64)).toBe('');
        expect(renderLoadingAnimation(QUANTUM_SPHERE_ANIMATION, 64)).toBe('');
        expect(renderLoadingAnimation(SPINNER_LOADING_ANIMATIONS[0], 64)).toBe('');
    });
});
