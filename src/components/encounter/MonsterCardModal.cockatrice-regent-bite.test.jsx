// MA-0503: Cockatrice Regent Petrifying Bite transport + dc_success adjudication —
// DATA twin of MA-0501: actions[1] now authors dc_success:"full" +
// staged_petrify:{petrified_hours:24} (byte-shape of the verified Cockatrice
// row); parseStagedPetrifyClause/buildSaveOptions/buildAbilitySaveRollContext
// arm generically on the structured key, so the ladder rides handleNpcSaveDamage
// (NPC inline) / saveProcessing (PC prompt) → cockatricePetrifyService.
// dc_success:"full" (MA-0367 mode): the 2d8+4 Piercing damage rides the ATTACK
// HIT and the CON save (DC 14) gates only the petrify ladder; half-default
// would MV-20 leak half bite damage on save success.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSaveOptions, parseStagedPetrifyClause, buildAbilitySaveRollContext } from './MonsterCardModal.jsx';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));
vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { addEntry } from '../../services/ui/logService.js';
import { addExpiration } from '../../services/rules/effects/expirationQueue.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { stagePetrifyingBiteTargets, applyPetrifyingBiteTurnEnd, PETRIFYING_BITE_STAGED_TE } from '../../services/rules/features/cockatricePetrifyService.js';

const regent = (monstersData.monsters || monstersData).find(m => m.name === 'Cockatrice Regent');
const bite = regent.actions[1];

describe('MA-0503 cockatrice-regent Petrifying Bite transport', () => {
  it('authored data lock: dc_success full + staged_petrify 24 hours on actions[1]', () => {
    expect(bite.name).toBe('Petrifying Bite');
    expect(bite.attack_bonus).toBe(7);
    expect(bite.save_dc).toBe(14);
    expect(bite.save_type).toBe('Constitution');
    expect(bite.dc_success).toBe('full');
    expect(bite.staged_petrify).toEqual({ petrified_hours: 24 });
    expect(bite.damage_dice_primary).toBe('2d8 + 4');
    expect(bite.damage_type_primary).toBe('Piercing');
  });

  it('parseStagedPetrifyClause arms the DC-14 row via the generic structured key', () => {
    expect(parseStagedPetrifyClause(bite)).toEqual({ petrifiedRounds: 14400 });
    expect(parseStagedPetrifyClause({ name: 'Talons', attack_bonus: 7, damage_dice_primary: '4d6 + 4' })).toBeNull();
  });

  it('buildSaveOptions carries stagedPetrify + dcSuccess full for the NPC-inline seam', () => {
    const opts = buildSaveOptions(bite);
    expect(opts.stagedPetrify).toEqual({ petrifiedRounds: 14400 });
    expect(opts.dcSuccess).toBe('full');
    expect(opts.saveDc).toBe(14);
    expect(opts.saveType).toBe('con');

    const talons = buildSaveOptions(regent.actions[2]);
    expect(talons.stagedPetrify).toBeNull();
    expect(talons.dcSuccess).toBeNull();
  });

  it('buildAbilitySaveRollContext arms stagedPetrify for the PC-prompt seam', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Cockatrice Regent 1', target: { name: 'Bandit 1' }, spellName: null, action: bite,
      saveType: 'CON', dcSuccess: 'full', saveDamageFormula: '2d8 + 4', saveConditions: [],
      usesGate: null, prerequisite: null, getDamageTypesForAction: () => ['Piercing'],
    });
    expect(ctx.stagedPetrify).toEqual({ petrifiedRounds: 14400 });
    expect(ctx.saveDc).toBe(14);
    expect(ctx.dcSuccess).toBe('full');
  });

  it('dc_success adjudication: save-success pays FULL 2d8+4 bite damage', () => {
    expect(computeDamageAfterSave(13, true, 'full')).toBe(13);
    expect(computeDamageAfterSave(13, false, 'full')).toBe(13);
    expect(computeDamageAfterSave(13, true, 'half')).toBe(6);
  });
});

describe('MA-0503 cockatrice-regent staged ladder (DC 14 shape)', () => {
  const caster = 'Cockatrice Regent 1';
  const campaignName = 'test-campaign';

  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getCombatSummary.mockReturnValue(null);
  });

  it('first failed CON DC 14 save grants Restrained ONLY + ladder te armed', async () => {
    getRuntimeValue.mockImplementation((target, key) => {
      if (target === 'campaign' && key === 'targetEffects') return [];
      return null;
    });

    const staged = await stagePetrifyingBiteTargets({
      campaignName, casterName: caster, targetNames: ['Bandit 1'], saveDc: 14,
      options: { saveType: 'CON', label: 'Petrifying Bite', petrifiedRounds: 14400 },
    });

    expect(staged).toEqual(['Bandit 1']);
    const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
    expect(teCall[2][0]).toMatchObject({
      target: 'Bandit 1',
      effect: PETRIFYING_BITE_STAGED_TE,
      stage: 'restrained',
      dc: 14,
      saveType: 'CON',
      petrifiedRounds: 14400,
    });
    const condWrite = setRuntimeValue.mock.calls.find(c => c[0] === 'Bandit 1' && c[1] === 'activeConditions');
    expect(condWrite[2]).toContain('restrained');
    expect(condWrite[2]).not.toContain('petrified');
    expect(addExpiration).not.toHaveBeenCalled();
    const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied');
    expect(condLog.condition).toBe('Restrained');
  });

  it('turn-END repeat save fail escalates to Petrified with ONE 24-hour clock', async () => {
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Bandit 1', type: 'npc', saveBonuses: { con: 1 } }],
    });
    getRuntimeValue.mockImplementation((target, key) => {
      if (target === 'campaign' && key === 'targetEffects') return [{
        target: 'Bandit 1', effect: PETRIFYING_BITE_STAGED_TE, source: caster,
        condition: 'restrained', stage: 'restrained', dc: 14, saveType: 'CON',
        duration: 'ladder_until_second_failure', label: 'Petrifying Bite', petrifiedRounds: 14400,
      }];
      if (target === 'Bandit 1' && key === 'activeConditions') return ['restrained'];
      return null;
    });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await applyPetrifyingBiteTurnEnd(campaignName, 'Bandit 1');

    expect(result).toMatchObject({ handled: true, success: false, roll: 1, total: 2 });
    expect(addExpiration).toHaveBeenCalledTimes(1);
    expect(addExpiration).toHaveBeenCalledWith({
      attackerName: caster,
      targetName: 'Bandit 1',
      effects: [{ type: 'condition', condition: 'petrified' }],
      campaignName,
      rounds: 14400,
    });
    const condWrites = setRuntimeValue.mock.calls.filter(c => c[0] === 'Bandit 1' && c[1] === 'activeConditions');
    expect(condWrites.at(-1)[2]).toContain('petrified');
    spy.mockRestore();
  });
});
