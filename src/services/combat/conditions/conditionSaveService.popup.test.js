// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect } from 'vitest';

// ── Imports ──────────────────────────────────────────────────────

import { buildConditionPopup } from './conditionSaveService.js';

// ── Tests ────────────────────────────────────────────────────────

describe('buildConditionPopup', () => {
  it('returns a popup object with all expected fields', () => {
    const popup = buildConditionPopup({ roll: 15, bonus: 5, bonusDetail: '+3 aura from Paladin', abilityLabel: 'Wisdom', conditionLabel: 'Charmed', dc: 18, success: true });

    expect(popup).toEqual({
      type: 'd20',
      rollType: 'condition-save',
      name: 'Wisdom',
      rolls: [15],
      bonus: 5,
      bonusDetail: '+3 aura from Paladin',
      targetName: null,
      targetAc: null,
      hit: undefined,
      condition: 'Charmed',
      dc: 18,
      success: true,
    });
  });

  it('handles failure, null/undefined bonusDetail, and negative bonus', () => {
    let popup = buildConditionPopup({ roll: 5, bonus: 2, bonusDetail: undefined, abilityLabel: 'Strength', conditionLabel: 'Grappled', dc: 14, success: false });
    expect(popup.success).toBe(false);
    expect(popup.rollType).toBe('condition-save');
    expect(popup.hit).toBeUndefined();

    popup = buildConditionPopup({ roll: 10, bonus: 0, bonusDetail: null, abilityLabel: 'Constitution', conditionLabel: 'Paralyzed', dc: 12, success: true });
    expect(popup.bonusDetail).toBeNull();

    popup = buildConditionPopup({ roll: 8, bonus: 3, bonusDetail: undefined, abilityLabel: 'Dexterity', conditionLabel: 'Blinded', dc: 11, success: false });
    expect(popup.bonusDetail).toBeUndefined();

    popup = buildConditionPopup({ roll: 1, bonus: -3, bonusDetail: 'detail', abilityLabel: 'Charisma', conditionLabel: 'Frightened', dc: 5, success: false });
    expect(popup.targetName).toBeNull();
    expect(popup.targetAc).toBeNull();
  });

  it('wraps the roll value in a rolls array', () => {
    const popup = buildConditionPopup({ roll: 7, bonus: 0, bonusDetail: undefined, abilityLabel: 'Wisdom', conditionLabel: 'Cursed', dc: 10, success: false });
    expect(Array.isArray(popup.rolls)).toBe(true);
    expect(popup.rolls).toEqual([7]);
  });
});
