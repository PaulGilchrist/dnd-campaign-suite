import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAutomationBonusesStep } from './attackRollBonuses.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 6, rolls: [6], modifier: 0 })),
}));
vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => null),
}));
vi.mock('../../automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));
vi.mock('../automation/automationExpressions.js', () => ({
    resolveDiceExpression: vi.fn((expr) => expr),
}));
vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve({})),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const lv9Rider = {
    type: 'attack_rider',
    name: 'Brutal Strike',
    featureLevel: 9,
    damageExpression: '1d10',
    damageType: 'same_as_weapon',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction' },
    ],
};

const lv13Rider = {
    type: 'attack_rider',
    name: 'Improved Brutal Strike',
    featureLevel: 13,
    damageExpression: '1d10',
    damageType: 'same_as_weapon',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction' },
        { name: 'Staggering Blow', effect: 'disadvantage_on_next_save', noOpportunityAttacks: true },
        { name: 'Sundering Blow', effect: 'next_attack_bonus', value: 5 },
    ],
};

function makeCtx() {
    return {
        campaignName: 'test-campaign',
        playerStats: {
            name: 'DraconicDragon',
            level: 13,
            automation: { actions: [], passives: [lv9Rider, lv13Rider] },
        },
        targetName: 'Ogre',
        formula: '1d8+5',
        total: 9,
        rolls: [8],
    };
}

describe('CLA-182: attackRollBonuses hit-time brutal strike rider selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('binds the lv13 improved rider when both riders have 1d10 and applies Sundering Blow targetEffect', async () => {
        getRuntimeValue.mockImplementation((key, rk) => {
            if (rk === '_brutalStrikeActive') return true;
            if (rk === '_brutalStrikeEffects') return ['Sundering Blow'];
            if (rk === 'targetEffects') return [];
            return null;
        });

        const step = buildAutomationBonusesStep();
        const result = await step.handler(makeCtx());

        expect(result.data.formula).toContain('1d10');
        const stored = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
        expect(stored).toBeDefined();
        expect(stored[2]).toEqual([expect.objectContaining({
            target: 'Ogre',
            source: 'DraconicDragon',
            option: 'Sundering Blow',
            effect: 'next_attack_bonus',
            value: 5,
        })]);
        const log = addEntry.mock.calls.map(c => c[1]).find(e => e?.type === 'ability_use' && e?.abilityName === 'Improved Brutal Strike');
        expect(log).toBeDefined();
    });

    it('applies Staggering Blow targetEffect from the improved rider options', async () => {
        getRuntimeValue.mockImplementation((key, rk) => {
            if (rk === '_brutalStrikeActive') return true;
            if (rk === '_brutalStrikeEffects') return ['Staggering Blow'];
            if (rk === 'targetEffects') return [];
            return null;
        });

        const step = buildAutomationBonusesStep();
        await step.handler(makeCtx());

        const stored = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
        expect(stored[2]).toEqual([expect.objectContaining({
            target: 'Ogre',
            option: 'Staggering Blow',
            effect: 'disadvantage_on_next_save',
            noOpportunityAttacks: true,
        })]);
    });

    it('still prefers lv17 2d10 rider over lv13 rider', async () => {
        const lv17Rider = { ...lv13Rider, name: 'Brutal Strike (Level 17)', featureLevel: 17, damageExpression: '2d10', maxEffects: 2 };
        getRuntimeValue.mockImplementation((key, rk) => {
            if (rk === '_brutalStrikeActive') return true;
            if (rk === '_brutalStrikeEffects') return [];
            return null;
        });

        const ctx = makeCtx();
        ctx.playerStats.automation.passives = [lv9Rider, lv13Rider, lv17Rider];
        const step = buildAutomationBonusesStep();
        const result = await step.handler(ctx);

        expect(result.data.formula).toContain('2d10');
    });
});
