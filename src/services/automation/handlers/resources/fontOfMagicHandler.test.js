import { describe, it, expect } from 'vitest';

import { handle } from './fontOfMagicHandler.js';

// ── Tests ────────────────────────────────────────────────────────

describe('fontOfMagicHandler.handle', () => {
  it('should return a modal result with type "modal", modalName "fontOfMagic", and empty payload', async () => {
    const result = await handle();

    expect(result).toEqual({
      type: 'modal',
      modalName: 'fontOfMagic',
      payload: {},
    });
  });

  it('should return the same modal structure regardless of input parameters', async () => {
    const action = {
      name: 'Custom Font of Magic',
      automation: { type: 'font_of_magic', custom: 'data' },
    };
    const playerStats = {
      name: 'Sorcerer',
      level: 17,
      rules: '2024',
      class: { class_levels: [{ level: 17, class_specific: {} }] },
      spellAbilities: { spell_slots_level_1: 4 },
    };

    const result = await handle(
      action,
      playerStats,
      'MyCampaign',
      'combat-map',
    );

    expect(result).toEqual({
      type: 'modal',
      modalName: 'fontOfMagic',
      payload: {},
    });
  });

  it('should return the same modal structure when all parameters are null or undefined', async () => {
    const result = await handle(null, null, null, null);

    expect(result).toEqual({
      type: 'modal',
      modalName: 'fontOfMagic',
      payload: {},
    });
  });

  it('should return identical results across multiple invocations', async () => {
    const result1 = await handle();
    const result2 = await handle({}, {}, 'campaign', 'map');
    const result3 = await handle(null, null, null, null);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });
});
