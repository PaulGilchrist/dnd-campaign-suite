// CLA-219: the rebuilt charm action must carry the Heightened Spell /
// Magical Ambush disadvantage transport (metaCtx.metamagicHeighten) so the
// charm save lane honours it once.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(() => Promise.resolve({ type: 'popup', payload: {} })),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [{ name: 'Bandit 1', type: 'npc', currentHp: 5, maxHp: 11 }] })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Bandit 1' })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
}));

import { executeHandler } from '../../automation/index.js';
import { triggerCharmMonster } from './charmMonsterService.js';

const caster = { name: 'AasimarTest', proficiency: 6, spellAbilities: { saveDc: 14 } };
const spell = { name: 'Charm Monster', level: 4 };

beforeEach(() => vi.clearAllMocks());

describe('CLA-219 charmMonsterService metamagicHeighten carry', () => {
    it('carries metamagicHeighten on the single-target rebuilt action', async () => {
        await triggerCharmMonster(spell, { targetName: 'Bandit 1', metamagicHeighten: true }, caster, 'test-campaign', null);

        expect(executeHandler).toHaveBeenCalled();
        const action = executeHandler.mock.calls[0][0];
        expect(action.metaCtx.metamagicHeighten).toBe(true);
    });

    it('carries metamagicHeighten on the multi-target rebuilt action', async () => {
        await triggerCharmMonster(spell, { charmMonsterTargets: ['Bandit 1', 'Bandit 2'], metamagicHeighten: true }, caster, 'test-campaign', null);

        const action = executeHandler.mock.calls[0][0];
        expect(action.metaCtx.metamagicHeighten).toBe(true);
    });

    it('control: no flag without invisibility ambush (metamagicHeighten false)', async () => {
        await triggerCharmMonster(spell, { targetName: 'Bandit 1' }, caster, 'test-campaign', null);

        const action = executeHandler.mock.calls[0][0];
        expect(action.metaCtx.metamagicHeighten).toBe(false);
    });
});
