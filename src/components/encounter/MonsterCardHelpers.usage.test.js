// MA-0049: structured `usage` objects must render human text, never
// "[object Object]" (MV-26). d6-recharge shapes are owned by RechargeNote
// (null here); "per day" → "N/Day"; flat strings verbatim. Plus the
// no-target save-row refusal builders.
import { describe, it, expect } from 'vitest';
import { formatActionUsage, buildNoTargetRefusalPopup, buildNoTargetRefusalLog } from './MonsterCardHelpers.js';

describe('MA-0049 formatActionUsage', () => {
  it('flat string verbatim; null for absent', () => {
    expect(formatActionUsage('1/Day')).toBe('1/Day');
    expect(formatActionUsage(null)).toBeNull();
  });

  it('recharge shapes return null (RechargeNote owns the label)', () => {
    expect(formatActionUsage({ type: 'recharge on roll', dice: '1d6', min_value: 5 })).toBeNull();
    expect(formatActionUsage({ type: 'recharge after rest', rest_types: ['short', 'long'] })).toBeNull();
  });

  it('"per day" object formats as "N/Day"', () => {
    expect(formatActionUsage({ type: 'per day', times: 3 })).toBe('3/Day');
  });
});

describe('MA-0049 no-target refusal builders', () => {
  it('popup names monster/action and states nothing rolled', () => {
    const html = buildNoTargetRefusalPopup({ monsterName: 'Adult Blue Dracolich 1', actionName: 'Frightful Presence' });
    expect(html).toContain('No Target');
    expect(html).toContain('Adult Blue Dracolich 1');
    expect(html).toContain('Frightful Presence');
    expect(html).toContain('No save rolled, nothing spent.');
  });

  it('log is <action>_refused with "(no target)" description', () => {
    const log = buildNoTargetRefusalLog({ monsterName: 'Adult Blue Dracolich 1', actionName: 'Frightful Presence' });
    expect(log.type).toBe('automation');
    expect(log.automationType).toBe('frightful_presence_refused');
    expect(log.characterName).toBe('Adult Blue Dracolich 1');
    expect(log.description).toMatch(/refused \(no target\)/);
  });
});
