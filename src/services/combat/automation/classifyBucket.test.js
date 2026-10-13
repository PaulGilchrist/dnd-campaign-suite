import { describe, it, expect } from 'vitest';
import { classifyBucket, isChargeableBucket, FREE_BUCKETS } from './classifyBucket.js';

describe('classifyBucket (L5-002 §7.2)', () => {
    it('classifies by explicit sheet lane first (row type)', () => {
        expect(classifyBucket({ type: 'Bonus Action' })).toBe('bonusAction');
        expect(classifyBucket({ type: 'Reaction' })).toBe('reaction');
        expect(classifyBucket({ type: 'Special Action' })).toBe('special');
        expect(classifyBucket({ type: 'Passive' })).toBe('passive');
    });

    it('classifies automation info by action field', () => {
        expect(classifyBucket({ automation: { action: 'bonus_action' } })).toBe('bonusAction');
        expect(classifyBucket({ automation: { action: 'reaction' } })).toBe('reaction');
        expect(classifyBucket({ automation: { action: 'none' } })).toBe('free');
    });

    it('classifies by casting_time (canonical + compound + bare)', () => {
        expect(classifyBucket({ casting_time: '1 Action' })).toBe('action');
        expect(classifyBucket({ casting_time: '1 bonus action' })).toBe('bonusAction');
        expect(classifyBucket({ casting_time: 'bonus action' })).toBe('bonusAction'); // normalizer
        expect(classifyBucket({ casting_time: '1 reaction' })).toBe('reaction');
        expect(classifyBucket({ casting_time: 'passive' })).toBe('passive');
        // Compound forms the normalizer passes through still classify by leading form.
        expect(classifyBucket({ casting_time: '1 bonus action (ritual)' })).toBe('bonusAction');
    });

    it('defaults unknown subjects to action (safe chargeable direction)', () => {
        expect(classifyBucket(null)).toBe('action');
        expect(classifyBucket(undefined)).toBe('action');
        expect(classifyBucket('nope')).toBe('action');
        expect(classifyBucket({ name: 'Mystery' })).toBe('action');
        expect(classifyBucket({ casting_time: '1 minute' })).toBe('action');
    });

    it('row lane beats casting_time (explicit wins)', () => {
        expect(classifyBucket({ type: 'Bonus Action', casting_time: '1 action' })).toBe('bonusAction');
    });

    it('multi-attack is still one action (charges the slot, not attack count)', () => {
        // Extra Attack style: one action row, many attacks attached.
        expect(classifyBucket({ type: 'Action', automation: { action: 'attack', attacks: 3 } })).toBe('action');
    });
});

describe('isChargeableBucket (L5-002)', () => {
    it('charges action/bonus/reaction, frees the rest', () => {
        expect(isChargeableBucket('action')).toBe(true);
        expect(isChargeableBucket('bonusAction')).toBe(true);
        expect(isChargeableBucket('reaction')).toBe(true);
        expect(isChargeableBucket('free')).toBe(false);
        expect(isChargeableBucket('special')).toBe(false);
        expect(isChargeableBucket('passive')).toBe(false);
        expect(FREE_BUCKETS).toContain('special');
    });
});
