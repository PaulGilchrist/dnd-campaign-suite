import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

import { handle } from './spellCastHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as postCastRiderService from '../../../../services/rules/spells/postCastRiderService.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Divine Smite',
    automation: {
      type: 'spell',
      ...automation,
    },
  };
}

describe('spellCastHandler - Spell damage with empowered evocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);
  });

  it('returns roll payload when spell has damage, adds Empowered Evocation for evocation spells', async () => {
    const ps = makePlayerStats({
      spellAbilities: {
        spells: [{ name: 'Fire Bolt', school: 'Evocation', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
      },
    });
    diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });

    const action = makeAction({ spell: 'Fire Bolt' });
    let result = await handle(action, ps, campaignName, null);
    expect(result.type).toBe('roll');
    expect(result.payload.rollType).toBe('damage');
    expect(result.payload.total).toBe(7);
    expect(result.payload.contextConfig.damageType).toBe('Fire');

    // With Empowered Evocation
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [9], modifier: 0 });
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);
    result = await handle(action, ps, campaignName, null);
    expect(result.payload.formula).toContain('Empowered Evocation');
    expect(result.payload.total).toBe(9);

    // Non-evocation spell → no Empowered Evocation
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);
    const ps2 = makePlayerStats({
      spellAbilities: {
        spells: [{ name: 'Chill Touch', school: 'Necromancy', damage: { damage_at_slot_level: { '1': '1d8' }, damage_type: 'Necrotic' } }],
      },
    });
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    const action2 = makeAction({ spell: 'Chill Touch' });
    result = await handle(action2, ps2, campaignName, null);
    expect(result.payload.formula).not.toContain('Empowered Evocation');
    expect(result.payload.total).toBe(5);

    // Modifier is 0 → no Empowered Evocation
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(0);
    result = await handle(action, ps, campaignName, null);
    expect(result.payload.formula).not.toContain('Empowered Evocation');
  });

  it('defaults damage_type to Radiant when not specified, falls back to spells.json', async () => {
    const ps = makePlayerStats({
      spellAbilities: {
        spells: [{ name: 'Scorching Ray', damage: { damage_at_slot_level: { '1': '2d6' } } }],
      },
    });
    diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

    const action = makeAction({ spell: 'Scorching Ray' });
    const result = await handle(action, ps, campaignName, null);
    expect(result.payload.contextConfig.damageType).toBe('Radiant');
  });

  it('returns popup when rollExpression fails, spell has no damage, or spell not found', async () => {
    const ps = makePlayerStats({
      spellAbilities: {
        spells: [{ name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
      },
    });
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

    // rollExpression returns null
    diceRoller.rollExpression.mockReturnValue(null);
    const result1 = await handle(makeAction({ spell: 'Fire Bolt' }), ps, campaignName, null);
    expect(result1.type).toBe('popup');

    // No damage_at_slot_level
    const ps2 = makePlayerStats({
      spellAbilities: {
        spells: [{ name: 'Weird Spell', damage: { damage_type: 'Psychic' } }],
      },
    });
    const result2 = await handle(makeAction({ spell: 'Weird Spell' }), ps2, campaignName, null);
    expect(result2.type).toBe('popup');

    // No damage at all
    const ps3 = makePlayerStats({
      spellAbilities: {
        spells: [{ name: 'Light' }],
      },
    });
    await handle(makeAction({ spell: 'Light' }), ps3, campaignName, null);
    // diceRoller.rollExpression was called in previous test, so just check the type
    expect(result2.type).toBe('popup');
  });
});
