// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { handle } from './divineOrderHandler.js';

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'TestMap';

function makeAction(overrides = {}) {
  return {
    name: 'Divine Order',
    description: 'A divine order ability',
    ...overrides,
  };
}

describe('divineOrderHandler', () => {
  describe('handle()', () => {
    it('should return a popup automation_info result', async () => {
      const action = makeAction();
      const result = await handle(action, {}, CAMPAIGN_NAME, MAP_NAME);

      expect(result).toEqual({
        type: 'popup',
        payload: expect.objectContaining({
          type: 'automation_info',
        }),
      });
    });

    it('should echo action.name into the popup payload', async () => {
      const action = makeAction({ name: 'Custom Divine Order' });
      const result = await handle(action, {}, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.name).toBe('Custom Divine Order');
    });

    it('should echo the action description into the popup payload', async () => {
      const action = makeAction({ description: 'Custom description' });
      const result = await handle(action, {}, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.description).toBe('Custom description');
    });

    it('should fall back to "Divine Order" when description is missing or falsy', async () => {
      const result = await handle(makeAction({ description: undefined }), {}, CAMPAIGN_NAME, MAP_NAME);
      expect(result.payload.description).toBe('Divine Order');
    });

    it('should fall back to "Divine Order" when description is an empty string', async () => {
      const result = await handle(makeAction({ description: '' }), {}, CAMPAIGN_NAME, MAP_NAME);
      expect(result.payload.description).toBe('Divine Order');
    });

    it('should return the same popup regardless of playerStats, campaignName, or mapName', async () => {
      const action = makeAction();
      const playerStats = { name: 'TestPlayer', level: 5 };
      const result = await handle(action, playerStats, 'MyCampaign', 'Dungeon1');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toBe(action.description);
    });

    it('should return a valid popup even when the action object is empty', async () => {
      const result = await handle({}, {}, CAMPAIGN_NAME, MAP_NAME);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Divine Order');
    });
  });
});
