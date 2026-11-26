// @maintained-by-ai 2026-10-15: 2026-11-15
// Special-path skip lanes for useSpellMetamagicFlow — branches no sibling suite pins:
// - Foresight / Protection from Evil and Good skip: UNPAID dismisses — zero writes,
//   zero log (2026-11-15 pay-state gate, bug-revivify-chooser-skip-rollback-
//   inflates-unspent-slot inverted the byte-exact phantom-cast-row pins this file
//   carried; the allTargets default and the skipTargets override in
//   useSimpleSpellHandlers.js stay in place for genuinely paid pendings).
// - True Polymorph skip AFTER path-select: the multi-stage machine clears unpaid.
// Owned elsewhere and removed as duplicates: Animal Shapes target-confirm popup +
// lv8 CR gate (complex-handlers.spells.test.js), beast-picker stage-2→3 handoff
// and concentration stamps (multi-stage.test.js), skip-before-select for all 18
// table spells incl. True Polymorph and the never-arm no-op (skip.test.js),
// Shield of Faith no-gate routing (gate.test.js) and its un-armed handler guards
// (generic useConfirmableFlow pending guard, exercised in skip/rollback lanes).
// Spell levels/casting times verified against public/data/spells.json 2026-10-15.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { applyTruePolymorph } from '../../services/automation/handlers/spells/truePolymorphService.js';


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
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: { name: CASTER, class: { name: 'Sorcerer' }, level: 5 },
      campaignName: CAMPAIGN,
      onExecute,
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml: vi.fn(),
    })
  );
  return { result, onExecute };
}

async function gateSpell(result, spell) {
  await act(async () => {
    await result.current.gateMetamagic(spell);
  });
}

describe('useSpellMetamagicFlow — unpaid skip lanes dismiss with zero writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Foresight skip: UNPAID dismiss — zero writes, no cast row, pending cleared', async () => {
    const { result } = renderFlow();
    // spells.json: lv9, 1 minute, Touch. 2026-11-15 pay-state gate
    // (bug-revivify-chooser-skip-rollback-inflates-unspent-slot): the gate armed
    // this chooser UNPAID, so skip logs NOTHING — the byte-exact phantom
    // allTargets cast row this pin used to enshrine is dead.
    await gateSpell(result, { name: 'Foresight', level: 9, casting_time: '1 minute', range: 'Touch' });
    expect(result.current.pendingForesight).not.toBeNull();

    act(() => {
      result.current.handleForesightSkip();
    });

    expect(result.current.pendingForesight).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('Protection from Evil and Good skip: UNPAID dismiss — zero writes, pending cleared', async () => {
    const { result } = renderFlow();
    // spells.json: lv1, 1 action, Touch. Same pay-state gate as the Foresight
    // row: an unpaid skip logs nothing, so the skipTargets override has nothing
    // to stamp (its caster-only byte-shape survives only on a paid pending).
    await gateSpell(result, { name: 'Protection from Evil and Good', level: 1, casting_time: '1 action', range: 'Touch' });
    expect(result.current.pendingProtectionFromEvilAndGood).not.toBeNull();

    act(() => {
      result.current.handleProtectionFromEvilAndGoodSkip();
    });

    expect(result.current.pendingProtectionFromEvilAndGood).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — True Polymorph skip after path-select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skip mid-machine (path persisted, nothing paid) clears without log, refund, or apply', async () => {
    const { result, onExecute } = renderFlow();
    // spells.json: lv9, 1 action, 30 feet. creature_to_creature pays at target-confirm,
    // so skipping after path-select must leave no money movement (clear lane).
    await gateSpell(result, { name: 'True Polymorph', level: 9, casting_time: '1 action', range: '30 feet' });

    act(() => {
      result.current.handleTruePolymorphPathSelect('creature_to_creature');
    });
    // Path-select keeps the machine open (multi-stage seam) — skip must still reach it.
    expect(result.current.pendingTruePolymorph).not.toBeNull();

    act(() => {
      result.current.handleTruePolymorphSkip();
    });

    expect(result.current.pendingTruePolymorph).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(applyTruePolymorph).not.toHaveBeenCalled();
  });
});
