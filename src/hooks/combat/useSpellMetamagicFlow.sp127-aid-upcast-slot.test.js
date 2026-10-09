// SP-127: Aid upcast burned the lv3 slot but applyAid resolved hpMaxIncreaseExpression
// at the base spell.level (+5). Pins the paid-slot threading on the aid spec bodyOf
// (stampPaidSlotLevel / CLA-086 seam), the exact chooser-selection cast log
// (targets list was allTargets + stray targetName), the lv2 baseline byte-shape,
// and the deathWard/auraOfVitality twin fold.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [{ name: 'TestCleric', type: 'player' }, { name: 'EvasiveFighter', type: 'player' }, { name: 'War_Cleric', type: 'player' }],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(async (spell, metaCtx) => ({ modifiedSpell: spell, metaCtx: metaCtx || {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

const SLOT_DEFAULTS = vi.hoisted(() => ({
  spell_slots_level_1: 4,
  spell_slots_level_2: 3,
  spell_slots_level_3: 3,
  spell_slots_level_4: 3,
  spell_slots_level_5: 2,
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => SLOT_DEFAULTS[key]),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn(() => Promise.resolve(null)),
  applyHeroesFeastEffect: vi.fn(() => Promise.resolve(null)),
  applyLesserRestorationEffect: vi.fn(() => Promise.resolve(null)),
  applyMageArmorEffect: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromEvilAndGood: vi.fn(() => Promise.resolve(null)),
  applyShieldOfFaithEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(() => Promise.resolve(null)),
  applyBlessEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(() => Promise.resolve(null)),
  applyInvisibility: vi.fn(() => Promise.resolve(null)),
  applyGreaterInvisibility: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfPurityEffect: vi.fn(() => Promise.resolve(null)),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve(null)),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve(null)),
  applyDeathWardEffect: vi.fn(() => Promise.resolve(null)),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyHeroism: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
  executeHandler: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve(null)),
}));

global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
}));

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    class: { name: 'Cleric' },
    level: 17,
    ...overrides,
  };
}

function makeAid(overrides = {}) {
  return {
    name: 'Aid',
    level: 2,
    casting_time: 'Bonus Action',
    range: '30 feet',
    automation: { type: 'aid', range: '30 feet', maxTargets: 3, hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)' },
    heal_at_slot_level: { 2: '5', 3: '10' },
    ...overrides,
  };
}

function renderFlow() {
  return renderHook(() => useSpellMetamagicFlow({
    playerStats: makePlayerStats(),
    campaignName: 'TestCampaign',
    onExecute: vi.fn(),
    setSecondaryTargetModal: null,
    characters: [],
    setPopupHtml: vi.fn(),
  }));
}

describe('SP-127 Aid — confirm lane threads the paid slot + exact target log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lv3 upcast: applyAid receives spellSlotLevel 3 (was base 2)', async () => {
    const { applyAidEffect } = await import('../../services/automation/index.js');
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic(makeAid({ isUpcast: true, upcastLevel: 3 }));
    });
    expect(result.current.pendingAid).not.toBeNull();

    await act(async () => {
      await result.current.handleAidConfirm(['War_Cleric']);
    });

    expect(applyAidEffect).toHaveBeenCalledTimes(1);
    const [action] = applyAidEffect.mock.calls[0];
    expect(action.spellSlotLevel).toBe(3);
    expect(action.automation.type).toBe('aid');
  });

  it('lv3 upcast: cast log lists ONLY the chosen targets, no stray targetName', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic(makeAid({ isUpcast: true, upcastLevel: 3 }));
    });
    await act(async () => {
      await result.current.handleAidConfirm(['War_Cleric']);
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      spellName: 'Aid',
      spellLevel: 3,
      castingTime: 'Bonus Action',
      targets: ['War_Cleric'],
      targetName: 'War_Cleric',
    }));
    const spellLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'spell' && e.spellName === 'Aid');
    expect(spellLog.targets).not.toContain('TestCleric');
    expect(spellLog.targets).not.toContain('EvasiveFighter');
  });

  it('lv2 baseline: spellSlotLevel 2 + exact targets — byte-identical legacy', async () => {
    const { applyAidEffect } = await import('../../services/automation/index.js');
    const { addEntry } = await import('../../services/ui/logService.js');
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic(makeAid());
    });
    await act(async () => {
      await result.current.handleAidConfirm(['EvasiveFighter', 'War_Cleric']);
    });

    const [action] = applyAidEffect.mock.calls[0];
    expect(action.spellSlotLevel).toBe(2);
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      spellName: 'Aid',
      spellLevel: 2,
      targets: ['EvasiveFighter', 'War_Cleric'],
      targetName: 'EvasiveFighter',
    }));
  });

  it('skip after lv3 upcast refunds at the upcast level (aid rides the free-cast refund lane)', async () => {
    const { incrementFreeCastResource } = await import('../../services/rules/spells/spellPreparationService.js');
    const { setRuntimeValue } = await import('../runtime/useRuntimeState.js');
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic(makeAid({ isUpcast: true, upcastLevel: 3 }));
    });
    act(() => {
      result.current.handleAidSkip();
    });

    // 'aid' is in FREE_CAST_SPELLS — rollback routes through the free-cast
    // resource refund at the paid upcast level, never raw lv2 slot keys.
    expect(incrementFreeCastResource).toHaveBeenCalledWith('TestCleric', 'Aid', 3, expect.anything(), 'TestCampaign');
    const lv2Writes = setRuntimeValue.mock.calls.filter(c => c[1] === 'spell_slots_level_2');
    expect(lv2Writes.length).toBe(0);
  });

  it('SP-127 twins: Aura of Vitality upcast lv4 forwards spellSlotLevel 4', async () => {
    const { applyAuraOfVitalityEffect } = await import('../../services/automation/index.js');
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic({ name: 'Aura of Vitality', level: 3, casting_time: 'Action', range: '30 feet', isUpcast: true, upcastLevel: 4 });
    });
    await act(async () => {
      await result.current.handleAuraOfVitalityConfirm(['War_Cleric']);
    });

    expect(applyAuraOfVitalityEffect).toHaveBeenCalledTimes(1);
    expect(applyAuraOfVitalityEffect.mock.calls[0][0].spellSlotLevel).toBe(4);
  });

  it('SP-127 twins: Death Ward upcast lv5 forwards spellSlotLevel 5 (byte-harmless consumer)', async () => {
    const { applyDeathWardEffect } = await import('../../services/automation/index.js');
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic({ name: 'Death Ward', level: 4, casting_time: 'Action', range: 'Touch', isUpcast: true, upcastLevel: 5 });
    });
    await act(async () => {
      await result.current.handleDeathWardConfirm(['War_Cleric']);
    });

    expect(applyDeathWardEffect).toHaveBeenCalledTimes(1);
    expect(applyDeathWardEffect.mock.calls[0][0].spellSlotLevel).toBe(5);
  });
});
