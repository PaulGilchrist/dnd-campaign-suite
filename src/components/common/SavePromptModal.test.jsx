import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auraOfProtection.js';

// ── Mock dependencies ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('./Subscriber.jsx', () => {
  return {
    default: function MockSubscriber({ handleEvent, campaignName }) {
      return React.createElement(
        'div',
        { 'data-testid': 'subscriber', 'data-campaign': campaignName },
        React.createElement(
          'button',
          {
            'data-testid': 'subscriber-trigger',
            onClick: () =>
              handleEvent({
                key: `change-${campaignName}-savePrompt-testTarget`,
                data: {
                  promptId: 'test-prompt-1',
                  targetName: 'testTarget',
                  saveType: 'con',
                  saveDc: 12,
                  disadvantage: false,
                },
              }),
          }
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'subscriber-trigger-second',
            onClick: () =>
              handleEvent({
                key: `change-${campaignName}-savePrompt-testTarget2`,
                data: {
                  promptId: 'test-prompt-2',
                  targetName: 'testTarget2',
                  saveType: 'dex',
                  saveDc: 15,
                  disadvantage: true,
                  dcSuccess: 'half',
                },
              }),
          }
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'subscriber-trigger-cleared',
            onClick: () =>
              handleEvent({
                key: `change-${campaignName}-savePromptCleared-testTarget`,
                data: {
                  promptId: 'test-prompt-1',
                },
              }),
          }
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'subscriber-trigger-disadvantage',
            onClick: () =>
              handleEvent({
                key: `change-${campaignName}-savePrompt-testTarget3`,
                data: {
                  promptId: 'test-prompt-disadv',
                  targetName: 'testTarget3',
                  saveType: 'str',
                  saveDc: 14,
                  disadvantage: true,
                  dcSuccess: 'half',
                  sourceName: 'Fireball',
                },
              }),
          }
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'subscriber-trigger-none-dc',
            onClick: () =>
              handleEvent({
                key: `change-${campaignName}-savePrompt-testTarget4`,
                data: {
                  promptId: 'test-prompt-none',
                  targetName: 'testTarget4',
                  saveType: 'wis',
                  saveDc: 16,
                  disadvantage: false,
                  dcSuccess: 'none',
                },
              }),
          }
        ),
      );
    },
  };
});

// ── jsdom does not provide EventSource, but the component checks for it ──

const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

function setupGlobalEventSource() {
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
}

function createCharacter(name, saveModifiers, evasionEffects) {
  return {
    name,
    computedStats: {
      abilities: [
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 1 },
        { name: 'Constitution', bonus: 3 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 1 },
        { name: 'Charisma', bonus: 4 },
      ],
      evasionEffects: evasionEffects || [],
    },
    saveModifiers: saveModifiers || [],
  };
}

// ── Tests ──

describe('SavePromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGlobalEventSource();
    // Default rollD20 value so saves produce deterministic results
    rollD20.mockReturnValue(15);
  });

  // ── Rendering with no prompts ──

  it('renders nothing when there are no prompts', () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );
    expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
  });

  it('does not show roll button when no prompts exist', () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );
    expect(screen.queryByRole('button', { name: 'Roll Save' })).not.toBeInTheDocument();
  });

  // ── Modal rendering with prompt ──

  it('renders the modal when a prompt is queued via Subscriber', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.getByText('testTarget')).toBeInTheDocument();
    expect(screen.getByText('CON')).toBeInTheDocument();
    expect(screen.getByText('DC 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('renders Subscriber only when EventSource is available', () => {
    delete globalThis.EventSource;

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    expect(screen.queryByTestId('subscriber')).not.toBeInTheDocument();

    setupGlobalEventSource();
  });

  it('renders with correct campaign name on subscriber', () => {
    render(
      <SavePromptModal
        campaignName="my-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const subscriber = screen.getByTestId('subscriber');
    expect(subscriber).toHaveAttribute('data-campaign', 'my-campaign');
  });

  it('renders the shield icon in header', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Saving Throw Required/i)).toBeInTheDocument();
    });

    const icon = document.querySelector('.sp-header i.fa-solid.fa-shield-halved');
    expect(icon).toBeInTheDocument();
  });

  // ── Dismiss ──

  it('dismisses the prompt when dismiss button is clicked', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
  });

  it('handles overlay click to dismiss', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const overlay = document.querySelector('.sp-overlay');
    if (overlay) {
      fireEvent.click(overlay);
    }

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
  });

  it('does not dismiss when clicking inside the modal', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const modal = document.querySelector('.sp-modal');
    if (modal) {
      fireEvent.click(modal);
    }

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });
  });

  // ── Roll save ──

  it('shows result after rolling a save', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/SAVE SUCCESS|SAVE FAILURE/i)).toBeInTheDocument();
  });

  it('shows "Done" button after rolling with single prompt', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('dispatches save-result custom event after rolling', async () => {
    const eventHandler = vi.fn();
    window.addEventListener('save-result', eventHandler);

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
    });

    const eventDetail = eventHandler.mock.calls[0][0].detail;
    expect(eventDetail.promptId).toBe('test-prompt-1');
    expect(eventDetail.targetName).toBe('testTarget');
    expect(eventDetail.saveType).toBe('con');
    expect(eventDetail.saveDc).toBe(12);

    window.removeEventListener('save-result', eventHandler);
  });

  it('shows save bonus breakdown in result', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/d20/i)).toBeInTheDocument();
    });
  });

  // ── Queue / multiple prompts ──

  it('does not show queue count for single prompt', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/\(1 of/)).not.toBeInTheDocument();
  });

  it('shows queue count when multiple prompts are queued', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const trigger2 = screen.getByTestId('subscriber-trigger-second');
    fireEvent.click(trigger2);

    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
  });

  it('shows "Next Save" button when multiple prompts exist', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    // Queue a second prompt first, then roll the first
    const trigger2 = screen.getByTestId('subscriber-trigger-second');
    fireEvent.click(trigger2);

    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next Save' })).toBeInTheDocument();
    });
  });

  it('advances to next prompt when Done is clicked with single prompt', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);

    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
  });

  // ── Cleared event ──

  it('removes prompt when savePromptCleared event is received', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const clearedBtn = screen.getByTestId('subscriber-trigger-cleared');
    fireEvent.click(clearedBtn);

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
  });

  // ── Duplicate prompt guard ──

  it('does not add duplicate prompts with same promptId', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    // Trigger again with same promptId
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).toBeInTheDocument();
    });
  });

  // ── String characters in characters array ──

  it('handles string characters in characters array', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={['testTarget']}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument();
    });
  });

  // ── Save bonus from character data ──

  it('finds save bonus from character data', async () => {
    const character = createCharacter('testTarget');
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[character]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/total:/i)).toBeInTheDocument();
    });
  });

  // ── Disadvantage ──

  it('rolls two d20s and takes the minimum for disadvantage', async () => {
    rollD20.mockReturnValueOnce(18).mockReturnValueOnce(5);

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-disadvantage');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/d20/i)).toBeInTheDocument();
    });

    // With disadvantage, finalRoll should be min(18, 5) = 5
    expect(rollD20).toHaveBeenCalledTimes(2);
  });

  it('rolls only one d20 when no disadvantage', async () => {
    rollD20.mockReturnValue(15);

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/d20/i)).toBeInTheDocument();
    });

    expect(rollD20).toHaveBeenCalledTimes(1);
  });

  // ── Aura bonus ──

  it('shows aura bonus in result when aura provides a bonus', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 2, sourceName: 'Paladin' });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/aura/i)).toBeInTheDocument();
    });
  });

  // ── dcSuccess display ──

  it('shows "Half damage on successful save" note when dcSuccess is "half"', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-disadvantage');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Half damage on successful save/i)).toBeInTheDocument();
    });
  });

  it('shows "No damage on successful save" note when dcSuccess is "none"', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-none-dc');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/No damage on successful save/i)).toBeInTheDocument();
    });
  });

  it('shows source name when provided', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-disadvantage');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Source: Fireball/i)).toBeInTheDocument();
    });
  });

  // ── Evasion display ──

  it('shows evasion message when target has own evasion for save type', async () => {
    const character = createCharacter(
      'testTarget2',
      [],
      [{ saveType: 'DEX', shareable: false, shareRange: 0 }]
    );
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[character]}
        activeMapName={null}
      />
    );

    // subscriber-trigger-second has saveType='dex' and dcSuccess='half'
    const trigger = screen.getByTestId('subscriber-trigger-second');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Evasion: No damage on success, half damage on failure/i)).toBeInTheDocument();
  });

  it('shows shared evasion when another character has shareable evasion', async () => {
    const targetChar = createCharacter('testTarget2', [], []);
    const paladin = createCharacter(
      'Paladin',
      [],
      [{ saveType: 'DEX', shareable: true, shareRange: 10 }]
    );
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar, paladin]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-second');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Evasion: No damage on success, half damage on failure/i)).toBeInTheDocument();
  });

  it('shows shared evasion only when shareRange >= 5', async () => {
    const targetChar = createCharacter('testTarget2', [], []);
    const paladin = createCharacter(
      'Paladin',
      [],
      [{ saveType: 'DEX', shareable: true, shareRange: 3 }]
    );
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar, paladin]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger-second');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Half damage on successful save/i)).toBeInTheDocument();
    expect(screen.queryByText(/Evasion:/)).not.toBeInTheDocument();
  });

  // ── Result display ──

  it('shows SAVE SUCCESS class when save succeeds', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS|SAVE FAILURE/i)).toBeInTheDocument();
    });

    const resultDiv = document.querySelector('.sp-result');
    expect(resultDiv).toBeTruthy();
  });

  it('shows result breakdown with roll details', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByText(/vs DC 12/)).toBeInTheDocument();
    });
  });

  // ── sendSaveResult is called ──

  it('calls sendSaveResult when rolling a save', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(sendSaveResult).toHaveBeenCalled();
    });

    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
    }));
  });

  // ── clearSavePrompt is called on dismiss ──

  it('calls clearSavePrompt when dismiss button is clicked', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget', 'test-prompt-1');
    });
  });

  // ── Overlay click calls clearSavePrompt ──

  it('calls clearSavePrompt when overlay is clicked', async () => {
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[]}
        activeMapName={null}
      />
    );

    const trigger = screen.getByTestId('subscriber-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    const overlay = document.querySelector('.sp-overlay');
    if (overlay) {
      fireEvent.click(overlay);
    }

    await waitFor(() => {
      expect(clearSavePrompt).toHaveBeenCalled();
    });
  });
});
