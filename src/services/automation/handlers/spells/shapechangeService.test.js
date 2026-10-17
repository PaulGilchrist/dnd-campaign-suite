// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * shapechangeService.test.js — lane #1954, SECOND of the shapechange PAIR
 * (sibling #1953 shapechangeHandler.test.js closes first; header recorded there).
 * Closes the family.
 *
 * Split (per #1953 header shed): handler is pure gate/payload-builder with ZERO
 * writes; THIS lane owns all application semantics: confirmShapechangeTransform
 * (cs stat swap, first-form THP anchor, concentration DC stamp, pendingExpirations,
 * targetEffects push incl polymorph-family cleanup), revertShapechange and the
 * private revertShapechangeTempHp (tested through revertShapechange).
 *
 * Production-caller liveness (verified 2026-10-16, grep incl. dynamic dispatch):
 * - confirmShapechangeTransform ← CharSheet.jsx:23, CreatureTargetPopups.jsx:5
 *   (shapechange_select + form-change popup confirms). LIVE.
 * - revertShapechange ← CreatureCard.jsx:25 (badge removal), useInitiativeEffects.js:9
 *   (new-initiative seam), clearExpirationEffects.js:9 → :451 (expiry router). LIVE.
 *
 * DEAD-API (#1916 pattern) — test lanes removed, export deletion flagged for owner:
 * - applyShapechange: ZERO production callers. No `apply${...}` bracket-string
 *   dispatch exists repo-wide; the live cast lane invokes shapechangeHandler.handle
 *   DIRECTLY via modalSpells.js (#1953 lane 1). Collateral: service.js:7
 *   `import { handle as runShapechangeHandler }` is consumed ONLY by applyShapechange,
 *   so deleting the export retires the import too — the service stops importing the
 *   handler (the INVERSE-delegation edge #1953 flagged).
 * - getActiveShapechanges / getShapechangeCaster: ZERO callers outside this file.
 *   The revert lane's caster recovery re-implements the lookup inline; consumers
 *   read targetEffects directly.
 * The ./shapechangeHandler.js mock stays as a load-guard until those exports die.
 *
 * POLICY VIOLATION (AGENTS.md no-timers mandate; eyebite #1906 family) — FLAGGED,
 * prod NOT touched, behavior pinned honestly as-shipped:
 * service.js:128-138 stores pendingExpirations with expiryRounds: 600 for
 * "Concentration, up to 1 hour" — the RETIRED hours×600 recipe. This is a REAL
 * countdown, not inert metadata: expirationQueue.js:47 expires entries when
 * currentRound >= appliedRound + expiryRounds, and clearExpirationEffects.js:451
 * routes shapechange expiry → revertShapechange. The mandate says ≥1-minute
 * durations are combat-scoped (cleared by new initiative / rests), NEVER round
 * countdowns, and "concentration stays concentration — never a fabricated clock".
 * Canonical sibling: polymorphService #1937 stores expiryRounds: Infinity (latch).
 * If prod is fixed to Infinity per policy, the POLICY pins below fail loudly and
 * update with it.
 *
 * Clobber comparison vs polymorphService #1937 (recast-snapshot-clobber PROD BUG):
 * shapechangeService does NOT clobber — isFormChange guards on creature.shapechangeOriginal
 * presence (animalShapesService isFirstTransform canonical twin, service.js:71).
 * Originals, first-form THP, concentration and the expiry anchor survive every later
 * confirm, and a flagless recast on an already-transformed creature FOLDS INTO the
 * form-change path. Pinned below; a regression to clobber fails loudly.
 *
 * abilities-ARRAY inspection (polymorph #prod-bug class): the service NEVER reads
 * playerStats.abilities — the DC chain is spellAbilities?.saveDc || 8 + proficiency
 * (service.js:50), so the `.CON?.bonus` object-access bug class is ABSENT here.
 * makePlayerStats keeps the prod-fidelity ARRAY shape (public/campaigns/test-campaign/*.json)
 * so the absence claim stays honest against real data.
 *
 * FIXED vacuous lanes at this pass:
 * (a) 'finds caster from targetEffects when creature has no shapechangeSource' mocked
 *     shapechangeSource INTACT → ran the ordinary changed=true path, never the
 *     recovery branch. Rewritten: source-less creature, honest pins (returns FALSE,
 *     te still removed, expiry cleared via the recovered caster).
 * (b) 'includes challenge rating in log description' — subsumed by the full-string
 *     save_result pin → folded.
 * (c) 'uses spell name from spell param for concentration' — byte-identical to the
 *     SP-103 fallback-DC pin → removed.
 * (d) revert persist pair ('persists only when changed' / 'sets cache when changed')
 *     → folded into the full-revert and idempotent lanes.
 * (e) array-target te lane only asserted the write call was truthy → strengthened to
 *     exact kept-array pins.
 * (f) non-number HP and AC default lanes (same typeof-guard branch) → collapsed to
 *     one incomplete-form lane pinning both defaults + the honest THP:0 anchor.
 * (g) all combat-summary writes now pinned by object identity (was expect.any(Object));
 *     defaultMocks exposes the shared cs.
 *
 * SMELL FLAG (pinned honestly, not sanitized): revertShapechange logs "reverts to
 * their normal form" and runs revertShapechangeTempHp UNCONDITIONALLY, even when the
 * creature was never shapechanged (service.js:225/237). Pinned in the idempotent lane.
 *
 * Turn-based only: no timers in this lane's source or tests.
 */

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
  getCurrentCombatRound: vi.fn(() => 5),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(() => Promise.resolve()) },
}));

// Load-guard only: service.js:7 statically imports the handler for the dead
// applyShapechange wrapper (#1916 above). Remove alongside that export.
vi.mock('./shapechangeHandler.js', () => ({
  handle: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────

import { confirmShapechangeTransform, revertShapechange } from './shapechangeService.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeObject } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'Wizard1';
const targetName = 'Goblin';

const form = {
  name: 'Elephant',
  index: 'elephant',
  size: 'Large',
  hit_points: 59,
  armor_class: 12,
  speed: '40 ft.',
  challenge_rating: '4',
  type: 'beast',
};

// Prod-fidelity ARRAY abilities shape (see header: abilities-ARRAY inspection).
// Do not reshape to an object — the array is what makes the "no .CON?.bonus bug
// class" claim honest against real character JSON.
function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 12,
    proficiency: 5,
    abilities: [
      { name: 'Constitution', baseScore: 14, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0, bonus: 2 },
      { name: 'Wisdom', baseScore: 18, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0, bonus: 4 },
    ],
    ...overrides,
  };
}

const confirmArgs = (overrides = {}) => ({
  targetName,
  form,
  casterName,
  spell: { name: 'Shapechange' },
  playerStats: makePlayerStats(),
  campaignName,
  ...overrides,
});

let cs; // shared combat context, pinned by identity in the pins below

function defaultMocks() {
  vi.clearAllMocks();
  cs = {
    creatures: [
      { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 },
      { name: casterName, type: 'player' },
    ],
  };
  getCombatContext.mockResolvedValue(cs);
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return [];
    if (key === casterName && subKey === 'pendingExpirations') return [];
    return undefined;
  });
}

// ── confirmShapechangeTransform — first transform ────────────────

describe('shapechangeService.confirmShapechangeTransform — first transform', () => {
  beforeEach(defaultMocks);

  it('returns no_target and performs ZERO writes when the creature is missing', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: casterName, type: 'player' }] });
    expect(await confirmShapechangeTransform(confirmArgs({ targetName: 'MissingCreature' }))).toEqual({ ok: false, reason: 'no_target' });
    expect(storage.set).not.toHaveBeenCalled();
    expect(setRuntimeObject).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
  });

  it('swaps the stat block IN PLACE (merge, not replace), snapshots originals, persists by identity, returns ok', async () => {
    cs.creatures[0].conditions = ['prone'];
    expect(await confirmShapechangeTransform(confirmArgs())).toEqual({ ok: true });

    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(59);
    expect(creature.ac).toBe(12);
    expect(creature.speed).toBe('40 ft.');
    expect(creature.currentHp).toBe(5); // merge semantics: current HP carries through
    expect(creature.conditions).toEqual(['prone']);
    expect(creature.shapechangeOriginal).toEqual({ maxHp: 7, ac: 15, speed: 30 });
    expect(creature.shapechangeSource).toBe(casterName);
    expect(creature.shapechangeForm).toEqual({
      name: 'Elephant', index: 'elephant', size: 'Large', hitPoints: 59,
      armorClass: 12, speed: '40 ft.', challengeRating: '4', type: 'beast',
    });
    expect(creature.formName).toBe('Elephant');
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, campaignName);
  });

  it('incomplete form: missing hit_points defaults to 0, armor_class to 10, THP anchor rides the 0', async () => {
    const incompleteForm = { name: 'Wolf', speed: '40 ft.', challenge_rating: '1/8', type: 'beast' };
    await confirmShapechangeTransform(confirmArgs({ form: incompleteForm }));
    expect(cs.creatures[0].maxHp).toBe(0);
    expect(cs.creatures[0].ac).toBe(10);
    // Honest pin: the first-form THP anchor is the ( defaulted ) form HP, not the old HP.
    expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 0, shapechangeTempHp: 0 }, campaignName);
  });

  it('SP-103: first transform anchors the first-form THP buffer in one batched write (RAW: never re-granted)', async () => {
    await confirmShapechangeTransform(confirmArgs());
    expect(setRuntimeObject).toHaveBeenCalledWith(targetName, { tempHp: 59, shapechangeTempHp: 59 }, campaignName);
  });

  it('pushes the shapechange targetEffect (exact shape, skipSync=true)', async () => {
    await confirmShapechangeTransform(confirmArgs());
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign', 'targetEffects',
      [{ target: targetName, source: casterName, effect: 'shapechange', duration: 'concentration', formName: 'Elephant' }],
      campaignName, true,
    );
  });

  it('cleans the polymorph family for the target (polymorph + true_polymorph) and keeps unrelated effects', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [
        { target: targetName, effect: 'polymorph', source: 'OldCaster' },
        { target: targetName, effect: 'true_polymorph', source: 'OldCaster' },
        { target: 'Orc', effect: 'shapechange', source: 'Other' },
      ];
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });
    await confirmShapechangeTransform(confirmArgs());
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign', 'targetEffects',
      [
        { target: 'Orc', effect: 'shapechange', source: 'Other' },
        { target: targetName, source: casterName, effect: 'shapechange', duration: 'concentration', formName: 'Elephant' },
      ],
      campaignName, true,
    );
  });

  it('replaces the target\'s existing shapechange te (new source wins, one entry only)', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, effect: 'shapechange', source: 'OldCaster' }];
      return undefined;
    });
    await confirmShapechangeTransform(confirmArgs());
    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    expect(effectsCall[2]).toHaveLength(1);
    expect(effectsCall[2][0].source).toBe(casterName);
  });

  it('SP-103: stamps concentration on the caster with the canonical saveDc-first DC fallback (8 + proficiency)', async () => {
    await confirmShapechangeTransform(confirmArgs());
    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'Shapechange', 13);
  });

  it('SP-103: prefers playerStats.spellAbilities.saveDc (caster WIS DC, not CON math)', async () => {
    await confirmShapechangeTransform(confirmArgs({ playerStats: makePlayerStats({ spellAbilities: { saveDc: 17 } }) }));
    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'Shapechange', 17);
  });

  it('falls back to the literal "Shapechange" spell name when spell has no name', async () => {
    await confirmShapechangeTransform(confirmArgs({ spell: {} }));
    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'Shapechange', 13);
  });

  it('skips concentration entirely when the caster is not in combat', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }] });
    await confirmShapechangeTransform(confirmArgs());
    expect(addConcentration).not.toHaveBeenCalled();
  });

  it('POLICY VIOLATION #1906 family — pinned as-shipped, NOT sanitized: expiryRounds 600 (retired hours×600) is a live round countdown', async () => {
    // AGENTS.md no-timers mandate: ≥1-minute durations are combat-scoped, cleared at
    // initiative/rest seams — NEVER stored as round countdowns; concentration stays
    // concentration. service.js:135 stores 600; expirationQueue.js:47 consumes it
    // (expired when currentRound >= appliedRound + expiryRounds) and
    // clearExpirationEffects.js:451 routes shapechange expiry → revertShapechange.
    // Canonical sibling polymorphService #1937 latches Infinity instead. Fix belongs
    // to the expiration-lane owner; this pin fails loudly when prod is fixed.
    await confirmShapechangeTransform(confirmArgs());
    expect(getCurrentCombatRound).toHaveBeenCalledWith(campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [{
      target: targetName,
      effects: [{ type: 'shapechange' }],
      appliedRound: 5,
      expiryRounds: 600,
      expireOnCreatureName: null,
    }], campaignName);
  });

  it('replaces only the target\'s own shapechange expiration; other targets/types untouched at 600', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === casterName && subKey === 'pendingExpirations') return [
        { target: targetName, effects: [{ type: 'shapechange' }], expiryRounds: 10 },
        { target: 'Orc', effects: [{ type: 'polymorph' }], expiryRounds: 5 },
      ];
      return undefined;
    });
    await confirmShapechangeTransform(confirmArgs());
    const orc = { target: 'Orc', effects: [{ type: 'polymorph' }], expiryRounds: 5 };
    expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [
      orc,
      { target: targetName, effects: [{ type: 'shapechange' }], appliedRound: 5, expiryRounds: 600, expireOnCreatureName: null },
    ], campaignName);
  });

  it('logs the cast as ONE save_result with the exact full description (CR included)', async () => {
    await confirmShapechangeTransform(confirmArgs());
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'save_result',
      characterName: casterName,
      rollType: 'save-shapechange',
      targetName,
      saveDc: 0,
      saveType: 'WIS',
      success: false,
      description: 'Goblin uses Shapechange to transform into Elephant (CR 4) cast by Wizard1.',
    });
  });
});

// ── confirmShapechangeTransform — SP-103 form change ─────────────

describe('shapechangeService.confirmShapechangeTransform — SP-103 form change', () => {
  const secondForm = {
    name: 'Panther', index: 'panther', size: 'Medium', hit_points: 41,
    armor_class: 12, speed: '50 ft.', challenge_rating: '1/4', type: 'beast',
  };

  let tcs; // transformed combat context

  function transformedMocks() {
    defaultMocks();
    tcs = {
      creatures: [
        {
          name: targetName, type: 'monster', currentHp: 5, maxHp: 59, ac: 12, speed: '40 ft.',
          shapechangeOriginal: { maxHp: 7, ac: 15, speed: 30 },
          shapechangeSource: casterName,
          shapechangeForm: { name: 'Elephant' }, formName: 'Elephant',
          concentration: { spell: 'Shapechange', dc: 13 },
        },
        { name: casterName, type: 'player' },
      ],
    };
    getCombatContext.mockResolvedValue(tcs);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, source: casterName, effect: 'shapechange', formName: 'Elephant' }];
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'shapechange' }], appliedRound: 2, expiryRounds: 600 }];
      return undefined;
    });
  }

  beforeEach(transformedMocks);

  it('ANTI-CLOBBER vs polymorph #1937: swaps the stat block to the new form, originals UNTOUCHED (isFormChange guard)', async () => {
    const result = await confirmShapechangeTransform(confirmArgs({ form: secondForm, formChange: true }));
    expect(result).toEqual({ ok: true });
    const creature = tcs.creatures[0];
    expect(creature.maxHp).toBe(41);
    expect(creature.ac).toBe(12);
    expect(creature.speed).toBe('50 ft.');
    expect(creature.formName).toBe('Panther');
    // The #1937 polymorph defect overwrote the snapshot with beast-form values on
    // recast; shapechange guards on shapechangeOriginal (animalShapes isFirstTransform
    // twin). If prod regresses to clobber, this pin fails.
    expect(creature.shapechangeOriginal).toEqual({ maxHp: 7, ac: 15, speed: 30 });
  });

  it('does NOT re-grant the first-form THP anchor on a form change', async () => {
    await confirmShapechangeTransform(confirmArgs({ form: secondForm, formChange: true }));
    expect(setRuntimeObject).not.toHaveBeenCalled();
    const tHpCalls = vi.mocked(setRuntimeValue).mock.calls.filter(call => call[0] === targetName && (call[1] === 'tempHp' || call[1] === 'shapechangeTempHp'));
    expect(tHpCalls.length).toBe(0);
  });

  it('does NOT re-stamp concentration or re-anchor the expiry clock', async () => {
    await confirmShapechangeTransform(confirmArgs({ form: secondForm, formChange: true }));
    expect(addConcentration).not.toHaveBeenCalled();
    expect(vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'pendingExpirations')).toHaveLength(0);
  });

  it('logs an ability_use form change (no slot check) and ZERO save_result entries', async () => {
    await confirmShapechangeTransform(confirmArgs({ form: secondForm, formChange: true }));
    const entries = vi.mocked(addEntry).mock.calls.map(c => c[1]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      type: 'ability_use',
      characterName: targetName,
      abilityName: 'Shapechange',
      description: 'Goblin shape-shifts into Panther (CR 1/4) using Shapechange. No spell slot expended.',
    });
  });

  it('updates the shapechange targetEffect formName (replace, not stack)', async () => {
    await confirmShapechangeTransform(confirmArgs({ form: secondForm, formChange: true }));
    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    expect(effectsCall[2]).toEqual([{ target: targetName, source: casterName, effect: 'shapechange', duration: 'concentration', formName: 'Panther' }]);
  });

  it('refuses an unpaid form-change confirm when never transformed (not_shapechanged, zero writes)', async () => {
    defaultMocks();
    expect(await confirmShapechangeTransform(confirmArgs({ formChange: true }))).toEqual({ ok: false, reason: 'not_shapechanged' });
    expect(setRuntimeObject).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('a flagless recast on an already-transformed creature FOLDS INTO the form-change path (guard, not flag)', async () => {
    // isFormChange derives from state (shapechangeOriginal presence), not the formChange
    // flag: a second unpaid confirm can never re-grant THP or re-anchor expiry. Pin the
    // full fold: swap yes, writes-to-THP/concentration/expiry no, ability_use log.
    const result = await confirmShapechangeTransform(confirmArgs({ form: secondForm }));
    expect(result).toEqual({ ok: true });
    expect(tcs.creatures[0].maxHp).toBe(41);
    expect(tcs.creatures[0].shapechangeOriginal).toEqual({ maxHp: 7, ac: 15, speed: 30 });
    expect(setRuntimeObject).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'pendingExpirations')).toHaveLength(0);
    expect(vi.mocked(addEntry).mock.calls.map(c => c[1].type)).toEqual(['ability_use']);
  });
});

// ── revertShapechange (+ private revertShapechangeTempHp) ─────────

describe('shapechangeService.revertShapechange', () => {
  let rcs; // revert combat summary

  beforeEach(() => {
    vi.clearAllMocks();
    rcs = {
      creatures: [{
        name: targetName, type: 'monster', currentHp: 5, maxHp: 59, ac: 12, speed: '40 ft.',
        shapechangeSource: casterName, shapechangeOriginal: { maxHp: 7, ac: 15, speed: 30 },
        shapechangeForm: { name: 'Elephant' }, formName: 'Elephant',
      }],
    };
    getCombatSummary.mockReturnValue(rcs);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, source: casterName, effect: 'shapechange', formName: 'Elephant' }];
      if (key === targetName && subKey === 'shapechangeTempHp') return 59;
      if (key === targetName && subKey === 'tempHp') return 59;
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'shapechange' }], expiryRounds: Infinity }];
      return undefined;
    });
  });

  it('full revert: restores originals, clears every shapechange field, persists by identity, logs exactly once', () => {
    expect(revertShapechange(targetName, campaignName)).toBe(true);
    const creature = rcs.creatures[0];
    expect(creature.maxHp).toBe(7);
    expect(creature.ac).toBe(15);
    expect(creature.speed).toBe(30);
    expect(creature.shapechangeSource).toBeUndefined();
    expect(creature.shapechangeOriginal).toBeUndefined();
    expect(creature.shapechangeForm).toBeUndefined();
    expect(creature.formName).toBeUndefined();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', rcs, campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(rcs, campaignName);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: targetName,
      abilityName: 'Shapechange',
      description: 'Goblin reverts to their normal form.',
    });
  });

  it('removes the shapechange targetEffect (exact kept set, skipSync=true)', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [
        { target: targetName, source: casterName, effect: 'shapechange' },
        { target: 'Orc', source: casterName, effect: 'hex' },
      ];
      if (key === targetName && subKey === 'shapechangeTempHp') return 59;
      if (key === targetName && subKey === 'tempHp') return 59;
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{ target: 'Orc', source: casterName, effect: 'hex' }], campaignName, true);
  });

  it('handles array-target te filtering and removes it in full (kept [])', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: [targetName, 'ally'], source: casterName, effect: 'shapechange' }];
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], campaignName, true);
  });

  it('SP-103: clears the Shapechange concentration stamp it ends', () => {
    rcs.creatures[0].concentration = { spell: 'Shapechange', dc: 17 };
    revertShapechange(targetName, campaignName);
    expect(rcs.creatures[0].concentration).toBeUndefined();
  });

  it('SP-103: leaves another spell\'s concentration untouched', () => {
    rcs.creatures[0].concentration = { spell: 'Bless', dc: 13 };
    revertShapechange(targetName, campaignName);
    expect(rcs.creatures[0].concentration).toEqual({ spell: 'Bless', dc: 13 });
  });

  it('revertShapechangeTempHp: subtracts the shapechange buffer from stored tempHp and zeroes the buffer', () => {
    // beforeEach: tempHp 59, buffer 59 → leftover 0 (exact pair).
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 0, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'shapechangeTempHp', 0, campaignName);
  });

  it('revertShapechangeTempHp: clamps leftover at 0 when the buffer exceeds stored tempHp', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'shapechangeTempHp') return 70;
      if (key === targetName && subKey === 'tempHp') return 59;
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 0, campaignName);
  });

  it('revertShapechangeTempHp: buffer of 0 falls back to the player\'s current HP', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'shapechangeTempHp') return 0;
      if (key === targetName && subKey === 'tempHp') return 10;
      if (key === targetName && subKey === 'currentHitPoints') return 3;
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 3, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'shapechangeTempHp', 0, campaignName);
  });

  it('revertShapechangeTempHp: negative buffer treated as non-positive → same current-HP fallback', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'shapechangeTempHp') return -5;
      if (key === targetName && subKey === 'tempHp') return 10;
      if (key === targetName && subKey === 'currentHitPoints') return 3;
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 3, campaignName);
  });

  it('revertShapechangeTempHp: skips the tempHp write when currentHitPoints is not a number', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'shapechangeTempHp') return 0;
      if (key === targetName && subKey === 'tempHp') return 10;
      if (key === targetName && subKey === 'currentHitPoints') return 'not a number';
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    expect(vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'tempHp' && call[0] === targetName)).toHaveLength(0);
  });

  it('removes the shapechange expiration from the caster (exact [])', () => {
    revertShapechange(targetName, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [], campaignName);
  });

  it('recovers the caster from targetEffects when the creature has no shapechangeSource (returns false honestly)', () => {
    // Previously vacuous: the mock kept shapechangeSource intact, so the ordinary
    // changed=true path ran and the recovery branch was never exercised. Now the
    // creature is source-less: revert reports FALSE (nothing on the creature changed)
    // but still removes the te and clears the recovered caster's expiration.
    getCombatSummary.mockReturnValue({ creatures: [{ name: targetName, currentHp: 5, maxHp: 59, ac: 12, speed: '40 ft.' }] });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, source: casterName, effect: 'shapechange' }];
      if (key === casterName && subKey === 'pendingExpirations') return [{ target: targetName, effects: [{ type: 'shapechange' }], expiryRounds: Infinity }];
      return undefined;
    });
    expect(revertShapechange(targetName, campaignName)).toBe(false);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], campaignName, true);
    expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [], campaignName);
    expect(storage.set).not.toHaveBeenCalled(); // changed=false → no cs persist
  });

  it('is idempotent: a never-transformed creature returns false with ZERO runtime/storage writes — but still logs (SMELL FLAG)', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }] });
    getRuntimeValue.mockImplementation(() => undefined);
    expect(revertShapechange(targetName, campaignName)).toBe(false);
    expect(storage.set).not.toHaveBeenCalled();
    expect(setCombatSummaryCache).not.toHaveBeenCalled();
    expect(setRuntimeObject).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    // service.js:237 logs unconditionally — pinned as-shipped, flag for owner.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({ description: 'Goblin reverts to their normal form.' }));
  });

  it('empty shapechangeOriginal wipes maxHp/ac (honest: no restore fallback), speed guard holds', () => {
    rcs.creatures[0].shapechangeOriginal = {};
    expect(revertShapechange(targetName, campaignName)).toBe(true);
    expect(rcs.creatures[0].maxHp).toBeUndefined();
    expect(rcs.creatures[0].ac).toBeUndefined();
    expect(rcs.creatures[0].speed).toBe('40 ft.'); // original.speed undefined → current kept
    expect(rcs.creatures[0].shapechangeSource).toBeUndefined();
  });

  it('does not touch pendingExpirations when the caster holds no matching entry', () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });
    revertShapechange(targetName, campaignName);
    expect(vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'pendingExpirations')).toHaveLength(0);
  });
});
