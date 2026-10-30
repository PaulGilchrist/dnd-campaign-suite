// @maintained-by-ai
// DeathSavePromptModal — terminal finality summary rows
// (death-save-modal-terminal-no-finality-row)
//
// Locks the modal lane's roll-less summary rows: rolling to the 3rd success
// must log result:'stable' and to the 3rd failure result:'dead', field-for-
// field identical to the rows the sheet lane writes (DeathSavingThrows.jsx
// :106/:118 — before this fix only the sheet seam produced them, so a modal-
// adjudicated death ended the log at the roll row with no finality row).
// Also locks the HP contract: stabilization leaves the creature at 0 HP on
// BOTH seams (owner decision — the sheet's HP=1 write is removed; the modal
// never wrote it), and a dead outcome never writes HP. The nat20 restore
// (restoredToHp:1) stays a roll-row effect only — no 'stable' summary row.
//
// Queue/roll mechanics live in DeathSavePromptModal.test.jsx; cross-tab
// retirement in DeathSavePromptModal.cross-tab.test.jsx — not repeated here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DeathSavePromptModal from './DeathSavePromptModal.jsx';
import * as deathSaveRules from '../../services/combat/conditions/deathSaveRules.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendDeathSaveResult: vi.fn(),
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/conditions/deathSaveRules.js', () => ({
  rollDeathSave: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

let emitEvent = null;

vi.mock('./Subscriber.jsx', () => ({
  default: function MockSubscriber({ handleEvent }) {
    emitEvent = handleEvent;
    return null;
  },
}));

const CAMPAIGN = 'test-campaign';
const TARGET = 'DyingAlly';

function rollShape(overrides) {
  return {
    roll: 15,
    isNat20: false,
    isNat1: false,
    result: 'success',
    newSaves: [true, false, false],
    newFailures: [false, false, false],
    restoredToHp: null,
    ...overrides,
  };
}

async function openAndRoll(result) {
  deathSaveRules.rollDeathSave.mockReturnValue(rollShape(result));
  render(<DeathSavePromptModal campaignName={CAMPAIGN} />);
  act(() => {
    emitEvent({
      key: `change-${CAMPAIGN}-deathSavePrompt-${TARGET}`,
      data: { promptId: `prompt-${TARGET}`, targetName: TARGET },
    });
  });
  await screen.findByText(/must make a/i);
  fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
  await screen.findByText(/^Roll:/i);
}

// The exact rows DeathSavingThrows.jsx writes for the same outcomes —
// byte-parity source of truth for the sheet lane's copy.
const SHEET_STABLE_ROW = {
  type: 'death_save',
  characterName: TARGET,
  result: 'stable',
  totalSuccesses: 3,
  totalFailures: 1,
};
const SHEET_DEAD_ROW = {
  type: 'death_save',
  characterName: TARGET,
  result: 'dead',
  totalSuccesses: 1,
  totalFailures: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  const MockEventSource = vi.fn();
  MockEventSource.prototype.close = vi.fn();
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
  getRuntimeValue.mockReturnValue(0); // target still at 0 HP: prompt is live
  emitEvent = null;
});

afterEach(() => {
  delete globalThis.EventSource;
});

describe('DeathSavePromptModal finality rows', () => {
  it('third success logs a roll-less stable summary row, field-exact with the sheet copy', async () => {
    await openAndRoll({
      result: 'stable',
      newSaves: [true, true, true],
      newFailures: [true, false, false],
    });

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, SHEET_STABLE_ROW);
  });

  it('third failure logs a roll-less dead summary row, field-exact with the sheet copy', async () => {
    await openAndRoll({
      roll: 4,
      result: 'dead',
      success: false,
      newSaves: [true, false, false],
      newFailures: [true, true, true],
    });

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, SHEET_DEAD_ROW);
  });

  it('stabilizing from the modal leaves the creature at 0 HP — no currentHitPoints write', async () => {
    await openAndRoll({
      result: 'stable',
      newSaves: [true, true, true],
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('DyingAlly', 'deathSaves', [true, true, true], CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('DyingAlly', 'currentHitPoints', expect.anything(), CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('DyingAlly', 'isDead', expect.anything(), CAMPAIGN);
  });

  it('dying from the modal stamps isDead but never writes HP', async () => {
    await openAndRoll({
      roll: 4,
      result: 'dead',
      newFailures: [true, true, true],
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('DyingAlly', 'isDead', 1, CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('DyingAlly', 'currentHitPoints', expect.anything(), CAMPAIGN);
  });

  it('plain success and failure rolls write no finality summary row', async () => {
    await openAndRoll({ result: 'success' });
    await screen.findByRole('button', { name: 'Done' });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await openAndRoll({ roll: 5, result: 'failure', newSaves: [false, false, false], newFailures: [true, false, false] });
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('nat20 restores 1 HP (restoredToHp) but writes no stable summary row', async () => {
    await openAndRoll({
      roll: 20,
      isNat20: true,
      result: 'nat20',
      newSaves: [false, false, false],
      newFailures: [false, false, false],
      restoredToHp: 1,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('DyingAlly', 'currentHitPoints', 1, CAMPAIGN);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
