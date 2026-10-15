// @maintained-by-ai: 2026-10-15
//
// SKIP/ROLLBACK AUTHORITY — metamagic gate lane.
// Owns the gate → pending → skip contract for the gated spells below (simple-handlers.test.js
// cites this file as owner of Web/Revivify skip + general skip-rollback semantics).
// Upcast-specific refund (CLA-086, level stamped from pending.spell.upcastLevel) lives in
// the cla086 lane; rows here pin BASE-level behavior with RAW levels per public/data/spells.json.
//
// Two skip lanes (per useConfirmableFlow.js / useCustomHandlers.js / useComplexSpellHandlers.js):
//  - lane 'refund': createSkipHandler — clears pending, logs the cast entry, and rolls back
//    the slot at pending.spellLevel. Free-cast spells (FREE_CAST_SPELLS) refund the free-cast
//    resource via incrementFreeCastResource instead of the slot.
//  - lane 'clear': pay-at-confirm chooser family (§CLA-208, SP-085/SP-095/SP-125) — the gate
//    never spends the slot, so skip clears pending with NO log and NO refund.
// Every row also asserts the no-pending face: skip before any gate is a zero-side-effect no-op.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';
import { incrementFreeCastResource } from '../../services/rules/spells/spellPreparationService.js';

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
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

// Goblin C is dead (currentHp 0) so the SP-100 Revivify dead-target gate arms pending.
vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C', type: 'monster', currentHp: 0 },
    ],
  })),
  loadCombatSummary: vi.fn(() => Promise.resolve({ creatures: [] })),
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
  applyShieldOfFaithEffect: vi.fn(),
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyResistanceEffect: vi.fn(),
  executeHandler: vi.fn(() => Promise.resolve(null)),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve(null)),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve(null)),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve(null)),
  applyDeathWardEffect: vi.fn(() => Promise.resolve(null)),
  applyHeroism: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve(null)),
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
  triggerBanishment: vi.fn(() => Promise.resolve(null)),
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
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

// Runtime slot mock: 3 available at every level → a skip refund is observable as
// setRuntimeValue(name, 'spell_slots_level_N', 4, campaign).
vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
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

const CAMPAIGN = 'TestCampaign';
const CASTER = 'TestSorcerer';

function renderFlow() {
  const setPopupHtml = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: { name: CASTER, class: { name: 'Sorcerer' }, level: 5 },
      campaignName: CAMPAIGN,
      onExecute: vi.fn(),
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml,
    })
  );
  return { result, setPopupHtml };
}

// ── Authority table ────────────────────────────────────────────────────────────
// Levels are RAW, verified against public/data/spells.json — the refund lane
// asserts the exact slot key, so a wrong level here would pin a wrong refund.
// lane: 'refund' (createSkipHandler) | 'free' (refund = free-cast resource) |
//       'clear' (pay-at-confirm chooser: no log, no refund).
// Hold Person / Charm Person / Animal Friendship / Animal Shapes are excluded:
// their gates filter creatures by type and the mock summary carries only goblins.
const skipCases = [
  { spell: 'Magic Missile', level: 1, time: '1 Action', range: '150 ft.', pending: 'pendingMagicMissile', handler: 'handleMagicMissileSkip', lane: 'clear' },
  { spell: 'Healing Word', level: 1, time: '1 Bonus Action', range: '60 ft.', pending: 'pendingHealingWord', handler: 'handleHealingWordSkip', lane: 'refund' },
  { spell: 'Cure Wounds', level: 1, time: '1 Action', range: 'Touch', pending: 'pendingCureWounds', handler: 'handleCureWoundsSkip', lane: 'refund' },
  { spell: 'Web', level: 2, time: '1 Action', range: '60 ft.', pending: 'pendingWeb', handler: 'handleWebSkip', lane: 'refund' },
  { spell: 'Pass Without Trace', level: 2, time: '1 Bonus Action', range: 'Self', pending: 'pendingPassWithoutTrace', handler: 'handlePassWithoutTraceSkip', lane: 'clear' },
  { spell: 'Barkskin', level: 2, time: '1 Bonus Action', range: 'Touch', pending: 'pendingBarkskin', handler: 'handleBarkskinSkip', lane: 'clear' },
  { spell: 'Revivify', level: 3, time: '1 Action', range: 'Touch', pending: 'pendingRevivify', handler: 'handleRevivifySkip', lane: 'refund' },
  { spell: 'Stinking Cloud', level: 3, time: '1 Action', range: '90 ft.', pending: 'pendingStinkingCloud', handler: 'handleStinkingCloudSkip', lane: 'refund' },
  { spell: 'Polymorph', level: 4, time: '1 Action', range: '60 ft.', pending: 'pendingPolymorph', handler: 'handlePolymorphSkip', lane: 'refund' },
  { spell: 'Charm Monster', level: 4, time: '1 Action', range: '30 ft.', pending: 'pendingCharmMonster', handler: 'handleCharmMonsterSkip', lane: 'refund' },
  { spell: 'Confusion', level: 4, time: '1 Action', range: '90 ft.', pending: 'pendingConfusion', handler: 'handleConfusionSkip', lane: 'refund' },
  { spell: 'Greater Restoration', level: 5, time: '1 Action', range: 'Touch', pending: 'pendingGreaterRestoration', handler: 'handleGreaterRestorationSkip', lane: 'free' },
  { spell: 'Hold Monster', level: 5, time: '1 Action', range: '60 ft.', pending: 'pendingHoldMonster', handler: 'handleHoldMonsterSkip', lane: 'refund' },
  { spell: 'Globe of Invulnerability', level: 6, time: '1 Action', range: 'Self', pending: 'pendingGlobe', handler: 'handleGlobeSkip', lane: 'refund' },
  { spell: 'Prismatic Spray', level: 7, time: '1 Action', range: '60 ft.', pending: 'pendingPrismaticSpray', handler: 'handlePrismaticSpraySkip', lane: 'refund' },
  { spell: 'Forcecage', level: 7, time: '1 Action', range: '100 ft.', pending: 'pendingForcecage', handler: 'handleForcecageSkip', lane: 'refund' },
  { spell: 'True Polymorph', level: 7, time: '1 Action', range: '30 ft.', pending: 'pendingTruePolymorph', handler: 'handleTruePolymorphSkip', lane: 'clear' },
  { spell: 'Antimagic Field', level: 8, time: '1 Action', range: 'Self', pending: 'pendingAntimagicField', handler: 'handleAntimagicFieldSkip', lane: 'refund' },
];

describe('useSpellMetamagicFlow — skip lane authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const tc of skipCases) {
    const semantics = {
      refund: 'logs the cast and refunds the lv' + tc.level + ' slot',
      free: 'logs the cast and refunds the free-cast resource, not the slot',
      clear: 'clears unpaid: no log, no refund (pay-at-confirm chooser)',
    }[tc.lane];

    it(`${tc.spell} skip — ${semantics}`, async () => {
      const { result } = renderFlow();
      const spell = { name: tc.spell, level: tc.level, casting_time: tc.time, range: tc.range };

      // Face 1: skip with nothing armed is a zero-side-effect no-op.
      act(() => { result.current[tc.handler](); });
      expect(result.current[tc.pending]).toBeNull();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(incrementFreeCastResource).not.toHaveBeenCalled();

      // Gate arms pending for the sorcerer.
      await act(async () => { await result.current.gateMetamagic(spell); });
      expect(result.current[tc.pending]).not.toBeNull();

      // Face 2: skip clears pending and pays the lane's exact money.
      act(() => { result.current[tc.handler](); });
      expect(result.current[tc.pending]).toBeNull();

      if (tc.lane === 'clear') {
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(incrementFreeCastResource).not.toHaveBeenCalled();
      } else {
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
          type: 'spell',
          characterName: CASTER,
          spellName: tc.spell,
          spellLevel: tc.level,
        }));
        if (tc.lane === 'free') {
          // FREE_CAST_SPELLS refund the free-cast resource, never a slot.
          expect(incrementFreeCastResource).toHaveBeenCalledWith(CASTER, tc.spell, tc.level, expect.anything(), CAMPAIGN);
          expect(setRuntimeValue).not.toHaveBeenCalled();
        } else {
          // Mocked available = 3 → refund lands as available + 1 at the RAW slot level.
          expect(setRuntimeValue).toHaveBeenCalledWith(CASTER, `spell_slots_level_${tc.level}`, 4, CAMPAIGN);
          expect(incrementFreeCastResource).not.toHaveBeenCalled();
        }
      }
    });
  }

  it('Animal Shapes never arms without beast targets — skip stays a no-op', async () => {
    const { result } = renderFlow();

    await act(async () => { await result.current.gateMetamagic({ name: 'Animal Shapes', level: 8, casting_time: '1 Action', range: '30 ft.' }); });
    // Goblin-only summary: the beast gate resolves zero targets, so nothing is armed.
    expect(result.current.pendingAnimalShapes).toBeNull();

    act(() => { result.current.handleAnimalShapesSkip(); });
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
