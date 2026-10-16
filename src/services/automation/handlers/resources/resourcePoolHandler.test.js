// @maintained-by-ai
// resourcePoolHandler — generic resource-pool modal-opener lane (router maps
// automation.type 'resource_pool' here; index.js owns that registration).
//
// This file OWNS:
// - full-shape default resourcePool modal contract (exact keys, exact values).
// - description default ('') and automation pass-through by reference
//   (identity: toBe, not toEqual) for null/missing automation.
// - the moonlightStepResource conversion branch: conversion
//   'spell_slot_to_moonlight_step' → moonlightStepResource modal; empty /
//   undefined conversion falls through to the default modal.
// - giantAncestry delegation guards (action.name === 'Giant Ancestry' OR
//   automation.type === 'giant_ancestry'): the delegate is MOCKED here so the
//   pin is exactly "handed the same four args, result returned verbatim" —
//   giantAncestry's internals and selection-modal payload are owned by
//   giantAncestry-selection.test.js, never re-pinned here.
//
// Deterministic: pure handler behaviour over literal inputs, mocked delegate,
// no timers, no DOM, no network.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../class-other/giantAncestryHandler.js', () => ({
  handle: vi.fn(async () => ({
    type: 'modal',
    modalName: 'giantAncestry',
    payload: { delegated: 'sentinel' },
  })),
}));

import { handle } from './resourcePoolHandler.js';
import { handle as handleGiantAncestry } from '../class-other/giantAncestryHandler.js';

const DELEGATED_RESULT = {
  type: 'modal',
  modalName: 'giantAncestry',
  payload: { delegated: 'sentinel' },
};

function makeAction(overrides = {}) {
  const { automation, ...rest } = overrides;
  const base = {
    name: 'Resource Pool',
    description: 'A pool of resources',
    automation: { type: 'resource_pool' },
  };
  // MERGE automation overrides (null/non-object replaces wholesale) so a
  // partial automation never loses the base type.
  if (automation === null || typeof automation !== 'object') {
    return { ...base, ...overrides };
  }
  return { ...base, ...rest, automation: { ...base.automation, ...automation } };
}

describe('resourcePoolHandler.handle', () => {
  it('returns the full-shape default resourcePool modal', async () => {
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

  it('defaults description to empty string and passes automation through by reference', async () => {
    const nullAutomation = { name: 'Pool', automation: null };
    const nullResult = await handle(nullAutomation, {}, 'campaign', 'map');
    expect(nullResult.modalName).toBe('resourcePool');
    expect(nullResult.payload.description).toBe('');
    expect(nullResult.payload.automation).toBe(nullAutomation.automation);

    const missingAutomation = { name: 'Pool' };
    const missingResult = await handle(missingAutomation, {}, 'campaign', 'map');
    expect(missingResult.payload.name).toBe('Pool');
    expect(missingResult.payload.description).toBe('');
    expect(missingResult.payload.automation).toBe(undefined);

    // Fully empty action still yields the exact default modal shape.
    const emptyResult = await handle({}, {}, 'campaign', 'map');
    expect(emptyResult).toEqual({
      type: 'modal',
      modalName: 'resourcePool',
      payload: { name: undefined, description: '', automation: undefined },
    });
  });

  describe('spell_slot_to_moonlight_step conversion', () => {
    it('opens the moonlightStepResource modal with full payload shape', async () => {
      const action = makeAction({
        name: 'Moonlight Conversion',
        description: 'Convert spell slots to moonlight steps',
        automation: { conversion: 'spell_slot_to_moonlight_step', max: 20 },
      });
      const result = await handle(action, {}, 'campaign', 'map');

      expect(result).toEqual({
        type: 'modal',
        modalName: 'moonlightStepResource',
        payload: {
          name: 'Moonlight Conversion',
          description: 'Convert spell slots to moonlight steps',
          automation: {
            type: 'resource_pool',
            conversion: 'spell_slot_to_moonlight_step',
            max: 20,
          },
        },
      });
    });

    it('falls through to the default resourcePool modal for empty or undefined conversion', async () => {
      const emptyResult = await handle(
        { name: 'Pool', automation: { type: 'resource_pool', conversion: '' } },
        {},
        'campaign',
        'map',
      );
      expect(emptyResult.modalName).toBe('resourcePool');

      const undefinedResult = await handle(
        { name: 'Pool', automation: { type: 'resource_pool' } },
        {},
        'campaign',
        'map',
      );
      expect(undefinedResult.modalName).toBe('resourcePool');
    });
  });

  describe('giantAncestry delegation', () => {
    const GUARDS = [
      ['action.name', { name: 'Giant Ancestry', automation: { type: 'resource_pool' } }],
      ['automation.type', { name: 'Ancestry', automation: { type: 'giant_ancestry' } }],
    ];

    it.each(GUARDS)('delegates untouched to giantAncestryHandler via %s guard', async (_label, action) => {
      const playerStats = { name: 'Hero' };
      const result = await handle(action, playerStats, 'testCampaign', 'map');

      expect(handleGiantAncestry).toHaveBeenCalledWith(action, playerStats, 'testCampaign', 'map');
      expect(result).toEqual(DELEGATED_RESULT);
      expect(result.payload).not.toHaveProperty('description');
    });
  });
});
