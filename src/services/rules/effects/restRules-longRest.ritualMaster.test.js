// @maintained-by-ai
// FT-068 lane: what the LONG REST does to Ritual Master bookkeeping.
// applyLongRest.js:694-699 writes the ONLY long-rest re-arm of the Quick Ritual latch:
// key is absent from LONG_REST_RESOURCES (restRules-constants.js) and the disk feat
// (public/data/2024/feats.json "Ritual Master") carries no recharge automation, so the
// generic null-everything batch never touches it — without this gated write the latch,
// consumed by spellPreparationService.js:730 (stamps Date.now()) and read at :861-864
// (`quickRitualUsed == null` re-arm sentinel), never re-arms (CLA-130 rule).
// Consume-side and injection-side are owned elsewhere: spellPreparationService.quickRitual.test.js
// and spellCalc2024-ritualMaster.test.js (#1270).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyLongRest } from './restRules.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((level) => Math.max(0, level - 1)),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}));

import { setRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';

function makePlayerStats(overrides = {}) {
  return {
    name: 'HexWarlock',
    level: 14,
    proficiency: 5,
    abilities: [{ name: 'Charisma', bonus: 4 }],
    automation: {
      actions: [], bonusActions: [], reactions: [], specialActions: [], passives: [],
      ritualSpells: [],
    },
    feats: [],
    ...overrides,
  };
}

const QUICK_RITUAL_LATCH = '_Ritual_Master_quickRitualUsed';

function makeAutomationHolder() {
  return makePlayerStats({
    automation: {
      actions: [], bonusActions: [], reactions: [], specialActions: [], passives: [],
      // entry mirrors public/data/2024/feats.json Ritual Master > "Ritual Spells" automation
      ritualSpells: [{ type: 'ritual_spells', effect: 'ritual_spells', name: 'Ritual Spells', chosenSpells: true, quickRitual: true, casting_time: 'passive' }],
    },
  });
}

describe('FT-068 long rest re-arms the Quick Ritual latch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-arms the latch for an automation-grant holder (ritualSpells.chosenSpells, no feats entry)', async () => {
    await applyLongRest(makeAutomationHolder(), 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('HexWarlock', QUICK_RITUAL_LATCH, null, 'test-campaign', true);
  });

  it('re-arms the latch via the feats-name fallback when no automation grant exists', async () => {
    await applyLongRest(makePlayerStats({ feats: ['Ritual Master'] }), 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('HexWarlock', QUICK_RITUAL_LATCH, null, 'test-campaign', true);
  });

  it('never nulls the latch for a non-holder — neither direct write nor batch payload', async () => {
    await applyLongRest(makePlayerStats({ feats: ['Poisoner'] }), 'test-campaign');

    const quickCalls = setRuntimeValue.mock.calls.filter(c => c[1] === QUICK_RITUAL_LATCH);
    expect(quickCalls).toHaveLength(0);
    const batched = setRuntimeBatch.mock.calls.filter(c => c[1] && QUICK_RITUAL_LATCH in c[1]);
    expect(batched).toHaveLength(0);
  });
});
