// CLA-335 regression: same-hit refire round latch + honest cap text
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

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => ({ actualHeal: 7, oldHp: 217, newHp: 224 })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(async () => ({
        attackEvent: { rollType: 'attack', attackerName: 'Orc' },
        attackerName: 'Orc',
        targetName: 'TestHero',
        totalDamage: 15,
    })),
}));

beforeEach(() => { vi.resetAllMocks(); });
import { describe, it, expect } from 'vitest';
import {
    handleStonesEndurance,
    handleStonesEnduranceDirect,
} from './giantAncestryHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { makePlayerStats } from './giantAncestry.test.setup.js';

const directAction = {
    name: "Stone's Endurance",
    automation: {
        type: 'stones_endurance',
        reductionExpression: '1d12 + CON modifier',
        trigger: 'damage_received',
        uses: 'proficiency_bonus',
        recharge: 'long_rest',
        casting_time: '1 reaction',
    },
};

function mockState({ uses = 3, usedRound = null } = {}) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'stonesEnduranceUses') return uses;
        if (key === '_Stones_Endurance_usedRound') return usedRound;
        return null;
    });
}

describe('CLA-335 Stone\'s Endurance refire latch + cap text', () => {
    it('refuses a second use on the same triggering hit (round latch): no uses spend, no heal, refusal logged', async () => {
        mockState({ uses: 3, usedRound: 1 });

        const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already used');
        expect(result.payload.description).toContain('Reaction is spent');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'stonesEnduranceUses', 2, 'campaign');
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
            type: 'automation',
            automationType: 'stones_endurance_refused',
        }));
    });

    it('stamps the round latch from a fresh combat context on a successful use', async () => {
        mockState({ uses: 3, usedRound: null });

        const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

        expect(result.payload.description).toContain('Healed');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stonesEnduranceUses', 2, 'campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_Stones_Endurance_usedRound', 1, 'campaign');
    });

    it('allows a use in a LATER round (round advanced past the stamp)', async () => {
        mockState({ uses: 3, usedRound: 0 });

        const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

        expect(result.payload.description).toContain('Healed');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_Stones_Endurance_usedRound', 1, 'campaign');
    });

    it('cap text reports the damage-taken cap when roll+CON exceeds damage', async () => {
        mockState({ uses: 3, usedRound: null });
        findLastAttack.mockResolvedValue({
            attackEvent: { rollType: 'attack', attackerName: 'Orc' },
            attackerName: 'Orc',
            targetName: 'TestHero',
            totalDamage: 4,
        });
        // rollExpression total 5 + CON 2 = 7, rawHeal capped at 4
        applyHealingToTarget.mockReturnValue({ actualHeal: 4, oldHp: 220, newHp: 224 });

        const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

        expect(result.payload.description).toContain('capped at 4 (damage taken)');
        expect(result.payload.description).not.toContain('capped at 7');
        expect(result.payload.description).toContain('Healed <strong>4</strong> HP');
    });

    it('cap text reports the HP deficit clamp, not totalDamage, when healing cannot cover the cap', async () => {
        mockState({ uses: 3, usedRound: null });
        // totalDamage 15, rollExpression total 5 + CON 2 = 7, but only 3 HP of deficit remain
        applyHealingToTarget.mockReturnValue({ actualHeal: 3, oldHp: 221, newHp: 224 });

        const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

        expect(result.payload.description).toContain('capped at 3 (HP deficit)');
        expect(result.payload.description).not.toContain('capped at 15');
        expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
            type: 'ability_use',
            description: expect.stringContaining('capped at 3 (HP deficit)'),
        }));
    });

    it('dispatch mirror refuses a refire on the same round without spending uses', async () => {
        mockState({ uses: 3, usedRound: 1 });
        const option = { name: "Stone's Endurance", type: 'damage_reduction', reductionExpression: '1d12 + CON modifier' };

        const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

        expect(result.payload.description).toContain('already used');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'stonesEnduranceUses', 2, 'campaign');
        expect(applyHealingToTarget).not.toHaveBeenCalled();
    });
});

function makeAction() {
    return { name: 'Giant Ancestry', automation: { type: 'giant_ancestry' } };
}
