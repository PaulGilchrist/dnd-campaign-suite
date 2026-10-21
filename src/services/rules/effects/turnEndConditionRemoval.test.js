// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { applyTurnEndConditionRemoval } from './turnEndConditionRemoval.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const selfRestorationStats = {
  turnStartEffects: [{
    type: 'condition_removal',
    name: 'Self-Restoration',
    conditions: ['charmed', 'frightened', 'poisoned'],
  }],
};

const storedConditions = (conds) => (name, prop) =>
  prop === 'activeConditions' ? conds : null;

describe('applyTurnEndConditionRemoval (CLA-307 Self-Restoration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRuntimeValue.mockImplementation(() => Promise.resolve());
    addEntry.mockImplementation(() => Promise.resolve());
  });

  it('writes the surviving conditions in one atomic setRuntimeValue call, passing skipSync through', async () => {
    // GM turn-end seam: default skipSync=false so the removal POSTs and broadcasts.
    getRuntimeValue.mockImplementation(storedConditions(['poisoned', 'blinded', 'charmed']));
    await applyTurnEndConditionRemoval('Disciplined_Monk', selfRestorationStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Disciplined_Monk',
      'activeConditions',
      ['blinded'],
      'test-campaign',
      false
    );

    // SSE echo seam (sseHandlers): skipSync=true — the server already holds it, re-POSTing loops.
    setRuntimeValue.mockClear();
    getRuntimeValue.mockImplementation(storedConditions(['charmed', 'frightened']));
    await applyTurnEndConditionRemoval('Disciplined_Monk', selfRestorationStats, 'test-campaign', true);

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Disciplined_Monk',
      'activeConditions',
      [],
      'test-campaign',
      true
    );
  });

  it('emits one condition/removed log entry per removed condition naming Self-Restoration', async () => {
    getRuntimeValue.mockImplementation(storedConditions(['poisoned', 'frightened', 'blinded']));

    await applyTurnEndConditionRemoval('Disciplined_Monk', selfRestorationStats, 'test-campaign');

    // Exactly two entries: the survivors (blinded) are never logged as removed.
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'condition',
      action: 'removed',
      characterName: 'Disciplined_Monk',
      condition: 'Poisoned',
      reason: 'Self-Restoration',
    }));
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'condition',
      action: 'removed',
      characterName: 'Disciplined_Monk',
      condition: 'Frightened',
      reason: 'Self-Restoration',
    }));
  });

  it('matches stored conditions case-insensitively and preserves survivor casing in the write', async () => {
    getRuntimeValue.mockImplementation(storedConditions(['Poisoned', 'Blinded']));

    await applyTurnEndConditionRemoval('Disciplined_Monk', selfRestorationStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Disciplined_Monk',
      'activeConditions',
      ['Blinded'],
      'test-campaign',
      false
    );
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      condition: 'Poisoned',
      reason: 'Self-Restoration',
    }));
  });

  it('is a zero-write, zero-log no-op whenever nothing can drop (previous/rewind re-entry, non-owners, empty store)', async () => {
    const noOps = [
      { name: null, stats: selfRestorationStats, stored: ['poisoned'] },              // no owner
      { name: 'Disciplined_Monk', stats: null, stored: ['poisoned'] },                // no stats (non-owner / rewind)
      { name: 'Disciplined_Monk', stats: {}, stored: ['poisoned'] },                  // turnStartEffects missing
      { name: 'Disciplined_Monk', stats: { turnStartEffects: [] }, stored: ['poisoned'] }, // no condition_removal effect
      { name: 'Disciplined_Monk', stats: selfRestorationStats, stored: null },       // store has no conditions yet
      { name: 'Disciplined_Monk', stats: selfRestorationStats, stored: [] },         // empty activeConditions
      { name: 'Disciplined_Monk', stats: selfRestorationStats, stored: ['blinded'] }, // no intersection
    ];

    for (const { name, stats, stored } of noOps) {
      getRuntimeValue.mockImplementation(storedConditions(stored));
      await applyTurnEndConditionRemoval(name, stats, 'test-campaign');
    }

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
