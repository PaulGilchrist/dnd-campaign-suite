// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * shapechangeHandler.test.js — lane map (trimmed; sibling shapechangeService.test.js #1954)
 *
 * HANDLER = pure gate / payload-builder (polymorph-pair precedent confirmed at source):
 * reads getCombatContext + runtime targetEffects/currentHitPoints + monsterUtils,
 * RETURNS popup payloads, performs ZERO writes (no-write guard pinned below).
 * Application lives in shapechangeService (#1954): confirmShapechangeTransform
 * (cs stat swap, first-form THP anchor, concentration stamp, expiryRounds:600,
 * targetEffects push), revertShapechange, revertShapechangeTempHp. SHED for #1954:
 * every cs-write, THP, concentration, pendingExpirations, revert, applyShapechange,
 * getActiveShapechanges/getShapechangeCaster lane.
 *
 * DELEGATION direction is the INVERSE of the polymorph pair: shapechangeService
 * imports handle (applyShapechange wrapper) — but applyShapechange has ZERO
 * production callers (dead-API tally #1916, flag for #1954). The handler's live
 * lanes are DIRECT calls:
 *  1. spellCastService/execution/modalSpells.js handleShapechange ← executeSpellCast
 *     (both rulesets: shapechange lv9 concentration present in spells.json AND
 *     2024/spells.json; spell data carries NO automation field — modalSpells matches
 *     by name and synthesizes automation:{type:'shapechange'}, so live cast popups
 *     have NO spellSlotLevel — level rides on payload.spell).
 *  2. CharSpecialActions.jsx handleShapeShiftClick — the runtime-derived unpaid
 *     "Shape-Shift:" row (automation.type 'shapechange_form_change' ∈
 *     automationService INTERACTIVE_AUTOMATIONS unpaid set) with
 *     metaCtx._shapechangeFormChange:true and spellSlotLevel:null.
 *  3. useSpellMetamagicGates tryUnpaidShapechangeRecast stamps
 *     _shapechangeFormChange on spell+metaCtx → folds back into lane 1.
 * Registered≠dispatched (#1949 lesson): HANDLER_MAP['shapechange'] (index.js) is
 * never dispatched live — no features/spells data declares automation.type
 * 'shapechange'; modalSpells invokes handle directly.
 *
 * resolveShapechangeMaxCR is exported but has NO external production caller
 * (dead-API #1916) — kept as the CR-gate rules table (RAW: creature form CR ≤
 * target's level if PC, else CR; default 1). Fractional CR pins stay (real
 * monsters), vacuous duplicates shed.
 *
 * FIXED vacuous lanes at this pass: target is ALWAYS the caster
 * (targetName = casterName), yet three legacy HP tests parked 0/negative/
 * hit_points-shape HP on a decoy 'Goblin' creature — all three passed vacuously
 * through the `?? 0` default. HP now pinned on the caster creature, with the
 * `?? 0` default surfaced as its own explicit lane. Negative-HP dropped (same
 * `<= 0` guard as zero).
 */

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: { getName: (fullName) => fullName || 'Unknown' },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, resolveShapechangeMaxCR } from './shapechangeHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    ...overrides,
  };
}

// Cast-lane action (modalSpells builds name/spell/metaCtx; spellSlotLevel:9
// mirrors the paid lane — the unpaid form-change row sends null). MERGES overrides.
function makeAction(metaCtx = {}, overrides = {}) {
  return {
    name: 'Shapechange',
    spell: { name: 'Shapechange', level: 9 },
    spellSlotLevel: 9,
    metaCtx,
    ...overrides,
  };
}

function abilityLogCalls() {
  return vi.mocked(addEntry).mock.calls.filter((call) => call[1]?.type === 'ability_use');
}

// Target is always the caster (targetName = casterName): HP-shape variants attach
// to the caster creature, never to a decoy.
function casterCreature(hp = { currentHp: 10 }) {
  return { name: casterName, type: 'player', ...hp };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
    casterCreature(),
  ],
};

function setupBaseMocks({ existingEffects = [], cs = baseCombatContext } = {}) {
  getCombatContext.mockResolvedValue(cs);
  getMonsterData.mockResolvedValue(null);
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return existingEffects;
    return undefined;
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('shapechangeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBaseMocks();
  });

  describe('combat context gate', () => {
    it('null combat context → no-creatures popup, nothing logged', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Shapechange',
        description: 'No creatures in combat. Shapechange has no effect.',
      });
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('missing or empty creatures list → same refusal', async () => {
      getCombatContext.mockResolvedValue({});
      expect((await handle(makeAction(), makePlayerStats(), campaignName, null)).payload
        .description).toBe('No creatures in combat. Shapechange has no effect.');

      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.type).toBe('automation_info');
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('target validation', () => {
    it('caster not found in combat → not-found popup, nothing logged', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'OtherCreature', type: 'monster', currentHp: 5 }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Shapechange',
        description: `${casterName} not found in combat. Shapechange has no effect.`,
      });
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('SP-103 form-change routing', () => {
    it('active shapechange effect reopens the chooser UNPAID (formChange:true), logs nothing', async () => {
      setupBaseMocks({
        existingEffects: [{ target: casterName, effect: 'shapechange', source: casterName }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.formChange).toBe(true);
      // confirmShapechangeTransform logs the shift — the opener stays silent.
      expect(abilityLogCalls().length).toBe(0);
    });

    it('shapechangeOriginal on the creature (no targetEffect) still routes form change', async () => {
      setupBaseMocks({
        cs: {
          creatures: [
            { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
            casterCreature({ currentHp: 10, shapechangeOriginal: { maxHp: 10, ac: 12, speed: 30 } }),
          ],
        },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.formChange).toBe(true);
    });

    it('stale form-change request without transform state refuses unpaid and logs', async () => {
      const result = await handle(
        makeAction({ _shapechangeFormChange: true }),
        makePlayerStats(),
        campaignName,
        null
      );

      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Shapechange',
        description: `${casterName} is not transformed. Shapechange the caster first.`,
      });
      const logs = abilityLogCalls();
      expect(logs.length).toBe(1);
      expect(logs[0][1].description).toContain('not transformed');
    });

    it('fresh cast (no transform state) opens chooser without formChange', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.formChange).toBeUndefined();
    });

    it('polymorph-family effects refuse (the other spell keeps control) and log once', async () => {
      setupBaseMocks({
        existingEffects: [
          { target: casterName, effect: 'polymorph', source: 'OldCaster' },
          { target: casterName, effect: 'true_polymorph', source: 'OldCaster' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Shapechange',
        description: `${casterName} is already transformed.`,
      });
      const logs = abilityLogCalls();
      expect(logs.length).toBe(1);
      expect(logs[0][1].characterName).toBe(casterName);
      expect(logs[0][1].abilityName).toBe('Shapechange');
      expect(logs[0][1].description).toBe(
        `${casterName} casts Shapechange, but ${casterName} is already transformed.`
      );
    });

    it('array target on self-effect still matches (formChange)', async () => {
      setupBaseMocks({
        existingEffects: [{ target: [casterName, 'extra'], effect: 'shapechange', source: 'OldCaster' }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.formChange).toBe(true);
    });

    it('shapechange effect on a DIFFERENT creature neither blocks nor formChange-flips', async () => {
      setupBaseMocks({
        existingEffects: [{ target: 'Goblin', effect: 'shapechange', source: 'OldCaster' }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.formChange).toBeUndefined();
    });
  });

  describe('HP gate (target is always the caster)', () => {
    it('currentHp 0 → refusal + ability_use log', async () => {
      setupBaseMocks({ cs: { creatures: [casterCreature({ currentHp: 0 })] } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Shapechange',
        description: 'Shapechange has no effect on a creature with 0 hit points.',
      });
      const logs = abilityLogCalls();
      expect(logs.length).toBe(1);
      expect(logs[0][1].description).toBe(
        `${casterName} casts Shapechange, but a creature with 0 hit points can't use Shapechange.`
      );
    });

    it('hit_points.current = 0 → same refusal (legacy HP shape)', async () => {
      setupBaseMocks({
        cs: { creatures: [casterCreature({ hit_points: { current: 0, max: 7 } })] },
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 hit points');
    });

    it('player HP reads currentHitPoints from the runtime store (server-first)', async () => {
      setupBaseMocks();
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === casterName && subKey === 'currentHitPoints') return 0;
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 hit points');
    });

    it('non-number runtime HP falls back to creature.currentHp → chooser opens', async () => {
      setupBaseMocks({ cs: { creatures: [casterCreature({ currentHp: 5 })] } });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === casterName && subKey === 'currentHitPoints') return 'invalid';
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
    });

    it('creature with no HP fields at all defaults to 0 → refusal (?? 0 floor)', async () => {
      setupBaseMocks({ cs: { creatures: [{ name: casterName, type: 'player' }] } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 hit points');
    });
  });

  describe('shapechange_select payload (own composition)', () => {
    it('chooser payload carries caster/self targeting, spell, slot level, default maxCR — zero writes', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload).toEqual({
        type: 'shapechange_select',
        targetName: casterName,
        maxCR: 1,
        casterName,
        campaignName,
        spell: { name: 'Shapechange', level: 9 },
        spellLevel: 9,
      });
      // Pure gate: the handler must never write runtime state.
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('characters from action.metaCtx drive maxCR via PC level', async () => {
      const characters = [{ name: casterName, computedStats: { level: 12 } }];

      const result = await handle(makeAction({ characters }), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('shapechange_select');
      expect(result.payload.maxCR).toBe(12);
    });
  });
});

describe('shapechangeHandler.resolveShapechangeMaxCR (CR-gate rules table)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMonsterData.mockResolvedValue(null);
  });

  it('PC match: computedStats.level preferred over raw level, both fallbacks', async () => {
    expect(await resolveShapechangeMaxCR(casterName, campaignName, [
      { name: casterName, level: 3, computedStats: { level: 8 } },
    ])).toBe(8);
    expect(await resolveShapechangeMaxCR(casterName, campaignName, [
      { name: casterName, level: 5 },
    ])).toBe(5);
  });

  it('PC with missing/zero/non-number level never yields a level-derived CR', async () => {
    // non-number falls through to the monster lane…
    getMonsterData.mockResolvedValue({ challenge_rating: 2 });
    expect(await resolveShapechangeMaxCR(casterName, campaignName, [
      { name: casterName, computedStats: { level: 'unknown' } },
    ])).toBe(2);
    // …and with no monster data the floor is DEFAULT_MAX_CR (level 0 and absent).
    getMonsterData.mockResolvedValue(null);
    expect(await resolveShapechangeMaxCR(casterName, campaignName, [
      { name: casterName, computedStats: { level: 0 } },
    ])).toBe(1);
    expect(await resolveShapechangeMaxCR(casterName, campaignName, [
      { name: casterName },
    ])).toBe(1);
  });

  it('monster challenge_rating: integer and fractional parse', async () => {
    getMonsterData.mockResolvedValue({ challenge_rating: 3 });
    expect(await resolveShapechangeMaxCR('Goblin', campaignName, [])).toBe(3);
    getMonsterData.mockResolvedValue({ challenge_rating: '1/2' });
    expect(await resolveShapechangeMaxCR('Goblin', campaignName, [])).toBe(0.5);
  });

  it('unparseable CR string yields 0', async () => {
    getMonsterData.mockResolvedValue({ challenge_rating: 'invalid' });
    expect(await resolveShapechangeMaxCR('Goblin', campaignName, [])).toBe(0);
  });

  it('missing monster/CR data defaults to 1; missing characters argument is tolerated', async () => {
    getMonsterData.mockResolvedValue(null);
    expect(await resolveShapechangeMaxCR('Goblin', campaignName, null)).toBe(1);
    expect(await resolveShapechangeMaxCR('Goblin', campaignName, undefined)).toBe(1);

    getMonsterData.mockResolvedValue({ name: 'Goblin', challenge_rating: null });
    expect(await resolveShapechangeMaxCR('Goblin', campaignName, [])).toBe(1);
    getMonsterData.mockResolvedValue({ name: 'Goblin', challenge_rating: '' });
    expect(await resolveShapechangeMaxCR('Goblin', campaignName, [])).toBe(1);
  });
});
