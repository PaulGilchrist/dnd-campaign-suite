import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './autoRerollHandler.js';

// Re-import after mocking
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn((r) => {
        const m = String(r).match(/^(\d+)_?ft$/i);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

function makeAction(overrides = {}) {
    return {
        name: 'Test Auto Reroll',
        description: 'Reroll ability.',
        automation: {
            type: 'auto_reroll',
            bonus: 2,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { class_levels: [{ level: 1, bardic_inspiration_uses: 3 }] },
        level: 1,
        resources: {},
        ...overrides,
    };
}

describe('autoRerollHandler - bonus path own attack miss->hit damage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return null;
            return null;
        });
    });

    it('should apply damage when own attack miss turns into hit with bonus', async () => {
        vi.mocked(rollExpression).mockReturnValue({ total: 10, rolls: [7, 3], modifier: 0 });
        vi.mocked(getCombatContext).mockResolvedValue({ creatures: [] });
        vi.mocked(applyDamageToTarget).mockReturnValue({ finalDamage: 10 });

        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d8', damageType: 'piercing', targetName: 'Orc' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 5 },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(rollExpression).toHaveBeenCalledWith('2d8');
        expect(getCombatContext).toHaveBeenCalledWith('test-campaign');
        expect(applyDamageToTarget).toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Orc',
            })
        );
    });

    it('should skip damage when damageFormula is missing on own attack miss->hit', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 5 },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(rollExpression).not.toHaveBeenCalled();
    });

    it('should skip damage when damage total is 0', async () => {
        vi.mocked(rollExpression).mockReturnValue({ total: 0, rolls: [], modifier: 0 });

        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d6', damageType: 'slashing', targetName: 'Goblin' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 10 },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Miss turned into a hit');
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                type: 'ability_use',
            })
        );
    });

    it('should use effectiveAc fallback when targetAc is null', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, effectiveAc: 16, hit: false, damageFormula: '2d6', damageType: 'slashing', targetName: 'Goblin' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 5 },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('d20(5)');
    });

    it('should handle null ac in own attack bonus path', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, hit: false, damageFormula: '2d6', targetName: 'Goblin' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 5 },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('N/A');
    });

    it('should still be a miss when modified total does not reach ac', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 2, bonus: 5, targetAc: 20, hit: false };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 2 },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.payload.description).toContain('Still a miss');
    });
});

describe('autoRerollHandler - bonus path ally attack miss->hit damage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return null;
            return null;
        });
    });

    it('should apply damage when ally attack miss turns into hit with range', async () => {
        vi.mocked(rollExpression).mockReturnValue({ total: 12, rolls: [8, 4], modifier: 0 });
        vi.mocked(getCombatContext).mockResolvedValue({ creatures: [] });
        vi.mocked(applyDamageToTarget).mockReturnValue({ finalDamage: 12 });

        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d10', damageType: 'radiant', targetName: 'Demon' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 5, range: '30_ft' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(rollExpression).toHaveBeenCalledWith('2d10');
        expect(getCombatContext).toHaveBeenCalledWith('test-campaign');
        expect(applyDamageToTarget).toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Demon',
                characterName: 'Ally',
            })
        );
    });

    it('should skip ally damage when damageFormula is missing', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, targetAc: 15, hit: false };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 5, range: '30_ft' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(rollExpression).not.toHaveBeenCalled();
    });

    it('should skip ally damage when damage total is 0', async () => {
        vi.mocked(rollExpression).mockReturnValue({ total: 0, rolls: [], modifier: 0 });

        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d6', damageType: 'slashing', targetName: 'Goblin' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 10, range: '30_ft' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Miss turned into a hit');
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                type: 'ability_use',
            })
        );
    });

    it('should use effectiveAc fallback for ally attack', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, effectiveAc: 16, hit: false, damageFormula: '2d6', damageType: 'slashing', targetName: 'Goblin' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 5, range: '30_ft' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('d20(5)');
    });

    it('should handle null ac in ally attack bonus path', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, hit: false, damageFormula: '2d6', targetName: 'Goblin' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 5, range: '30_ft' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('N/A');
    });

    it('should still be a miss for ally when modified total does not reach ac', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'Ally', d20: 2, bonus: 5, targetAc: 20, hit: false };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 2, range: '30_ft' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.payload.description).toContain('Still a miss');
    });
});
