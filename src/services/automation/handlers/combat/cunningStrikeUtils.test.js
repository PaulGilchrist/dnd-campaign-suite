// @maintained-by-ai
// FT-106 + CANONICAL UNIT HOME for the Cunning Strike validators
// (cunningStrikeUtils.js): validateCunningStrikeOption full gate matrices
// (Charger push / Trip size gates incl. relative-vs-absolute discrimination,
// unknown & missing sizes, unknown sizeLimit passthrough, the requires /
// tool-prerequisite branch), getCombatContextSync cs-cache contract, and
// applyCunningStrikeCost accumulator + log composition. attackRiderHandler
// lanes (main + charger-size-gate) pin the handler-level wiring ONLY and
// defer these internals here. Deterministic, fully mocked, turn-based.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockCombatSummary = null;

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => mockCombatSummary),
}));

import { getCombatContextSync, validateCunningStrikeOption, applyCunningStrikeCost } from './cunningStrikeUtils.js';

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

    it('Medium charger vs Gargantuan target → refused, full reason names max allowed and player size', () => {
        stampCreatures([{ name: 'Titan', size: 'Gargantuan' }]);
        const result = validateCunningStrikeOption(pushOption, 'Titan', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Target is Gargantuan (too large for Charger push — only up to Large allowed when player is Medium).');
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

    it('Large charger vs Huge target → allowed (one size larger)', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const result = validateCunningStrikeOption(pushOption, 'Fire Giant 1', mediumCharger({ size: 'Large' }),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('gate is player-relative, not absolute: Small charger vs Medium allowed but vs Large refused', () => {
        stampCreatures([
            { name: 'Orc 1', size: 'Medium' },
            { name: 'Ogre 1', size: 'Large' },
        ]);
        const smallCharger = { name: 'HalflingRogue', size: 'Small' };
        expect(validateCunningStrikeOption(pushOption, 'Orc 1', smallCharger,
            (name) => getCombatContextSync(name, campaignName))).toEqual({ valid: true });
        const tooBig = validateCunningStrikeOption(pushOption, 'Ogre 1', smallCharger,
            (name) => getCombatContextSync(name, campaignName));
        expect(tooBig.valid).toBe(false);
        expect(tooBig.reason).toContain('too large for Charger push');
        expect(tooBig.reason).toContain('only up to Medium');
        expect(tooBig.reason).toContain('when player is Small');
    });

    it('unknown-size target → lenient allow', () => {
        const result = validateCunningStrikeOption(pushOption, 'Mystery Target', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('charger with a size outside the size scale → lenient allow even vs Huge', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const result = validateCunningStrikeOption(pushOption, 'Fire Giant 1', mediumCharger({ size: 'Enormous' }),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('charger missing size field → defaults Medium and still gates vs Huge', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const result = validateCunningStrikeOption(pushOption, 'Fire Giant 1', { name: 'EvasiveFighter' },
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('when player is Medium');
    });

    it('missing target name → lenient allow (no lookup performed)', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        expect(validateCunningStrikeOption(pushOption, null, mediumCharger(),
            (name) => getCombatContextSync(name, campaignName)).valid).toBe(true);
        expect(validateCunningStrikeOption(pushOption, '', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName)).valid).toBe(true);
    });

    it('damage_bonus option (no sizeLimit) is unaffected by huge target', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const result = validateCunningStrikeOption({ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d8' },
            'Fire Giant 1', mediumCharger(), (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('unrecognised sizeLimit key passes through both gates even vs Gargantuan', () => {
        stampCreatures([{ name: 'Titan', size: 'Gargantuan' }]);
        const result = validateCunningStrikeOption(
            { name: 'Shove', effect: 'push', value: 5, sizeLimit: 'huge_or_smaller' },
            'Titan', mediumCharger(), (name) => getCombatContextSync(name, campaignName));
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

    it('Gargantuan target → refused with full pinned reason', () => {
        stampCreatures([{ name: 'Titan', size: 'Gargantuan' }]);
        const result = validateCunningStrikeOption(tripOption, 'Titan', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Target is Gargantuan (too large for Trip — only Large or smaller affected).');
    });

    it('Large target → allowed', () => {
        stampCreatures([{ name: 'Ogre 1', size: 'Large' }]);
        const result = validateCunningStrikeOption(tripOption, 'Ogre 1', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('trip limit is absolute, not charger-relative: Huge charger vs Huge target → refused', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const result = validateCunningStrikeOption(tripOption, 'Fire Giant 1', mediumCharger({ size: 'Huge' }),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('too large for Trip');
    });

    it('unknown-size target → lenient allow', () => {
        const result = validateCunningStrikeOption(tripOption, 'Mystery Target', mediumCharger(),
            (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(true);
    });

    it('missing target name → lenient allow', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        expect(validateCunningStrikeOption(tripOption, null, mediumCharger(),
            (name) => getCombatContextSync(name, campaignName)).valid).toBe(true);
    });
});

describe('validateCunningStrikeOption — requires branch (tool/item prerequisite)', () => {
    const poisonOption = { name: 'Poison', effect: 'poison', cost: '1d6', requires: "Poisoner's Kit" };

    function validate(option, playerStats) {
        return validateCunningStrikeOption(option, 'Goblin 1', playerStats,
            (name) => getCombatContextSync(name, campaignName));
    }

    it('tool proficiency match (case-insensitive substring) → allowed', () => {
        const result = validate(poisonOption, mediumCharger({
            toolProficiencies: ["poisoner's kit", "Thieves' tools"],
            inventory: { equipped: [], backpack: [] },
        }));
        expect(result.valid).toBe(true);
    });

    it('item as equipped object with name → allowed even without proficiency', () => {
        const result = validate(poisonOption, mediumCharger({
            toolProficiencies: [],
            inventory: { equipped: [{ name: "Poisoner's Kit" }], backpack: [] },
        }));
        expect(result.valid).toBe(true);
    });

    it('item as backpack string → allowed', () => {
        const result = validate(poisonOption, mediumCharger({
            toolProficiencies: [],
            inventory: { equipped: [], backpack: ["Poisoner's Kit"] },
        }));
        expect(result.valid).toBe(true);
    });

    it('nameless inventory entries are skipped → refused', () => {
        const result = validate(poisonOption, mediumCharger({
            toolProficiencies: [],
            inventory: { equipped: [{ id: 'mystery-slot' }], backpack: ['Rope'] },
        }));
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("Requires Poisoner's Kit which the character does not have.");
    });

    it('no proficiencies and no inventory at all → refused', () => {
        expect(validate(poisonOption, mediumCharger()).valid).toBe(false);
        expect(validate(poisonOption, { name: 'EvasiveFighter', size: 'Medium' }).valid).toBe(false);
    });

    it('requires check runs before the size gates (kit missing + Huge target → requires reason)', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const tripRequiringKit = { name: 'Trip', effect: 'prone', sizeLimit: 'large_or_smaller', requires: "Poisoner's Kit" };
        const result = validateCunningStrikeOption(
            tripRequiringKit,
            'Fire Giant 1', mediumCharger(), (name) => getCombatContextSync(name, campaignName));
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("Requires Poisoner's Kit which the character does not have.");

        // With the kit present, the same option falls through to the size gate.
        const withKit = validateCunningStrikeOption(
            tripRequiringKit,
            'Fire Giant 1',
            mediumCharger({ toolProficiencies: ["Poisoner's Kit"] }),
            (name) => getCombatContextSync(name, campaignName));
        expect(withKit.valid).toBe(false);
        expect(withKit.reason).toContain('too large for Trip');
    });
});

describe('applyCunningStrikeCost (Sneak Attack dice accumulator + log)', () => {
    const playerStats = { name: 'EvasiveFighter' };
    let getRuntimeValue, setRuntimeValue, addEntry;

    beforeEach(() => {
        getRuntimeValue = vi.fn(() => undefined);
        setRuntimeValue = vi.fn(async () => {});
        addEntry = vi.fn(async () => {});
    });

    async function run(costD6) {
        await applyCunningStrikeCost({ playerStats, campaignName, costD6, getRuntimeValue, setRuntimeValue, addEntry });
    }

    it('fresh turn (undefined in store) → writes costD6 to _cunningStrikeCostUsed with exact args', async () => {
        await run(2);
        expect(getRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_cunningStrikeCostUsed', campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_cunningStrikeCostUsed', 2, campaignName);
    });

    it('accumulates onto existing spend (both nonzero inputs: 1 + 2 → 3)', async () => {
        getRuntimeValue.mockReturnValue(1);
        await run(2);
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_cunningStrikeCostUsed', 3, campaignName);
    });

    it('logs ability_use entry with full pinned description', async () => {
        await run(2);
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Cunning Strike',
            description: 'Forgoing 2d6 Sneak Attack damage dice for Cunning Strike cost.',
        });
    });

    it('rejected log write is swallowed (console.error) without failing the cost write', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        addEntry.mockRejectedValueOnce(new Error('log down'));
        await expect(run(1)).resolves.toBeUndefined();
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_cunningStrikeCostUsed', 1, campaignName);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });
});
