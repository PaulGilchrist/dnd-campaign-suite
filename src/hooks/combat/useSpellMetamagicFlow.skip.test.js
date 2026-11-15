// @maintained-by-ai: 2026-11-15
//
// SKIP AUTHORITY — metamagic gate lane.
// Owns the gate → pending → skip contract for the gated spells below (simple-handlers.test.js
// cites this file as owner of Web/Revivify skip + general skip semantics).
// Upcast-level REFUND bytes (CLA-086) live on the PAID lane, pinned by
// useConfirmableFlow.skip-paid-gate.test.js and the cla086 lane.
//
// 2026-11-15 INVERSION (bug-revivify-chooser-skip-rollback-inflates-unspent-slot):
// the old 'refund'/'free' lanes (createSkipHandler logs + rolls back / credits the
// free-cast resource) ENshrined an UNPAID refund — every gate in this table arms its
// chooser via spellGates → makePending WITHOUT spending anything (the slot is paid at
// CONFIRM by createConfirmHandler → prepareSpellCast), so a skip refunded money that
// was never paid, drifting spell_slots_level_N above the class max (Revivify observed
// live 3→4 on a lv8 cleric) and logging a phantom cast row. Per the §11 unpaid-lane
// law, EVERY pay-at-confirm chooser skip in this table now clears pending with NO log
// and NO refund — the pay-at-confirm 'clear' semantics that already governed Magic
// Missile / Pass Without Trace / Barkskin / True Polymorph is now the whole lane.
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
// Levels are RAW, verified against public/data/spells.json (kept for row identity).
// Every lane is 'clear': a pay-at-confirm chooser skip dismisses with zero writes
// (2026-11-15 pay-state gate — see file header).
// Hold Person / Charm Person / Animal Friendship / Animal Shapes are excluded:
// their gates filter creatures by type and the mock summary carries only goblins.
const skipCases = [
  { spell: 'Magic Missile', level: 1, time: '1 Action', range: '150 ft.', pending: 'pendingMagicMissile', handler: 'handleMagicMissileSkip' },
  { spell: 'Healing Word', level: 1, time: '1 Bonus Action', range: '60 ft.', pending: 'pendingHealingWord', handler: 'handleHealingWordSkip' },
  { spell: 'Cure Wounds', level: 1, time: '1 Action', range: 'Touch', pending: 'pendingCureWounds', handler: 'handleCureWoundsSkip' },
  { spell: 'Web', level: 2, time: '1 Action', range: '60 ft.', pending: 'pendingWeb', handler: 'handleWebSkip' },
  { spell: 'Pass Without Trace', level: 2, time: '1 Bonus Action', range: 'Self', pending: 'pendingPassWithoutTrace', handler: 'handlePassWithoutTraceSkip' },
  { spell: 'Barkskin', level: 2, time: '1 Bonus Action', range: 'Touch', pending: 'pendingBarkskin', handler: 'handleBarkskinSkip' },
  { spell: 'Revivify', level: 3, time: '1 Action', range: 'Touch', pending: 'pendingRevivify', handler: 'handleRevivifySkip' },
  { spell: 'Stinking Cloud', level: 3, time: '1 Action', range: '90 ft.', pending: 'pendingStinkingCloud', handler: 'handleStinkingCloudSkip' },
  { spell: 'Polymorph', level: 4, time: '1 Action', range: '60 ft.', pending: 'pendingPolymorph', handler: 'handlePolymorphSkip' },
  { spell: 'Charm Monster', level: 4, time: '1 Action', range: '30 ft.', pending: 'pendingCharmMonster', handler: 'handleCharmMonsterSkip' },
  { spell: 'Confusion', level: 4, time: '1 Action', range: '90 ft.', pending: 'pendingConfusion', handler: 'handleConfusionSkip' },
  { spell: 'Greater Restoration', level: 5, time: '1 Action', range: 'Touch', pending: 'pendingGreaterRestoration', handler: 'handleGreaterRestorationSkip' },
  { spell: 'Hold Monster', level: 5, time: '1 Action', range: '60 ft.', pending: 'pendingHoldMonster', handler: 'handleHoldMonsterSkip' },
  { spell: 'Globe of Invulnerability', level: 6, time: '1 Action', range: 'Self', pending: 'pendingGlobe', handler: 'handleGlobeSkip' },
  { spell: 'Prismatic Spray', level: 7, time: '1 Action', range: '60 ft.', pending: 'pendingPrismaticSpray', handler: 'handlePrismaticSpraySkip' },
  { spell: 'Forcecage', level: 7, time: '1 Action', range: '100 ft.', pending: 'pendingForcecage', handler: 'handleForcecageSkip' },
  { spell: 'True Polymorph', level: 7, time: '1 Action', range: '30 ft.', pending: 'pendingTruePolymorph', handler: 'handleTruePolymorphSkip' },
  { spell: 'Antimagic Field', level: 8, time: '1 Action', range: 'Self', pending: 'pendingAntimagicField', handler: 'handleAntimagicFieldSkip' },
];

describe('useSpellMetamagicFlow — skip lane authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const tc of skipCases) {
    it(`${tc.spell} skip — clears unpaid: no log, no refund (pay-at-confirm chooser)`, async () => {
      const { result } = renderFlow();
      const spell = { name: tc.spell, level: tc.level, casting_time: tc.time, range: tc.range };

      // Face 1: skip with nothing armed is a zero-side-effect no-op.
      act(() => { result.current[tc.handler](); });
      expect(result.current[tc.pending]).toBeNull();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(incrementFreeCastResource).not.toHaveBeenCalled();

      // Gate arms pending for the sorcerer — UNPAID (makePending spends nothing).
      await act(async () => { await result.current.gateMetamagic(spell); });
      expect(result.current[tc.pending]).not.toBeNull();

      // Face 2: skip dismisses with a byte-empty write census — nothing was paid,
      // so nothing is refunded and no cast row is stamped.
      act(() => { result.current[tc.handler](); });
      expect(result.current[tc.pending]).toBeNull();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(incrementFreeCastResource).not.toHaveBeenCalled();
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
