// @maintained-by-ai
// Divine Order is an info-only automation: handle() echoes the action into an
// automation_info popup, falls back to "Divine Order" for falsy descriptions, and
// ignores playerStats/campaignName/mapName (pure, no side effects). This suite pins
// that output contract and only needs editing if the handler's shape intentionally changes.
import { describe, it, expect } from 'vitest';
import { handle } from './divineOrderHandler.js';

describe('divineOrderHandler', () => {
  describe('handle()', () => {
    it('returns an automation_info popup echoing the action name and description', async () => {
      const action = { name: 'Divine Order (Paladin)', description: 'A holy ability' };
      const result = await handle(action, {}, 'TestCampaign', 'TestMap');

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Divine Order (Paladin)',
          description: 'A holy ability',
        },
      });
    });

    it.each([
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
      ['zero', 0],
      ['false', false],
    ])('falls back to "Divine Order" description when description is %s', async (_label, description) => {
      const result = await handle({ name: 'Custom Order', description }, {}, 'TestCampaign', 'TestMap');

      expect(result.payload.name).toBe('Custom Order');
      expect(result.payload.description).toBe('Divine Order');
    });

    it('ignores playerStats, campaignName, and mapName', async () => {
      const action = { name: 'Divine Order', description: 'A divine order ability' };
      const baseline = await handle(action, {}, 'TestCampaign', 'TestMap');
      const varied = await handle(
        action,
        { name: 'TestCharacter', level: 5 },
        'SomeCampaign',
        'DungeonMap',
      );

      expect(varied).toEqual(baseline);
    });

    it('handles an empty action object without crashing', async () => {
      const result = await handle({}, {}, 'TestCampaign', 'TestMap');

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: undefined,
          description: 'Divine Order',
        },
      });
    });
  });
});
