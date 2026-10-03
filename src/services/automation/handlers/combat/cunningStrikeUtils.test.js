// FT-106: Charger push / Trip size-gate regression matrix.
// The live size source is the combatSummary cache (cs creatures carry `size`);
// unknown sizes stay lenient, cs-known sizes MUST gate.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockCombatSummary = null;

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => mockCombatSummary),
}));

import { getCombatContextSync, validateCunningStrikeOption } from './cunningStrikeUtils.js';

const campaignName = 'test-campaign';

function stampCreatures(creatures) {
    mockCombatSummary = { round: 1, creatures };
}

function mediumCharger(overrides = {}) {
    return { name: 'EvasiveFighter', size: 'Medium', ...overrides };
}

beforeEach(() => {
    mockCombatSummary = null;
});

describe('getCombatContextSync (cs-cache size source)', () => {
    it('returns {name, size} for a cached combatant with a known size', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        expect(getCombatContextSync('Fire Giant 1', campaignName)).toEqual({ name: 'Fire Giant 1', size: 'Huge' });
    });

    it('returns null for a combatant not in the cache', () => {
        stampCreatures([{ name: 'Goblin 1', size: 'Small' }]);
        expect(getCombatContextSync('Fire Giant 1', campaignName)).toBeNull();
    });

    it('returns null when the cache is empty or campaign unknown (lenient)', () => {
        expect(getCombatContextSync('Fire Giant 1', campaignName)).toBeNull();
        stampCreatures([{ name: 'Fire Giant 1' }]);
        expect(getCombatContextSync('Fire Giant 1', campaignName)).toBeNull();
        expect(getCombatContextSync(null, campaignName)).toBeNull();
    });
});

describe('validateCunningStrikeOption — Charger push size gate', () => {
    const pushOption = { name: 'Push 10 ft', effect: 'push', value: 10, sizeLimit: 'one_size_larger' };

    it('Medium charger vs Huge target → refused with size reason', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const result = validateCunningStrikeOption(pushOption, 'Fire Giant 1', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('too large for Charger push');
        expect(result.reason).toContain('Huge');
    });

    it('Medium charger vs Large target → allowed', () => {
        stampCreatures([{ name: 'Hill Giant 1', size: 'Large' }]);
        const result = validateCunningStrikeOption(pushOption, 'Hill Giant 1', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('Medium charger vs Small target → allowed', () => {
        stampCreatures([{ name: 'Goblin 1', size: 'Small' }]);
        const result = validateCunningStrikeOption(pushOption, 'Goblin 1', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('unknown-size target → lenient allow', () => {
        const result = validateCunningStrikeOption(pushOption, 'Mystery Target', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('Large charger vs Huge target → allowed (one size larger)', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const result = validateCunningStrikeOption(pushOption, 'Fire Giant 1', mediumCharger({ size: 'Large' }),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('damage_bonus option (no sizeLimit) is unaffected by huge target', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const result = validateCunningStrikeOption({ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d8' },
            'Fire Giant 1', mediumCharger(), (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });
});

describe('validateCunningStrikeOption — Trip size gate (revived by same source)', () => {
    const tripOption = { name: 'Trip', effect: 'prone', sizeLimit: 'large_or_smaller' };

    it('Huge target → refused with Trip size reason', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const result = validateCunningStrikeOption(tripOption, 'Fire Giant 1', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('too large for Trip');
    });

    it('Large target → allowed', () => {
        stampCreatures([{ name: 'Ogre 1', size: 'Large' }]);
        const result = validateCunningStrikeOption(tripOption, 'Ogre 1', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('unknown-size target → lenient allow', () => {
        const result = validateCunningStrikeOption(tripOption, 'Mystery Target', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });
});
