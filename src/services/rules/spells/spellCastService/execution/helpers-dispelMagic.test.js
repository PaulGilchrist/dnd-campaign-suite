// @maintained-by-ai
// CLA-322: Spell Breaker — Dispel Magic internals BEHIND the dispatch seam.
// Boundary (verified): every execution/ consumer lane MOCKS triggerDispelMagic —
// including execution-post-cast #1477, which owns the index.js:357 dispatch face
// (arg tuple + case-gate there). THIS file is the sole runner of the REAL
// helpers.js chain: triggerDispelMagic :170-188 → resolveDispelCheckBonus :109,
// logDispelCheck :128, refundDispelSpellBreakerSlot :153 → refundSpellBreakerSlot :102.
// Fixtures: REAL disk rows both rulesets (public/data/{,2024/}spells.json — both
// Dispel Magic level 3; disk-row census owned by #1365, not repeated here).
// Spell Breaker passive = collector-normalized disk row: automationCollector.js:52-62
// maps 2024/classes.json lv10 wizard `type:'passive_rule', effect:'spell_breaker'`
// into the runtime `type:'spell_breaker'` shape the helper finds (:119).
// spellUtils is NOT mocked — the real usesSpellSlot runs (pure, side-effect-free).
// No clock: disk dispel is Instantaneous; addExpiration never fires in this chain.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  Mocks — every module-level import of helpers.js (:1-13), exact   */
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

// Only the three exports helpers.js actually imports (:12) — the old mock's
// markFortifiedHealthUsedIfGranted key is dead surface, removed.
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

import { triggerDispelMagic } from './helpers.js';
import { rollExpression } from '../../../../dice/diceRoller.js';
import { addEntry } from '../../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';

/* ------------------------------------------------------------------ */
/*  Test-data factories (REAL disk bytes)                            */
/* ------------------------------------------------------------------ */

function diskRow(spells, name) {
  const row = spells.find(s => s.name === name);
  if (!row) throw new Error(`disk row missing: ${name}`);
  return row;
}

const dispel5e = diskRow(spells5e, 'Dispel Magic'); // disk: level 3, Abjuration
const dispel2024 = diskRow(spells2024, 'Dispel Magic'); // disk: level 3 too → DC identical
if (dispel5e.level !== 3 || dispel2024.level !== 3) {
  throw new Error('disk dispel level drifted — this suite pins DC 10+3');
}

// Collector-normalized runtime passive (automationCollector.js:52-62 applied to
// 2024/classes.json Spell Breaker lv10; disk has no `spellLevel` → collector defaults 1).
const SPELL_BREAKER = {
  type: 'spell_breaker',
  name: 'Spell Breaker',
  spellLevel: 1,
  alwaysPreparedSpells: ['Counterspell', 'Dispel Magic'],
  bonusActionSpells: ['Dispel Magic'],
  dispelAbilityCheckBonus: 'proficiency_bonus',
  slotRetentionSpells: ['Counterspell', 'Dispel Magic'],
};

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  };
}

const BREAKER = makePlayerStats({ automation: { passives: [SPELL_BREAKER] } });

function collectEvents() {
  const events = [];
  const handler = (e) => events.push(e.detail);
  window.addEventListener('spell-result', handler);
  return { events, dispose: () => window.removeEventListener('spell-result', handler) };
}

function checkLogDescription({ targetName, d20, bonus, total, dc, failed }) {
  return `Dispel Magic ability check on ${targetName}: d20 (${d20}) + ${bonus} = ${total} vs DC ${dc} — ${failed ? 'failed, spell not stopped' : 'succeeded'}.`;
}

// Assert ONE exact spell-result payload + ONE exact check-log addEntry tuple.
function expectCheckOutcome(events, { casterName, targetName, d20, bonus, total, dc, failed }) {
  expect(events).toHaveLength(1);
  expect(events[0]).toEqual({
    spellName: 'Dispel Magic',
    casterName,
    targetName,
    checkBonus: bonus,
    targetDC: dc,
    d20,
    total,
    checkFailed: failed,
    isDispelMagic: true,
  });
  const checkLogs = addEntry.mock.calls.filter(c => c[1].abilityName === 'Dispel Magic');
  expect(checkLogs).toHaveLength(1);
  const [campaign, entry] = checkLogs[0];
  expect(campaign).toBe('test-campaign');
  const { timestamp, ...rest } = entry;
  expect(typeof timestamp).toBe('number');
  expect(rest).toEqual({
    type: 'ability_use',
    characterName: casterName,
    abilityName: 'Dispel Magic',
    description: checkLogDescription({ targetName, d20, bonus, total, dc, failed }),
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                            */
/* ------------------------------------------------------------------ */

describe('helpers.js — triggerDispelMagic (CLA-322)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(2);
    setRuntimeValue.mockResolvedValue(undefined);
    rollExpression.mockReturnValue({ total: 5, rolls: [5] });
  });

  it('bonus resolution + DC math table: PB vs RAW vs spellCastingAbility vs PB-double-count guard vs upcast DC — success rows dispatch the exact payload and log, refund never fires', async () => {
    const rows = [
      {
        label: 'Spell Breaker +9, d20 tie at DC (strict < boundary → succeeds)',
        metaCtx: { targetName: 'Goblin', slotLevel: 3 },
        spell: dispel5e,
        playerStats: BREAKER,
        roll: { total: 4, rolls: [4] }, // 4 + 9 = 13 vs DC 13
        expect: { casterName: 'TestWizard', targetName: 'Goblin', d20: 4, bonus: 9, total: 13, dc: 13, failed: false },
      },
      {
        label: 'RAW mod-only without Spell Breaker (INT 5, no PB)',
        metaCtx: { targetName: 'Goblin', slotLevel: 2 },
        spell: dispel5e,
        playerStats: makePlayerStats(),
        roll: { total: 7, rolls: [7] }, // 7 + 5 = 12 vs DC 12 tie
        expect: { casterName: 'TestWizard', targetName: 'Goblin', d20: 7, bonus: 5, total: 12, dc: 12, failed: false },
      },
      {
        label: 'spell.spellCastingAbility overrides spellAbilities fallback (feat-buff shape, featBuffService.js:617 lineage)',
        metaCtx: { targetName: 'Goblin', slotLevel: 2 },
        spell: { ...dispel5e, spellCastingAbility: 'Wisdom' },
        playerStats: makePlayerStats({
          abilities: [
            { name: 'Intelligence', bonus: 5 },
            { name: 'Wisdom', bonus: 3 },
          ],
        }),
        roll: { total: 10, rolls: [10] }, // WIS 3 only → 13 vs DC 12
        expect: { casterName: 'TestWizard', targetName: 'Goblin', d20: 10, bonus: 3, total: 13, dc: 12, failed: false },
      },
      {
        label: 'no PB double-count when popup forwards dispelAbilityCheckBonus (CLA-322: max(PB, ctx) once, not stacked)',
        metaCtx: { targetName: 'Goblin', slotLevel: 3, dispelAbilityCheckBonus: 6 },
        spell: dispel5e,
        playerStats: makePlayerStats({
          level: 20,
          proficiency: 6,
          abilities: [{ name: 'Intelligence', bonus: 3 }],
          spellAbilities: { spellCastingAbility: 'Intelligence', modifier: 3 },
          automation: { passives: [SPELL_BREAKER] },
        }),
        roll: { total: 4, rolls: [4] }, // 3 + 6 = 9, NOT 3 + 6 + 6 = 15; 13 vs DC 13 tie
        expect: { casterName: 'TestWizard', targetName: 'Goblin', d20: 4, bonus: 9, total: 13, dc: 13, failed: false },
      },
      {
        label: 'upcast DC uses metaCtx.slotLevel over spell.level (disk row level 3 cast at slot 5 → DC 15)',
        metaCtx: { targetName: 'Goblin', slotLevel: 5 },
        spell: dispel5e,
        playerStats: BREAKER,
        roll: { total: 8, rolls: [8] }, // 8 + 9 = 17 vs DC 15
        expect: { casterName: 'TestWizard', targetName: 'Goblin', d20: 8, bonus: 9, total: 17, dc: 15, failed: false },
      },
    ];

    for (const row of rows) {
      vi.clearAllMocks();
      rollExpression.mockReturnValue(row.roll);
      const { events, dispose } = collectEvents();
      await triggerDispelMagic(row.metaCtx, row.spell, row.playerStats, 'test-campaign', 'test-map');
      dispose();

      expect(rollExpression).toHaveBeenCalledTimes(1);
      expect(rollExpression).toHaveBeenCalledWith('1d20');
      expectCheckOutcome(events, row.expect);
      expect(addEntry).toHaveBeenCalledTimes(1); // success → no Spell Breaker refund log
      expect(setRuntimeValue).toHaveBeenCalledTimes(0);
    }
  });

  it('metaCtx fallbacks: missing targetName logs "unknown target", missing slotLevel takes DC 13 from the disk spell row (2024)', async () => {
    const playerStats = makePlayerStats();
    rollExpression.mockReturnValue({ total: 8, rolls: [8] }); // 8 + 5 = 13 vs DC 13 tie

    const { events, dispose } = collectEvents();
    await triggerDispelMagic({}, dispel2024, playerStats, 'test-campaign', 'test-map');
    dispose();

    expectCheckOutcome(events, {
      casterName: 'TestWizard', targetName: 'unknown target', d20: 8, bonus: 5, total: 13, dc: 13, failed: false,
    });
    // purity: the disk row passed through untouched
    expect(dispel2024).toEqual(diskRow(spells2024, 'Dispel Magic'));
  });

  it('failed check at slot 5 (disk spell level 3) refunds the ACTUAL cast slot with exact runtime tuples (2-arg getRuntimeValue quirk) and logs Spell Breaker — full failure payload', async () => {
    // slotRetentionSpells gate (:154) holds: disk row always lists Dispel Magic.
    // usesSpellSlot (:154) runs REAL: slotLevel 5 > 0 → true.
    const metaCtx = { targetName: 'Goblin', slotLevel: 5 };
    rollExpression.mockReturnValue({ total: 3, rolls: [3] }); // 3 + 9 = 12 vs DC 15

    const { events, dispose } = collectEvents();
    await triggerDispelMagic(metaCtx, dispel2024, BREAKER, 'test-campaign', 'test-map');
    dispose();

    expectCheckOutcome(events, {
      casterName: 'TestWizard', targetName: 'Goblin', d20: 3, bonus: 9, total: 12, dc: 15, failed: true,
    });
    expect(addEntry).toHaveBeenCalledTimes(2); // check log + refund log

    // refund keyed by CAST SLOT level (5), never the spell's disk level (3)
    expect(getRuntimeValue).toHaveBeenCalledTimes(1);
    expect(getRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_5'); // arity quirk: no campaignName
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_5', 3, 'test-campaign'); // 2 + 1
    expect(JSON.stringify([...getRuntimeValue.mock.calls, ...setRuntimeValue.mock.calls])).not.toContain('spell_slots_level_3');

    const [refundCampaign, refundEntry] = addEntry.mock.calls[1];
    expect(refundCampaign).toBe('test-campaign');
    const { timestamp, ...rest } = refundEntry;
    expect(typeof timestamp).toBe('number');
    expect(rest).toEqual({
      type: 'ability_use',
      characterName: 'TestWizard',
      abilityName: 'Spell Breaker',
      description: 'Spell Breaker: Dispel Magic failed to stop a spell — spell slot level 5 refunded.',
    });
  });

  it('failed check refunds NOTHING without a retention grant — no passive (5e regression gate) and passive without Dispel Magic in slotRetentionSpells — check still logs', async () => {
    const rows = [
      { label: 'no Spell Breaker passive', playerStats: makePlayerStats(), bonus: 5 },
      {
        label: 'passive whose slotRetentionSpells omit Dispel Magic (PB still applies — bonus gate is passive presence, retention gate is separate)',
        playerStats: makePlayerStats({
          automation: { passives: [{ ...SPELL_BREAKER, slotRetentionSpells: ['Counterspell'] }] },
        }),
        bonus: 9,
      },
    ];

    for (const row of rows) {
      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue(2);
      rollExpression.mockReturnValue({ total: 3, rolls: [3] }); // 3 + bonus vs DC 13 → fail
      const { events, dispose } = collectEvents();
      await triggerDispelMagic({ targetName: 'Goblin', slotLevel: 3 }, dispel5e, row.playerStats, 'test-campaign', 'test-map');
      dispose();

      expectCheckOutcome(events, {
        casterName: 'TestWizard', targetName: 'Goblin', d20: 3, bonus: row.bonus, total: 3 + row.bonus, dc: 13, failed: true,
      });
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry.mock.calls.map(c => c[1].abilityName)).toEqual(['Dispel Magic']);
      expect(getRuntimeValue).toHaveBeenCalledTimes(0);
      expect(setRuntimeValue).toHaveBeenCalledTimes(0);
    }
  });

  it('roll-shape fallback ladder (:179): rolls[0] wins over total, bare total backstops, null roll degrades to d20 0 without a console error', async () => {
    const playerStats = makePlayerStats(); // mod-only +5, DC 12 at slot 2
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows = [
        { label: 'rolls[0] precedence', roll: { rolls: [4], total: 18 }, d20: 4, total: 9, failed: true },
        { label: 'total fallback when rolls missing', roll: { total: 7 }, d20: 7, total: 12, failed: false },
        { label: 'null rollResult → d20 0', roll: null, d20: 0, total: 5, failed: true },
      ];

      for (const row of rows) {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(row.roll);
        const { events, dispose } = collectEvents();
        await triggerDispelMagic({ targetName: 'Goblin', slotLevel: 2 }, dispel5e, playerStats, 'test-campaign', 'test-map');
        dispose();

        expectCheckOutcome(events, {
          casterName: 'TestWizard', targetName: 'Goblin', d20: row.d20, bonus: 5, total: row.total, dc: 12, failed: row.failed,
        });
        expect(setRuntimeValue).toHaveBeenCalledTimes(0); // fails here are refund-free: no passive
      }
      expect(consoleError.mock.calls).toEqual([]); // golden guard: optional chaining, no TypeError trail
    } finally {
      consoleError.mockRestore();
    }
  });
});
