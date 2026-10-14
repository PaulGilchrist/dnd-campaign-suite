import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './autoRerollHandler.js';

// Re-import after mocking
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';

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

describe('autoRerollHandler - handleAbilityCheck / handleSaveRoll paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return null;
            return null;
        });
    });

    it('should return early popup from handleAbilityCheck when lastAttack is not a check', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 10, bonus: 5, targetAc: 15, hit: false };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', effect: 'override_fail_to_success', oncePer: 'short_rest' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
    });

    it('should return early popup from handleSaveRoll when lastAttack is not a save', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 10, bonus: 5, targetAc: 15, hit: false };
            return null;
        });

        const action = makeAction({
            automation: { target: 'saving_throw', resourceCost: 'channel_divinity' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No recent saving throw found');
    });

    it('should handle saveType fallback when saveType is null', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: null };
            return null;
        });

        const action = makeAction({
            automation: { target: 'saving_throw', resourceCost: 'channel_divinity' },
        });
        const stats = makePlayerStatsForLevel(5, { channel_divinity: 2 });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Save');
    });

    it('should handle checkName fallback when checkName is null', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'check', attackerName: 'TestHero', d20: 10, bonus: 3, checkName: null };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 2 },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('d20(10)');
    });
});

describe('autoRerollHandler - consumeResourceCost paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return null;
            return null;
        });
    });

    it('should reject when no focus points remaining', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Intelligence' };
            if (name === 'TestHero' && key === 'focusPoints') return 0;
            return null;
        });

        const action = makeAction({
            automation: { target: 'saving_throw', resourceCost: 'focus_points' },
        });
        const stats = makePlayerStats({ level: 1, class: { class_levels: [{ level: 1, focus_points: 5 }] } });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.payload.description).toContain('No Focus Points remaining');
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('should fallback to getClassFeatures for maxFocusPoints', async () => {
        vi.mocked(getClassFeatures).mockReturnValue({ maxFocusPoints: 3 });

        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Intelligence' };
            if (name === 'TestHero' && key === 'focusPoints') return 2;
            return null;
        });

        const action = makeAction({
            automation: { target: 'saving_throw', resourceCost: 'focus_points' },
        });
        const stats = makePlayerStats({ level: 1, class: { class_levels: [{ level: 1 }] } });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(getClassFeatures).toHaveBeenCalledWith(stats);
    });

    it('should consume focus points and decrement', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Intelligence' };
            if (name === 'TestHero' && key === 'focusPoints') return 3;
            return null;
        });

        const action = makeAction({
            automation: { target: 'saving_throw', resourceCost: 'focus_points' },
        });
        const stats = makePlayerStats({ level: 1, class: { class_levels: [{ level: 1, focus_points: 5 }] } });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'focusPoints', 2, 'test-campaign');
    });

    it('should return consumeResourceCost error path in saving throw handler', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' };
            if (name === 'TestHero' && key === 'channelDivinityCharges') return 0;
            return null;
        });

        const action = makeAction({
            automation: { target: 'saving_throw', resourceCost: 'channel_divinity' },
        });
        const stats = makePlayerStatsForLevel(5, { channel_divinity: 2 });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.payload.description).toContain('No Channel Divinity charges remaining');
        expect(addEntry).not.toHaveBeenCalled();
    });
});

describe('autoRerollHandler - findAllyMissedAttack / getBardicDieSize paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return null;
            return null;
        });
    });

    it('should return null from findAllyMissedAttack when lastAttack is null', async () => {
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

    it('should return null from findAllyMissedAttack when lastAttack is not an attack', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'check', attackerName: 'Ally', d20: 10, bonus: 3, checkName: 'Stealth' };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', effect: 'override_fail_to_success', oncePer: 'short_rest' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
    });

    it('should return null from findAllyMissedAttack when lastAttack hit is true', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'Ally', d20: 18, bonus: 5, targetAc: 15, hit: true };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', effect: 'override_fail_to_success', oncePer: 'short_rest' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
    });

    it('should return null from findAllyMissedAttack when attackerName is player', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false };
            return null;
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', effect: 'override_fail_to_success', oncePer: 'short_rest' },
        });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
    });

    it('should return 0 from getBardicDieSize when no class_levels', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return null;
            return null;
        });

        const stats = makePlayerStats({ class: null });
        const action = makeAction({
            automation: { bonusExpression: 'bardic_inspiration_die' },
        });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
    });

    it('should reject bardic inspiration when last roll is not player attack or check', async () => {
        getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'lastAttack') return { rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, targetAc: 15, hit: false };
            return null;
        });

        const stats = makePlayerStatsForLevel(1, { bardic_inspiration_uses: 3, bardic_die: 6 });
        const action = makeAction({
            automation: { bonusExpression: 'bardic_inspiration_die' },
        });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.payload.description).toContain('No recent failed ability check or attack roll');
    });
});

function makePlayerStatsForLevel(level, classOverrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { class_levels: [{ level, ...classOverrides }] },
        level,
        resources: {},
    };
}
