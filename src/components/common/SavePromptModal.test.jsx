/* @cleaned-by-ai */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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
  setRuntimeValue: vi.fn(),
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

  // ── Roll save ──

  it('shows result after rolling a save and replaces buttons with Done', async () => {
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
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
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

  // ── Queue / multiple prompts ──

  it('shows queue count and advances to second prompt when multiple prompts exist', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('testTarget2')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
      expect(screen.getByText('DC 15')).toBeInTheDocument();
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

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/\(1 of 2\)/)).not.toBeInTheDocument();
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

  // ── dcSuccess display ──

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

  // ── Evasion display ──

  it('shows evasion message when target has own or shared evasion', async () => {
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

  // ── Result display ──

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

  // ── Stroke of Luck ──

  it('does not show Stroke of Luck button when target has no stroke_of_luck passive', async () => {
    const targetChar = createCharacter('testTarget');
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

    expect(screen.queryByRole('button', { name: 'Stroke of Luck' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
  });

  it('shows Stroke of Luck button when available, rolls 20 and marks as used', async () => {
    const targetChar = {
      name: 'testTarget',
      computedStats: {
        abilities: [
          { name: 'Constitution', bonus: 3 },
        ],
        evasionEffects: [],
        automation: { passives: [{ type: 'stroke_of_luck' }] },
      },
      saveModifiers: [],
    };
    getRuntimeValue.mockImplementation((key, prop, _campaign) => {
      if (key === 'testTarget' && prop === 'strokeOfLuckUsed') return false;
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

    expect(screen.getByRole('button', { name: 'Stroke of Luck' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();

    const strokeBtn = screen.getByRole('button', { name: 'Stroke of Luck' });
    fireEvent.click(strokeBtn);

    await waitFor(() => {
      expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    });

    expect(rollD20).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', 'strokeOfLuckUsed', true, 'test-campaign');
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
      roll: 20,
      success: true,
    }));
  });

  it('does not show Stroke of Luck button when already used', async () => {
    const targetChar = {
      name: 'testTarget',
      computedStats: {
        abilities: [
          { name: 'Constitution', bonus: 3 },
        ],
        evasionEffects: [],
        automation: { passives: [{ type: 'stroke_of_luck' }] },
      },
      saveModifiers: [],
    };
    getRuntimeValue.mockImplementation((key, prop, _campaign) => {
      if (key === 'testTarget' && prop === 'strokeOfLuckUsed') return true;
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

    expect(screen.queryByRole('button', { name: 'Stroke of Luck' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
  });
});
