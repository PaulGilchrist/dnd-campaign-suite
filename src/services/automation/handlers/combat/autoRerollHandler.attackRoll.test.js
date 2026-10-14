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

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
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

describe('autoRerollHandler - handleAttackRoll paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return null;
            return null;
        });
    });

    it('should return early popup when lastAttack is null in handleAttackRoll', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return null;
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', effect: 'override_fail_to_success', oncePer: 'short_rest' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
    });

    it('should return early popup when lastAttack rollType is not attack in handleAttackRoll', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'check', attackerName: 'TestHero', d20: 10, bonus: 3, checkName: 'Stealth' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', effect: 'override_fail_to_success', oncePer: 'short_rest' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
    });

    it('should apply damage when miss turns into hit with damageFormula', async () => {
        vi.mocked(rollExpression).mockReturnValue({ total: 8, rolls: [6, 2], modifier: 0 });
        vi.mocked(getCombatContext).mockResolvedValue({ creatures: [] });
        vi.mocked(applyDamageToTarget).mockReturnValue({ finalDamage: 8 });

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
        expect(rollExpression).toHaveBeenCalledWith('2d6');
        expect(getCombatContext).toHaveBeenCalledWith('test-campaign');
        expect(applyDamageToTarget).toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Goblin',
            })
        );
    });

    it('should skip damage when damageFormula is missing on miss->hit', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 10 },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.payload.description).toContain('Miss turned into a hit');
        expect(rollExpression).not.toHaveBeenCalled();
    });

    it('should skip damage when total is 0', async () => {
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

    it('should still show still a miss when modifiedHit is also false', async () => {
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

    it('should handle null ac in handleAttackRoll', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, hit: false, damageFormula: '2d6', targetName: 'Goblin' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 10 },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('N/A');
    });
});
