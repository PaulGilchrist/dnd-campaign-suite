// @maintained-by-ai 2026-11-26
// Special-path skip lanes for useSpellMetamagicFlow — branches no sibling suite pins:
// - Foresight / Protection from Evil and Good gate-armed unpaid skip: these two
//   choosers sit OUTSIDE skip.test.js's 18-row authority table; skip dismisses
//   with the exhaustive zero-write census (no log, no slot/free-cast write, no
//   apply, no execute). 2026-11-15 pay-state gate
//   (bug-revivify-chooser-skip-rollback-inflates-unspent-slot) inverted the
//   byte-exact phantom-cast-row pins this file used to carry.
// - True Polymorph skip AFTER path-select (mid-machine): skip.test.js owns the
//   pre-select row; the path-persisted seam is unique here.
// Owned elsewhere and removed as duplicates: Animal Shapes target-confirm popup +
// lv8 CR gate (confirm-payloads.test.js), beast-picker stage-2→3 handoff
// and concentration stamps (multi-stage.test.js), skip-before-select for all 18
// table spells incl. True Polymorph and the never-arm no-op (skip.test.js),
// Shield of Faith no-gate routing (gate.test.js) and its un-armed handler guards
// (generic useConfirmableFlow pending guard, exercised in skip/rollback lanes).
// Spell levels/casting times verified against public/data/spells.json.
// 2026-11-26 audit: the two chooser-skip rows consolidated into an it.each table;
// postCastRiderService mock gained the triggerPostCastRiderSaves/
// triggerBewitchingMagic exports useConfirmableFlow imports.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';
import { incrementFreeCastResource } from '../../services/rules/spells/spellPreparationService.js';
import { applyTruePolymorph } from '../../services/automation/handlers/spells/truePolymorphService.js';
import { triggerForesight } from '../../services/rules/features/foresightService.js';
import { applyProtectionFromEvilAndGood } from '../../services/automation/index.js';


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

// Gate-armed chooser skips OUTSIDE skip.test.js's 18-row authority table.
// The unpaid census (addEntry/setRuntimeValue/incrementFreeCastResource) mirrors
// skip.test.js's exhaustive write channels: an unpaid dismiss must move no money
// and stamp no cast row. Handler spies prove the skip never applies the effect.
const unpaidSkipCases = [
  // spells.json: lv9, 1 minute, Touch. 2026-11-15 pay-state gate
  // (bug-revivify-chooser-skip-rollback-inflates-unspent-slot) killed the byte-exact
  // phantom allTargets cast row this lane used to enshrine.
  {
    spell: { name: 'Foresight', level: 9, casting_time: '1 minute', range: 'Touch' },
    pending: 'pendingForesight',
    skip: 'handleForesightSkip',
    applySpy: triggerForesight,
  },
  // spells.json: lv1, 1 action, Touch. The skipTargets override in
  // useSimpleSpellHandlers.js has nothing to stamp here — it survives only on a
  // paid pending.
  {
    spell: { name: 'Protection from Evil and Good', level: 1, casting_time: '1 action', range: 'Touch' },
    pending: 'pendingProtectionFromEvilAndGood',
    skip: 'handleProtectionFromEvilAndGoodSkip',
    applySpy: applyProtectionFromEvilAndGood,
  },
];

describe('useSpellMetamagicFlow — unpaid skip lanes dismiss with zero writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(unpaidSkipCases)(
    '$spell.name skip: UNPAID dismiss — pending cleared, zero writes, effect never applied',
    async ({ spell, pending, skip, applySpy }) => {
      const { result, onExecute } = renderFlow();

      // Non-vacuity: the gate must arm the chooser UNPAID before skipping.
      await gateSpell(result, spell);
      expect(result.current[pending]).not.toBeNull();

      act(() => {
        result.current[skip]();
      });

      expect(result.current[pending]).toBeNull();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(incrementFreeCastResource).not.toHaveBeenCalled();
      expect(applySpy).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
    }
  );
});

describe('useSpellMetamagicFlow — True Polymorph skip after path-select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skip mid-machine (path persisted, nothing paid) clears without log, refund, or apply', async () => {
    const { result, onExecute } = renderFlow();
    // spells.json: lv9, 1 action, 30 feet. creature_to_creature pays only at
    // target-confirm, so skipping after path-select must leave no money movement.
    // skip.test.js owns the PRE-select row; the mid-machine seam is unique here.
    await gateSpell(result, { name: 'True Polymorph', level: 9, casting_time: '1 action', range: '30 feet' });

    act(() => {
      result.current.handleTruePolymorphPathSelect('creature_to_creature');
    });
    // Path-select keeps the machine open (multi-stage seam) — skip must still reach it.
    expect(result.current.pendingTruePolymorph).not.toBeNull();

    act(() => {
      result.current.handleTruePolymorphSkip();
    });

    // The persisted path disappears with the whole machine.
    expect(result.current.pendingTruePolymorph).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(incrementFreeCastResource).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(applyTruePolymorph).not.toHaveBeenCalled();
  });
});
