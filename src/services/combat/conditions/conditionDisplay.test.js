// @maintained-by-ai 2026-11-19
// Canon for the shared badge/tone DISPLAY helpers (roadmap Item 6): the
// label capitalization contract (moved from gm-screen/partyRowData.js), the
// invisible-as-buff condition tone law, the registry-cls semantic fold
// (moved from ConditionEffectBadges.jsx) and the map chip glyph rule.
// Consumers (ConditionEffectBadges, StatusBadges, CharConditions,
// tokenStatus) pin their own usage in their own lanes.
import { describe, it, expect } from 'vitest';
import {
  resolveEffectTone,
  conditionTone,
  conditionLabel,
  normalizeConditionKeys,
} from './conditionDisplay.js';

describe('resolveEffectTone', () => {
  it('folds the four alias cls values onto their semantic tone', () => {
    expect(resolveEffectTone('effect-stealth-attack')).toBe('effect-neutral');
    expect(resolveEffectTone('effect-speed-zero')).toBe('effect-debuff');
    expect(resolveEffectTone('effect-target-disadv')).toBe('effect-buff');
    expect(resolveEffectTone('effect-cannot-act')).toBe('effect-debuff');
  });

  it('passes every other cls through untouched (CreatureBadge.css styles the aliases)', () => {
    for (const cls of ['effect-buff', 'effect-debuff', 'effect-neutral', 'effect-condition',
      'effect-disadvantage', 'effect-target-adv', 'effect-bless', 'effect-auto-crit',
      'effect-summoned', 'effect-charm']) {
      expect(resolveEffectTone(cls)).toBe(cls);
    }
  });

  it('is honest about undefined (no fabricated tone)', () => {
    expect(resolveEffectTone(undefined)).toBe(undefined);
  });
});

describe('conditionTone', () => {
  it('renders Invisible as a buff and every other condition with the red condition tone', () => {
    expect(conditionTone('invisible')).toBe('effect-buff');
    expect(conditionTone('INVISIBLE')).toBe('effect-buff');
    expect(conditionTone('prone')).toBe('effect-condition');
    expect(conditionTone('poisoned')).toBe('effect-condition');
    expect(conditionTone('petrified')).toBe('effect-condition');
  });
});

describe('conditionLabel', () => {
  it('capitalizes and translates the speed_zero special case', () => {
    expect(conditionLabel('poisoned')).toBe('Poisoned');
    expect(conditionLabel('speed_zero')).toBe('Speed 0');
  });
});

describe('normalizeConditionKeys', () => {
  it('dedupes strings and object keys alike', () => {
    expect(normalizeConditionKeys(['poisoned', 'poisoned', { key: 'prone' }, null]))
      .toEqual(['poisoned', 'prone']);
    expect(normalizeConditionKeys(undefined)).toEqual([]);
    expect(normalizeConditionKeys('not-an-array')).toEqual([]);
  });
});
