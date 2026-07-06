// @cleaned-by-ai
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
  });
});
