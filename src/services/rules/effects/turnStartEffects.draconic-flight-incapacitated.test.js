// @improved-by-ai
// BUG CLA-096 lock: turn-start Incapacitated clause for Draconic Flight
// (Wrath of the Sea / Cloak of Shadows verified lane shape).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { getName: vi.fn((val) => String(val)) },
}));

vi.mock('../../ui/storage.js', () => ({
  default: { set: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  getActiveCreatureName: vi.fn(() => 'DragonbornTest'),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => (typeof expr === 'number' ? expr : 1)),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../automation/handlers/spells/confusionTurnStartHandler.js', () => ({
  handleConfusionTurnStart: vi.fn(),
}));

vi.mock('../../rules/features/infernalWoundService.js', () => ({
  applyInfernalWoundBleedTurnStart: vi.fn(),
}));

vi.mock('../features/whirlwindService.js', () => ({
  applyWhirlwindTurnStart: vi.fn(),
}));

vi.mock('../../encounters/monsterLegendaryUses.js', () => ({
  regainLegendaryUses: vi.fn(),
}));

vi.mock('../../encounters/monsterRecharge.js', () => ({
  rollMonsterRecharges: vi.fn(),
}));

import { applyTurnStartEffects } from './turnStartEffects.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';

const FLY_BUFF = { name: 'Draconic Flight', effect: 'fly_speed_equals_walk_speed' };

function stubStore({ buffs = [], conditions = [] } = {}) {
  getRuntimeValue.mockImplementation((name, prop) => {
    if (prop === 'activeBuffs') return buffs;
    if (prop === 'activeConditions') return conditions;
    if (prop === 'targetEffects') return [];
    return null;
  });
}

describe('CLA-096 endDraconicFlightIfIncapacitated turn-start lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.dispatchEvent = vi.fn();
  });

  it('ends the wings and logs when the active creature is Incapacitated', async () => {
    stubStore({ buffs: [FLY_BUFF], conditions: ['incapacitated'] });

    await applyTurnStartEffects('DragonbornTest', { turnStartEffects: [] }, campaignName, []);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'DragonbornTest',
      'activeBuffs',
      [],
      campaignName,
    );
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'DragonbornTest',
      abilityName: 'Draconic Flight',
      description: expect.stringContaining('due to the Incapacitated condition'),
    }));
  });

  it('leaves the wings standing when not incapacitated', async () => {
    stubStore({ buffs: [FLY_BUFF], conditions: [] });

    await applyTurnStartEffects('DragonbornTest', { turnStartEffects: [] }, campaignName, []);

    expect(setRuntimeValue).not.toHaveBeenCalledWith('DragonbornTest', 'activeBuffs', [], campaignName);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('does not touch other fly buffs (Heavenly Wings twin)', async () => {
    const wings = { name: 'Heavenly Wings', effect: 'fly_speed_equals_walk_speed' };
    stubStore({ buffs: [wings], conditions: ['incapacitated'] });

    await applyTurnStartEffects('DragonbornTest', { turnStartEffects: [] }, campaignName, []);

    expect(setRuntimeValue).not.toHaveBeenCalledWith('DragonbornTest', 'activeBuffs', [], campaignName);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
