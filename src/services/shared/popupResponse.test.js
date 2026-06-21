// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { automationInfoPopup } from './popupResponse.js';

describe('automationInfoPopup', () => {
  describe('return structure', () => {
    it('should return a popup type with automation_info payload type', () => {
      const result = automationInfoPopup({
        name: 'Fireball',
        description: 'A ball of fire.',
        automation: { type: 'damage_roll' },
      });

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fireball',
          automationType: 'damage_roll',
          description: 'A ball of fire.',
          automation: { type: 'damage_roll' },
        },
      });
    });
  });

  describe('name mapping', () => {
    it('should pass through action.name to payload.name', () => {
      const result = automationInfoPopup({
        name: 'Thunderwave',
        automation: { type: 'save_roll' },
      });
      expect(result.payload.name).toBe('Thunderwave');
    });

    it('should pass undefined name through as undefined', () => {
      const result = automationInfoPopup({
        automation: { type: 'test_type' },
      });
      expect(result.payload.name).toBeUndefined();
    });

    it('should pass null name through as null', () => {
      const result = automationInfoPopup({
        name: null,
        automation: { type: 'test_type' },
      });
      expect(result.payload.name).toBeNull();
    });

    it('should pass empty string name through as empty string', () => {
      const result = automationInfoPopup({
        name: '',
        automation: { type: 'test_type' },
      });
      expect(result.payload.name).toBe('');
    });
  });

  describe('automationType mapping', () => {
    it('should extract automation.type as payload.automationType', () => {
      const result = automationInfoPopup({
        name: 'Action Surge',
        automation: { type: 'extra_action' },
      });
      expect(result.payload.automationType).toBe('extra_action');
    });

    it('should handle nested automation objects', () => {
      const automation = {
        type: 'custom',
        params: { depth: [{ nested: true }] },
        extra: [1, 2, 3],
      };
      const result = automationInfoPopup({
        name: 'Complex',
        automation,
      });
      expect(result.payload.automationType).toBe('custom');
      expect(result.payload.automation).toBe(automation);
    });
  });

  describe('description mapping', () => {
    it('should pass through a truthy description', () => {
      const result = automationInfoPopup({
        name: 'Magic Missile',
        description: 'Creates three glowing darts.',
        automation: { type: 'damage_roll' },
      });
      expect(result.payload.description).toBe('Creates three glowing darts.');
    });

    it('should coerce falsy descriptions to empty string', () => {
      const falsyValues = [undefined, null, '', 0, false];
      const base = { name: 'Action', automation: { type: 'misc' } };

      for (const desc of falsyValues) {
        const result = automationInfoPopup({ ...base, description: desc });
        expect(result.payload.description).toBe('');
      }
    });

    it('should pass through a numeric string description', () => {
      const result = automationInfoPopup({
        name: 'Numeric Desc',
        description: '42',
        automation: { type: 'misc' },
      });
      expect(result.payload.description).toBe('42');
    });
  });

  describe('automation passthrough', () => {
    it('should pass the automation object reference through unchanged', () => {
      const automation = { type: 'attack_roll', weapon: 'Longsword', damage: '1d8+3' };
      const result = automationInfoPopup({
        name: 'Melee Attack',
        automation,
      });
      expect(result.payload.automation).toBe(automation);
    });
  });

  describe('output immutability', () => {
    it('should return a new object, not the input', () => {
      const action = {
        name: 'New',
        automation: { type: 'test' },
        description: '',
      };
      const result = automationInfoPopup(action);
      expect(result).not.toBe(action);
      expect(result.payload).not.toBe(action);
    });
  });

  describe('error handling', () => {
    it('should throw when automation is undefined', () => {
      expect(() => automationInfoPopup({ name: 'Test' })).toThrow('Cannot read properties of undefined');
    });

    it('should throw when automation is null', () => {
      expect(() => automationInfoPopup({ name: 'Test', automation: null })).toThrow('Cannot read properties of null');
    });
  });
});
