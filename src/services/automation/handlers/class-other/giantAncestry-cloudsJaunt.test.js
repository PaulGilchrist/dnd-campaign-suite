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

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 5),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 15, oldHp: 20, damageReduced: false })),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => ({ actualHeal: 12, oldHp: 10, newHp: 22 })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(async () => ({
        attackEvent: { rollType: 'attack', attackerName: 'TestHero' },
        attackerName: 'TestHero',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['slashing'],
    })),
}));

beforeEach(() => { vi.resetAllMocks(); });
import { describe, it, expect } from 'vitest';
import {
    handleCloudsJaunt,
    handleCloudsJauntDirect,
} from './giantAncestryHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { makeAction, makePlayerStats } from './giantAncestry.test.setup.js';

function makeUsesMock(usesKey, value) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === usesKey) return value;
        return null;
    });
}

describe('giantAncestry selection & dispatch', () => {
    describe('handleCloudsJaunt', () => {
        const option = { name: "Cloud's Jaunt", type: 'teleport', range: '30_ft' };

        it('returns info popup when uses available', async () => {
            makeUsesMock('cloudsJauntUses', 3);
            const result = await handleCloudsJaunt(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Cloud's Jaunt");
            expect(result.payload.description).toContain('Teleported');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'cloudsJauntUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: "Cloud's Jaunt",
            }));
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('cloudsJauntUses', 0);
            const result = await handleCloudsJaunt(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });
    describe('handleCloudsJauntDirect', () => {
        const directAction = {
            name: "Cloud's Jaunt",
            automation: {
                type: 'clouds_jaunt',
                distance: '30 ft',
                range: '30_ft',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 bonus action',
            },
        };

        it('consumes use and returns info popup', async () => {
            makeUsesMock('cloudsJauntUses', 3);
            const result = await handleCloudsJauntDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Cloud's Jaunt");
            expect(result.payload.description).toContain('Teleported');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'cloudsJauntUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: "Cloud's Jaunt",
            }));
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('cloudsJauntUses', 0);
            const result = await handleCloudsJauntDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });
});
