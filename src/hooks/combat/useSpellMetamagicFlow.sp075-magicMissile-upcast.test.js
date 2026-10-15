// @maintained-by-ai: 2026-10-15
// SP-075: handleMagicMissileConfirm hardcoded isUpcast:false and slotLevel from
// spell.level, so prepareSpellCast paid the lv1 slot even when the popup carried a
// Level 2/4 selection on spell.upcastLevel — the lv-N slot was never paid and
// executeMagicMissile logged 3 darts. Pins the CLA-312 effective-level threading
// through the confirm lane (isFreeCastAuthorized + prepareSpellCast + onExecute
// args) and the byte-identical lv1 baseline. Gate-side dart totals are pinned
// upstream in spellGates.magicMissile.test.js; execution-side dart rolls in
// spellCastService execution helpers — this file owns only the confirm lane.
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
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
  isWizardRitualAdeptSpell: vi.fn(() => false),
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

const CAMPAIGN = 'test-campaign';
const CASTER = 'DivinationWizard';

let prepareSpellCast;
let isFreeCastAuthorized;

beforeAll(async () => {
  const prep = await import('../../services/rules/spells/spellPreparationService.js');
  prepareSpellCast = prep.prepareSpellCast;
  isFreeCastAuthorized = prep.isFreeCastAuthorized;
});

function renderFlow(onExecute) {
  return renderHook(() => useSpellMetamagicFlow({
    playerStats: { name: CASTER, class: { name: 'Wizard' }, level: 20 },
    campaignName: CAMPAIGN,
    onExecute,
    setSecondaryTargetModal: null,
    characters: [],
    setPopupHtml: vi.fn(),
  }));
}

// Popup shape (SpellDetailPopup onCast): upcasts arrive as isUpcast + upcastLevel
// while spell.level stays 1. Darts = 3 + (slotLevel - 1) per spells.json
// higher_level text, distributed across two goblins (2 to B, rest to A).
const CONFIRM_CASES = [
  { label: 'lv1 baseline: isUpcast false, slotLevel 1 — byte-compatible legacy', spell: {}, slotLevel: 1, isUpcast: false },
  { label: 'lv2 upcast: isUpcast true + upcastLevel 2 threaded, slotLevel 2', spell: { isUpcast: true, upcastLevel: 2 }, slotLevel: 2, isUpcast: true },
  { label: 'lv4 upcast: isUpcast true + upcastLevel 4 threaded, slotLevel 4', spell: { isUpcast: true, upcastLevel: 4 }, slotLevel: 4, isUpcast: true },
];

describe('SP-075 Magic Missile — confirm lane pays the upcast slot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(CONFIRM_CASES)('$label', async ({ spell, slotLevel, isUpcast }) => {
    const darts = 3 + (slotLevel - 1);
    const distribution = { 'Goblin A': darts - 2, 'Goblin B': 2 };
    const onExecute = vi.fn();
    const { result } = renderFlow(onExecute);

    await act(async () => {
      await result.current.gateMetamagic({
        name: 'Magic Missile',
        level: 1,
        casting_time: 'Action',
        range: '120 feet',
        ...spell,
      });
    });
    // Gate armed with the effective-level dart total (full totals matrix lives
    // in spellGates.magicMissile.test.js — this only proves confirm had pending
    // state to consume before cfClearPending).
    expect(result.current.pendingMagicMissile.totalMissiles).toBe(darts);

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution });
    });

    expect(isFreeCastAuthorized).toHaveBeenCalledWith(CASTER, 'Magic Missile', slotLevel, expect.any(Object), CAMPAIGN);
    const prepareArgs = prepareSpellCast.mock.calls.find(c => c[0]?.name === 'Magic Missile');
    expect(prepareArgs).toBeDefined();
    expect(prepareArgs[0]).toEqual(expect.objectContaining({ name: 'Magic Missile', level: 1 }));
    expect(prepareArgs[1]).toEqual(expect.objectContaining({ magicMissileDistribution: distribution, slotLevel }));
    expect(prepareArgs[2]).toEqual(expect.objectContaining({
      playerName: CASTER,
      campaignName: CAMPAIGN,
      isUpcast,
      ...(isUpcast ? { upcastLevel: slotLevel } : {}),
    }));
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ magicMissileDistribution: distribution, slotLevel })
    );
    expect(result.current.pendingMagicMissile).toBeNull();
  });
});
