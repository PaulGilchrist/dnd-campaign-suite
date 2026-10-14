import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocks ──

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(() => false),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  applyLongRest: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function MockModal({ onConfirm, onSkip, targets, note }) {
    return (
      <div data-testid="overlay" className="sp-overlay" onClick={(e) => {
        if (e.target === e.currentTarget && onSkip) onSkip();
      }}>
        <div data-testid="creature-selection-modal" className="sp-modal" onClick={(e) => e.stopPropagation()}>
          <div data-testid="note">{note}</div>
          {targets.map((t, i) => (
            <label key={i} data-testid={`target-${i}`}>
              {t.name}
            </label>
          ))}
          <button
            data-testid="confirm-button"
            onClick={() => {
              const selectedNames = targets.map((t) => t.name);
              if (selectedNames.length > 0) {
                onConfirm && onConfirm(selectedNames);
              }
            }}
          >
            Confirm
          </button>
          <button
            data-testid="skip-button"
            onClick={() => onSkip && onSkip()}
            type="button"
          >
            Skip
          </button>
        </div>
      </div>
    );
  },
}));

// ── Re-import mocks ──

import * as restRules from '../../services/rules/effects/restRules.js';
import * as tempHpService from '../../services/automation/handlers/buffs/tempHpService.js';
import * as logService from '../../services/ui/logService.js';

// ── Fixtures ──

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
  hitPoints: 45,
  class: { name: 'Cleric' },
};

const mockCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    playerStats: basePlayerStats,
    campaignName: mockCampaignName,
    onLongRest: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('LongRestButton - celestial resilience modal interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setTempHp for each ally when confirming modal', async () => {
    const celestialData = {
      creatureTargets: [
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'npc' },
      ],
      allyTempHp: 10,
      selfTempHp: 5,
      maxTargets: 5,
    };
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps()} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-button'));

    expect(tempHpService.setTempHp).toHaveBeenCalledTimes(2);
    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally1', 10, mockCampaignName);
    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally2', 10, mockCampaignName);
  });

  it('uses allyTempHp from celestial data for setTempHp calls', async () => {
    const celestialData = {
      creatureTargets: [{ name: 'Ally1', type: 'player' }],
      allyTempHp: 20,
      selfTempHp: 10,
      maxTargets: 5,
    };
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps()} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-button'));

    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally1', 20, mockCampaignName);
  });

  it('logs ability_use with correct fields when confirming modal', async () => {
    const celestialData = {
      creatureTargets: [
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'npc' },
      ],
      allyTempHp: 10,
      selfTempHp: 5,
      maxTargets: 5,
    };
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps()} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => {
      expect(logService.addEntry).toHaveBeenCalled();
    });

    const logCall = logService.addEntry.mock.calls[0][1];
    expect(logCall.type).toBe('ability_use');
    expect(logCall.characterName).toBe('TestCharacter');
    expect(logCall.abilityName).toBe('Celestial Resilience');
    expect(logCall.description).toContain('TestCharacter');
    expect(logCall.description).toContain('temporary hit points');
    expect(logCall.description).toContain('Ally1');
    expect(logCall.description).toContain('Ally2');
    expect(typeof logCall.timestamp).toBe('number');
  });

  it('logs ability_use with correct fields when skipping modal', async () => {
    const celestialData = {
      creatureTargets: [{ name: 'Ally1', type: 'player' }],
      allyTempHp: 10,
      selfTempHp: 5,
      maxTargets: 5,
    };
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps()} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('skip-button'));

    await waitFor(() => {
      expect(logService.addEntry).toHaveBeenCalled();
    });

    const logCall = logService.addEntry.mock.calls[0][1];
    expect(logCall.type).toBe('ability_use');
    expect(logCall.characterName).toBe('TestCharacter');
    expect(logCall.abilityName).toBe('Celestial Resilience');
    expect(logCall.description).toContain('skipped');
    expect(logCall.description).toContain('Celestial Resilience');
    expect(typeof logCall.timestamp).toBe('number');
  });

  it('clears the modal and calls onLongRest after confirming', async () => {
    const celestialData = {
      creatureTargets: [{ name: 'Ally1', type: 'player' }],
      allyTempHp: 10,
      selfTempHp: 5,
      maxTargets: 5,
    };
    const onLongRest = vi.fn();
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps({ onLongRest })} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    });

    expect(onLongRest).toHaveBeenCalledTimes(1);
  });

  it('clears the modal and calls onLongRest after skipping', async () => {
    const celestialData = {
      creatureTargets: [{ name: 'Ally1', type: 'player' }],
      allyTempHp: 10,
      selfTempHp: 5,
      maxTargets: 5,
    };
    const onLongRest = vi.fn();
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps({ onLongRest })} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('skip-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    });

    expect(onLongRest).toHaveBeenCalledTimes(1);
  });

  it('does not call setTempHp when skipping modal', async () => {
    const celestialData = {
      creatureTargets: [{ name: 'Ally1', type: 'player' }],
      allyTempHp: 10,
      selfTempHp: 5,
      maxTargets: 5,
    };
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps()} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('skip-button'));

    expect(tempHpService.setTempHp).not.toHaveBeenCalled();
  });

  it('does not call onLongRest until modal is dismissed', async () => {
    const celestialData = {
      creatureTargets: [{ name: 'Ally1', type: 'player' }],
      allyTempHp: 10,
      selfTempHp: 5,
      maxTargets: 5,
    };
    const onLongRest = vi.fn();
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps({ onLongRest })} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    expect(onLongRest).not.toHaveBeenCalled();
  });

  it('shows modal note with selfTempHp and allyTempHp values', async () => {
    const celestialData = {
      creatureTargets: [{ name: 'Ally1', type: 'player' }],
      allyTempHp: 12,
      selfTempHp: 8,
      maxTargets: 5,
    };
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps()} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    expect(screen.getByTestId('note')).toHaveTextContent(/8 temporary hit points/);
    expect(screen.getByTestId('note')).toHaveTextContent(/12 temporary hit points/);
  });

  it('renders all creature targets in the modal', async () => {
    const celestialData = {
      creatureTargets: [
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'npc' },
        { name: 'Ally3', type: 'player' },
      ],
      allyTempHp: 10,
      selfTempHp: 5,
      maxTargets: 5,
    };
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps()} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    expect(screen.getByTestId('target-0')).toHaveTextContent('Ally1');
    expect(screen.getByTestId('target-1')).toHaveTextContent('Ally2');
    expect(screen.getByTestId('target-2')).toHaveTextContent('Ally3');
  });
});
