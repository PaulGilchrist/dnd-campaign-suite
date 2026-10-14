import { describe, it, expect } from 'vitest';

import { handle } from './resourcePoolHandler.js';

function makeAction(overrides = {}) {
  return {
    name: 'Resource Pool',
    description: 'A pool of resources',
    automation: { type: 'resource_pool' },
    ...overrides,
  };
}

describe('resourcePoolHandler.handle', () => {
  describe('default resourcePool modal', () => {
    it('should return a modal with resourcePool name and action fields in payload', async () => {
      const action = makeAction();
      const result = await handle(action, {}, 'campaign', 'map');

      expect(result).toEqual({
        type: 'modal',
        modalName: 'resourcePool',
        payload: {
          name: 'Resource Pool',
          description: 'A pool of resources',
          automation: { type: 'resource_pool' },
        },
      });
    });

    it('should default description to empty string and pass through automation as-is', async () => {
      const resultNull = await handle({ name: 'Pool', automation: null }, {}, 'campaign', 'map');
      expect(resultNull.payload.description).toBe('');
      expect(resultNull.payload.automation).toBe(null);

      const resultUndefined = await handle({ name: 'Pool' }, {}, 'campaign', 'map');
      expect(resultUndefined.payload.description).toBe('');
      expect(resultUndefined.payload.automation).toBe(undefined);
    });
  });

  describe('moonlightStepResource modal for spell_slot_to_moonlight_step conversion', () => {
    it('should return moonlightStepResource modal when conversion is spell_slot_to_moonlight_step, resourcePool for empty/undefined conversion', async () => {
      const moonlightAction = {
        name: 'Moonlight Conversion',
        description: 'Convert spell slots to moonlight steps',
        automation: { type: 'resource_pool', conversion: 'spell_slot_to_moonlight_step', max: 20 },
      };
      const moonlightResult = await handle(moonlightAction, {}, 'campaign', 'map');
      expect(moonlightResult.modalName).toBe('moonlightStepResource');
      expect(moonlightResult.payload.automation.conversion).toBe('spell_slot_to_moonlight_step');

      const emptyAction = { name: 'Pool', automation: { type: 'resource_pool', conversion: '' } };
      const emptyResult = await handle(emptyAction, {}, 'campaign', 'map');
      expect(emptyResult.modalName).toBe('resourcePool');

      const undefinedAction = { name: 'Pool', automation: { type: 'resource_pool' } };
      const undefinedResult = await handle(undefinedAction, {}, 'campaign', 'map');
      expect(undefinedResult.modalName).toBe('resourcePool');
    });
  });

  describe('giantAncestry delegation', () => {
    it('should delegate to giantAncestryHandler when action.name is Giant Ancestry', async () => {
      const action = { name: 'Giant Ancestry', automation: { type: 'resource_pool' } };
      const result = await handle(action, { name: 'Hero' }, 'testCampaign', 'map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('giantAncestry');
      expect(result.payload).toBeDefined();
    });

    it('should delegate to giantAncestryHandler when automation.type is giant_ancestry', async () => {
      const action = { name: 'Ancestry', automation: { type: 'giant_ancestry' } };
      const result = await handle(action, { name: 'Hero' }, 'testCampaign', 'map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('giantAncestry');
      expect(result.payload).toBeDefined();
    });
  });

  describe('non-giant_ancestry automation types', () => {
    it('should return resourcePool modal when automation.type is not giant_ancestry', async () => {
      const action = { name: 'Spell Slot Pool', automation: { type: 'spell_slot' } };
      const result = await handle(action, {}, 'campaign', 'map');

      expect(result.modalName).toBe('resourcePool');
      expect(result.payload.automation.type).toBe('spell_slot');
    });
  });

  describe('minimal and edge-case actions', () => {
    it('should return resourcePool modal with empty action object', async () => {
      const result = await handle({}, {}, 'campaign', 'map');

      expect(result.modalName).toBe('resourcePool');
      expect(result.payload.name).toBe(undefined);
      expect(result.payload.description).toBe('');
      expect(result.payload.automation).toBe(undefined);
    });
  });
});
