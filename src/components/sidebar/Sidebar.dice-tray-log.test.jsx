import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sidebar from './Sidebar.jsx';
import * as diceRoller from '../../services/dice/diceRoller.js';

const mockAddEntry = vi.fn().mockResolvedValue({ id: 'r1' });
vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn().mockResolvedValue([]),
  addEntry: (...args) => mockAddEntry(...args),
}));

const MOCK_ROLL_VALUE = 11;

function createProps(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    characters: [],
    activeCharacter: null,
    isLocalhost: true,
    activeView: 'charSheet',
    onBackToCampaigns: vi.fn(),
    onAddCharacter: vi.fn(),
    onCharacterClick: vi.fn(),
    onInitiativeClick: vi.fn(),
    onEncounterClick: vi.fn(),
    onFactionsClick: vi.fn(),
    onMapsClick: vi.fn(),
    onNotesClick: vi.fn(),
    onQuestsClick: vi.fn(),
    onNPCsClick: vi.fn(),
    onSessionsClick: vi.fn(),
    onInventoryClick: vi.fn(),
    onSettlementsClick: vi.fn(),
    onLogClick: vi.fn(),
    onRepairClick: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockAddEntry.mockClear();
  vi.spyOn(diceRoller, 'rollDie').mockReturnValue(MOCK_ROLL_VALUE);
});

describe('Sidebar dice tray logging', () => {
  it('appends a roll entry to the campaign log when a die is rolled', () => {
    render(<Sidebar {...createProps()} />);
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

  it('still shows the result popup when a die is rolled', () => {
    render(<Sidebar {...createProps()} />);
    fireEvent.click(screen.getByTitle('Roll d6'));
    expect(screen.getByText(String(MOCK_ROLL_VALUE))).toBeInTheDocument();
    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'roll',
      name: 'Dice Tray d6',
      total: MOCK_ROLL_VALUE,
    }));
  });
});
