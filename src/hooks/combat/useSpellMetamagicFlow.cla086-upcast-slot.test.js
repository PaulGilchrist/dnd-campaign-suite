// CLA-086: gated confirm lane pays the upcast slot but the heal seams resolved
// at the base makePending spellLevel. Pins the canonical stampPaidSlotLevel
// backfill, the upcast-level heal metaCtx for Cure Wounds / Healing Word, the
// cast-log spellLevel stamp, and the skip rollback refunding the consumed level.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { stampPaidSlotLevel } from './useConfirmableFlow.js';

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
  // CLA-033: fired by the gated confirm lane's rider seam in useConfirmableFlow.
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [{ name: 'TestCleric', type: 'player' }, { name: 'EvasiveFighter', type: 'player' }],
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
  incrementFreeCastResource: vi.fn(),
}));

const SLOT_DEFAULTS = vi.hoisted(() => ({
  spell_slots_level_1: 4,
  spell_slots_level_2: 3,
  spell_slots_level_3: 2,
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

function makeCureWounds(overrides = {}) {
  return {
    name: 'Cure Wounds',
    level: 1,
    casting_time: 'Action',
    range: 'Touch',
    heal_at_slot_level: { 1: '2d8 + MOD', 2: '4d8 + MOD', 3: '6d8 + MOD' },
    ...overrides,
  };
}

function renderFlow(onExecute) {
  return renderHook(() => useSpellMetamagicFlow({
    playerStats: makePlayerStats(),
    campaignName: 'TestCampaign',
    onExecute,
    setSecondaryTargetModal: null,
    characters: [],
    setPopupHtml: vi.fn(),
  }));
}

describe('stampPaidSlotLevel (CLA-086 canonical stamp)', () => {
  it('stamps the upcast level onto the pending metaCtx carrier', () => {
    const pending = { spell: { level: 1, upcastLevel: 3 }, spellLevel: 1 };
    stampPaidSlotLevel(pending);
    expect(pending.metaCtx.slotLevel).toBe(3);
  });

  it('is a no-op for base-level casts (byte-identical lv1)', () => {
    const pending = { spell: { level: 1 }, spellLevel: 1 };
    stampPaidSlotLevel(pending);
    expect(pending.metaCtx.slotLevel).toBeUndefined();
  });

  it('is inert for cantrips (level 0 never stamped)', () => {
    const pending = { spell: { level: 0 }, spellLevel: 0 };
    stampPaidSlotLevel(pending);
    expect(pending.metaCtx).toBeUndefined();
  });

  it('preserves a pre-set metaCtx.slotLevel (byte-twin guard)', () => {
    const pending = { spell: { level: 1, upcastLevel: 3 }, spellLevel: 1, metaCtx: { slotLevel: 2 } };
    stampPaidSlotLevel(pending);
    expect(pending.metaCtx.slotLevel).toBe(2);
  });
});

describe('useSpellMetamagicFlow — gated upcast heals resolve at the paid slot (CLA-086)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Cure Wounds upcast lv3: metaCtx.slotLevel reaches onExecute at 3 and the cast log stamps 3', async () => {
    const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
    const { addEntry } = await import('../../services/ui/logService.js');
    const onExecute = vi.fn();
    const { result } = renderFlow(onExecute);

    await act(async () => {
      await result.current.gateMetamagic(makeCureWounds({ isUpcast: true, upcastLevel: 3 }));
    });
    expect(result.current.pendingCureWounds).not.toBeNull();

    await act(async () => {
      await result.current.handleCureWoundsConfirm({ targetName: 'EvasiveFighter' });
    });

    // Slot payment stays at the upcast level...
    const prepOpts = prepareSpellCast.mock.calls[0][2];
    expect(prepOpts.upcastLevel).toBe(3);
    expect(prepOpts.isUpcast).toBe(true);
    // ...and the heal metaCtx now carries it (was lv1 pre-fix).
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][1]).toEqual({ targetName: 'EvasiveFighter', slotLevel: 3 });
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      spellName: 'Cure Wounds',
      spellLevel: 3,
    }));
  });

  it('Cure Wounds lv1 baseline stays byte-identical: heal resolves at 1', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const onExecute = vi.fn();
    const { result } = renderFlow(onExecute);

    await act(async () => {
      await result.current.gateMetamagic(makeCureWounds());
    });
    await act(async () => {
      await result.current.handleCureWoundsConfirm({ targetName: 'EvasiveFighter' });
    });

    expect(onExecute.mock.calls[0][1]).toEqual({ targetName: 'EvasiveFighter', slotLevel: 1 });
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      spellName: 'Cure Wounds',
      spellLevel: 1,
    }));
  });

  it('Healing Word upcast lv3: triggerHealingWord metaCtx resolves at slot 3', async () => {
    const { triggerHealingWord } = await import('../../services/rules/features/healingWordService.js');
    const { addEntry } = await import('../../services/ui/logService.js');
    const { result } = renderFlow(vi.fn());

    const spell = {
      name: 'Healing Word',
      level: 1,
      casting_time: 'Bonus Action',
      range: '60 feet',
      heal_at_slot_level: { 1: '2d4 + MOD', 2: '4d4 + MOD', 3: '5d4 + MOD' },
      isUpcast: true,
      upcastLevel: 3,
    };
    await act(async () => {
      await result.current.gateMetamagic(spell);
    });
    expect(result.current.pendingHealingWord).not.toBeNull();

    await act(async () => {
      await result.current.handleHealingWordConfirm({ targetName: 'EvasiveFighter' });
    });

    expect(triggerHealingWord).toHaveBeenCalledTimes(1);
    expect(triggerHealingWord.mock.calls[0][1]).toEqual({ targetName: 'EvasiveFighter', slotLevel: 3 });
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      spellName: 'Healing Word',
      spellLevel: 3,
    }));
  });

  it('skip after upcast lv3 refunds the lv3 slot, not lv1', async () => {
    const { setRuntimeValue, getRuntimeValue } = await import('../runtime/useRuntimeState.js');
    const { result } = renderFlow(vi.fn());

    await act(async () => {
      await result.current.gateMetamagic(makeCureWounds({ isUpcast: true, upcastLevel: 3 }));
    });
    expect(result.current.pendingCureWounds).not.toBeNull();

    act(() => {
      result.current.handleCureWoundsSkip();
    });

    // lv3 read back and refunded at lv3 (2 → 3); lv1 key untouched.
    expect(getRuntimeValue).toHaveBeenCalledWith('TestCleric', 'spell_slots_level_3');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'spell_slots_level_3', 3, 'TestCampaign');
    const lv1Writes = setRuntimeValue.mock.calls.filter(c => c[1] === 'spell_slots_level_1');
    expect(lv1Writes.length).toBe(0);
  });

  it('skip at lv1 (no upcast) still refunds lv1 — byte-identical legacy', async () => {
    const { setRuntimeValue } = await import('../runtime/useRuntimeState.js');
    const { result } = renderFlow(vi.fn());

    await act(async () => {
      await result.current.gateMetamagic(makeCureWounds());
    });

    act(() => {
      result.current.handleCureWoundsSkip();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'spell_slots_level_1', 5, 'TestCampaign');
  });
});
