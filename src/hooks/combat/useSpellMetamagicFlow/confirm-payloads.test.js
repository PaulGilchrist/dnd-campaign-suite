// @maintained-by-ai: 2026-10-15
// Folder-confirm-payloads AUTHORITY: every popup-bearing confirm lane of the full
// useSpellMetamagicFlow hook, exercised end-to-end (gateMetamagic → pending →
// confirm → setPopupHtml). Levels/ranges are pinned against spells.json (RAW).
// Deep per-handler internals (slot payment, target threading, rider stamps) live
// in the per-handler folder lanes (useCustomHandlers.* / useSimpleSpellHandlers.*
// / useTwoStageHandlers.* .test.js); this file stays breadth: one table row per
// popup lane, exact-payload pins, table-driven.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from '../useSpellMetamagicFlow.js';

import * as automation from '../../../services/automation/index.js';
import { triggerFaerieFire } from '../../../services/rules/features/faerieFireService.js';
import { triggerHeal } from '../../../services/rules/features/healService.js';
import { triggerForesight } from '../../../services/rules/features/foresightService.js';
import { triggerBanishment } from '../../../services/rules/features/banishmentService.js';
import { triggerRevivify } from '../../../services/rules/features/revivifyService.js';
import { triggerHealingWord } from '../../../services/rules/features/healingWordService.js';
import { confirmRemoveCurse } from '../../../services/rules/features/removeCurseService.js';
import { confirmRegenerate } from '../../../services/rules/features/regenerateService.js';
import { applyPolymorph } from '../../../services/automation/handlers/spells/polymorphService.js';
import { applyTruePolymorph } from '../../../services/automation/handlers/spells/truePolymorphService.js';
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js';

// ── Mocking strategy ─────────────────────────────────────────────────────────
// Mock the full module graph the gated confirm lanes touch, but keep every mock
// a bare vi.fn() — the payload a lane emits is declared on its row in POPUP_CASES
// (wired via mockResolvedValueOnce), never baked into the mock. NO_POPUP lanes
// resolve a payload anyway to prove the runner discards it by design.

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      // Goblin C sits at 0 HP with fresh death saves: it arms BOTH the SP-100
      // Revivify dead-target gate and the SP-110 Spare-the-Dying dying gate.
      { name: 'Goblin C', type: 'monster', currentHp: 0, deathSaves: [] },
    ],
  })),
}));

// CLA-033/CLA-037 rider seam — fired centrally by every createConfirmHandler.
vi.mock('../../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

// gateAnimalShapes ally resolution.
vi.mock('../../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase(), 'goblin a', 'goblin b']),
}));

// Automation index — full named surface so every flow module's imports resolve.
vi.mock('../../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn(),
  applyHeroesFeastEffect: vi.fn(),
  applyLesserRestorationEffect: vi.fn(),
  applyMageArmorEffect: vi.fn(),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyShieldOfFaithEffect: vi.fn(),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyBeaconOfHopeEffect: vi.fn(),
  applyHolyAuraEffect: vi.fn(),
  applyHaste: vi.fn(),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(),
  applyCompulsionEffect: vi.fn(),
  applyAuraOfVitalityEffect: vi.fn(),
  applyDeathWardEffect: vi.fn(),
  applyFeignDeath: vi.fn(),
  applyHeroism: vi.fn(),
  applyLongstriderEffect: vi.fn(),
  applySpareTheDyingEffect: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(),
  applyResistanceEffect: vi.fn(),
  applyBarkskinEffect: vi.fn(),
  applyPassWithoutTraceEffect: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(),
  applyStoneSkinHandler: vi.fn(),
  handleSanctuary: vi.fn(),
  executeHandler: vi.fn(),
}));

vi.mock('../../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(),
}));
vi.mock('../../../services/rules/features/healService.js', () => ({
  triggerHeal: vi.fn(),
}));
vi.mock('../../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(),
}));
vi.mock('../../../services/rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(),
}));
vi.mock('../../../services/rules/features/charmPersonService.js', () => ({
  triggerCharmPerson: vi.fn(),
}));
vi.mock('../../../services/rules/features/charmMonsterService.js', () => ({
  triggerCharmMonster: vi.fn(),
}));
vi.mock('../../../services/rules/features/banishmentService.js', () => ({
  triggerBanishment: vi.fn(),
}));
vi.mock('../../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(),
}));
vi.mock('../../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(),
}));
vi.mock('../../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));
vi.mock('../../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(),
}));
vi.mock('../../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(),
}));
vi.mock('../../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));
vi.mock('../../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(),
}));

// Hermetic guard: nothing on these lanes should reach the network.
global.fetch = vi.fn(() =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
);

// ── Factories ──────────────────────────────────────────────────────────────────

function renderWithSpell(spellName, level, overrides = {}) {
  const setPopupHtml = vi.fn();
  const onExecute = vi.fn();
  const spell = { name: spellName, level, casting_time: '1 Action', range: 'Touch', ...overrides };
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: { name: 'TestSorcerer', class: { name: 'Sorcerer' }, level: 17 },
      campaignName: 'test-campaign',
      onExecute,
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml,
    })
  );
  act(() => {
    result.current.gateMetamagic(spell);
  });
  return { result, setPopupHtml, onExecute };
}

// One row per popup lane: RAW level/range (spells.json), the exported confirm
// handler, the lane's terminal apply fn, what it resolves, and the exact payload
// setPopupHtml must receive. popup: NO_POPUP → the lane discards the apply
// result by design (resolved still carries a payload to prove the discard).
const NO_POPUP = Symbol('no-popup');

const POPUP_CASES = [
  // triggerSpell lanes (features/)
  { spell: 'Banishment', level: 4, range: '60 feet', handler: 'handleBanishmentConfirm', arg: ['Goblin A'], apply: triggerBanishment, popup: 'banishment-popup' },
  { spell: 'Faerie Fire', level: 1, range: '60 feet', handler: 'handleFaerieFireConfirm', arg: ['Goblin A'], apply: triggerFaerieFire, popup: 'faerie-fire-popup' },
  // applySpell lanes (automation/) with showPopup wiring
  { spell: 'Holy Aura', level: 8, range: 'Self', handler: 'handleHolyAuraConfirm', arg: ['Goblin A'], apply: automation.applyHolyAuraEffect, popup: 'holyAura-popup' },
  { spell: 'Feign Death', level: 3, range: 'Touch', handler: 'handleFeignDeathConfirm', arg: ['Goblin A'], apply: automation.applyFeignDeath, popup: 'feignDeath-popup' },
  { spell: 'Longstrider', level: 1, range: 'Touch', handler: 'handleLongstriderConfirm', arg: ['Goblin A'], apply: automation.applyLongstriderEffect, popup: 'longstrider-popup' },
  { spell: 'Beacon of Hope', level: 3, range: '30 feet', handler: 'handleBeaconOfHopeConfirm', arg: ['Goblin A'], apply: automation.applyBeaconOfHopeEffect, popup: 'beaconOfHope-popup' },
  { spell: 'Spare the Dying', level: 0, range: '15 feet', handler: 'handleSpareTheDyingConfirm', arg: ['Goblin C'], apply: automation.applySpareTheDyingEffect, popup: 'spareTheDying-popup' },
  { spell: 'Death Ward', level: 4, range: 'Touch', handler: 'handleDeathWardConfirm', arg: ['Goblin A'], apply: automation.applyDeathWardEffect, popup: 'deathWard-popup' },
  { spell: 'Heroism', level: 1, range: 'Touch', handler: 'handleHeroismConfirm', arg: ['Goblin A'], apply: automation.applyHeroism, popup: 'heroism-popup' },
  { spell: 'Circle of Power', level: 5, range: 'Self', handler: 'handleCircleOfPowerConfirm', arg: ['Goblin A'], apply: automation.applyCircleOfPowerEffect, popup: 'circleOfPower-popup' },
  { spell: 'Compulsion', level: 4, range: '30 feet', handler: 'handleCompulsionConfirm', arg: ['Goblin A'], apply: automation.applyCompulsionEffect, popup: 'compulsion-popup' },
  { spell: 'Aura of Vitality', level: 3, range: 'Self', handler: 'handleAuraOfVitalityConfirm', arg: ['Goblin A'], apply: automation.applyAuraOfVitalityEffect, popup: 'auraOfVitality-popup' },
  // confirm-service lanes
  { spell: 'Remove Curse', level: 3, range: 'Touch', handler: 'handleRemoveCurseConfirm', arg: ['Goblin A'], apply: confirmRemoveCurse, popup: 'removeCurse-popup' },
  { spell: 'Foresight', level: 9, range: 'Touch', handler: 'handleForesightConfirm', arg: ['Goblin A'], apply: triggerForesight, popup: 'foresight-popup' },
  { spell: 'Regenerate', level: 7, range: 'Touch', handler: 'handleRegenerateConfirm', arg: { targetName: 'Goblin A' }, apply: confirmRegenerate, popup: 'regenerate-popup' },
  // object-target lane behind the SP-100 dead-target gate (and its rollback guard)
  { spell: 'Revivify', level: 3, range: 'Touch', handler: 'handleRevivifyConfirm', arg: { targetName: 'Goblin C' }, apply: triggerRevivify, popup: 'revivify-popup' },
  // polymorph lane
  { spell: 'Polymorph', level: 4, range: '60 feet', handler: 'handlePolymorphConfirm', arg: ['Goblin A'], apply: applyPolymorph, popup: 'polymorph-popup' },
  // custom-handler lanes (pay-at-confirm chooser family)
  { spell: 'Protection from Poison', level: 2, range: 'Touch', handler: 'handleProtectionFromPoisonConfirm', arg: ['Goblin A'], apply: automation.applyProtectionFromPoisonHandler, popup: 'protectionFromPoison-popup' },
  { spell: 'Barkskin', level: 2, range: 'Touch', handler: 'handleBarkskinConfirm', arg: ['Goblin A'], apply: automation.applyBarkskinEffect, popup: 'barkskin-popup' },
  { spell: 'Stone Skin', level: 4, range: 'Touch', handler: 'handleStoneSkinConfirm', arg: ['Goblin A'], apply: automation.applyStoneSkinHandler, popup: 'stoneSkin-popup' },
  // string-target lane
  { spell: 'Sanctuary', level: 1, range: '30 feet', handler: 'handleSanctuaryConfirm', arg: ['Goblin A'], apply: automation.handleSanctuary, popup: 'sanctuary-popup' },
  // executeHandler lanes (runConfusion shows; the globe/forcecage/antimagic twins
  // route through their own area-handler callbacks which also surface the payload)
  { spell: 'Confusion', level: 4, range: '90 feet', handler: 'handleConfusionConfirm', arg: ['Goblin A'], apply: automation.executeHandler, popup: 'confusion-popup' },
  { spell: 'Globe of Invulnerability', level: 6, range: 'Self', handler: 'handleGlobeConfirm', arg: ['Goblin A'], apply: automation.executeHandler, popup: 'globe-popup' },
  { spell: 'Forcecage', level: 7, range: '100 feet', handler: 'handleForcecageConfirm', arg: ['Goblin A'], apply: automation.executeHandler, popup: 'forcecage-popup' },
  { spell: 'Antimagic Field', level: 8, range: 'Self', handler: 'handleAntimagicFieldConfirm', arg: ['Goblin A'], apply: automation.executeHandler, popup: 'antimagic-popup' },
  // healing-word object payload (buildHealingWordPopup shape)
  {
    spell: 'Healing Word', level: 1, range: '60 feet', handler: 'handleHealingWordConfirm', arg: { targetName: 'Goblin A' },
    apply: triggerHealingWord,
    resolved: { formula: '1d4+2', rolls: [3], rawTotal: 5, healAmount: 5, targetName: 'Goblin A', bonusHeal: 2, bonusDetails: [{ amount: 2, name: 'Tavern Heal' }] },
    popup: expect.objectContaining({ type: 'heal', name: 'Healing Word', formula: '1d4+2', total: 5, finalHeal: 5, bonusHeal: 2, bonusHealDetail: '2 Tavern Heal' }),
  },
  // NO_POPUP lanes — spec deliberately omits showPopup wiring (or the runner
  // discards the result): a payload from apply must never reach setPopupHtml.
  // (Shield of Faith has no chooser gate — its cast queues generic metamagic —
  // so its unprompted confirm lane is not armable from gateMetamagic.)
  { spell: 'Bane', level: 1, range: '30 feet', handler: 'handleBaneConfirm', arg: ['Goblin A'], apply: automation.applyBaneEffect, popup: NO_POPUP },
  { spell: 'Heal', level: 6, range: '60 feet', handler: 'handleHealConfirm', arg: { targetName: 'Goblin A' }, apply: triggerHeal, popup: NO_POPUP },
  { spell: 'Web', level: 2, range: '60 feet', handler: 'handleWebConfirm', arg: ['Goblin A'], apply: automation.executeHandler, popup: NO_POPUP },
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — confirm payload authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const c of POPUP_CASES) {
    const resolved = c.resolved ?? (c.popup === NO_POPUP ? { payload: `${c.handler}-never-shown` } : { payload: c.popup });
    it(`${c.spell} lv${c.level}: ${c.popup === NO_POPUP ? 'apply runs, no popup' : `popup payload "${typeof c.popup === 'string' ? c.popup : 'object'}"`}`, async () => {
      const { result, setPopupHtml } = renderWithSpell(c.spell, c.level, { range: c.range });
      c.apply.mockResolvedValueOnce(resolved);

      await act(async () => {
        await result.current[c.handler](c.arg);
      });

      expect(c.apply).toHaveBeenCalledTimes(1);
      if (c.popup === NO_POPUP) {
        expect(setPopupHtml).not.toHaveBeenCalled();
      } else {
        expect(setPopupHtml).toHaveBeenCalledWith(c.popup);
      }
    });
  }

  // ── Two-stage True Polymorph (path-select pays the lv9 slot; both paths
  // surface the same applyTruePolymorph payload) ────────────────────────────────

  describe('two-stage True Polymorph', () => {
    it('object_into_creature resolves at path-select (pays slot, no target-confirm)', async () => {
      const { result, setPopupHtml } = renderWithSpell('True Polymorph', 9, { range: '30 feet' });
      applyTruePolymorph.mockResolvedValueOnce({ payload: 'true-polymorph-popup' });

      await act(async () => {
        await result.current.handleTruePolymorphPathSelect('object_into_creature');
      });

      expect(setPopupHtml).toHaveBeenCalledWith('true-polymorph-popup');
      expect(prepareSpellCast).toHaveBeenCalled();
      expect(result.current.pendingTruePolymorph).toBeNull();
    });

    it('creature_to_creature resolves after path select + target confirm', async () => {
      const { result, setPopupHtml } = renderWithSpell('True Polymorph', 9, { range: '30 feet' });
      applyTruePolymorph.mockResolvedValueOnce({ payload: 'true-polymorph-popup' });

      await act(async () => {
        result.current.handleTruePolymorphPathSelect('creature_to_creature');
      });
      await act(async () => {
        await result.current.handleTruePolymorphTargetConfirm(['Goblin A']);
      });

      expect(setPopupHtml).toHaveBeenCalledWith('true-polymorph-popup');
      expect(prepareSpellCast).toHaveBeenCalled();
      expect(result.current.pendingTruePolymorph).toBeNull();
    });
  });

  // ── Two-stage Resistance (no per-handler lane elsewhere): target→type stages,
  // per-target apply, result discarded (no popup by design) ─────────────────────

  it('Resistance lv0: target→type two-stage applies per target, shows no popup', async () => {
    const { result, setPopupHtml } = renderWithSpell('Resistance', 0);

    expect(result.current.resistanceStage).toBe('target');
    act(() => {
      result.current.handleResistanceTargetSelect('Goblin A');
    });
    expect(result.current.resistanceStage).toBe('type');

    automation.applyResistanceEffect.mockResolvedValueOnce({ payload: 'resistance-popup' });
    await act(async () => {
      await result.current.handleResistanceTypeSelect('Fire');
    });

    expect(automation.applyResistanceEffect).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(result.current.resistanceStage).toBeNull();
  });

  // ── Animal Shapes first-stage chooser (its own popup object) ────────────────

  it('Animal Shapes lv8: target-confirm opens the beast picker payload', async () => {
    const { result, setPopupHtml } = renderWithSpell('Animal Shapes', 8, { range: '30 feet' });

    await act(async () => {
      await result.current.handleAnimalShapesTargetConfirm(['Goblin A']);
    });

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'animal_shapes_target_selection',
      targets: ['Goblin A'],
      casterName: 'TestSorcerer',
      spellLevel: 8,
      maxCR: 4,
    }));
    expect(result.current.pendingAnimalShapes).toBeNull();
  });

  // ── Magic Missile distribution (onExecute lane — payload pin at prepareSpellCast) ──

  it('Magic Missile lv1: confirm threads the dart distribution + paid slot into prepareSpellCast', async () => {
    const { result, onExecute } = renderWithSpell('Magic Missile', 1, { range: '120 feet' });
    const distribution = { 'Goblin A': 2, 'Goblin B': 1 };

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution });
    });

    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Magic Missile' }),
      expect.objectContaining({ magicMissileDistribution: distribution, slotLevel: 1 }),
      expect.anything(),
    );
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(result.current.pendingMagicMissile).toBeNull();
  });
});
