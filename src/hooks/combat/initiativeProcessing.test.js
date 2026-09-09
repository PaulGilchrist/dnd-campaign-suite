// CLA-372 regression: rolling initiative must NOT clear the Uncanny Metabolism
// once-per-Long-Rest latch (uncannyMetabolismUsed). Long Rest
// (restRules-longRest.js) is the only legitimate reset.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 0),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: (n) => (typeof n === 'string' ? n.split(' ')[0] : n) },
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  clearHuntersMarkConcentration: vi.fn(),
}));

vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
  maybeGrantThiefsReflexesSecondTurn: vi.fn(),
}));

import { processInitiativeRoll } from './initiativeProcessing.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';

const campaignName = 'TestCampaign';

describe('processInitiativeRoll — CLA-372 once-per-Long-Rest latch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(0);
    loadCombatSummary.mockResolvedValue(null);
  });

  it('does not clear uncannyMetabolismUsed on initiative roll', async () => {
    const setPopupHtml = vi.fn();

    await processInitiativeRoll('Disciplined_Monk', campaignName, {}, 3, 12, 9, 3, setPopupHtml, [], 0, []);

    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'Disciplined_Monk',
      'uncannyMetabolismUsed',
      false,
      campaignName,
    );
    expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'uncannyMetabolismUsed')).toHaveLength(0);
  });

  it('still writes initiative and fires initiative-rolled', async () => {
    const combatSummary = { round: 1, creatures: [{ type: 'player', name: 'Disciplined_Monk', initiative: '' }] };
    loadCombatSummary.mockResolvedValue(combatSummary);
    const setPopupHtml = vi.fn();
    const dispatched = [];
    window.addEventListener('initiative-rolled', (e) => dispatched.push(e.detail));

    await processInitiativeRoll('Disciplined_Monk', campaignName, {}, 3, 12, 9, 3, setPopupHtml, [], 0, []);

    expect(combatSummary.creatures[0].initiative).toBe('15');
    expect(dispatched).toEqual([{ characterName: 'Disciplined_Monk', roll: 15 }]);
  });
});
