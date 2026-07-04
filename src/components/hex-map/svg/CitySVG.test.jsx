import { describe, it, expect } from 'vitest';
import CitySVG from './CitySVG.jsx';

describe('CitySVG', () => {
    it('should have displayName CitySVG', () => {
        expect(CitySVG.displayName).toBe('CitySVG');
    });
});
