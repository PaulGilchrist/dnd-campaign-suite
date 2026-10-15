// @maintained-by-ai: 2026-10-15 — see lane map below
// Multi-stage state-machine lane — unique seams only:
//  * True Polymorph path-storage: path-select persists the chosen path on the open
//    pending machine (object-path resolution → confirm-payloads / complex-handlers.spells;
//    no-pending guards → handler-guards).
//  * Animal Shapes stage-2→3 handoff: the beast map threads to applyAnimalShapes and the
//    beast-picker popup closes even when the apply is rejected (ok:false).
//  * Animal Shapes concentration runtime seam: ok:true + caster in the combat summary stamps
//    animalShapesConcentrationActive / animalShapesConcentrationDc (8 + prof + CON); an
//    off-summary caster stamps nothing.
// Deliberately NOT here: Resistance / Protection from Energy / Enhance Ability two-stage
// chains (gate-two-stage), Magic Missile arm/pay/execute (sp075 + spellConfirm),
// Greater Restoration no-effects refund (special-paths), no-pending guards (handler-guards).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { applyAnimalShapes } from '../../services/automation/handlers/spells/animalShapesService.js';

// ── Minimal mocks (only what this lane's state machines exercise) ──────────────

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn().mockResolvedValue({ type: 'beast' }),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn().mockReturnValue(null),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
    ],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn(),
  applyHeroesFeastEffect: vi.fn(),
  applyLesserRestorationEffect: vi.fn(),
  applyMageArmorEffect: vi.fn(),
  applyShieldOfFaithEffect: vi.fn(() => Promise.resolve({ payload: 'shieldOfFaith-popup' })),
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve({ payload: 'protectionFromPoison-popup' })),
  applyResistanceEffect: vi.fn(),
  executeHandler: vi.fn(() => Promise.resolve(null)),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve({ payload: 'barkskin-popup' })),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve({ payload: 'circleOfPower-popup' })),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve({ payload: 'auraOfVitality-popup' })),
  applyDeathWardEffect: vi.fn(() => Promise.resolve({ payload: 'deathWard-popup' })),
  applyHeroism: vi.fn(() => Promise.resolve({ payload: 'heroism-popup' })),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve({ payload: 'stoneSkin-popup' })),
  handleSanctuary: vi.fn(() => Promise.resolve({ payload: 'sanctuary-popup' })),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve({ payload: 'removeCurse-popup' })),
}));

vi.mock('../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve({ payload: 'regenerate-popup' })),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve({ payload: 'foresight-popup' })),
}));

vi.mock('../../services/rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/charmPersonService.js', () => ({
  triggerCharmPerson: vi.fn(),
}));

vi.mock('../../services/rules/features/charmMonsterService.js', () => ({
  triggerCharmMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/banishmentService.js', () => ({
  triggerBanishment: vi.fn(() => Promise.resolve({ payload: 'banishment-popup' })),
}));

vi.mock('../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/healService.js', () => ({
  triggerHeal: vi.fn(),
}));

vi.mock('../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve({ payload: 'revivify-popup' })),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve({ payload: 'true-polymorph-popup' })),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(async (spell, metaCtx) => ({
    modifiedSpell: spell,
    metaCtx: { ...metaCtx },
    slotConsumed: false,
    freeCastUsed: false,
  })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase(), 'goblin a', 'goblin b']),
}));

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ creatures: [] }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

// ── Factories ──────────────────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 Action',
    range: '150 ft.',
    ...overrides,
  };
}

function renderFlow(playerStats = makePlayerStats()) {
  const setPopupHtml = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats,
      campaignName: 'test-campaign',
      onExecute: vi.fn(),
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml,
    })
  );
  return { result, setPopupHtml };
}

// Gate a spell and drive the Animal Shapes machine to the beast-picker stage:
// gate → target-select opens the stage-2 popup, whose choice lands in beast-confirm.
async function openAnimalShapesBeastPicker(result, casterName = 'Goblin A') {
  await act(async () => {
    await result.current.gateMetamagic(makeSpell({ name: 'Animal Shapes', level: 8 }));
  });
  await act(async () => {
    await result.current.handleAnimalShapesTargetConfirm([casterName]);
  });
}

// ── True Polymorph — path-storage on the open machine ─────────────────────────

describe('useSpellMetamagicFlow — multi-stage path storage (True Polymorph)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('path-select persists the chosen path on the still-open pending machine', async () => {
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic(makeSpell({ name: 'True Polymorph', level: 9 }));
    });
    expect(result.current.pendingTruePolymorph).not.toBeNull();

    await act(async () => {
      await result.current.handleTruePolymorphPathSelect('creature_to_creature');
    });

    // Machine stays open, remembering the path for the terminal target-confirm.
    expect(result.current.pendingTruePolymorph).not.toBeNull();
    expect(result.current.pendingTruePolymorph.path).toBe('creature_to_creature');
  });
});

// ── Animal Shapes — stage-2→3 handoff + concentration runtime ─────────────────

describe('useSpellMetamagicFlow — Animal Shapes beast-picker handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('beast-confirm threads the beast map to applyAnimalShapes and closes the popup even when rejected', async () => {
    const { result, setPopupHtml } = renderFlow();

    await openAnimalShapesBeastPicker(result);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'animal_shapes_target_selection',
      targets: ['Goblin A'],
    }));

    await act(async () => {
      await result.current.handleAnimalShapesBeastConfirm({ 'Goblin A': 'Wolf' });
    });

    expect(applyAnimalShapes).toHaveBeenCalledWith(expect.objectContaining({
      targetBeastMap: { 'Goblin A': 'Wolf' },
      casterName: 'TestSorcerer',
      campaignName: 'test-campaign',
    }));
    // Rejection must still tear the picker down — a stuck popup blocks the turn.
    expect(setPopupHtml).toHaveBeenLastCalledWith(null);
    // Rejected apply never stamps concentration.
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'TestSorcerer', 'animalShapesConcentrationActive', true, 'test-campaign');
  });

  it('ok:true with the caster in the combat summary stamps concentration active + DC 8+prof+CON', async () => {
    applyAnimalShapes.mockResolvedValueOnce({ ok: true });
    const { result, setPopupHtml } = renderFlow(
      makePlayerStats({ name: 'Goblin A', abilities: { CON: { bonus: 2 } } })
    );

    await openAnimalShapesBeastPicker(result, 'Goblin A');

    await act(async () => {
      await result.current.handleAnimalShapesBeastConfirm({ 'Goblin A': 'Wolf' });
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin A', 'animalShapesConcentrationActive', true, 'test-campaign');
    // 8 + proficiency(2) + CON bonus(2)
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin A', 'animalShapesConcentrationDc', 12, 'test-campaign');
    expect(setPopupHtml).toHaveBeenLastCalledWith(null);
  });

  it('ok:true but caster absent from the combat summary stamps no concentration', async () => {
    applyAnimalShapes.mockResolvedValueOnce({ ok: true });
    const { result, setPopupHtml } = renderFlow();

    await openAnimalShapesBeastPicker(result);

    await act(async () => {
      await result.current.handleAnimalShapesBeastConfirm({ 'Goblin A': 'Wolf' });
    });

    // TestSorcerer is not in the combat summary (Goblin A/B/C) — no caster, no DC.
    expect(getRuntimeValue).not.toHaveBeenCalledWith('TestSorcerer', 'animalShapesConcentrationDc', 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestSorcerer', 'animalShapesConcentrationActive', true, 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestSorcerer', 'animalShapesConcentrationDc', expect.any(Number), 'test-campaign');
    expect(setPopupHtml).toHaveBeenLastCalledWith(null);
  });
});
