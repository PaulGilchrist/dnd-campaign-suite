import { isWithinRange, isDistanceInRange } from './rangeCheck.js';

describe('rangeCheck', () => {
    describe('isWithinRange', () => {
        it('returns true when rangeFt is null', () => {
            expect(isWithinRange({ gridX: 1, gridY: 1 }, { gridX: 5, gridY: 5 }, null)).toBe(true);
            expect(isWithinRange({ gridX: 1, gridY: 1 }, { gridX: 5, gridY: 5 }, undefined)).toBe(true);
        });

        it('returns true when distance is null (can not be calculated)', () => {
            expect(isWithinRange(null, { gridX: 5, gridY: 5 }, 30)).toBe(true);
            expect(isWithinRange({ gridX: 1, gridY: 1 }, null, 30)).toBe(true);
        });

        it('returns true when within range', () => {
            expect(isWithinRange({ gridX: 10, gridY: 10 }, { gridX: 10, gridY: 10 }, 30)).toBe(true);
            expect(isWithinRange({ gridX: 10, gridY: 10 }, { gridX: 13, gridY: 10 }, 30)).toBe(true);
        });

        it('returns true at exact range boundary', () => {
            const pos1 = { gridX: 10, gridY: 10 };
            const pos2 = { gridX: 10, gridY: 16 }; // 30 ft exactly
            expect(isWithinRange(pos1, pos2, 30)).toBe(true);
        });

        it('returns false when beyond range', () => {
            const pos1 = { gridX: 10, gridY: 10 };
            const pos2 = { gridX: 10, gridY: 17 }; // 35 ft
            expect(isWithinRange(pos1, pos2, 30)).toBe(false);
        });

        it('returns true for diagonal distance within range', () => {
            // Diagonal 3 squares = 25 ft
            const pos1 = { gridX: 10, gridY: 10 };
            const pos2 = { gridX: 12, gridY: 12 };
            expect(isWithinRange(pos1, pos2, 30)).toBe(true);
        });

        it('returns false for diagonal distance beyond range', () => {
            // Diagonal 5 squares ≈ 35.4 ft
            const pos1 = { gridX: 10, gridY: 10 };
            const pos2 = { gridX: 15, gridY: 15 };
            expect(isWithinRange(pos1, pos2, 30)).toBe(false);
        });
    });

    describe('isDistanceInRange', () => {
        it('returns true when rangeFt is null', () => {
            expect(isDistanceInRange(25, null)).toBe(true);
            expect(isDistanceInRange(25, undefined)).toBe(true);
        });

        it('returns true when dist is null', () => {
            expect(isDistanceInRange(null, 30)).toBe(true);
            expect(isDistanceInRange(undefined, 30)).toBe(true);
        });

        it('returns true when within range', () => {
            expect(isDistanceInRange(20, 30)).toBe(true);
            expect(isDistanceInRange(0, 30)).toBe(true);
        });

        it('returns true at exact range boundary', () => {
            expect(isDistanceInRange(30, 30)).toBe(true);
        });

        it('returns false when beyond range', () => {
            expect(isDistanceInRange(35, 30)).toBe(false);
            expect(isDistanceInRange(100, 30)).toBe(false);
        });
    });
});
