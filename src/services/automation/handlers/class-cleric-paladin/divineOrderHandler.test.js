import { describe, it, expect } from 'vitest';
import { handle } from './divineOrderHandler.js';

describe('divineOrderHandler', () => {
  describe('handle()', () => {
    it('should return an automation_info popup with the action name and description', async () => {
      const action = { name: 'Divine Order', description: 'A divine order ability' };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Divine Order',
          description: 'A divine order ability',
        },
      });
    });

    it('should fall back to "Divine Order" when description is missing or falsy', async () => {
      const action = { name: 'Custom Order', description: '' };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.payload.name).toBe('Custom Order');
      expect(result.payload.description).toBe('Divine Order');
    });

    it('should handle an empty action object without crashing', async () => {
      const result = await handle({}, {}, 'TestCampaign', 'TestMap');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Divine Order');
    });

    it('should return popup type regardless of playerStats', async () => {
      const action = { name: 'Divine Order' };
      const result = await handle(
        action,
        { name: 'TestCharacter', level: 5 },
        'TestCampaign',
        'TestMap',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should return popup type regardless of campaignName', async () => {
      const action = { name: 'Divine Order' };
      const result = await handle(action, {}, 'SomeCampaign', 'TestMap');

      expect(result.type).toBe('popup');
    });

    it('should return popup type regardless of mapName', async () => {
      const action = { name: 'Divine Order' };
      const result = await handle(action, {}, 'TestCampaign', 'DungeonMap');

      expect(result.type).toBe('popup');
    });

    it('should pass through action.name even when description is provided', async () => {
      const action = { name: 'Divine Order', description: 'A divine order ability' };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.payload.name).toBe('Divine Order');
      expect(result.payload.description).toBe('A divine order ability');
    });

    it('should handle null description by falling back to default', async () => {
      const action = { name: 'Custom Name', description: null };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.payload.name).toBe('Custom Name');
      expect(result.payload.description).toBe('Divine Order');
    });

    it('should handle undefined description by falling back to default', async () => {
      const action = { name: 'Custom Name' };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.payload.name).toBe('Custom Name');
      expect(result.payload.description).toBe('Divine Order');
    });

    it('should handle action with only name and no description key', async () => {
      const action = { name: 'Divine Order' };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Divine Order');
      expect(result.payload.description).toBe('Divine Order');
    });

    it('should use empty string description as default when description key exists but is empty', async () => {
      const action = { name: 'Divine Order', description: '' };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.payload.description).toBe('Divine Order');
    });

    it('should handle zero as description fallback (falsy value)', async () => {
      const action = { name: 'Custom', description: 0 };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.payload.description).toBe('Divine Order');
    });

    it('should handle false as description fallback (falsy value)', async () => {
      const action = { name: 'Custom', description: false };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.payload.description).toBe('Divine Order');
    });

    it('should preserve action properties not used by handler', async () => {
      const action = {
        name: 'Divine Order',
        description: 'Test desc',
        extraField: 'should not affect result',
        automation: { type: 'test' },
      };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Divine Order');
      expect(result.payload.description).toBe('Test desc');
    });

    it('should return a plain object result with correct structure', async () => {
      const action = { name: 'Divine Order' };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(typeof result.type).toBe('string');
      expect(typeof result.payload).toBe('object');
      expect(typeof result.payload.type).toBe('string');
      expect(typeof result.payload.name).toBe('string');
      expect(typeof result.payload.description).toBe('string');
    });

    it('should handle special characters in action name', async () => {
      const action = { name: 'Divine Order (Paladin)', description: 'A holy ability' };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result.payload.name).toBe('Divine Order (Paladin)');
      expect(result.payload.description).toBe('A holy ability');
    });
  });
});
