// @maintained-by-ai 2026-11-26
// CANONICAL UNIT HOME for the Cunning Strike pure utils (cunningStrikeUtils.js):
// validateCunningStrikeOption full gate matrices (Charger push player-relative
// gate vs Trip absolute gate, lenient pass-through branches, unknown/off-scale
// sizes, unrecognised sizeLimit passthrough, the requires tool-prerequisite
// branch and its ordering before the size gates), getCombatContextSync cs-cache
// contract, and applyCunningStrikeCost accumulator + log composition. The
// resolveRoundStamp stamp-shape contract is pinned consumer-side by
// steps/attackRollRiders.test.js (object + number forms) — not re-pinned here.
// attackRiderHandler lanes (main + charger-size-gate) pin handler wiring ONLY.
// Pure-function truth tables with full-shape toEqual pins; the only mock is the
// combatData cache so size lookups are deterministic. Turn-based.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockCombatSummary = null;

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => mockCombatSummary),
}));

import { getCombatContextSync, validateCunningStrikeOption, applyCunningStrikeCost, isCunningStrikeFeatureName } from './cunningStrikeUtils.js';

const campaignName = 'test-campaign';

function stampCreatures(creatures) {
    mockCombatSummary = { round: 1, creatures };
}

// The lookup closure every production caller threads into the validator.
const context = (name) => getCombatContextSync(name, campaignName);

const pushOption = { name: 'Push 10 ft', effect: 'push', value: 10, sizeLimit: 'one_size_larger' };
const tripOption = { name: 'Trip', effect: 'prone', sizeLimit: 'large_or_smaller' };
const poisonOption = { name: 'Poison', effect: 'poison', cost: '1d6', requires: "Poisoner's Kit" };

function charger(size) {
    return { name: 'EvasiveFighter', size };
}

describe('getCombatContextSync (cs-cache size source)', () => {
    it('returns {name, size} for a cached combatant with a known size', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        expect(getCombatContextSync('Fire Giant 1', campaignName)).toEqual({ name: 'Fire Giant 1', size: 'Huge' });
    });

    it('returns null on every indeterminate path (missing name, not cached, empty cache, cached without size)', () => {
        stampCreatures([{ name: 'Goblin 1', size: 'Small' }]);
        expect(getCombatContextSync(null, campaignName)).toBeNull();
        expect(getCombatContextSync('Fire Giant 1', campaignName)).toBeNull();
        mockCombatSummary = null;
        expect(getCombatContextSync('Fire Giant 1', campaignName)).toBeNull();
        stampCreatures([{ name: 'Fire Giant 1' }]);
        expect(getCombatContextSync('Fire Giant 1', campaignName)).toBeNull();
    });
});

describe('validateCunningStrikeOption — Charger push size gate', () => {
    it('Medium charger vs Gargantuan → refused with full player-relative reason', () => {
        stampCreatures([{ name: 'Titan', size: 'Gargantuan' }]);
        expect(validateCunningStrikeOption(pushOption, 'Titan', charger('Medium'), context)).toEqual({
            valid: false,
            reason: 'Target is Gargantuan (too large for Charger push — only up to Large allowed when player is Medium).',
        });
    });

    it('gate is player-relative, not absolute: Small charger keeps Large refused at the shifted boundary', () => {
        stampCreatures([{ name: 'Ogre 1', size: 'Large' }]);
        expect(validateCunningStrikeOption(pushOption, 'Ogre 1', charger('Small'), context)).toEqual({
            valid: false,
            reason: 'Target is Large (too large for Charger push — only up to Medium allowed when player is Small).',
        });
    });

    it('charger missing size field → defaults Medium and still gates vs Huge', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        expect(validateCunningStrikeOption(pushOption, 'Fire Giant 1', { name: 'EvasiveFighter' }, context)).toEqual({
            valid: false,
            reason: 'Target is Huge (too large for Charger push — only up to Large allowed when player is Medium).',
        });
    });

    it.each([
        ['Large target is exactly one size larger than Medium charger', 'Medium', 'Hill Giant 1', [{ name: 'Hill Giant 1', size: 'Large' }], pushOption],
        ['Small target sits below the limit', 'Medium', 'Goblin 1', [{ name: 'Goblin 1', size: 'Small' }], pushOption],
        ['Large charger vs Huge keeps relative headroom', 'Large', 'Fire Giant 1', [{ name: 'Fire Giant 1', size: 'Huge' }], pushOption],
        ['target not in the combat cache (unknown size)', 'Medium', 'Mystery Target', [{ name: 'Goblin 1', size: 'Small' }], pushOption],
        ['target size off the size scale', 'Medium', 'Weird Thing', [{ name: 'Weird Thing', size: 'Enormous' }], pushOption],
        ['charger size off the size scale even vs Huge', 'Enormous', 'Fire Giant 1', [{ name: 'Fire Giant 1', size: 'Huge' }], pushOption],
        ['missing target name → no lookup performed', 'Medium', null, [{ name: 'Fire Giant 1', size: 'Huge' }], pushOption],
        ['option without sizeLimit (damage_bonus) vs Huge', 'Medium', 'Fire Giant 1', [{ name: 'Fire Giant 1', size: 'Huge' }], { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d8' }],
        ['unrecognised sizeLimit key passes through vs Gargantuan', 'Medium', 'Titan', [{ name: 'Titan', size: 'Gargantuan' }], { name: 'Shove', effect: 'push', value: 5, sizeLimit: 'huge_or_smaller' }],
    ])('%s → allowed', (_label, chargerSize, target, creatures, option) => {
        stampCreatures(creatures);
        expect(validateCunningStrikeOption(option, target, charger(chargerSize), context)).toEqual({ valid: true });
    });
});

describe('validateCunningStrikeOption — Trip size gate (absolute limit)', () => {
    it('Gargantuan target → refused with full pinned reason', () => {
        stampCreatures([{ name: 'Titan', size: 'Gargantuan' }]);
        expect(validateCunningStrikeOption(tripOption, 'Titan', charger('Medium'), context)).toEqual({
            valid: false,
            reason: 'Target is Gargantuan (too large for Trip — only Large or smaller affected).',
        });
    });

    it('limit is absolute, not charger-relative: Huge charger vs Huge target → refused with Huge reason', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        expect(validateCunningStrikeOption(tripOption, 'Fire Giant 1', charger('Huge'), context)).toEqual({
            valid: false,
            reason: 'Target is Huge (too large for Trip — only Large or smaller affected).',
        });
    });

    it.each([
        ['Large target sits at the limit', 'Ogre 1', [{ name: 'Ogre 1', size: 'Large' }]],
        ['target not in the combat cache (unknown size)', 'Mystery Target', [{ name: 'Goblin 1', size: 'Small' }]],
        ['target size off the size scale', 'Weird Thing', [{ name: 'Weird Thing', size: 'Colossal' }]],
        ['missing target name → no lookup performed', null, [{ name: 'Fire Giant 1', size: 'Huge' }]],
    ])('%s → allowed', (_label, target, creatures) => {
        stampCreatures(creatures);
        expect(validateCunningStrikeOption(tripOption, target, charger('Medium'), context)).toEqual({ valid: true });
    });
});

describe('validateCunningStrikeOption — requires branch (tool/item prerequisite)', () => {
    function validate(playerStats) {
        return validateCunningStrikeOption(poisonOption, 'Goblin 1', playerStats, context);
    }

    it.each([
        ["tool proficiency match (case-insensitive substring)", { toolProficiencies: ["poisoner's kit", "Thieves' tools"], inventory: { equipped: [], backpack: [] } }],
        ["item as equipped object with name, even without proficiency", { toolProficiencies: [], inventory: { equipped: [{ name: "Poisoner's Kit" }], backpack: [] } }],
        ['item as backpack string', { toolProficiencies: [], inventory: { equipped: [], backpack: ["Poisoner's Kit"] } }],
    ])('required kit matched via %s → allowed', (_label, inventoryStats) => {
        expect(validate({ ...charger('Medium'), ...inventoryStats })).toEqual({ valid: true });
    });

    it.each([
        ['nameless inventory entries are skipped', { toolProficiencies: [], inventory: { equipped: [{ id: 'mystery-slot' }], backpack: ['Rope'] } }],
        ['no proficiencies and no inventory at all', {}],
    ])('%s → refused with requires reason', (_label, stats) => {
        expect(validate({ name: 'EvasiveFighter', size: 'Medium', ...stats })).toEqual({
            valid: false,
            reason: "Requires Poisoner's Kit which the character does not have.",
        });
    });

    it('requires check runs before the size gates (kit missing + Huge target → requires reason)', () => {
        stampCreatures([{ name: 'Fire Giant 1', size: 'Huge' }]);
        const tripRequiringKit = { ...tripOption, requires: "Poisoner's Kit" };
        expect(validateCunningStrikeOption(tripRequiringKit, 'Fire Giant 1', charger('Medium'), context)).toEqual({
            valid: false,
            reason: "Requires Poisoner's Kit which the character does not have.",
        });

        // With the kit present, the same option falls through to the size gate.
        expect(validateCunningStrikeOption(tripRequiringKit, 'Fire Giant 1',
            { ...charger('Medium'), toolProficiencies: ["Poisoner's Kit"] }, context)).toEqual({
            valid: false,
            reason: 'Target is Huge (too large for Trip — only Large or smaller affected).',
        });
    });
});

describe('applyCunningStrikeCost (Sneak Attack dice accumulator + log)', () => {
    const playerStats = { name: 'EvasiveFighter' };
    let getRuntimeValue, setRuntimeValue, addEntry;

    beforeEach(() => {
        getRuntimeValue = vi.fn();
        setRuntimeValue = vi.fn(async () => {});
        addEntry = vi.fn(async () => {});
    });

    async function run(costD6) {
        await applyCunningStrikeCost({ playerStats, campaignName, costD6, getRuntimeValue, setRuntimeValue, addEntry });
    }

    it.each([
        ['fresh turn (undefined in store coerces to 0)', undefined, 2, 2],
        ['accumulates onto existing spend', 1, 2, 3],
    ])('%s → writes the total to _cunningStrikeCostUsed with exact args', async (_label, stored, costD6, total) => {
        getRuntimeValue.mockReturnValue(stored);
        await run(costD6);
        expect(getRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_cunningStrikeCostUsed', campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_cunningStrikeCostUsed', total, campaignName);
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

describe('isCunningStrikeFeatureName (canonical CS-family name list)', () => {
    it.each([
        ['Cunning Strike', true],
        ['Improved Cunning Strike', true],
        ['Devious Strikes', true],
        ['Hamstring', false],
        ["Stalker's Flurry", false],
        [undefined, false],
    ])('isCunningStrikeFeatureName(%o) → %s', (name, expected) => {
        expect(isCunningStrikeFeatureName(name)).toBe(expected);
    });
});
