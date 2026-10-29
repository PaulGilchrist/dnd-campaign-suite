// @maintained-by-ai
// Centralized At Will sentinel — the ONE helper deciding "unlimited" for every
// monster reaction counter/prose consumer (chip lane: MonsterCardHelpers
// monsterReactionUsesRemaining → null → GatedReactionLink hides the em;
// backlog improve `at-will-reaction-chip-999`, Goblin Boss Redirect Attack repro).
import { describe, it, expect } from 'vitest';
import { AT_WILL_USES_SENTINEL, isAtWillUsesLimit } from './monsterAbilityUses.js';
import { monsterReactionUsesRemaining } from '../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

describe('isAtWillUsesLimit — one helper decides at-will (no inline 999 checks)', () => {
  it.each([
    [999, true],
    ['999', true],
    [1000, true],
    [2, false],
    [1, false],
    [0, false],
    [null, false],
    [undefined, false],
    ['At Will', false],
  ])('maxUses %s → %s', (maxUses, expected) => {
    expect(isAtWillUsesLimit(maxUses)).toBe(expected);
  });

  it('sentinel constant matches the authored disk shape', () => {
    expect(AT_WILL_USES_SENTINEL).toBe(999);
  });
});

describe('monsterReactionUsesRemaining — sentinel vs real limit (chip counter legs)', () => {
  const AT_WILL_ROW = monsters.find(m => m.index === 'goblin-boss').reactions.find(a => a.name === 'Redirect Attack');
  const LIMITED_ROW = monsters.find(m => m.index === 'githzerai-monk').reactions[0];

  it('999 sentinel → null fresh AND after spends (chip prints no "(N left)")', () => {
    expect(AT_WILL_ROW.uses).toBe(999);
    expect(monsterReactionUsesRemaining(AT_WILL_ROW, {})).toBeNull();
    expect(monsterReactionUsesRemaining(AT_WILL_ROW, { redirect_attack: 5 })).toBeNull();
  });

  it('real limit keeps maxUses−spends arithmetic (chip prints "(N left)")', () => {
    expect(LIMITED_ROW.maxUses).toBe(2);
    expect(monsterReactionUsesRemaining(LIMITED_ROW, {})).toBe(2);
    expect(monsterReactionUsesRemaining(LIMITED_ROW, { feather_fall: 1 })).toBe(1);
    expect(monsterReactionUsesRemaining(LIMITED_ROW, { feather_fall: 2 })).toBe(0);
  });
});
