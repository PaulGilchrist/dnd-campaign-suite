// @maintained-by-ai
// Copy pin for the shared rejected-load notice (backlog map-fresh-fallback-
// silent): both loaders and the acceptance criteria key off these exact
// bytes — "Could not load" + the quoted map name + the fresh-copy
// explanation + the re-save hint.
import { describe, it, expect } from 'vitest';
import { buildMapLoadRejectedNotice } from './mapLoadNotice.js';

describe('buildMapLoadRejectedNotice', () => {
    it('names the dead map and explains the fresh-copy fallback', () => {
        expect(buildMapLoadRejectedNotice('battle-arena')).toBe(
            'Could not load "battle-arena" — opened a fresh copy. Make an edit to save it back.',
        );
    });
});
