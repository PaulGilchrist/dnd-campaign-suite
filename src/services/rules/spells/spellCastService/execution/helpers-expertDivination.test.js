// @maintained-by-ai
// CLA-128 consumer lane: REAL triggerExpertDivination internals (helpers.js:336-379),
// BEHIND the index.js:546 dispatch seam (dispatch arg-tuple face owned by
// execution-post-cast; refundSpellBreakerSlot :102-107 owned by helpers-spellBreaker).
// Boundary (verified): every execution/ consumer lane MOCKS triggerExpertDivination
// (index.generic*, earlyReturns*, execution-post-cast*, compelledDuelExpiry, spellStats);
// spellCastService.featureTriggers.test.js:436-481 asserts only that Arcane Ward does NOT
// fire — it never asserts this helper's payload. THIS file is the sole runner of the real
// gate chain: usesSpellSlot :337 → school :341-342 → slot read/fallback :346-347 →
// passives-guard throw :352-355 → AND-gate :357-359 → action build :362-370 →
// executeHandler :373 (4-arg) → catch :375-377.
// spellUtils is NOT mocked — the real usesSpellSlot runs (pure, #1478 unmocked precedent).
// Fixtures: REAL disk rows both rulesets (spells.json + 2024/spells.json) + collector-
// normalized passive row verbatim from automationCollector.expertDivination.test.js
// EXPECTED_ROW (2024/classes.json Diviner lv6 disk automation {type:'expert_divination',
// casting_time:'passive'} → envelope via collector).
// Quirk census:
//  - DEAD ARM (:347 `!spellSlotLevel` term): unreachable once real usesSpellSlot passes
//    (:337 proves slotLevel>0 OR spell.level>0; the :346 `||` fallback then yields a
//    truthy value) — only the `< 2` half is live (slotLevel/baseLevel 1). Not forced.
//  - :355 console.error + :355 throw is a GUARDED throw (logs first), not golden deref.
//  - No clock: instantaneous passive; daily/reset owned by rest-seam lanes, absent here.
//  - :374 returns whatever the handler resolves (undefined passes through silently —
//    handler return contract owned by expertDivinationHandler lane).
// Kill-matrix declare: 2-fires-vs-1-rejects pins `< 2` strictness (:347); slotLevel
// PRECEDENCE over spell.level (:346 4‖2 must yield 4); fallback arms slotLevel 0 and
// metaCtx undefined must fall to spell.level; school gate is case-INSENSITIVE (:341
// toLowerCase) and school-mismatch rejects; :357 AND-gate killed from both sides
// (right name/wrong type AND wrong name/right type); exact action key-set
// [name, automation, spell, spellSlotLevel]; 4-arg arity vs REAL; return identity
// pass-through (toBe, not toEqual).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  Mocks — every module-level import of helpers.js (:1-13) except   */
/*  spellUtils (:5), which runs REAL. No extra keys.                 */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 8, rolls: [8] })),
  applyHealingRerollOnes: vi.fn(() => ({ displayRolls: [5], originalRolls: [5] })),
}));

// Only the three exports helpers.js actually imports (:12).
vi.mock('../../../../combat/automation/automationService.js', () => ({
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  SUT imports after mocks                                            */
/* ------------------------------------------------------------------ */

import { triggerExpertDivination } from './helpers.js';
import { executeHandler } from '../../../../automation/index.js';

/* ------------------------------------------------------------------ */
/*  Fixtures — REAL disk bytes + collector-exact passive             */
/* ------------------------------------------------------------------ */

function diskRow(spells, name, level) {
  const row = spells.find(s => s.name === name);
  if (!row) throw new Error(`disk row missing: ${name}`);
  if (row.level !== level) {
    throw new Error(`disk row drifted: ${name} level ${row.level} !== ${level}`);
  }
  return row;
}

const detectThoughts = diskRow(spells5e, 'Detect Thoughts', 2);   // Divination lv2
const clairvoyance = diskRow(spells5e, 'Clairvoyance', 3);         // Divination lv3
const detectMagic = diskRow(spells5e, 'Detect Magic', 1);           // Divination lv1
const guidance = diskRow(spells5e, 'Guidance', 0);                  // Divination cantrip
const fireball = diskRow(spells5e, 'Fireball', 3);                  // Evocation (school reject)
const detectThoughts2024 = diskRow(spells2024, 'Detect Thoughts', 2); // same row, 2024 disk

// Verbatim collector-normalized passive (CLA-128 supply lane EXPECTED_ROW) — the
// exact shape the :357 gate consumes at runtime.
const EXPERT_DIVINATION = {
  type: 'expert_divination',
  name: 'Expert Divination',
  effect: 'expert_divination',
  casting_time: 'passive',
  hasAutomation: true,
};

function wizardWith(passives) {
  return {
    name: 'TestWizard',
    automation: { passives },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('triggerExpertDivination — real helpers.js:336-379 internals', () => {
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('fires on slotLevel 2+ with the exact action payload, 4-arg tuple, identity return, and slotLevel precedence over spell.level', async () => {
    // rows: [label, spell, metaCtx, expected spellSlotLevel]
    //  2 = `< 2` boundary fires (vs level-1 reject below); 4 = :346 precedence
    //  (4 || 2 → 4, NOT spell.level); lowercase school hits :341 toLowerCase arm;
    //  2024 disk row parity.
    const rows = [
      ['boundary 2', detectThoughts, { slotLevel: 2 }, 2],
      ['precedence upcast', detectThoughts, { slotLevel: 4 }, 4],
      ['lowercase school gate', { ...clairvoyance, school: 'divination' }, { slotLevel: 3 }, 3],
      ['2024 disk row', detectThoughts2024, { slotLevel: 2 }, 2],
    ];

    for (const [label, spell, metaCtx, expectedLevel] of rows) {
      vi.clearAllMocks();
      const playerStats = wizardWith([EXPERT_DIVINATION]);
      const sentinel = { token: label };
      executeHandler.mockResolvedValue(sentinel);

      const result = await triggerExpertDivination(spell, metaCtx, playerStats, 'test-campaign', 'test-map');

      expect(executeHandler, label).toHaveBeenCalledTimes(1);
      const call = executeHandler.mock.calls[0];
      expect(call.length, label).toBe(4); // arity vs REAL (spell, metaCtx, stats, campaign, map) → handler gets 4
      const [action, statsArg, campaignArg, mapArg] = call;
      expect(Object.keys(action), label).toStrictEqual(['name', 'automation', 'spell', 'spellSlotLevel']);
      expect(action.name, label).toBe('Expert Divination');
      expect(action.automation, label).toStrictEqual({ type: 'expert_divination', casting_time: 'passive' });
      expect(action.spell, label).toBe(spell); // disk-row identity, untouched
      expect(action.spellSlotLevel, label).toBe(expectedLevel);
      expect(statsArg, label).toBe(playerStats);
      expect(campaignArg, label).toBe('test-campaign');
      expect(mapArg, label).toBe('test-map');
      expect(result, label).toBe(sentinel); // identity pass-through (:374), not a copy
    }

    // purity: each fire builds a FRESH action object
    vi.clearAllMocks();
    const playerStats = wizardWith([EXPERT_DIVINATION]);
    executeHandler.mockResolvedValue({ token: 'x' });
    await triggerExpertDivination(detectThoughts, { slotLevel: 2 }, playerStats, 'test-campaign', 'test-map');
    await triggerExpertDivination(detectThoughts, { slotLevel: 2 }, playerStats, 'test-campaign', 'test-map');
    expect(executeHandler).toHaveBeenCalledTimes(2);
    expect(executeHandler.mock.calls[0][0]).not.toBe(executeHandler.mock.calls[1][0]);
    expect(executeHandler.mock.calls[1][0].spell).toBe(detectThoughts);
  });

  it('falls back to spell.level when metaCtx.slotLevel is 0 or metaCtx is absent (:346 ||-arm)', async () => {
    const playerStats = wizardWith([EXPERT_DIVINATION]);

    // slotLevel 0 (free-cast shape): usesSpellSlot survives on spell.level > 0,
    // then :346 `0 || spell.level` picks up level 2 → fires at 2.
    const sentinel = { token: 'fallback-0' };
    executeHandler.mockResolvedValue(sentinel);
    const result0 = await triggerExpertDivination(detectThoughts, { slotLevel: 0 }, playerStats, 'test-campaign', 'test-map');
    expect(result0).toBe(sentinel);
    expect(executeHandler).toHaveBeenCalledTimes(1);
    expect(executeHandler.mock.calls[0][0]).toStrictEqual({
      name: 'Expert Divination',
      automation: { type: 'expert_divination', casting_time: 'passive' },
      spell: detectThoughts,
      spellSlotLevel: 2,
    });

    // metaCtx undefined entirely — same :346 optional-chain fallback.
    vi.clearAllMocks();
    const sentinelU = { token: 'fallback-undefined' };
    executeHandler.mockResolvedValue(sentinelU);
    const resultU = await triggerExpertDivination(clairvoyance, undefined, playerStats, 'test-campaign', 'test-map');
    expect(resultU).toBe(sentinelU);
    expect(executeHandler.mock.calls[0][0].spellSlotLevel).toBe(3);
  });

  it('returns null without touching the handler: cantrip (:337), level-1 boundary and innate fallback (:347), wrong school (:342), missing or mismatched passive (:358-359)', async () => {
    const playerStats = wizardWith([EXPERT_DIVINATION]);

    const rejections = [
      // cantrip cast with no slot: real usesSpellSlot(0,0) = false → :337
      ['cantrip', guidance, { slotLevel: 0 }, playerStats],
      // lv1 divination: passes usesSpellSlot (level 1 > 0), killed by `< 2` at :347
      ['level-1 boundary', detectMagic, { slotLevel: 1 }, playerStats],
      // innate lv1 with slotLevel 0: :346 fallback yields 1, still < 2
      ['innate lv1 fallback', detectMagic, { slotLevel: 0 }, playerStats],
      // wrong school: Evocation lv3 slot — school gate :342 before any slot math
      ['wrong school', fireball, { slotLevel: 3 }, playerStats],
      // AND-gate both sides of :357: right name/wrong type, wrong name/right type
      ['name-type mismatch', detectThoughts, { slotLevel: 2 }, wizardWith([{ ...EXPERT_DIVINATION, type: 'portent' }])],
      ['type-name mismatch', detectThoughts, { slotLevel: 2 }, wizardWith([{ ...EXPERT_DIVINATION, name: 'Portent' }])],
      // no passives at all (empty array is NOT the throw arm — passives==null is)
      ['empty passives', detectThoughts, { slotLevel: 2 }, wizardWith([])],
    ];

    for (const [label, spell, metaCtx, stats] of rejections) {
      const result = await triggerExpertDivination(spell, metaCtx, stats, 'test-campaign', 'test-map');
      expect(result, label).toBeNull();
    }
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('throws with logged line when automation/passives are missing (guarded :352-355), for passives:null AND absent automation', async () => {
    const passivesNull = wizardWith(null);
    const automationAbsent = { name: 'TestWizard' };

    await expect(
      triggerExpertDivination(detectThoughts, { slotLevel: 2 }, passivesNull, 'test-campaign', 'test-map'),
    ).rejects.toThrow('playerStats.automation.passives is required for expert divination');
    await expect(
      triggerExpertDivination(detectThoughts, { slotLevel: 2 }, automationAbsent, 'test-campaign', 'test-map'),
    ).rejects.toThrow('playerStats.automation.passives is required for expert divination');

    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith('[spellCast] triggerExpertDivination: playerStats.automation.passives is missing');
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('swallows handler rejection: logs exact prefix with the error, returns null (:375-377)', async () => {
    const playerStats = wizardWith([EXPERT_DIVINATION]);
    const err = new Error('handler error');
    executeHandler.mockRejectedValue(err);

    const result = await triggerExpertDivination(detectThoughts, { slotLevel: 2 }, playerStats, 'test-campaign', 'test-map');

    expect(result).toBeNull();
    expect(executeHandler).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('[spellCast] Expert Divination trigger failed:', err);
  });
});
