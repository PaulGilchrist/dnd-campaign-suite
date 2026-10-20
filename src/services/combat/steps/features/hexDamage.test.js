// @maintained-by-ai
// Lane #1054 — hexDamage (attack-step): Hex's Curse damage bonus on a weapon hit.
// Hex-family map:
//   - #1051 eldritchStrikes pins the Hex Strike latch-key derivation ('_Hex_Strike_usedRound',
//     space→underscore contract). Hex STRIKE consumption is NOT this lane.
//   - spellCastService.hexEffects / helpers.js cover Hex-on-CAST application (targetEffects
//     disadvantage stamps) — NOT this attack-damage step.
//   - This lane owns the HIT-time decision bytes: caster channelling concentration
//     { spell: 'Hex' } (exact ===, per concentrationService.addConcentration shape
//     { id, spell, dc, target }) AND cursed-target match → +1d6 necrotic appended.
//   - No per-turn latch here: concentration itself is the gate; zero-applied must not burn
//     anything (#1026) — every guard refusal before the roll never calls rollExpression;
//     only rollExpression's own null return passes prevData through unchanged (no re-roll).
// Old→new map: 20 tests → 8 (null/undefined and near-duplicate refusals table-driven;
// success runs consolidated to one exact-full-result run with distinguishable dice bytes).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { hexDamage } from './hexDamage.js';

import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

// ── Helpers ───────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const ATK = 'Ranger1';
const CURSED = 'Goblin1';

function makeCtx(overrides = {}) {
  return {
    campaignName: CAMPAIGN,
    playerStats: { name: ATK },
    targetName: CURSED,
    ...overrides,
  };
}

// Fresh prevData per run (distinguishable bytes: 8+3 = 11, no 4s — hex roll is visible).
function makePrev() {
  return { formula: '1d8+3', total: 11, rolls: [8, 3] };
}

// Arm the caster with a live Hex concentration (concentrationService.addConcentration shape).
// NO_CONC omits the key entirely (explicit `undefined` would hit the default param).
const NO_CONC = Symbol('no concentration');
function armHex(concentration = { spell: 'Hex', target: CURSED }) {
  const creature = { name: ATK };
  if (concentration !== NO_CONC) creature.concentration = concentration;
  getCombatContext.mockResolvedValue({ creatures: [creature] });
}

// A refusal must return prevData byte-identical and never touch the dice.
async function expectRefusal(ctx) {
  const prevData = makePrev();
  const result = await hexDamage.handler(ctx, prevData);

  expect(result).toEqual({ data: prevData });
  expect(rollExpression).not.toHaveBeenCalled();
}

// ── Tests ────────────────────────────────────────────────────────

describe('hexDamage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('step contract: name "hexDamage", condition always true', () => {
    expect(hexDamage.name).toBe('hexDamage');
    expect(hexDamage.condition(makeCtx())).toBe(true);
    expect(hexDamage.condition({})).toBe(true);
  });

  describe('refusals — no dice rolled, prevData untouched', () => {
    it.each([
      ['no combat summary', null],
      ['attacker not in combat', { creatures: [{ name: 'Orc1' }] }],
      ['creatures list missing', {}],
    ])('refuses when %s', async (_label, cs) => {
      getCombatContext.mockResolvedValue(cs);
      await expectRefusal(makeCtx());
    });

    // Strict === 'Hex' byte contract — near-miss bytes and missing concentration refuse
    // (cites #1051: exact-match keys in this family are never substring/loose matched).
    it.each([
      ['no concentration', NO_CONC],
      ['null concentration', null],
      ['channelling another spell', { spell: 'Bane', target: CURSED }],
      ['lowercase spell byte', { spell: 'hex', target: CURSED }],
      ['near-miss spell byte', { spell: 'HexingStriker', target: CURSED }],
    ])('refuses when %s', async (_label, concentration) => {
      armHex(concentration);
      await expectRefusal(makeCtx());
    });

    // Co-located falsifier (#948): the exact same armed state ACROSS below — only the
    // target byte flips the outcome. Uncursed targets never take the bonus.
    it('refuses when the attack target is not the cursed target', async () => {
      armHex({ spell: 'Hex', target: 'Orc1' });
      await expectRefusal(makeCtx({ targetName: CURSED }));
    });

    it('refuses when rollExpression returns null (dice rolled but zero burned)', async () => {
      armHex();
      rollExpression.mockReturnValue(null);

      const prevData = makePrev();
      const result = await hexDamage.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
      expect(rollExpression).toHaveBeenCalledTimes(1);
      expect(rollExpression).toHaveBeenCalledWith('1d6');
    });
  });

  describe('application — +1d6 necrotic appended', () => {
    it('cursed target hit: appends 1d6 [necrotic] with exact full-result shape', async () => {
      armHex();
      rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0, formula: '1d6' });

      const prevData = makePrev();
      const result = await hexDamage.handler(makeCtx(), prevData);

      expect(result).toEqual({
        data: { formula: '1d8+3 + 1d6 [necrotic]', total: 15, rolls: [8, 3, 4] },
      });
      expect(rollExpression).toHaveBeenCalledWith('1d6');
      expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
      expect(prevData).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    });

    it('applies when concentration carries no target (addConcentration default null)', async () => {
      armHex({ spell: 'Hex', target: null });
      rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0, formula: '1d6' });

      const result = await hexDamage.handler(makeCtx(), makePrev());

      expect(result).toEqual({
        data: { formula: '1d8+3 + 1d6 [necrotic]', total: 15, rolls: [8, 3, 4] },
      });
    });

    it('defaults missing prevData.rolls to [] before appending hex dice', async () => {
      armHex();
      rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0, formula: '1d6' });

      const result = await hexDamage.handler(makeCtx(), { formula: 'flat', total: 5 });

      expect(result).toEqual({
        data: { formula: 'flat + 1d6 [necrotic]', total: 9, rolls: [4] },
      });
    });
  });
});
