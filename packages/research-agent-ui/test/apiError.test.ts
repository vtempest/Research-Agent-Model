/**
 * @fileoverview Unit tests for reading a message out of a generated-client error.
 */
import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from '../src/lib/apiError';

describe('apiErrorMessage', () => {
    it('reads the { message } shape the app handlers return', () => {
        expect(apiErrorMessage({ message: 'Authentication required' }, 401)).toBe(
            'Authentication required',
        );
    });

    it('reads the { error } shape the article route returns', () => {
        expect(apiErrorMessage({ error: 'Failed to fetch article' }, 500)).toBe(
            'Failed to fetch article',
        );
    });

    it('prefers message over the other keys', () => {
        expect(apiErrorMessage({ message: 'first', error: 'second' }, 500)).toBe('first');
    });

    it('falls back to the status instead of "undefined" for a body with no message', () => {
        // The regression: a platform 500 answers with a body this app never wrote,
        // and reading `.message` off it rendered the literal string "undefined".
        expect(apiErrorMessage({}, 500)).toBe('HTTP 500');
        expect(apiErrorMessage(undefined, 500)).toBe('HTTP 500');
        expect(apiErrorMessage({ message: '   ' }, 500)).toBe('HTTP 500');
    });

    it('uses a plain-text error body as the message', () => {
        expect(apiErrorMessage('Internal Server Error', 500)).toBe('Internal Server Error');
    });

    it('does not surface an HTML error page as the message', () => {
        expect(apiErrorMessage('<!DOCTYPE html><title>500</title>', 500)).toBe('HTTP 500');
    });

    it('truncates a long message so a toast stays readable', () => {
        const result = apiErrorMessage('x'.repeat(500), 500);
        expect(result).toHaveLength(200);
        expect(result.endsWith('…')).toBe(true);
    });

    it('says so when the request never reached the server', () => {
        expect(apiErrorMessage(undefined, undefined)).toBe('Unknown error');
    });
});
