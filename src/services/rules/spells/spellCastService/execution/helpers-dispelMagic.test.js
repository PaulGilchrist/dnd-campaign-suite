// CLA-322: Spell Breaker — Dispel Magic ability check resolution, PB math,
// slot retention on failure (keyed by cast slot level) + log.
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — dependencies of helpers.js                                */
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

vi.mock('../../../features/spellUtils.js', () => ({
  usesSpellSlot: vi.fn(() => true),
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

vi.mock('../../../../combat/automation/automationService.js', () => ({
  markFortifiedHealthUsedIfGranted: vi.fn(),
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
import { usesSpellSlot } from '../../../features/spellUtils.js';

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

const SPELL_BREAKER = {
  type: 'spell_breaker',
  name: 'Spell Breaker',
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

function collectEvents() {
  const events = [];
  const handler = (e) => events.push(e.detail);
  window.addEventListener('spell-result', handler);
  return { events, dispose: () => window.removeEventListener('spell-result', handler) };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('helpers.js — triggerDispelMagic (CLA-322)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(2);
    setRuntimeValue.mockResolvedValue(undefined);
    rollExpression.mockReturnValue({ total: 5, rolls: [5] });
  });

  it('rolls a d20 ability check and dispatches spell-result with checkFailed', async () => {
    const metaCtx = { targetName: 'Goblin', slotLevel: 3 };
    const playerStats = makePlayerStats({ automation: { passives: [SPELL_BREAKER] } });
    // INT 5 + PB 4 = +9; d20 5 → total 14 vs DC 13 → succeeds
    rollExpression.mockReturnValue({ total: 14, rolls: [14] });

    const { events, dispose } = collectEvents();
    await triggerDispelMagic(metaCtx, { level: 3 }, playerStats, 'test-campaign', 'test-map');
    dispose();

    expect(rollExpression).toHaveBeenCalledWith('1d20');
    const dispelEvent = events.find(e => e.isDispelMagic);
    expect(dispelEvent).toBeDefined();
    expect(dispelEvent.spellName).toBe('Dispel Magic');
    expect(dispelEvent.targetName).toBe('Goblin');
    expect(dispelEvent.checkBonus).toBe(9);
    expect(dispelEvent.targetDC).toBe(13); // 10 + 3
    expect(dispelEvent.d20).toBe(14);
    expect(dispelEvent.total).toBe(23);
    expect(dispelEvent.checkFailed).toBe(false);
  });

  it('marks checkFailed when the roll cannot beat the DC', async () => {
    const metaCtx = { targetName: 'Goblin', slotLevel: 3 };
    const playerStats = makePlayerStats({ automation: { passives: [SPELL_BREAKER] } });
    // INT 5 + PB 4 = +9; d20 3 → total 12 vs DC 13 → fails
    rollExpression.mockReturnValue({ total: 3, rolls: [3] });

    const { events, dispose } = collectEvents();
    await triggerDispelMagic(metaCtx, { level: 3 }, playerStats, 'test-campaign', 'test-map');
    dispose();

    const dispelEvent = events.find(e => e.isDispelMagic);
    expect(dispelEvent.checkFailed).toBe(true);
    expect(dispelEvent.total).toBe(12);
  });

  it('does not add proficiency bonus without Spell Breaker (RAW mod-only)', async () => {
    const metaCtx = { targetName: 'Goblin', slotLevel: 2 };
    const playerStats = makePlayerStats({ automation: { passives: [] } });

    const { events, dispose } = collectEvents();
    await triggerDispelMagic(metaCtx, { level: 2 }, playerStats, 'test-campaign', 'test-map');
    dispose();

    const dispelEvent = events.find(e => e.isDispelMagic);
    // INT 5 only — no PB without the Spell Breaker passive
    expect(dispelEvent.checkBonus).toBe(5);
  });

  it('uses spell.spellCastingAbility when present', async () => {
    const metaCtx = { targetName: 'Goblin', slotLevel: 2 };
    const spell = { level: 2, spellCastingAbility: 'Wisdom' };
    const playerStats = makePlayerStats({
      abilities: [
        { name: 'Intelligence', bonus: 5 },
        { name: 'Wisdom', bonus: 3 },
      ],
      automation: { passives: [] },
    });

    const { events, dispose } = collectEvents();
    await triggerDispelMagic(metaCtx, spell, playerStats, 'test-campaign', 'test-map');
    dispose();

    const dispelEvent = events.find(e => e.isDispelMagic);
    // WIS 3 only (no passive)
    expect(dispelEvent.checkBonus).toBe(3);
  });

  it('does NOT double-count proficiency when popup forwards PB in metaCtx', async () => {
    // lv20 wizard: INT +3, PB +6 → canonical Spell Breaker dispel check = +9, not +15
    const metaCtx = { targetName: 'Goblin', slotLevel: 3, dispelAbilityCheckBonus: 6 };
    const playerStats = makePlayerStats({
      level: 20,
      proficiency: 6,
      abilities: [{ name: 'Intelligence', bonus: 3 }],
      spellAbilities: { spellCastingAbility: 'Intelligence', modifier: 3 },
      automation: { passives: [SPELL_BREAKER] },
    });

    const { events, dispose } = collectEvents();
    await triggerDispelMagic(metaCtx, { level: 3 }, playerStats, 'test-campaign', 'test-map');
    dispose();

    const dispelEvent = events.find(e => e.isDispelMagic);
    expect(dispelEvent.checkBonus).toBe(9); // 3 + 6, once
  });

  it('handles missing targetName with "unknown target"', async () => {
    const metaCtx = { slotLevel: 1 };
    const playerStats = makePlayerStats();

    const { events, dispose } = collectEvents();
    await triggerDispelMagic(metaCtx, { level: 1 }, playerStats, 'test-campaign', 'test-map');
    dispose();

    const dispelEvent = events.find(e => e.isDispelMagic);
    expect(dispelEvent.targetName).toBe('unknown target');
  });

  it('logs the ability check with d20, bonus, DC and outcome', async () => {
    const metaCtx = { targetName: 'Goblin', slotLevel: 3 };
    const playerStats = makePlayerStats({ automation: { passives: [SPELL_BREAKER] } });
    rollExpression.mockReturnValue({ total: 3, rolls: [3] });

    await triggerDispelMagic(metaCtx, { level: 3 }, playerStats, 'test-campaign', 'test-map');

    const checkLog = addEntry.mock.calls
      .map(c => c[1])
      .find(d => d.abilityName === 'Dispel Magic');
    expect(checkLog).toBeDefined();
    expect(checkLog.type).toBe('ability_use');
    expect(checkLog.description).toContain('d20 (3)');
    expect(checkLog.description).toContain('+ 9');
    expect(checkLog.description).toContain('DC 13');
    expect(checkLog.description).toContain('failed');
  });

  it('refunds the slot at the ACTUAL cast slot level and logs Spell Breaker on failure', async () => {
    const metaCtx = { targetName: 'Goblin', slotLevel: 5 };
    const playerStats = makePlayerStats({ automation: { passives: [SPELL_BREAKER] } });
    rollExpression.mockReturnValue({ total: 3, rolls: [3] });

    await triggerDispelMagic(metaCtx, { level: 5 }, playerStats, 'test-campaign', 'test-map');

    expect(getRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_5');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_5', 3, 'test-campaign');

    const refundLog = addEntry.mock.calls
      .map(c => c[1])
      .find(d => d.abilityName === 'Spell Breaker');
    expect(refundLog).toBeDefined();
    expect(refundLog.description).toContain('level 5');
  });

  it('does not refund the slot on a successful check', async () => {
    const metaCtx = { targetName: 'Goblin', slotLevel: 3 };
    const playerStats = makePlayerStats({ automation: { passives: [SPELL_BREAKER] } });
    rollExpression.mockReturnValue({ total: 20, rolls: [20] });

    await triggerDispelMagic(metaCtx, { level: 3 }, playerStats, 'test-campaign', 'test-map');

    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'TestWizard', 'spell_slots_level_3', expect.anything(), 'test-campaign',
    );
    const refundLog = addEntry.mock.calls
      .map(c => c[1])
      .find(d => d.abilityName === 'Spell Breaker');
    expect(refundLog).toBeUndefined();
  });

  it('does not refund when the cast consumed no spell slot', async () => {
    const metaCtx = { targetName: 'Goblin', slotLevel: 3 };
    const playerStats = makePlayerStats({ automation: { passives: [SPELL_BREAKER] } });
    rollExpression.mockReturnValue({ total: 3, rolls: [3] });
    usesSpellSlot.mockReturnValue(false);

    await triggerDispelMagic(metaCtx, { level: 3, freeCastAuthorized: true }, playerStats, 'test-campaign', 'test-map');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not refund without the Spell Breaker passive (5e regression gate)', async () => {
    const metaCtx = { targetName: 'Goblin', slotLevel: 3 };
    const playerStats = makePlayerStats({ automation: { passives: [] } });
    rollExpression.mockReturnValue({ total: 3, rolls: [3] });

    await triggerDispelMagic(metaCtx, { level: 3 }, playerStats, 'test-campaign', 'test-map');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
