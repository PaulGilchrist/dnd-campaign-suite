// @maintained-by-ai
// MA-0049: structured `usage` objects must render human text, never
// "[object Object]" (MV-26). OWNER lane: the formatActionUsage full branch
// truth table lives here — ma1120:12 and ma0305:14 delegate their "At Will"
// passthrough here (#530). monsterReactionUsesRemaining fresh/spend
// arithmetic is owned by gated-reaction.test.js:62-69 (#517) — no
// arithmetic legs here. d6-recharge shapes → null (RechargeNote owns the
// label); flat strings (incl. "At Will" sentinel) verbatim; "per day" →
// "N/Day"; unknown shapes console.error → null, never silent. Plus the
// no-target save-row refusal builders (sole pins suite-wide; the only
// consumer is MonsterCardModal.jsx). FIXED pass#336T: buildCounterspellMessage
// now prints "At Will" on 999-sentinels (finite limits keep "N/Day") —
// codified by the direct-call pin below.
import { describe, it, expect, vi } from 'vitest';
import { formatActionUsage, buildNoTargetRefusalPopup, buildNoTargetRefusalLog, buildCounterspellMessage } from './MonsterCardHelpers.js';

describe('MA-0049 formatActionUsage — owner truth table', () => {
  it.each([
    ['absent null → null', null, null],
    ['absent undefined → null', undefined, null],
    ['"At Will" sentinel passthrough verbatim (#530, delegated from ma1120)', 'At Will', 'At Will'],
    ['flat string verbatim', '1/Day', '1/Day'],
    ['d6 recharge → null (RechargeNote owns the label)', { type: 'recharge on roll', dice: '1d6', min_value: 5 }, null],
    ['rest recharge → null', { type: 'recharge after rest', rest_types: ['short', 'long'] }, null],
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

describe('MA-0049 no-target refusal builders', () => {
  it('popup names monster/action verbatim and states nothing rolled — exact template', () => {
    expect(buildNoTargetRefusalPopup({ monsterName: 'Adult Blue Dracolich 1', actionName: 'Frightful Presence' })).toBe(
      '<div class="mc-no-target-refusal"><h3>No Target</h3><p>Adult Blue Dracolich 1 cannot use Frightful Presence — no target is armed on Adult Blue Dracolich 1\'s initiative card. Arm a target on the initiative card first (AoE rows pick their own area targets). No save rolled, nothing spent.</p></div>'
    );
  });

  it('log is <action-slug>_refused — exact shape, "(no target)" zero-spend description', () => {
    const { timestamp, ...log } = buildNoTargetRefusalLog({ monsterName: 'Adult Blue Dracolich 1', actionName: 'Frightful Presence' });
    expect(timestamp).toEqual(expect.any(Number));
    expect(log).toEqual({
      type: 'automation',
      automationType: 'frightful_presence_refused',
      characterName: 'Adult Blue Dracolich 1',
      abilityName: 'Frightful Presence',
      description: 'Adult Blue Dracolich 1 Frightful Presence refused (no target) — no armed target on the initiative card, no self-resolve. Zero spend, no save prompt.',
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
