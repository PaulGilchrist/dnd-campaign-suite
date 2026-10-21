// @maintained-by-ai
// Initiative lane of getPlayerStats: pins computeInitiative() numeric composition and
// Alert/Gloom Stalker flags (rules.js:556 calls it unmodified). Facade invocation of
// getPlayerStats is owned by rules.getPlayerStats.test.js; the dread_ambush_initiative
// numeric lane is owned here per the dreadAmbushHandler.test.js cross-reference.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => 0),
}));

import { computeInitiative } from '../rules-initiative.js';
import { evaluateAutoExpression } from '../../combat/automation/automationService.js';

const makeStats = ({ dex = 2, wis, passives } = {}) => {
  const abilities = [{ name: 'Dexterity', bonus: dex }];
  if (wis !== undefined) abilities.push({ name: 'Wisdom', bonus: wis });
  const stats = { abilities };
  if (passives !== undefined) stats.automation = { passives };
  return stats;
};

describe('computeInitiative (getPlayerStats initiative lane)', () => {
  beforeEach(() => {
    vi.mocked(evaluateAutoExpression).mockReset().mockReturnValue(0);
  });

  it('leaves initiative at the Dexterity modifier when no automation passives exist', () => {
    const stats = makeStats({ dex: 4 });
    computeInitiative(stats);
    expect(stats.initiative).toBe(4);
    expect(stats.initiativeAdvantage).toBe(false);
    expect(stats.noSurprise).toBe(false);
    expect(stats.unseenAttackerAdvantageNegate).toBe(false);
  });

  it.each([
    {
      label: 'Dread Ambush (passive_rule) adds the Wisdom modifier: 2 + 3 = 5',
      wis: 3,
      passives: [{ type: 'passive_rule', effect: 'dread_ambush_initiative' }],
      expected: 5,
    },
    {
      label: 'Dread Ambush with the wrong passive type is ignored',
      wis: 3,
      passives: [{ type: 'passive_buff', effect: 'dread_ambush_initiative' }],
      exprResult: 5,
      expected: 2,
    },
    {
      label: 'initiative_bonus (passive_buff) adds the evaluated expression: 2 + 2 = 4',
      passives: [{ type: 'passive_buff', effect: 'initiative_bonus', bonusExpression: '2' }],
      exprResult: 2,
      expected: 4,
    },
    {
      label: 'multiple initiative_bonus passives stack (2 + 2 + 2 = 6)',
      passives: [
        { type: 'passive_buff', effect: 'initiative_bonus', bonusExpression: '2' },
        { type: 'passive_buff', effect: 'initiative_bonus', bonusExpression: '2' },
      ],
      exprResult: 2,
      calls: 2,
      expected: 6,
    },
    {
      label: 'initiative_bonus with the wrong passive type is ignored',
      passives: [{ type: 'passive_rule', effect: 'initiative_bonus', bonusExpression: '2' }],
      exprResult: 5,
      expected: 2,
    },
    {
      label: 'a NaN evaluation is not added',
      passives: [{ type: 'passive_buff', effect: 'initiative_bonus', bonusExpression: 'bad' }],
      exprResult: NaN,
      expected: 2,
    },
    {
      label: 'a string evaluation result is not added even if numeric-looking',
      passives: [{ type: 'passive_buff', effect: 'initiative_bonus', bonusExpression: '2' }],
      exprResult: '3',
      expected: 2,
    },
  ])('$label', ({ wis, passives, exprResult, calls, expected }) => {
    if (exprResult !== undefined) {
      vi.mocked(evaluateAutoExpression).mockReturnValue(exprResult);
    }
    const stats = makeStats({ wis, passives });
    computeInitiative(stats);
    expect(stats.initiative).toBe(expected);
    const applied = passives.filter(
      (p) => p.type === 'passive_buff' && p.effect === 'initiative_bonus'
    );
    if (applied.length) {
      expect(evaluateAutoExpression).toHaveBeenCalledWith(applied[0].bonusExpression, stats);
      expect(evaluateAutoExpression).toHaveBeenCalledTimes(calls ?? 1);
    } else {
      expect(evaluateAutoExpression).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['initiative_advantage', 'initiativeAdvantage', 'passive_rule'],
    ['no_surprise', 'noSurprise', 'passive_buff'],
    ['unseen_attacker_advantage_negate', 'unseenAttackerAdvantageNegate', 'passive_buff'],
  ])('sets $flag=true from a $type passive $effect without touching numeric initiative', (effect, flag, type) => {
    const stats = makeStats({ passives: [{ type, effect }] });
    computeInitiative(stats);
    expect(stats[flag]).toBe(true);
    expect(stats.initiative).toBe(2);
  });
});
