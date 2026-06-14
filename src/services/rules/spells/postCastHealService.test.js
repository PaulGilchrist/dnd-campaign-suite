import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../combat/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(),
  logHealingToSSE: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

import { hasPostCastSelfHeal, triggerPostCastSelfHeals } from './postCastHealService.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';
import { applyHealingDirectly, logHealingToSSE } from '../../automation/common/healingRoll.js';

// ── Helpers ─────────────────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Grog',
    proficiency: 2,
    level: 3,
    hitPoints: 30,
    automation: {},
    ...overrides,
  };
}

function makeSpell(name, level = 1, range = '60 feet') {
  return { name, level, range };
}

// ── isHealingSpell (private — tested via triggerPostCastSelfHeal) ──

describe('isHealingSpell', () => {
  beforeEach(() => vi.clearAllMocks());

  // The private function is tested indirectly through triggerPostCastSelfHeals.
  // We cover each known healing spell name from the HEALING_SPELL_NAMES set.

  const healingNames = [
     'aid', 'aura of life', 'bless', 'cure wounds', 'death ward',
     'greater restoration', 'heal', 'healing word', 'lesser restoration',
     'mass cure wounds', 'mass healing word', 'prayer of healing',
     'power word heal', 'regenerate', 'revivify',
   ];

  for (const name of healingNames) {
    it(`recognizes "${name}" as a healing spell`, async () => {
      evaluateAutoExpression.mockReturnValue(5);
      applyHealingDirectly.mockReturnValue({ newHp: 10, maxHp: 30, actualHeal: 5 });

      const spell = makeSpell(name, 1);
      const playerStats = makePlayerStats({
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: '3', othersOnly: false }] },
       });

      const result = await triggerPostCastSelfHeals(spell, {}, playerStats, CAMPAIGN);
      expect(result).not.toBeNull();
     });
   }

  for (const name of ['fire bolt', 'magic missile', 'shield', 'lightning bolt', 'sleep']) {
    it(`does NOT recognize "${name}" as a healing spell`, async () => {
      const spell = makeSpell(name, 2);
      const playerStats = makePlayerStats({
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: '3', othersOnly: false }] },
       });

      const result = await triggerPostCastSelfHeals(spell, {}, playerStats, CAMPAIGN);
      expect(result).toBeNull();
     });
   }

  it('treats unknown spell name as non-healing', async () => {
    const spell = makeSpell('Some Random Spell', 3);
    const playerStats = makePlayerStats({ automation: { passives: [] } });
    const result = await triggerPostCastSelfHeals(spell, {}, playerStats, CAMPAIGN);
    expect(result).toBeNull();
   });

  it('is case-insensitive for healing spell names', async () => {
    evaluateAutoExpression.mockReturnValue(5);
    applyHealingDirectly.mockReturnValue({ newHp: 10, maxHp: 30, actualHeal: 5 });

    const spell = makeSpell('CURE WOUNDS', 1);
    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: '3', othersOnly: false }] },
     });

    const result = await triggerPostCastSelfHeals(spell, {}, playerStats, CAMPAIGN);
    expect(result).not.toBeNull();
   });

  it('handles spell with empty name as non-healing', async () => {
    const spell = makeSpell('', 1);
    const playerStats = makePlayerStats({ automation: { passives: [] } });
    const result = await triggerPostCastSelfHeals(spell, {}, playerStats, CAMPAIGN);
    expect(result).toBeNull();
   });

  it('handles spell without name property', async () => {
     // @ts-ignore — deliberately testing edge case
    const spell = { level: 1, range: '60 feet' };
    const playerStats = makePlayerStats({ automation: { passives: [] } });
    const result = await triggerPostCastSelfHeals(spell, {}, playerStats, CAMPAIGN);
    expect(result).toBeNull();
   });
});

// ── hasPostCastSelfHeal ─────────────────────────────────────────

describe('hasPostCastSelfHeal', () => {
  it('returns true when player has post_cast_self_heal passives', () => {
    const playerStats = makePlayerStats({
      automation: {
        passives: [{ type: 'post_cast_self_heal', name: 'Disciple Life' }],
      },
    });
    expect(hasPostCastSelfHeal(playerStats)).toBe(true);
  });

  it('returns true when player has multiple post_cast_self_heal passives', () => {
    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Disciple Life' },
          { type: 'post_cast_self_heal', name: 'Divine Gift' },
        ],
      },
    });
    expect(hasPostCastSelfHeal(playerStats)).toBe(true);
  });

  it('returns false when player has no automation passives', () => {
    const playerStats = makePlayerStats({ automation: { passives: [] } });
    expect(hasPostCastSelfHeal(playerStats)).toBe(false);
  });

  it('returns false when player has no automation object', () => {
    const playerStats = makePlayerStats({ automation: undefined });
    expect(hasPostCastSelfHeal(playerStats)).toBe(false);
  });

  it('returns false when player has other passives but not post_cast_self_heal', () => {
    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_buff', name: 'Heavy Armor Training' },
          { type: 'resistance', name: 'Darkness Resistance' },
        ],
      },
    });
    expect(hasPostCastSelfHeal(playerStats)).toBe(false);
  });

  it('correctly filters mixed passive list (one match among many)', () => {
    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_buff', name: 'Defensive Fighting' },
          { type: 'post_cast_self_heal', name: 'Disciple Life' },
          { type: 'resistance', name: 'Fire Resistance' },
        ],
      },
    });
    expect(hasPostCastSelfHeal(playerStats)).toBe(true);
  });

  it('handles playerStats with null automation', () => {
    const playerStats = makePlayerStats({ automation: null });
    expect(hasPostCastSelfHeal(playerStats)).toBe(false);
  });

  it('handles bare empty object as playerStats', () => {
    expect(hasPostCastSelfHeal({})).toBe(false);
  });
});

// ── triggerPostCastSelfHeals — Early exits ──────────────────────

describe('triggerPostCastSelfHeals — early exit conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when spell is not a healing spell', async () => {
    const result = await triggerPostCastSelfHeals(
      makeSpell('fire bolt', 1),
      {},
      makePlayerStats({ automation: { passives: [] } }),
      CAMPAIGN,
    );
    expect(result).toBeNull();
    expect(evaluateAutoExpression).not.toHaveBeenCalled();
    expect(applyHealingDirectly).not.toHaveBeenCalled();
  });

  it('returns null when spell level is 0 (cantrip)', async () => {
    const result = await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 0),
      {},
      makePlayerStats({ automation: { passives: [] } }),
      CAMPAIGN,
    );
    expect(result).toBeNull();
  });

  it('returns null when playerStats has no post-cast self heals', async () => {
    const result = await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 1),
      {},
      makePlayerStats({ automation: { passives: [] } }),
      CAMPAIGN,
    );
    expect(result).toBeNull();
  });

  it('returns null when playerStats has no automation', async () => {
    const result = await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 1),
      {},
      makePlayerStats({ automation: undefined }),
      CAMPAIGN,
    );
    expect(result).toBeNull();
  });

  it('returns null when playerStats has no passives in automation', async () => {
    const result = await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 1),
      {},
      makePlayerStats({ automation: {} }),
      CAMPAIGN,
    );
    expect(result).toBeNull();
  });

  it('returns null when evaluateAutoExpression returns non-number', async () => {
    evaluateAutoExpression.mockReturnValue('invalid');
    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Heal', healExpression: 'proficiency_bonus_d4', othersOnly: false }] },
    });
    const result = await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 1),
      {},
      playerStats,
      CAMPAIGN,
    );
    expect(result).toBeNull();
  });

  it('returns null when evaluateAutoExpression returns NaN', async () => {
    evaluateAutoExpression.mockReturnValue(NaN);
    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Heal', healExpression: 'abc', othersOnly: false }] },
    });
    const result = await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 1),
      {},
      playerStats,
      CAMPAIGN,
    );
    expect(result).toBeNull();
  });

  it('returns null when evaluateAutoExpression returns negative number', async () => {
    evaluateAutoExpression.mockReturnValue(-5);
    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Heal', healExpression: '-proficiency_bonus', othersOnly: false }] },
    });
    const result = await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 1),
      {},
      playerStats,
      CAMPAIGN,
    );
    expect(result).toBeNull();
  });

  it('returns null when evaluateAutoExpression returns zero', async () => {
    evaluateAutoExpression.mockReturnValue(0);
    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Heal', healExpression: '0', othersOnly: false }] },
    });
    const result = await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 1),
      {},
      playerStats,
      CAMPAIGN,
    );
    expect(result).toBeNull();
  });
});

// ── triggerPostCastSelfHeals — Main success flow ────────────────

describe('triggerPostCastSelfHeals — successful healing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupSuccessfulScenario() {
    evaluateAutoExpression.mockReturnValue(7);
    applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 30, actualHeal: 7 });

    const playerStats = makePlayerStats({
      name: 'Cleric',
      proficiency: 2,
      level: 5,
      hitPoints: 30,
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: 'proficiency_bonus', othersOnly: false },
        ],
      },
    });

    return { playerStats };
  }

  it('returns results array when healing succeeds', async () => {
    const { playerStats } = setupSuccessfulScenario();
    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([
      { name: 'Disciple Life', amount: 7, actualHeal: 7 },
    ]);
  });

  it('calls evaluateAutoExpression with correct arguments', async () => {
    const { playerStats } = setupSuccessfulScenario();
    await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(evaluateAutoExpression).toHaveBeenCalledWith(
      'proficiency_bonus',
      playerStats,
      2, // prof
      5, // level
      1, // slotLevel
    );
  });

  it('calls applyHealingDirectly with correct arguments', async () => {
    const { playerStats } = setupSuccessfulScenario();
    await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(applyHealingDirectly).toHaveBeenCalledWith(
      playerStats,
      'Cleric',
      7, // amount
      CAMPAIGN,
    );
  });

  it('calls logHealingToSSE with correct info', async () => {
    const { playerStats } = setupSuccessfulScenario();
    await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 2),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(logHealingToSSE).toHaveBeenCalledWith(CAMPAIGN, {
      targetName: 'Cleric',
      sourceName: 'Disciple Life',
      actualHeal: 7,
      newHp: 20,
      maxHp: 30,
    });
  });

  it('uses spell.level as slotLevel when metaCtx has no slotLevel', async () => {
    const { playerStats } = setupSuccessfulScenario();
    await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 2),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(evaluateAutoExpression).toHaveBeenCalledWith(
      'proficiency_bonus',
      playerStats,
      2, // prof
      5, // level
      2, // slotLevel defaulted to spell.level
    );
  });

  it('uses metaCtx.slotLevel when provided (overriding spell.level)', async () => {
    const { playerStats } = setupSuccessfulScenario();
    evaluateAutoExpression.mockReturnValue(10);
    applyHealingDirectly.mockReturnValue({ newHp: 23, maxHp: 30, actualHeal: 10 });

    await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 1),
      { slotLevel: 3 },
      playerStats,
      CAMPAIGN,
    );

    expect(evaluateAutoExpression).toHaveBeenCalledWith(
      'proficiency_bonus',
      playerStats,
      2, // prof
      5, // level
      3, // slotLevel from metaCtx
    );
  });

  it('uses spell.level as fallback for slotLevel when metaCtx.slotLevel missing', async () => {
    const { playerStats } = setupSuccessfulScenario();
    evaluateAutoExpression.mockReturnValue(7);
    applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 30, actualHeal: 7 });

    await triggerPostCastSelfHeals(
      makeSpell('mass cure wounds', 5),
      {}, // metaCtx with no slotLevel
      playerStats,
      CAMPAIGN,
    );

    expect(evaluateAutoExpression).toHaveBeenCalledWith(
      'proficiency_bonus',
      playerStats,
      2,
      5,
      5, // defaults to spell.level
    );
  });

  it('defaults slotLevel to 1 when both metaCtx.slotLevel and spell.level are missing', async () => {
    evaluateAutoExpression.mockReturnValue(3);
    applyHealingDirectly.mockReturnValue({ newHp: 10, maxHp: 30, actualHeal: 3 });

     // Player with no level or proficiency — both default to 1 and 0 respectively
      // @ts-ignore — deliberately missing level/proficiency to test defaults
    const playerStats = {
      name: 'Novice',
      hitPoints: 30,
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Gift', healExpression: 'slotLevel', othersOnly: false }] },
     };

      // @ts-ignore — spell with no level property
    await triggerPostCastSelfHeals(
        { name: 'healing word', range: '60 feet' },
        {},
      playerStats,
      CAMPAIGN,
      );

    expect(evaluateAutoExpression).toHaveBeenCalledWith(
        'slotLevel',
      playerStats,
        0, // prof defaults to 0 when playerStats.proficiency is undefined (|| 0)
        1, // level defaults to 1 when playerStats.level is undefined (|| 1)
        1, // slotLevel defaults to 1 when both metaCtx.slotLevel and spell.level are missing
      );
    });

  it('uses proficiency from playerStats (defaults to 0 if missing)', async () => {
    evaluateAutoExpression.mockReturnValue(5);
    applyHealingDirectly.mockReturnValue({ newHp: 25, maxHp: 30, actualHeal: 5 });

    // playerStats with no proficiency — defaults to 0
    const playerStats = { name: 'Novice', level: 1, hitPoints: 30, automation: { passives: [{ type: 'post_cast_self_heal', name: 'Gift', healExpression: 'proficiency_bonus', othersOnly: false }] } };

    await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(evaluateAutoExpression).toHaveBeenCalledWith(
      'proficiency_bonus',
      playerStats,
      0, // prof defaults to 0
      1, // level defaults to 1
      1,
    );
  });

  it('uses level from playerStats (defaults to 1 if missing)', async () => {
    evaluateAutoExpression.mockReturnValue(5);
    applyHealingDirectly.mockReturnValue({ newHp: 25, maxHp: 30, actualHeal: 5 });

    const playerStats = { name: 'Novice', proficiency: 2, hitPoints: 30, automation: { passives: [{ type: 'post_cast_self_heal', name: 'Gift', healExpression: 'level', othersOnly: false }] } };

    await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(evaluateAutoExpression).toHaveBeenCalledWith(
      'level',
      expect.any(Object),
      2, // prof
      1, // level defaults to 1
      1,
    );
  });

  it('uses healExpression default "0" when not provided on the passive', async () => {
    evaluateAutoExpression.mockReturnValue(0);

    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Broken Heal' }] },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(evaluateAutoExpression).toHaveBeenCalledWith('0', expect.any(Object), expect.any(Number), expect.any(Number), expect.any(Number));
    expect(result).toBeNull(); // amount was 0, skipped
  });
});

// ── triggerPostCastSelfHeals — othersOnly filter ────────────────

describe('triggerPostCastSelfHeals — othersOnly filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips heal when othersOnly is true and spell range is Self', async () => {
    evaluateAutoExpression.mockReturnValue(10);
    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Others Only Heal', healExpression: 'proficiency_bonus', othersOnly: true },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('heal', 3, 'Self'),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toBeNull(); // skipped because othersOnly && range === 'Self'
    expect(evaluateAutoExpression).not.toHaveBeenCalled();
    expect(applyHealingDirectly).not.toHaveBeenCalled();
  });

  it('does NOT skip heal when othersOnly is true and spell range is not Self', async () => {
    evaluateAutoExpression.mockReturnValue(10);
    applyHealingDirectly.mockReturnValue({ newHp: 25, maxHp: 30, actualHeal: 10 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'AoE Heal', healExpression: 'proficiency_bonus', othersOnly: true },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('aid', 2, '60 feet'), // aid is a healing spell with range
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([{ name: 'AoE Heal', amount: 10, actualHeal: 10 }]);
    expect(applyHealingDirectly).toHaveBeenCalled();
  });

  it('does NOT skip heal when othersOnly is false and spell range is Self', async () => {
    evaluateAutoExpression.mockReturnValue(5);
    applyHealingDirectly.mockReturnValue({ newHp: 18, maxHp: 30, actualHeal: 5 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Lifebound Magic', healExpression: 'proficiency_bonus', othersOnly: false },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1, 'Self'),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([{ name: 'Lifebound Magic', amount: 5, actualHeal: 5 }]);
    expect(applyHealingDirectly).toHaveBeenCalled();
  });

  it('does NOT skip heal when othersOnly is undefined and spell range is Self', async () => {
    // othersOnly defaults to true in buildAttackInfo, but in the stored passive it might be undefined.
    // The guard checks `heal.othersOnly && spell.range === 'Self'` — if undefined, this is falsy.
    evaluateAutoExpression.mockReturnValue(5);
    applyHealingDirectly.mockReturnValue({ newHp: 18, maxHp: 30, actualHeal: 5 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Default Heal', healExpression: 'proficiency_bonus' },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1, 'Self'),
      {},
      playerStats,
    );

    expect(result).toEqual([{ name: 'Default Heal', amount: 5, actualHeal: 5 }]);
  });

  it('still triggers when othersOnly is true and spell range differs from Self', async () => {
    evaluateAutoExpression.mockReturnValue(12);
    applyHealingDirectly.mockReturnValue({ newHp: 22, maxHp: 30, actualHeal: 12 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Group Heal', healExpression: 'spell_slot_level * 2', othersOnly: true },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('prayer of healing', 3, '30 feet'),
      { slotLevel: 3 },
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([{ name: 'Group Heal', amount: 12, actualHeal: 12 }]);
  });
});

// ── triggerPostCastSelfHeals — Multiple passives ────────────────

describe('triggerPostCastSelfHeals — multiple post-cast heal sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes multiple self-heal passives', async () => {
    evaluateAutoExpression
      .mockReturnValueOnce(5)   // first heal
      .mockReturnValueOnce(3);  // second heal
    applyHealingDirectly
      .mockReturnValueOnce({ newHp: 20, maxHp: 30, actualHeal: 5 })
      .mockReturnValueOnce({ newHp: 23, maxHp: 30, actualHeal: 3 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: 'proficiency_bonus', othersOnly: false },
          { type: 'post_cast_self_heal', name: 'Divine Gift', healExpression: 'level - 2', othersOnly: false },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([
      { name: 'Disciple Life', amount: 5, actualHeal: 5 },
      { name: 'Divine Gift', amount: 3, actualHeal: 3 },
    ]);
  });

  it('calls evaluateAutoExpression once per heal passive', async () => {
    evaluateAutoExpression.mockReturnValue(2);
    applyHealingDirectly.mockReturnValue({ newHp: 10, maxHp: 30, actualHeal: 2 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Heal A', healExpression: 'a', othersOnly: false },
          { type: 'post_cast_self_heal', name: 'Heal B', healExpression: 'b', othersOnly: false },
          { type: 'post_cast_self_heal', name: 'Heal C', healExpression: 'c', othersOnly: false },
        ],
      },
    });

    await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(evaluateAutoExpression).toHaveBeenCalledTimes(3);
  });

  it('calls applyHealingDirectly once per valid heal', async () => {
    evaluateAutoExpression.mockReturnValue(4);
    applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 30, actualHeal: 4 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'First', healExpression: 'expr1', othersOnly: false },
          { type: 'post_cast_self_heal', name: 'Second', healExpression: 'expr2', othersOnly: false },
        ],
      },
    });

    await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(applyHealingDirectly).toHaveBeenCalledTimes(2);
  });

  it('calls logHealingToSSE once per valid heal', async () => {
    evaluateAutoExpression.mockReturnValue(3);
    applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 30, actualHeal: 3 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'First', healExpression: 'expr1', othersOnly: false },
          { type: 'post_cast_self_heal', name: 'Second', healExpression: 'expr2', othersOnly: false },
        ],
      },
    });

    await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(logHealingToSSE).toHaveBeenCalledTimes(2);
  });

  it('skips one heal in the middle but continues with the rest', async () => {
    evaluateAutoExpression
      .mockReturnValueOnce(5)    // first — valid
      .mockReturnValueOnce(NaN)  // second — skipped
      .mockReturnValueOnce(3);   // third — valid
    applyHealingDirectly
      .mockReturnValueOnce({ newHp: 18, maxHp: 30, actualHeal: 5 })
      .mockReturnValueOnce({ newHp: 21, maxHp: 30, actualHeal: 3 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Good Heal', healExpression: 'good', othersOnly: false },
          { type: 'post_cast_self_heal', name: 'Bad Heal', healExpression: 'broken', othersOnly: false },
          { type: 'post_cast_self_heal', name: 'Another Good Heal', healExpression: 'also_good', othersOnly: false },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([
      { name: 'Good Heal', amount: 5, actualHeal: 5 },
      { name: 'Another Good Heal', amount: 3, actualHeal: 3 },
    ]);
    expect(evaluateAutoExpression).toHaveBeenCalledTimes(3); // all evaluated
    expect(applyHealingDirectly).toHaveBeenCalledTimes(2);  // only valid ones applied
  });

  it('returns null when all passives are skipped (negative amounts)', async () => {
    evaluateAutoExpression.mockReturnValue(-1);

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Negative 1', healExpression: '-proficiency_bonus', othersOnly: false },
          { type: 'post_cast_self_heal', name: 'Negative 2', healExpression: '0 - proficiency_bonus', othersOnly: false },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toBeNull();
  });

  it('returns null when all passives are skipped by othersOnly filter', async () => {
    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'post_cast_self_heal', name: 'Others Only 1', healExpression: '5', othersOnly: true },
          { type: 'post_cast_self_heal', name: 'Others Only 2', healExpression: '3', othersOnly: true },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('heal', 6, 'Self'), // Self range + healing spell
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toBeNull();
    expect(evaluateAutoExpression).not.toHaveBeenCalled();
    expect(applyHealingDirectly).not.toHaveBeenCalled();
  });

  it('handles mixed passives (some post_cast_self_heal, some other)', async () => {
    evaluateAutoExpression.mockReturnValue(8);
    applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 30, actualHeal: 8 });

    const playerStats = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_buff', name: 'Heavy Armor Training' },
          { type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: 'proficiency_bonus * 4', othersOnly: false },
          { type: 'resistance', name: 'Fire Resistance' },
        ],
      },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 2),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([{ name: 'Disciple Life', amount: 8, actualHeal: 8 }]);
  });
});

// ── triggerPostCastSelfHeals — metaCtx edge cases ───────────────

describe('triggerPostCastSelfHeals — metaCtx edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles null metaCtx gracefully', async () => {
    evaluateAutoExpression.mockReturnValue(7);
    applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 30, actualHeal: 7 });

    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: 'proficiency_bonus', othersOnly: false }] },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      null, // null metaCtx
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([{ name: 'Disciple Life', amount: 7, actualHeal: 7 }]);
    // slotLevel should default to spell.level (1) since metaCtx is null
    expect(evaluateAutoExpression).toHaveBeenCalledWith(
      'proficiency_bonus',
      playerStats,
      2,
      3,
      1, // spell.level used as fallback
    );
  });

  it('handles undefined metaCtx gracefully', async () => {
    evaluateAutoExpression.mockReturnValue(7);
    applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 30, actualHeal: 7 });

    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: 'proficiency_bonus', othersOnly: false }] },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      undefined, // undefined metaCtx
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([{ name: 'Disciple Life', amount: 7, actualHeal: 7 }]);
  });

  it('_mapName parameter is accepted but not used', async () => {
    evaluateAutoExpression.mockReturnValue(7);
    applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 30, actualHeal: 7 });

    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: 'proficiency_bonus', othersOnly: false }] },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
      'dungeon_floor_1', // _mapName
    );

    expect(result).toEqual([{ name: 'Disciple Life', amount: 7, actualHeal: 7 }]);
  });
});

// ── triggerPostCastSelfHeals — applyHealingDirectly integration ──

describe('triggerPostCastSelfHeals — applyHealingDirectly integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes playerStats.hitPoints as targetName arg to applyHealingDirectly (uses playerStats.name)', async () => {
    evaluateAutoExpression.mockReturnValue(5);
    applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 30, actualHeal: 5 });

    const playerStats = makePlayerStats({
      name: 'Thern',
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Gift', healExpression: 'proficiency_bonus', othersOnly: false }] },
    });

    await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      CAMPAIGN,
    );

    // Second argument to applyHealingDirectly is targetName === playerStats.name
    expect(applyHealingDirectly).toHaveBeenCalledWith(playerStats, 'Thern', 5, CAMPAIGN);
  });

  it('passes the evaluated amount (not raw expression) to applyHealingDirectly', async () => {
    evaluateAutoExpression.mockReturnValue(14); // resolved from a complex expression
    applyHealingDirectly.mockReturnValue({ newHp: 27, maxHp: 30, actualHeal: 14 });

    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Heal', healExpression: '(proficiency_bonus + level) * 2', othersOnly: false }] },
    });

    await triggerPostCastSelfHeals(
      makeSpell('heal', 6),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(applyHealingDirectly).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      14, // resolved amount
      CAMPAIGN,
    );
  });

  it('uses actualHeal from applyHealingDirectly in result object', async () => {
    evaluateAutoExpression.mockReturnValue(20);
    // Player at HP 28/30, healed for 20 → actualHeal = 2 (capped at max)
    applyHealingDirectly.mockReturnValue({ newHp: 30, maxHp: 30, actualHeal: 2 });

    const playerStats = makePlayerStats({
      hitPoints: 30,
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Power Word Heal', healExpression: 'proficiency_bonus * 10', othersOnly: false }] },
    });

    const result = await triggerPostCastSelfHeals(
      makeSpell('power word heal', 9),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(result).toEqual([{ name: 'Power Word Heal', amount: 20, actualHeal: 2 }]);
  });

  it('uses newHp and maxHp from applyHealingDirectly in logHealingToSSE call', async () => {
    evaluateAutoExpression.mockReturnValue(8);
    applyHealingDirectly.mockReturnValue({ newHp: 25, maxHp: 30, actualHeal: 8 });

    const playerStats = makePlayerStats({
      name: 'Zara',
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: 'proficiency_bonus * 4', othersOnly: false }] },
    });

    await triggerPostCastSelfHeals(
      makeSpell('cure wounds', 2),
      {},
      playerStats,
      CAMPAIGN,
    );

    expect(logHealingToSSE).toHaveBeenCalledWith(CAMPAIGN, {
      targetName: 'Zara',
      sourceName: 'Disciple Life',
      actualHeal: 8,
      newHp: 25,
      maxHp: 30,
    });
  });

  it('passes campaignName to both applyHealingDirectly and logHealingToSSE', async () => {
    evaluateAutoExpression.mockReturnValue(5);
    applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 30, actualHeal: 5 });

    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'post_cast_self_heal', name: 'Heal', healExpression: 'proficiency_bonus', othersOnly: false }] },
    });

    await triggerPostCastSelfHeals(
      makeSpell('healing word', 1),
      {},
      playerStats,
      'MyCampaign',
    );

    expect(applyHealingDirectly).toHaveBeenCalledWith(expect.any(Object), expect.any(String), 5, 'MyCampaign');
    expect(logHealingToSSE).toHaveBeenCalledWith('MyCampaign', expect.any(Object));
  });
});

// ── triggerPostCastSelfHeals — Healing spell names coverage ─────

describe('triggerPostCastSelfHeals — all known healing spells trigger flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const healingSpells = [
    'aid', 'aura of life', 'bless', 'cure wounds', 'death ward',
    'greater restoration', 'heal', 'healing word', 'lesser restoration',
    'mass cure wounds', 'mass healing word', 'prayer of healing',
    'power word heal', 'regenerate', 'revivify',
  ];

  for (const name of healingSpells) {
    it(`triggers self-healing for "${name}"`, async () => {
      evaluateAutoExpression.mockReturnValue(3);
      applyHealingDirectly.mockReturnValue({ newHp: 10, maxHp: 30, actualHeal: 3 });

      const playerStats = makePlayerStats({
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Disciple Life', healExpression: 'proficiency_bonus', othersOnly: false }] },
      });

      const result = await triggerPostCastSelfHeals(
        makeSpell(name, 1),
        {},
        playerStats,
        CAMPAIGN,
      );

      expect(result).not.toBeNull();
      expect(result.length).toBe(1);
    });
  }
});
