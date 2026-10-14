import { describe, it, expect } from 'vitest';
import { automationInfoPopup } from './popupResponse.js';

describe('automationInfoPopup', () => {
  it('returns a popup response with automation_info type', () => {
    const action = {
      name: 'Fire Bolt',
      description: 'A bolt of fire',
      automation: { type: 'spell_attack' },
    };

    const result = automationInfoPopup(action);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
  });

  it('maps action fields into the payload', () => {
    const action = {
      name: 'Fire Bolt',
      description: 'A bolt of fire',
      automation: { type: 'spell_attack', damage: '1d10' },
    };

    const result = automationInfoPopup(action);

    expect(result.payload.name).toBe('Fire Bolt');
    expect(result.payload.automationType).toBe('spell_attack');
    expect(result.payload.description).toBe('A bolt of fire');
    expect(result.payload.automation).toEqual({ type: 'spell_attack', damage: '1d10' });
  });

  it('coerces falsy descriptions to empty string', () => {
    const base = { name: 'Test', automation: { type: 'misc' } };

    expect(automationInfoPopup({ ...base, description: undefined }).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: null }).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: 0 }).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: false }).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: '' }).payload.description).toBe('');
  });

  it('preserves truthy descriptions', () => {
    const base = { name: 'Test', automation: { type: 'misc' } };

    expect(automationInfoPopup({ ...base, description: 42 }).payload.description).toBe(42);
    expect(automationInfoPopup({ ...base, description: '  ' }).payload.description).toBe('  ');
  });

  it('handles missing description field', () => {
    const action = { name: 'Test', automation: { type: 'misc' } };

    const result = automationInfoPopup(action);

    expect(result.payload.description).toBe('');
  });

  it('handles action.automation with no type field', () => {
    const action = { name: 'Test', automation: {} };

    const result = automationInfoPopup(action);

    expect(result.payload.automationType).toBeUndefined();
  });
});
