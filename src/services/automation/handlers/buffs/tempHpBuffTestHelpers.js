import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { addEntry } from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';

export const campaignName = 'TestCampaign';

export function makePlayerStats(overrides = {}) {
  return {
    name: 'Grog',
    level: 3,
    class: {
      name: 'Barbarian',
      class_levels: [
        { level: 1 },
        { level: 2 },
        { level: 3 },
      ],
    },
    abilities: [],
    ...overrides,
  };
}

export function makeAction(automation = {}, actionOverrides = {}) {
  return {
    name: 'Second Wind',
    automation: {
      type: 'temp_hp_buff',
      tempHpExpression: '',
      ongoingHealingExpression: '',
      healingRange: '',
      bonusMovement: false,
      ...automation,
    },
    ...actionOverrides,
  };
}

export function resetMocks() {
  getRuntimeValue.mockClear().mockReset();
  setRuntimeValue.mockClear().mockResolvedValue(undefined);
  evaluateAutoExpression.mockClear().mockReset();
  loadMapData.mockClear().mockReset();
  addExpiration.mockClear().mockReset();
  getDistanceFeet.mockClear().mockReset();
  rangeToFeet.mockClear().mockReset();
  addEntry.mockClear().mockResolvedValue({});
  rangeCheck.isWithinRange.mockClear().mockReset().mockResolvedValue(true);
  if (damageUtils.getCombatContext?.mock) {
    damageUtils.getCombatContext.mockClear().mockReset();
  }
}
