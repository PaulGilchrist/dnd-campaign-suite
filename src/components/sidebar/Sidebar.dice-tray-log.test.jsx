// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sidebar from './Sidebar.jsx';
import * as diceRoller from '../../services/dice/diceRoller.js';

// Stub logService so Sidebar.addEntry and MusicPlayer's useLog stay off the network.
const { mockAddEntry } = vi.hoisted(() => ({
  mockAddEntry: vi.fn().mockResolvedValue({ id: 'r1' }),
}));
vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn().mockResolvedValue([]),
  addEntry: mockAddEntry,
}));

const MOCK_ROLL_VALUE = 11;

function renderSidebar() {
  return render(
    <Sidebar
      campaignName="test-campaign"
      characters={[]}
      activeCharacter={null}
      isLocalhost
      activeView="charSheet"
    />
  );
}

beforeEach(() => {
  mockAddEntry.mockClear();
  vi.spyOn(diceRoller, 'rollDie').mockReturnValue(MOCK_ROLL_VALUE);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Sidebar dice tray → campaign log', () => {
  it('appends a GM roll entry to the campaign log when a die is rolled', () => {
    renderSidebar();
    fireEvent.click(screen.getByTitle('Roll d20'));
    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'roll',
      rollType: 'dice',
      characterName: 'GM',
      name: 'Dice Tray d20',
      rolls: [MOCK_ROLL_VALUE],
      total: MOCK_ROLL_VALUE,
      formula: 'd20',
    });
  });

  it('shows the result popup wired to the tray roll', () => {
    const { container } = renderSidebar();
    fireEvent.click(screen.getByTitle('Roll d6'));
    expect(container.querySelector('.dice-tray-result-value')).toHaveTextContent(String(MOCK_ROLL_VALUE));
  });
});
