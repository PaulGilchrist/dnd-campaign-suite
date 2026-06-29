/* @improved-by-ai */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
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

// ── EventSource helper ──

const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

function setupGlobalEventSource() {
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
}

// ── Test helpers ──

function createCharacter(name, saveModifiers, evasionEffects, abilities) {
  return {
    name,
    computedStats: {
      abilities: abilities || [
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
    rollD20.mockReturnValue(15);
    getRuntimeValue.mockReturnValue(null);
  });

  afterEach(() => {
    // Restore EventSource to avoid leaking between test files
    delete globalThis.EventSource;
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
    expect(screen.queryByRole('button', { name: 'Roll Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  // ── Subscriber rendering ──

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
  });

  it('renders Subscriber with correct campaign attribute', () => {
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

  // ── Modal rendering with prompt ──

  it('displays the modal with target name, ability, and DC when a prompt is queued', async () => {
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

    expect(clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
  });

  it('dismisses the prompt when overlay is clicked', async () => {
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

    expect(clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
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

    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    expect(clearSavePrompt).not.toHaveBeenCalled();
  });

  it('does not dismiss on Escape key since component uses overlay click for dismiss', async () => {
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

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
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

  it('replaces Roll Save/Dismiss buttons with Done after rolling a single prompt', async () => {
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

    expect(screen.queryByRole('button', { name: 'Roll Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
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

  it('dispatches save-result custom event with correct detail after rolling', async () => {
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
    expect(eventDetail.success).toBe(true);
    expect(eventDetail.roll).toBe(15);
    expect(eventDetail.mode).toBe('normal');

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

    expect(screen.getByText(/vs DC 12/)).toBeInTheDocument();
  });

  it('calls sendSaveResult with correct parameters when rolling a save', async () => {
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
      success: true,
      roll: 15,
      total: 15,
      mode: 'normal',
    }));
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

    // Verify queue count is still 1, not 2
    expect(screen.queryByText(/\(1 of 2\)/)).not.toBeInTheDocument();
  });

  it('advances to second prompt when Next Save is clicked', async () => {
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

    const rollBtn = screen.getByRole('button', { name: 'Roll Save' });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next Save' })).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: 'Next Save' });
    fireEvent.click(nextBtn);

    // Should now show the second prompt (testTarget2, DEX)
    await waitFor(() => {
      expect(screen.getByText('testTarget2')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
      expect(screen.getByText('DC 15')).toBeInTheDocument();
    });
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
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(sendSaveResult).toHaveBeenCalled();
  });

  it('handles mixed string and object characters in characters array', async () => {
    const character = createCharacter('otherChar');
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={['testTarget', character]}
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

    expect(sendSaveResult).toHaveBeenCalled();
  });

  // ── Save bonus from character data ──

  it('finds save bonus from character data and includes it in result', async () => {
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
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    expect(getAbilitySaveBonus).toHaveBeenCalledOnce();
    expect(getAbilitySaveBonus).toHaveBeenCalledWith(character.computedStats, 'con');
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

    expect(screen.getByText(/from Paladin/)).toBeInTheDocument();
  });

  it('includes aura bonus in the final total calculation', async () => {
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
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    // 15 (d20) + 3 (save bonus) + 2 (aura) = 20
    expect(screen.getByText(/20/)).toBeInTheDocument();
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

  it('does not show shared evasion when shareRange is less than 5', async () => {
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

  it('does not show evasion when target is incapacitated', async () => {
    const targetChar = createCharacter(
      'testTarget2',
      [],
      [{ saveType: 'DEX', shareable: true, shareRange: 10 }]
    );
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'testTarget2' && prop === 'activeConditions') {
        return ['incapacitated'];
      }
      return null;
    });
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
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

  it('shows result failure message when save fails', async () => {
    rollD20.mockReturnValue(1);

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
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });
  });

  it('adds sp-result-success class when save succeeds', async () => {
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
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    const resultDiv = document.querySelector('.sp-result-success');
    expect(resultDiv).toBeTruthy();
    expect(document.querySelector('.sp-result-fail')).toBeFalsy();
  });

  it('adds sp-result-fail class when save fails', async () => {
    rollD20.mockReturnValue(1);

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
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });

    const resultDiv = document.querySelector('.sp-result-fail');
    expect(resultDiv).toBeTruthy();
    expect(document.querySelector('.sp-result-success')).toBeFalsy();
  });

  it('shows advantage indicator in result breakdown when advantage applies', async () => {
    const targetChar = createCharacter('testTarget', [
      { target: 'saving_throw', effect: 'advantage', condition: 'stunned' },
    ]);
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'testTarget' && prop === 'activeConditions') {
        return ['stunned'];
      }
      return null;
    });

    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[targetChar]}
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
      expect(screen.getByText(/Advantage/)).toBeInTheDocument();
    });

    // Advantage reuses roll1 for roll2 (only one actual dice roll call)
    expect(rollD20).toHaveBeenCalledTimes(1);
  });

  it('shows disadvantage indicator in result breakdown', async () => {
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
      expect(screen.getByText(/Disadvantage/)).toBeInTheDocument();
    });
  });
});
