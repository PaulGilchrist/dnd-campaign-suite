// @maintained-by-ai: 2026-10-14
// Seam: processInitiativeRoll — the initiative-roll tail: popup rebuild, tracker
// write, and `initiative-rolled` dispatch. (Roll-side Cosmic Omen / tandem-footwork
// folding is covered in useLoggedDiceRollAttack.test.js.)
// CLA-372: rolling initiative must NOT clear the Uncanny Metabolism once-per-Long-Rest
// latch (uncannyMetabolismUsed) — Long Rest (restRules-longRest.js) is its only reset.
// CLA-065: the tail popup bonus/bonusDetail and tracker initiative must carry the folded
// Cosmic Omen ±1d6, not just the base bonus.
import { describe, it, expect, vi, beforeEach, onTestFinished } from 'vitest';

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
const characterName = 'Disciplined_Monk';

function armedCombatSummary() {
  const summary = { round: 1, creatures: [{ type: 'player', name: characterName, initiative: '' }] };
  loadCombatSummary.mockResolvedValue(summary);
  return summary;
}

function rollInitiative(overrides = {}) {
  const setPopupHtml = vi.fn();
  const dispatched = [];
  const listener = (e) => dispatched.push(e.detail);
  window.addEventListener('initiative-rolled', listener);
  onTestFinished(() => window.removeEventListener('initiative-rolled', listener));

  return processInitiativeRoll({
    characterName,
    campaignName,
    context: {},
    bonus: 3,
    effectiveD20Roll: 12,
    r1: 9,
    r2: 3,
    setPopupHtml,
    availableSuperiorityManeuvers: [],
    cosmicOmenAppliedBonus: 0,
    characters: [],
    ...overrides,
  }).then(() => ({ setPopupHtml, dispatched }));
}

describe('processInitiativeRoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(0);
    // Neutralize any mockResolvedValue armed by a previous test.
    loadCombatSummary.mockResolvedValue(null);
  });

  it('writes tracker initiative, dispatches initiative-rolled, and never touches the CLA-372 uncannyMetabolismUsed latch (no omen)', async () => {
    const combatSummary = armedCombatSummary();
    const { setPopupHtml, dispatched } = await rollInitiative();

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      rollType: 'initiative',
      rolls: [9, 3],
      bonus: 3,
      bonusDetail: undefined,
    }));
    expect(combatSummary.creatures[0].initiative).toBe('15');
    expect(dispatched).toEqual([{ characterName, roll: 15 }]);
    expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'uncannyMetabolismUsed')).toHaveLength(0);
  });

  it.each([
    { omen: 4, detail: '(+4 from Weal)' },
    { omen: -2, detail: '(-2 from Woe)' },
  ])('CLA-065: folds Cosmic Omen $omen into popup, tracker, and event', async ({ omen, detail }) => {
    const combatSummary = armedCombatSummary();
    const roll = 6 - 1 + omen; // d20 6 + base bonus −1 ± omen
    const { setPopupHtml, dispatched } = await rollInitiative({
      bonus: -1,
      effectiveD20Roll: 6,
      r1: 6,
      r2: 11,
      cosmicOmenAppliedBonus: omen,
      cosmicOmenDetail: detail,
    });

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      bonus: -1 + omen,
      bonusDetail: detail,
      cosmicOmenAppliedBonus: omen,
    }));
    expect(combatSummary.creatures[0].initiative).toBe(String(roll));
    expect(dispatched).toEqual([{ characterName, roll }]);
  });
});
