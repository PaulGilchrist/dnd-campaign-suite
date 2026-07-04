import { describe, it, expect } from 'vitest';
import HazardSVG from './HazardSVG.jsx';

describe('HazardSVG', () => {
    it('should have displayName HazardSVG', () => {
        expect(HazardSVG.displayName).toBe('HazardSVG');
    });
});
