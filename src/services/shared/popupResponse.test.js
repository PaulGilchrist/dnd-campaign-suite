import { describe, it, expect } from 'vitest';
import { automationInfoPopup } from './popupResponse.js';

describe('automationInfoPopup', () => {
  it('should return an object with type "popup"', () => {
    const result = automationInfoPopup({
      name: 'Fireball',
      description: 'A ball of fire shoots from your fingertips.',
      automation: { type: 'damage_roll', dice: '8d6' },
    });
    expect(result.type).toBe('popup');
  });

  it('should return a payload with type "automation_info"', () => {
    const result = automationInfoPopup({
      name: 'Healing Word',
      description: '',
      automation: { type: 'heal_roll' },
    });
    expect(result.payload.type).toBe('automation_info');
  });

  it('should set payload.name from action.name when provided', () => {
    const result = automationInfoPopup({
      name: 'Thunderwave',
      description: '',
      automation: { type: 'save_roll' },
    });
    expect(result.payload.name).toBe('Thunderwave');
  });

  it('should set payload.automationType from action.automation.type', () => {
    const result = automationInfoPopup({
      name: 'Action Surge',
      description: '',
      automation: { type: 'extra_action' },
    });
    expect(result.payload.automationType).toBe('extra_action');
  });

  it('should set payload.description from action.description when truthy', () => {
    const result = automationInfoPopup({
      name: 'Magic Missile',
      description: 'Creates three glowing darts.',
      automation: { type: 'damage_roll' },
    });
    expect(result.payload.description).toBe('Creates three glowing darts.');
  });

  it('should default payload.description to "" when action.description is undefined', () => {
    const result = automationInfoPopup({
      name: 'Jump',
      automation: { type: 'misc' },
    });
    expect(result.payload.description).toBe('');
  });

  it('should default payload.description to "" when action.description is null', () => {
    const result = automationInfoPopup({
      name: 'Dash',
      description: null,
      automation: { type: 'misc' },
    });
    expect(result.payload.description).toBe('');
  });

  it('should default payload.description to "" when action.description is an empty string', () => {
    const result = automationInfoPopup({
      name: 'Disengage',
      description: '',
      automation: { type: 'misc' },
    });
    expect(result.payload.description).toBe('');
  });

  it('should default payload.description to "" when action.description is 0', () => {
    const result = automationInfoPopup({
      name: 'Some Action',
      description: 0,
      automation: { type: 'misc' },
    });
    expect(result.payload.description).toBe('');
  });

  it('should default payload.description to "" when action.description is false', () => {
    const result = automationInfoPopup({
      name: 'False Action',
      description: false,
      automation: { type: 'misc' },
    });
    expect(result.payload.description).toBe('');
  });

  it('should pass through action.automation as the payload.automation object', () => {
    const automation = { type: 'attack_roll', weapon: 'Longsword', damage: '1d8+3' };
    const result = automationInfoPopup({
      name: 'Melee Attack',
      description: '',
      automation,
    });
    expect(result.payload.automation).toBe(automation);
  });

  it('should include the automation object even with no description and minimal fields', () => {
    const result = automationInfoPopup({
      name: 'Minimal',
      automation: { type: 'simple' },
    });
    expect(result.payload.automation).toEqual({ type: 'simple' });
  });

  it('should handle when action.name is undefined', () => {
    const result = automationInfoPopup({
      automation: { type: 'test_type' },
      description: 'A test action.',
    });
    expect(result.payload.name).toBeUndefined();
  });

  it('should handle when action.name is null', () => {
    const result = automationInfoPopup({
      name: null,
      automation: { type: 'test_type' },
      description: '',
    });
    expect(result.payload.name).toBeNull();
  });

  it('should handle when action.name is an empty string', () => {
    const result = automationInfoPopup({
      name: '',
      automation: { type: 'test_type' },
      description: '',
    });
    expect(result.payload.name).toBe('');
  });

  it('should handle a fully populated action object end-to-end', () => {
    const action = {
      name: 'Fireball',
      description:
        'A bright streak flashes from your fingertips to the point you can designate, where it erupts in a burst of flame.',
      automation: {
        type: 'damage_roll',
        dice: '8d6',
        damageType: 'fire',
        save: 'dex',
        halfOnSave: true,
      },
    };

    const result = automationInfoPopup(action);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Fireball');
    expect(result.payload.automationType).toBe('damage_roll');
    expect(result.payload.description).toContain('flame');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('should pass through complex nested automation objects', () => {
    const automation = {
      type: 'custom',
      params: { depth: [{ nested: true }] },
      extra: [1, 2, 3],
    };
    const result = automationInfoPopup({
      name: 'Complex',
      description: '',
      automation,
    });
    expect(result.payload.automation.params.depth[0].nested).toBe(true);
    expect(result.payload.automation.extra).toEqual([1, 2, 3]);
    expect(result.payload.automationType).toBe('custom');
  });

  it('should handle undefined action.name still returning valid structure', () => {
    const result = automationInfoPopup({
      automation: { type: 'spell_slot' },
    });
    expect(result.type).toBe('popup');
    expect(result.payload).toBeTruthy();
    expect(result.payload.automationType).toBe('spell_slot');
  });

  it('should handle action with extra properties unchanged in output', () => {
    const action = {
      name: 'Test',
      description: 'desc',
      automation: { type: 'roll' },
      extraProp: 'retained',
    };
    const result = automationInfoPopup(action);
    expect(result.payload.name).toBe('Test');
    // The function doesn't copy extra properties, but it shouldn't error
    expect(result.type).toBe('popup');
  });

  it('should always create a new return object (not the input)', () => {
    const action = {
      name: 'New',
      automation: { type: 'test' },
      description: '',
    };
    const result = automationInfoPopup(action);
    expect(result).not.toBe(action);
  });

  it('should pass through the full automation object reference', () => {
    const action = {
      name: 'Ref',
      automation: { type: 'buff' },
      description: 'A buff.',
    };
    const result = automationInfoPopup(action);
    expect(result.payload.automation).toBe(action.automation);
  });

  it('should handle when action.description is a number string that is truthy', () => {
    const result = automationInfoPopup({
      name: 'Numeric Desc',
      description: '42',
      automation: { type: 'misc' },
    });
    expect(result.payload.description).toBe('42');
  });
});
