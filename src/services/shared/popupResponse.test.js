// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { automationInfoPopup } from './popupResponse.js';

describe('automationInfoPopup', () => {
  it('should return a popup object with the correct top-level shape', () => {
    const action = {
      name: 'Fireball',
      description: 'A ball of fire.',
      automation: { type: 'damage_roll' },
    };

    const result = automationInfoPopup(action);

    expect(result).toHaveProperty('type', 'popup');
    expect(result).toHaveProperty('payload');
    expect(result.payload).toHaveProperty('type', 'automation_info');
  });

  it('should map action fields to the payload with correct keys', () => {
    const action = {
      name: 'Thunderwave',
      description: 'A wave of thunder.',
      automation: { type: 'save_roll', savingThrow: 'Constitution' },
    };

    const result = automationInfoPopup(action);

    expect(result.payload.name).toBe(action.name);
    expect(result.payload.automationType).toBe(action.automation.type);
    expect(result.payload.description).toBe(action.description);
    expect(result.payload.automation).toBe(action.automation);
  });

  it('should coerce falsy descriptions to empty string', () => {
    const base = { name: 'Action', automation: { type: 'misc' } };

    const result = automationInfoPopup({ ...base, description: undefined });
    expect(result.payload.description).toBe('');

    const resultNull = automationInfoPopup({ ...base, description: null });
    expect(resultNull.payload.description).toBe('');

    const resultZero = automationInfoPopup({ ...base, description: 0 });
    expect(resultZero.payload.description).toBe('');

    const resultFalse = automationInfoPopup({ ...base, description: false });
    expect(resultFalse.payload.description).toBe('');
  });

  it('should preserve truthy descriptions unchanged', () => {
    const result = automationInfoPopup({
      name: 'Magic Missile',
      description: 'Creates three glowing darts.',
      automation: { type: 'damage_roll' },
    });
    expect(result.payload.description).toBe('Creates three glowing darts.');
  });

  it('should preserve name as-is including empty string and null', () => {
    const base = { automation: { type: 'test' } };

    expect(automationInfoPopup({ ...base, name: '' }).payload.name).toBe('');
    expect(automationInfoPopup({ ...base, name: null }).payload.name).toBeNull();
    expect(automationInfoPopup(base).payload.name).toBeUndefined();
  });

  it('should pass the automation object by reference', () => {
    const automation = { type: 'attack_roll', weapon: 'Longsword', damage: '1d8+3' };
    const result = automationInfoPopup({ name: 'Melee Attack', automation });
    expect(result.payload.automation).toBe(automation);
  });

  it('should return a new object that does not share references with the input', () => {
    const action = { name: 'New', automation: { type: 'test' }, description: '' };
    const result = automationInfoPopup(action);
    expect(result).not.toBe(action);
    expect(result.payload).not.toBe(action);
  });

  it('should throw when automation is missing', () => {
    expect(() => automationInfoPopup({ name: 'Test' })).toThrow();
  });

  it('should throw when automation is null', () => {
    expect(() => automationInfoPopup({ name: 'Test', automation: null })).toThrow();
  });
});
