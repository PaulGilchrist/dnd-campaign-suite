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

describe('applyTurnEndConditionRemoval (CLA-307 Self-Restoration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRuntimeValue.mockImplementation(() => Promise.resolve());
    addEntry.mockImplementation(() => Promise.resolve());
  });

  it('removes charmed/frightened/poisoned from the owner at owner turn end', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return ['poisoned', 'blinded', 'charmed'];
      return null;
    });

    await applyTurnEndConditionRemoval('Disciplined_Monk', selfRestorationStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Disciplined_Monk',
      'activeConditions',
      ['blinded'],
      'test-campaign',
      false
    );
  });

  it('emits one condition/removed log entry per removed condition naming Self-Restoration', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return ['poisoned', 'frightened', 'blinded'];
      return null;
    });

    await applyTurnEndConditionRemoval('Disciplined_Monk', selfRestorationStats, 'test-campaign');

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

  it('passes skipSync through to setRuntimeValue on the SSE echo path', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return ['poisoned'];
      return null;
    });

    await applyTurnEndConditionRemoval('Disciplined_Monk', selfRestorationStats, 'test-campaign', true);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Disciplined_Monk',
      'activeConditions',
      [],
      'test-campaign',
      true
    );
  });

  it('is idempotent — no write and no log when nothing matches (previous/rewind re-entry)', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return ['blinded'];
      return null;
    });

    await applyTurnEndConditionRemoval('Disciplined_Monk', selfRestorationStats, 'test-campaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('never touches a creature without the feature (non-owner control)', async () => {
    await applyTurnEndConditionRemoval('Thug 1', { turnStartEffects: [] }, 'test-campaign');
    await applyTurnEndConditionRemoval('Thug 1', null, 'test-campaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handles case-insensitive condition matching', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return ['Poisoned', 'Blinded'];
      return null;
    });

    await applyTurnEndConditionRemoval('Disciplined_Monk', selfRestorationStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Disciplined_Monk',
      'activeConditions',
      ['Blinded'],
      'test-campaign',
      false
    );
  });
});
