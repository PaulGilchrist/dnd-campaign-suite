// SP-075: handleMagicMissileConfirm hardcoded isUpcast:false and slotLevel from
// spell.level, so prepareSpellCast paid the lv1 slot even when the popup carried a
// Level 2/4 selection on spell.upcastLevel — the lv-N slot was never paid and
// executeMagicMissile logged 3 darts. Pins the CLA-312 effective-level threading
// through the confirm lane and the byte-identical lv1 baseline.
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
    creatures: [{ name: 'DivinationWizard', type: 'player' }, { name: 'Goblin A', type: 'monster' }, { name: 'Goblin B', type: 'monster' }],
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
  prepareSpellCast: vi.fn(async (spell, metaCtx) => ({ modifiedSpell: spell, metaCtx: metaCtx || {}, slotConsumed: true, freeCastUsed: false })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
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
    name: 'DivinationWizard',
    class: { name: 'Wizard' },
    level: 20,
    ...overrides,
  };
}

function makeMagicMissile(overrides = {}) {
  return {
    name: 'Magic Missile',
    level: 1,
    casting_time: 'Action',
    range: '120 feet',
    ...overrides,
  };
}

function renderFlow(onExecute) {
  return renderHook(() => useSpellMetamagicFlow({
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    onExecute,
    setSecondaryTargetModal: null,
    characters: [],
    setPopupHtml: vi.fn(),
  }));
}

describe('SP-075 Magic Missile — confirm lane pays the upcast slot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lv2 upcast: prepareSpellCast receives isUpcast true + upcastLevel 2, metaCtx.slotLevel 2', async () => {
    const { prepareSpellCast, isFreeCastAuthorized } = await import('../../services/rules/spells/spellPreparationService.js');
    const onExecute = vi.fn();
    const { result } = renderFlow(onExecute);

    await act(async () => {
      await result.current.gateMetamagic(makeMagicMissile({ isUpcast: true, upcastLevel: 2 }));
    });
    expect(result.current.pendingMagicMissile.totalMissiles).toBe(4);

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution: { 'Goblin A': 4 } });
    });

    expect(isFreeCastAuthorized).toHaveBeenCalledWith('DivinationWizard', 'Magic Missile', 2, expect.any(Object), 'test-campaign');
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Magic Missile', level: 1 }),
      expect.objectContaining({ magicMissileDistribution: { 'Goblin A': 4 }, slotLevel: 2 }),
      expect.objectContaining({ playerName: 'DivinationWizard', campaignName: 'test-campaign', isUpcast: true, upcastLevel: 2 })
    );
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ magicMissileDistribution: { 'Goblin A': 4 }, slotLevel: 2 })
    );
    expect(result.current.pendingMagicMissile).toBeNull();
  });

  it('lv1 baseline: isUpcast false, slotLevel 1 — byte-compatible legacy', async () => {
    const { prepareSpellCast, isFreeCastAuthorized } = await import('../../services/rules/spells/spellPreparationService.js');
    const onExecute = vi.fn();
    const { result } = renderFlow(onExecute);

    await act(async () => {
      await result.current.gateMetamagic(makeMagicMissile());
    });
    expect(result.current.pendingMagicMissile.totalMissiles).toBe(3);

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution: { 'Goblin A': 3 } });
    });

    expect(isFreeCastAuthorized).toHaveBeenCalledWith('DivinationWizard', 'Magic Missile', 1, expect.any(Object), 'test-campaign');
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Magic Missile', level: 1 }),
      expect.objectContaining({ magicMissileDistribution: { 'Goblin A': 3 }, slotLevel: 1 }),
      expect.objectContaining({ playerName: 'DivinationWizard', campaignName: 'test-campaign', isUpcast: false })
    );
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ magicMissileDistribution: { 'Goblin A': 3 }, slotLevel: 1 })
    );
  });
});
