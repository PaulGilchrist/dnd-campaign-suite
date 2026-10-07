// CLA-219: charm NPC inline adjudication honours the Heightened Spell /
// Magical Ambush disadvantage transport — 2d20 keep-low, applied once.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 10),
}));

vi.mock('../../../combat/auras/auraConditionImmunity.js', () => ({
    getAuraConditionImmunities: vi.fn(() => Promise.resolve(null)),
    auraCoversCondition: vi.fn(() => false),
    logAuraConditionImmunity: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 14),
    createSaveListener: vi.fn(() => ({ promptId: 'p1', promise: Promise.resolve({ success: false, roll: 1, total: 1 }) })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./areaSpellUtils.js', () => ({
    spellNoticePopup: vi.fn(() => ({ type: 'popup', payload: {} })),
}));

import { rollNpcSave } from './charmSpellUtils.js';
import { handleCharmSpell } from './charmSpellUtils.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

describe('CLA-219 rollNpcSave disadvantage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('keeps the lower die on disadvantage (no creature)', () => {
        rollD20.mockReturnValueOnce(15).mockReturnValueOnce(4);

        const result = rollNpcSave(null, 14, false, true);

        expect(result.rawRolls).toEqual([15, 4]);
        expect(result.roll).toBe(4);
        expect(result.success).toBe(false);
    });

    it('rolls a single kept die when neither advantage nor disadvantage (control)', () => {
        rollD20.mockReturnValue(15);

        const result = rollNpcSave(null, 14, false, false);

        expect(result.roll).toBe(15);
        expect(result.success).toBe(true);
    });

    it('keeps the lower die on disadvantage via the creature path', () => {
        rollD20.mockReturnValueOnce(17).mockReturnValueOnce(3);

        const creature = { saveBonuses: { wis: 2 } };
        const result = rollNpcSave(creature, 14, false, true);

        expect(result.roll).toBe(3);
        expect(result.total).toBe(5);
    });

    it('advantage still keeps the higher die when disadvantage absent', () => {
        rollD20.mockReturnValueOnce(5).mockReturnValueOnce(18);

        const result = rollNpcSave(null, 14, true, false);

        expect(result.roll).toBe(18);
        expect(result.success).toBe(true);
    });
});

describe('CLA-219 handleCharmSpell magical ambush fold', () => {
    const ambushPlayerStats = {
        name: 'AasimarTest',
        level: 20,
        proficiency: 6,
        automation: { passives: [{ type: 'passive_rule', effect: 'magical_ambush' }] },
    };
    const charmConfig = {
        targetsKey: 'charmMonsterTargets',
        advantagesKey: 'charmMonsterAdvantages',
        logPrefix: '[charmMonster]',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Bandit 1', type: 'npc', saveBonuses: { wis: 2 } }] });
        rollD20.mockReturnValue(5);
    });

    const cast = (conditions) => {
        getRuntimeValue.mockImplementation((name, key) => (key === 'activeConditions' ? conditions : undefined));
        return handleCharmSpell(
            { name: 'Charm Monster', automation: { type: 'charm_monster', saveDc: 14, targetName: 'Bandit 1' }, metaCtx: { charmMonsterTargets: ['Bandit 1'] } },
            ambushPlayerStats,
            'test-campaign',
            charmConfig,
        );
    };

    it('folds Magical Ambush invisibility into save disadvantage when metaCtx lacks the flag', async () => {
        await cast(['Invisible']);

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ disadvantage: true }));
    });

    it('does not fold when caster is visible (control)', async () => {
        await cast([]);

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ disadvantage: false }));
    });

    it('does not fold when caster lacks the magical_ambush passive (control)', async () => {
        getRuntimeValue.mockImplementation((name, key) => (key === 'activeConditions' ? ['Invisible'] : undefined));

        await handleCharmSpell(
            { name: 'Charm Monster', automation: { type: 'charm_monster', saveDc: 14, targetName: 'Bandit 1' }, metaCtx: { charmMonsterTargets: ['Bandit 1'] } },
            { name: 'AasimarTest', level: 20, proficiency: 6, automation: { passives: [] } },
            'test-campaign',
            charmConfig,
        );

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ disadvantage: false }));
    });
});
