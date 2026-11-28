// @maintained-by-ai 2026-11-28
// MA-0049: structured `usage` objects must render human text, never
// "[object Object]" (MV-26). OWNER lane: the formatActionUsage full branch
// truth table lives here — ma1120:12 and ma0305:14 delegate their "At Will"
// passthrough here (#530). monsterReactionUsesRemaining fresh/spend
// arithmetic is owned by gated-reaction.test.js:62-69 (#517) — no
// arithmetic legs here. d6-recharge shapes → null (RechargeNote owns the
// label); flat strings (incl. "At Will" sentinel) verbatim; "per day" →
// "N/Day"; unknown shapes console.error → null, never silent.
// No-target refusal: builders moved to services/combat/noTargetRefusal.js
// and are re-exported here for the MonsterCardModal chip lane. The byte-
// exact popup/log default templates are OWNED by noTargetRefusal.test.js:19-29
// and :75-85 (direct import, maintained 2026-11-18) — this lane pins only the
// re-export wiring plus the slug-normalization branches (sole pins suite-
// wide). buildCounterspellMessage: "At Will" on 999-sentinels, finite limits
// keep "N/Day" (pass#336T) — sole direct-call pin of that label branch.
import { describe, it, expect, vi } from 'vitest';
import { formatActionUsage, buildNoTargetRefusalPopup, buildNoTargetRefusalLog, buildCounterspellMessage } from './MonsterCardHelpers.js';

describe('MA-0049 formatActionUsage — owner truth table', () => {
  it.each([
    ['absent null → null', null, null],
    ['absent undefined → null', undefined, null],
    ['"At Will" sentinel passthrough verbatim (#530, delegated from ma1120)', 'At Will', 'At Will'],
    ['d6 recharge → null (RechargeNote owns the label)', { type: 'recharge on roll', dice: '1d6', min_value: 5 }, null],
    ['recharge match is case-insensitive', { type: 'Recharge on a 6' }, null],
    ['per day object → "N/Day"', { type: 'per day', times: 3 }, '3/Day'],
    ['primitive coerced to string, never [object Object]', 3, '3'],
  ])('%s', (_label, usage, expected) => {
    expect(formatActionUsage(usage)).toBe(expected);
  });

  it('unformattable objects: console.error once per call, null out (never silent)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(formatActionUsage({ type: 'per encounter' })).toBeNull();
    expect(formatActionUsage({ type: 'per day' })).toBeNull(); // per day without times
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

describe('MA-0049 no-target refusal — MonsterCardModal re-export lane', () => {
  // Templates byte-pinned at the single owner (noTargetRefusal.test.js); the
  // unique risk here is the re-export breaking the chip consumer's import.
  it('popup and log ride the re-export: save refusal names monster/action, states nothing rolled, logs <slug>_refused', () => {
    const popup = buildNoTargetRefusalPopup({ monsterName: 'Adult Blue Dracolich 1', actionName: 'Frightful Presence' });
    expect(popup).toContain('mc-no-target-refusal');
    expect(popup).toContain('Adult Blue Dracolich 1 cannot use Frightful Presence');
    expect(popup).toContain('No save rolled, nothing spent.');

    const { timestamp, ...log } = buildNoTargetRefusalLog({ monsterName: 'Adult Blue Dracolich 1', actionName: 'Frightful Presence' });
    expect(timestamp).toEqual(expect.any(Number));
    expect(log).toMatchObject({
      type: 'automation',
      automationType: 'frightful_presence_refused',
      characterName: 'Adult Blue Dracolich 1',
      abilityName: 'Frightful Presence',
    });
  });

  it.each([
    ['punctuation/spaces collapse, edges trimmed', 'Tail Sweep (Recharge 5-6)', 'tail_sweep_recharge_5_6_refused'],
    ['missing actionName defaults to "action"', undefined, 'action_refused'],
  ])('slug normalization: %s', (_label, actionName, expectedSlug) => {
    expect(buildNoTargetRefusalLog({ monsterName: 'Hag 1', actionName }).automationType).toBe(expectedSlug);
  });
});

describe('buildCounterspellMessage — At-Will sentinel label (#517 discharge)', () => {
  const outcome = { auto: true, spellLevel: 2, countered: true, d20: 12, mod: 5, total: 17, targetDC: 15 };
  it('999 sentinel prints "At Will", never "999/Day"; finite limit keeps N/Day byte', () => {
    const atWill = buildCounterspellMessage({ monsterName: 'Hag 1', spellName: 'Magic Missile', outcome, limit: 999, remaining: 999 });
    expect(atWill).toContain('At Will · 999 left today.');
    expect(atWill).not.toContain('999/Day');
    const finite = buildCounterspellMessage({ monsterName: 'Archmage 1', spellName: 'Magic Missile', outcome, limit: 3, remaining: 0 });
    expect(finite).toContain('3/Day · 0 left today.');
  });
});
