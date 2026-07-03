// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest';

// ── Imports ────────────────────────────────────────────────────

import { handle } from './resourcePoolHandler.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
  return {
    name: 'Resource Pool',
    description: 'A pool of resources',
    automation: { type: 'resource_pool' },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('resourcePoolHandler.handle', () => {
  describe('default resource pool modal', () => {
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

    it('should default description to empty string when action.description is undefined or null', async () => {
      const result = await handle({ name: 'Pool', automation: { type: 'resource_pool' } }, {}, 'campaign', 'map');
      expect(result.payload.description).toBe('');
    });

    it('should pass through automation object as-is including null', async () => {
      const action = { name: 'Pool', automation: null };
      const result = await handle(action, {}, 'campaign', 'map');
      expect(result.payload.automation).toBe(null);
    });

    it('should forward all action fields into the payload', async () => {
      const action = {
        name: 'Unique Pool',
        description: 'Custom description',
        automation: { type: 'resource_pool', max: 10, current: 5 },
      };
      const result = await handle(action, {}, 'campaign', 'map');

      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toBe(action.description);
      expect(result.payload.automation).toEqual(action.automation);
    });
  });

  describe('moonlight step conversion', () => {
    it('should return moonlightStepResource modal when conversion is spell_slot_to_moonlight_step', async () => {
      const action = {
        name: 'Moonlight Conversion',
        description: 'Convert spell slots to moonlight steps',
        automation: { type: 'resource_pool', conversion: 'spell_slot_to_moonlight_step', max: 20 },
      };
      const result = await handle(action, {}, 'campaign', 'map');

      expect(result).toEqual({
        type: 'modal',
        modalName: 'moonlightStepResource',
        payload: {
          name: 'Moonlight Conversion',
          description: 'Convert spell slots to moonlight steps',
          automation: { type: 'resource_pool', conversion: 'spell_slot_to_moonlight_step', max: 20 },
        },
      });
    });
  });

  describe('giant ancestry delegation', () => {
    it('should delegate to giantAncestryHandler when action.name is Giant Ancestry', async () => {
      const action = { name: 'Giant Ancestry', automation: { type: 'resource_pool' } };
      const result = await handle(action, { name: 'Hero' }, 'testCampaign', 'map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('giantAncestry');
    });

    it('should delegate to giantAncestryHandler when automation.type is giant_ancestry', async () => {
      const action = { name: 'Ancestry', automation: { type: 'giant_ancestry' } };
      const result = await handle(action, { name: 'Hero' }, 'testCampaign', 'map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('giantAncestry');
    });
  });

  describe('edge cases', () => {
    it('should return resourcePool modal when action has no automation and no giant ancestry indicators', async () => {
      const action = { name: 'Simple Pool' };
      const result = await handle(action, {}, 'campaign', 'map');

      expect(result).toEqual({
        type: 'modal',
        modalName: 'resourcePool',
        payload: {
          name: 'Simple Pool',
          description: '',
          automation: undefined,
        },
      });
    });

    it('should return resourcePool modal when automation.type is not giant_ancestry', async () => {
      const action = { name: 'Spell Slot Pool', automation: { type: 'spell_slot' } };
      const result = await handle(action, {}, 'campaign', 'map');

      expect(result.modalName).toBe('resourcePool');
      expect(result.payload.automation.type).toBe('spell_slot');
    });
  });
});
