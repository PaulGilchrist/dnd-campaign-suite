// @maintained-by-ai 2026-11-26
// Flow-wiring lane for SIMPLE_SPELL_SPECS (useSimpleSpellHandlers.js): one shared
// table drives BOTH legs of the createConfirmHandler/createSkipHandler contract in
// ONE test per spec —
//   gate → pending armed → confirm dispatches the spec's apply/trigger fn exactly
//   once, logs one spell entry, clears pending; then re-arm → skip clears WITHOUT
//   dispatch and WITHOUT any write (2026-11-15 pay-state gate — the armed pending
//   is unpaid; see useConfirmableFlow.skip-paid-gate.test.js for the paid-lane
//   refund pair). Both legs ride the uniform factory loop (no spec in SPELL_ROWS
//   customizes skipTargets), so they share one test; confirm breadth still catches
//   per-spec mis-wiring (wrong fn thunk, wrong key, stray deferCastLog).
// Owned elsewhere — do not duplicate here:
//   - no-pending misfire guards:        useSpellMetamagicFlow.handler-guards.test.js
//   - complex/gate-lane skip clears:    useSpellMetamagicFlow.skip.test.js
//     (incl. the Web + Revivify skip rows)
//   - Web confirm payload/clear:        useSpellMetamagicFlow.webStamp.test.js (SP-126)
//   - SP-100 Revivify confirm success/refusal cast-row bytes:
//                                       useSpellMetamagicFlow.revivifyRefusal.test.js
//   - exposed return-value surface:     useSpellMetamagicFlow.returnValue.test.js
//   - per-handler payload internals:    useSpellMetamagicFlow/useSimpleSpellHandlers.*.test.js
// Adding a spec to SIMPLE_SPELL_SPECS? Add one row to SPELL_ROWS below (Web/Revivify
// stay out — their confirm legs are fully owned by the dedicated lanes above).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import {
  applyBaneEffect, applyBlessEffect, applyHaste, applyInvisibility,
  applyGreaterInvisibility, applyFeignDeath, applyLongstriderEffect,
  applySpareTheDyingEffect, applyBeaconOfHopeEffect, applyAuraOfLifeEffect,
  applyAuraOfPurityEffect, applyCircleOfPowerEffect, applyCompulsionEffect,
  applyAuraOfVitalityEffect, applyDeathWardEffect, applyHeroism,
  handleSanctuary, executeHandler,
} from '../../services/automation/index.js';
import { triggerFaerieFire } from '../../services/rules/features/faerieFireService.js';
import { triggerForesight } from '../../services/rules/features/foresightService.js';

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
    // Goblin A is a dying PC (runtime 0 HP) so the SP-110 Spare the Dying gate arms pending.
    creatures: [{ name: 'Goblin A', type: 'player' }, { name: 'Goblin B' }],
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
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  // SP-110: Goblin A must read as a dying PC (runtime 0 HP) for the Spare the
  // Dying gate; everything else keeps the legacy 3.
  getRuntimeValue: vi.fn((name, key) => {
    if (name === 'Goblin A' && key === 'currentHitPoints') return 0;
    if (name === 'Goblin A' && (key === 'isDead' || key === 'deathSaves')) return null;
    return 3;
  }),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

// Automation mocks — only the dispatch fns the table below asserts on.
vi.mock('../../services/automation/index.js', () => ({
  applyBaneEffect: vi.fn(() => Promise.resolve(null)),
  applyBlessEffect: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(() => Promise.resolve(null)),
  applyInvisibility: vi.fn(() => Promise.resolve(null)),
  applyGreaterInvisibility: vi.fn(() => Promise.resolve(null)),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfPurityEffect: vi.fn(() => Promise.resolve(null)),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve(null)),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve(null)),
  applyDeathWardEffect: vi.fn(() => Promise.resolve(null)),
  applyHeroism: vi.fn(() => Promise.resolve(null)),
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

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ creatures: [] }) });
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

function renderFlow() {
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: makePlayerStats(),
      campaignName: CAMPAIGN,
      onExecute: vi.fn(),
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml: vi.fn(),
    })
  );
  return { result };
}

// One row per SIMPLE_SPELL_SPECS member owned by this flow lane.
// fn = the dispatch fn the spec's runner must invoke exactly once on confirm.
// Web/Revivify omitted: their confirm legs are owned stronger by
// webStamp.test.js / revivifyRefusal.test.js, skip legs by skip.test.js.
const SPELL_ROWS = [
  { spell: 'Bane', level: 0, key: 'Bane', fn: applyBaneEffect },
  { spell: 'Bless', level: 1, key: 'Bless', fn: applyBlessEffect },
  { spell: 'Faerie Fire', level: 1, key: 'FaerieFire', fn: triggerFaerieFire },
  { spell: 'Haste', level: 3, key: 'Haste', fn: applyHaste },
  { spell: 'Invisibility', level: 2, key: 'Invisibility', fn: applyInvisibility },
  { spell: 'Greater Invisibility', level: 4, key: 'GreaterInvisibility', fn: applyGreaterInvisibility },
  { spell: 'Feign Death', level: 3, key: 'FeignDeath', fn: applyFeignDeath },
  { spell: 'Longstrider', level: 0, key: 'Longstrider', fn: applyLongstriderEffect },
  { spell: 'Spare The Dying', level: 0, key: 'SpareTheDying', fn: applySpareTheDyingEffect },
  { spell: 'Beacon of Hope', level: 3, key: 'BeaconOfHope', fn: applyBeaconOfHopeEffect },
  { spell: 'Aura of Life', level: 4, key: 'AuraOfLife', fn: applyAuraOfLifeEffect },
  { spell: 'Aura of Purity', level: 4, key: 'AuraOfPurity', fn: applyAuraOfPurityEffect },
  { spell: 'Circle of Power', level: 5, key: 'CircleOfPower', fn: applyCircleOfPowerEffect },
  { spell: 'Compulsion', level: 4, key: 'Compulsion', fn: applyCompulsionEffect },
  { spell: 'Aura of Vitality', level: 3, key: 'AuraOfVitality', fn: applyAuraOfVitalityEffect },
  { spell: 'Death Ward', level: 4, key: 'DeathWard', fn: applyDeathWardEffect },
  { spell: 'Heroism', level: 1, key: 'Heroism', fn: applyHeroism },
  { spell: 'Sanctuary', level: 1, key: 'Sanctuary', fn: handleSanctuary, arg: 'Goblin A' },
  { spell: 'Foresight', level: 9, key: 'Foresight', fn: triggerForesight },
  { spell: 'Slow', level: 3, key: 'Slow', fn: executeHandler },
  { spell: 'Sleet Storm', level: 3, key: 'SleetStorm', fn: executeHandler },
];

// Default confirm payload for array-target selectors (allTargets/toArray lanes).
const TARGETS = ['Goblin A'];

async function armPending(result, tc) {
  await act(async () => {
    await result.current.gateMetamagic(makeSpell({ name: tc.spell, level: tc.level }));
  });
  expect(result.current[`pending${tc.key}`]).not.toBeNull();
}

describe('useSpellMetamagicFlow — simple handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Both legs in one test per spec: the skip leg needs the pending the confirm
  // leg consumed, so re-arm between legs (uniform factory loop — no row here
  // customizes skipTargets, so one pass per spec suffices).
  for (const tc of SPELL_ROWS) {
    it(`${tc.spell}: confirm dispatches once + logs + clears; skip clears unpaid with zero writes`, async () => {
      const { result } = renderFlow();

      // ── Confirm leg: dispatch exactly once, one spell row, pending cleared.
      await armPending(result, tc);
      await act(async () => {
        await result.current[`handle${tc.key}Confirm`](tc.arg || TARGETS);
      });

      expect(tc.fn).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'spell',
        spellName: tc.spell,
        targets: expect.any(Array),
      }));
      expect(result.current[`pending${tc.key}`]).toBeNull();

      // ── Skip leg: re-arm, then dismiss. 2026-11-15 pay-state gate
      // (bug-revivify-chooser-skip-rollback-inflates-unspent-slot): the gate
      // armed UNPAID (createConfirmHandler pays at CONFIRM), so skip dismisses
      // with NO phantom cast row and NO refund.
      vi.clearAllMocks();
      await armPending(result, tc);
      await act(async () => {
        result.current[`handle${tc.key}Skip`]();
      });

      expect(tc.fn).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(result.current[`pending${tc.key}`]).toBeNull();
    });
  }

  // #1417 DUAL-PRODUCER census (2026-10-22): the runSlow bypass lane must
  // route THROUGH the canonical slowHandler chokepoint (automation/index.js
  // HANDLER_MAP slow: handleSlow) with the confirmed targets INTACT in
  // metaCtx.targets, and must publish ZERO state itself. Single publisher of
  // slow condition/meta/targetEffects is spells/slowHandler.js (its lane
  // pins that metaCtx.targets is honored — selects exactly these names).
  describe('Slow (#1417): bypass payload census', () => {
    it('runSlow ships metaCtx.targets through executeHandler and writes no state itself', async () => {
      const { result } = renderFlow();
      await armPending(result, { spell: 'Slow', level: 3, key: 'Slow' });

      await act(async () => {
        await result.current.handleSlowConfirm(TARGETS);
      });

      expect(executeHandler).toHaveBeenCalledTimes(1);
      const action = executeHandler.mock.calls[0][0];
      expect(action).toMatchObject({
        automation: { type: 'slow', saveType: 'WIS' },
        metaCtx: { targets: TARGETS },
      });
      // No bypass-side state fields may ride the action (no inline publish).
      expect(action.buff).toBeUndefined();
      expect(action.targetEffects).toBeUndefined();
      // Bypass call site performs zero direct store writes.
      const { setRuntimeValue } = await import('../runtime/useRuntimeState.js');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
