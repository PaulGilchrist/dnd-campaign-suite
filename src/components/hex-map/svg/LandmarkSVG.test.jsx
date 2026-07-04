import { describe, it, expect } from 'vitest';
import LandmarkSVG from './LandmarkSVG.jsx';

describe('LandmarkSVG', () => {
    it('should have displayName LandmarkSVG', () => {
        expect(LandmarkSVG.displayName).toBe('LandmarkSVG');
    });
});
