// CLA-337 regression: 60-ft isWithinRange gate wired + ability_use spend log + honest option text
import { vi } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_expr) => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 15, oldHp: 20, damageReduced: false })),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
    isWithinRangeOf: vi.fn(async () => true),
    isDistanceInRange: vi.fn(() => true),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(async () => ({
        attackEvent: { rollType: 'attack', attackerName: 'Orc' },
        attackerName: 'Orc',
        targetName: 'TestHero',
        totalDamage: 10,
    })),
}));

beforeEach(() => { vi.resetAllMocks(); });
import { describe, it, expect } from 'vitest';
import {
    handleStormsThunder,
    handleStormsThunderDirect,
} from './giantAncestryHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { GIANT_OPTIONS } from './giantAncestryOptions.js';
import { makeAction, makePlayerStats } from './giantAncestry.test.setup.js';

const directAction = {
    name: "Storm's Thunder",
    automation: {
        type: 'storms_thunder',
        damage: '1d8',
        damageType: 'Thunder',
        range: '60_ft',
        trigger: 'damage_received_within_range',
        uses: 'proficiency_bonus',
        recharge: 'long_rest',
        casting_time: '1 reaction',
    },
};

const option = { name: "Storm's Thunder", type: 'reaction_damage', damage: '1d8', damageType: 'Thunder', range: '60_ft' };

function makeUsesMock(usesKey, value) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === usesKey) return value;
        return null;
    });
}

describe('CLA-337 Storms Thunder 60ft gate + spend log', () => {
    describe('handleStormsThunderDirect', () => {
        it('consults isWithinRange with attacker→self and 60ft, and logs ability_use spend on activation', async () => {
            makeUsesMock('stormsThunderUses', 3);
            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(isWithinRange).toHaveBeenCalledWith('Orc', 'TestHero', 60);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: "Storm's Thunder",
                description: expect.stringContaining('2 uses remaining'),
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Orc',
                damageType: 'Thunder',
            }));
        });

        it('refuses and logs when attacker is out of range, consuming no use', async () => {
            makeUsesMock('stormsThunderUses', 3);
            isWithinRange.mockResolvedValueOnce(false);
            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('out of range');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'storms_thunder_refused',
                characterName: 'TestHero',
            }));
            const loggedTypes = addEntry.mock.calls.map(c => c[1]?.type);
            expect(loggedTypes).not.toContain('ability_use');
            expect(loggedTypes).not.toContain('roll');
        });
    });

    describe('handleStormsThunder (dispatch/option variant)', () => {
        it('consults isWithinRange with attacker→self and 60ft, and logs ability_use spend on activation', async () => {
            makeUsesMock('stormsThunderUses', 3);
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(isWithinRange).toHaveBeenCalledWith('Orc', 'TestHero', 60);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: "Storm's Thunder",
                description: expect.stringContaining('2 uses remaining'),
            }));
        });

        it('refuses and logs when attacker is out of range, consuming no use', async () => {
            makeUsesMock('stormsThunderUses', 3);
            isWithinRange.mockResolvedValueOnce(false);
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('out of range');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'storms_thunder_refused',
            }));
            const loggedTypes = addEntry.mock.calls.map(c => c[1]?.type);
            expect(loggedTypes).not.toContain('ability_use');
            expect(loggedTypes).not.toContain('roll');
        });
    });

    describe('option text', () => {
        it('no longer claims a ranged spell attack roll (auto-hit canonical wording)', async () => {
            const stormsThunder = GIANT_OPTIONS.find(o => o.name === "Storm's Thunder");
            expect(stormsThunder).toBeDefined();
            expect(stormsThunder.description).not.toMatch(/ranged spell attack/i);
            expect(stormsThunder.description).not.toMatch(/on a hit/i);
            expect(stormsThunder.description).toContain('within 60 feet');
            expect(stormsThunder.description).toContain('Reaction');
        });
    });
});
