import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HypnoticPatternShakeModal from './HypnoticPatternShakeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/index.js', () => ({
  executeHandler: vi.fn(() => null),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import { executeHandler } from '../../../services/automation/index.js';
import { addEntry } from '../../../services/ui/logService.js';

// ── Test fixtures ──

const baseProps = {
  attackerName: 'Wizard1',
  campaignName: 'test-campaign',
  targets: ['Orc Warrior', 'Goblin A', 'Goblin B'],
  rangeFeet: 60,
  featureName: 'Shake Out Stupor',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('HypnoticPatternShakeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay and header with feature name', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    expect(screen.getByText('Shake Out Stupor')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders Font Awesome brain icon in header', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-brain');
    expect(icon).toBeInTheDocument();
  });

  it('displays the target selection prompt with range', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    expect(screen.getByText(/within 60 feet/)).toBeInTheDocument();
    expect(screen.getByText(/Hypnotic Pattern/)).toBeInTheDocument();
  });

  it('renders all targets as radio options', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
    expect(screen.getByText('Goblin A')).toBeInTheDocument();
    expect(screen.getByText('Goblin B')).toBeInTheDocument();
  });

  it('renders Shake Free button disabled by default', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const shakeBtn = screen.getByRole('button', { name: /Shake Free/ });
    expect(shakeBtn).toBeDisabled();
  });

  it('renders Shake Free button showing "none" when no selection', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Shake Free (none)' })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders modal with proper CSS classes', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders Font Awesome hand icon on Shake Free button', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-hand');
    expect(icon).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Radio button selection ──

  it('has no target selected on initial render', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
      expect(radio.checked).toBe(false);
    });
  });

  it('has three radio inputs with correct name attribute', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(3);
    radios.forEach(radio => {
      expect(radio.name).toBe('hypnoticShakeTarget');
    });
  });

  it('marks first target as selected when clicked', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    expect(radios[0].checked).toBe(true);
  });

  it('marks second target as selected when clicked', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    expect(radios[1].checked).toBe(true);
  });

  it('marks third target as selected when clicked', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[2]);
    expect(radios[2].checked).toBe(true);
  });

  it('unchecks previous target when another is clicked', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(radios[2]);
    expect(radios[0].checked).toBe(false);
    expect(radios[2].checked).toBe(true);
  });

  it('updates Shake Free button text to show selected target', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    expect(screen.getByRole('button', { name: 'Shake Free (Goblin A)' })).toBeInTheDocument();
  });

  it('enables Shake Free button after target selection', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    const shakeBtn = screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' });
    expect(shakeBtn).toBeEnabled();
  });

  it('applies selected class to chosen target row', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    const selectedRow = document.querySelector('.abjure-target-selected');
    expect(selectedRow).toBeInTheDocument();
    expect(selectedRow.textContent).toContain('Goblin A');
  });

  it('removes selected class from previous target when another is chosen', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(radios[2]);
    const selectedRows = document.querySelectorAll('.abjure-target-selected');
    expect(selectedRows.length).toBe(1);
    expect(selectedRows[0].textContent).toContain('Goblin B');
  });

  // ── Shake Free action - no selection ──

  it('does not call executeHandler without selection', async () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (none)' }));
    });
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('does not call addEntry without selection', async () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (none)' }));
    });
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('does not call onClose without selection', async () => {
    const onClose = vi.fn();
    render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (none)' }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Shake Free action - with selection ──

  it('calls executeHandler with correct action on shake', async () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    expect(executeHandler).toHaveBeenCalledWith(
      {
        automation: {
          type: 'hypnotic_pattern_shake',
          range: '60 ft',
        },
        name: 'Shake Out Stupor',
      },
      { name: 'Wizard1' },
      'test-campaign',
      null
    );
  });

  it('calls addEntry with correct log data on shake', async () => {
    executeHandler.mockResolvedValue({});
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[2]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Goblin B)' }));
    });
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'ability_use',
      characterName: 'Wizard1',
      abilityName: 'Shake Out Stupor',
      description: 'Wizard1 used an action to shake Goblin B out of its hypnotic stupor.',
      targetName: 'Goblin B',
      timestamp: expect.any(Number),
    });
  });

  it('calls onClose after successful shake', async () => {
    const onClose = vi.fn();
    executeHandler.mockResolvedValue({});
    render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[1]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Goblin A)' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows processing state during shake', async () => {
    let resolveHandler;
    executeHandler.mockReturnValue(new Promise(resolve => { resolveHandler = resolve; }));
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    expect(screen.getByText('Shaking target free...')).toBeInTheDocument();
    await act(async () => {
      resolveHandler({});
    });
  });

  it('hides processing state after shake completes', async () => {
    let resolveHandler;
    executeHandler.mockReturnValue(new Promise(resolve => { resolveHandler = resolve; }));
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    await act(async () => {
      resolveHandler({});
    });
    await waitFor(() => {
      expect(screen.queryByText('Shaking target free...')).not.toBeInTheDocument();
    });
  });

  it('hides buttons during processing state', async () => {
    executeHandler.mockReturnValue(new Promise(() => {}));
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Select a creature/)).not.toBeInTheDocument();
    });
  });

  it('hides target list during processing state', async () => {
    executeHandler.mockReturnValue(new Promise(() => {}));
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Orc Warrior' })).not.toBeInTheDocument();
    });
  });

  // ── Error handling ──

  it('calls onClose even when executeHandler throws', async () => {
    const onClose = vi.fn();
    executeHandler.mockRejectedValue(new Error('Handler failed'));
    render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides processing state after error', async () => {
    executeHandler.mockRejectedValue(new Error('Handler failed'));
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    await waitFor(() => {
      expect(screen.queryByText('Shaking target free...')).not.toBeInTheDocument();
    });
  });

  it('does not call addEntry when executeHandler returns falsy on error', async () => {
    executeHandler.mockResolvedValue(null);
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    expect(addEntry).not.toHaveBeenCalled();
  });

  // ── Default feature name ──

  it('renders with default feature name when featureName is not provided', () => {
    render(<HypnoticPatternShakeModal {...makeProps({ featureName: undefined })} />);
    expect(screen.getByText('Shake Out Stupor')).toBeInTheDocument();
  });

  it('uses custom feature name in header when provided', () => {
    render(<HypnoticPatternShakeModal {...makeProps({ featureName: 'Custom Shake' })} />);
    expect(screen.getByText('Custom Shake')).toBeInTheDocument();
  });

  // ── Range display ──

  it('displays correct range in prompt text', () => {
    render(<HypnoticPatternShakeModal {...makeProps({ rangeFeet: 30 })} />);
    expect(screen.getByText(/within 30 feet/)).toBeInTheDocument();
  });

  it('displays correct range in automation action', async () => {
    render(<HypnoticPatternShakeModal {...makeProps({ rangeFeet: 45 })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    expect(executeHandler).toHaveBeenCalledWith(
      {
        automation: {
          type: 'hypnotic_pattern_shake',
          range: '45 ft',
        },
        name: 'Shake Out Stupor',
      },
      { name: 'Wizard1' },
      'test-campaign',
      null
    );
  });

  // ── Empty targets ──

  it('renders with empty targets list', () => {
    render(<HypnoticPatternShakeModal {...makeProps({ targets: [] })} />);
    expect(document.querySelector('.abjure-targets-list')).toBeInTheDocument();
    const rows = document.querySelectorAll('.abjure-target-row');
    expect(rows.length).toBe(0);
  });

  it('keeps Shake Free button disabled with empty targets', () => {
    render(<HypnoticPatternShakeModal {...makeProps({ targets: [] })} />);
    const shakeBtn = screen.getByRole('button', { name: 'Shake Free (none)' });
    expect(shakeBtn).toBeDisabled();
  });

  // ── Single target ──

  it('renders with single target', () => {
    render(<HypnoticPatternShakeModal {...makeProps({ targets: ['Orc Warrior'] })} />);
    expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(1);
  });

  it('calls executeHandler with single target selection', async () => {
    executeHandler.mockResolvedValue({});
    render(<HypnoticPatternShakeModal {...makeProps({ targets: ['Orc Warrior'] })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'ability_use',
      characterName: 'Wizard1',
      abilityName: 'Shake Out Stupor',
      description: 'Wizard1 used an action to shake Orc Warrior out of its hypnotic stupor.',
      targetName: 'Orc Warrior',
      timestamp: expect.any(Number),
    });
  });

  // ── Attacker name in log entry ──

  it('uses attackerName in log entry characterName', async () => {
    executeHandler.mockResolvedValue({});
    render(<HypnoticPatternShakeModal {...makeProps({ attackerName: 'Sorcerer3' })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    const logCall = addEntry.mock.calls[0][1];
    expect(logCall.characterName).toBe('Sorcerer3');
  });

  // ── Campaign name in calls ──

  it('passes campaignName to executeHandler', async () => {
    executeHandler.mockResolvedValue({});
    render(<HypnoticPatternShakeModal {...makeProps({ campaignName: 'my-campaign' })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    expect(executeHandler).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'my-campaign',
      null
    );
  });

  it('passes campaignName to addEntry', async () => {
    executeHandler.mockResolvedValue({});
    render(<HypnoticPatternShakeModal {...makeProps({ campaignName: 'my-campaign' })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    expect(addEntry).toHaveBeenCalledWith('my-campaign', expect.any(Object));
  });

  // ── Timestamp in log entry ──

  it('includes timestamp in log entry', async () => {
    executeHandler.mockResolvedValue({});
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    const logCall = addEntry.mock.calls[0][1];
    expect(typeof logCall.timestamp).toBe('number');
  });

  // ── Log entry description ──

  it('includes target name in log entry description', async () => {
    executeHandler.mockResolvedValue({});
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[1]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Goblin A)' }));
    });
    const logCall = addEntry.mock.calls[0][1];
    expect(logCall.description).toContain('Goblin A');
  });

  it('includes hypnotic stupor phrase in log description', async () => {
    executeHandler.mockResolvedValue({});
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    await act(async () => {
      fireEvent.click(radios[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    });
    const logCall = addEntry.mock.calls[0][1];
    expect(logCall.description).toContain('hypnotic stupor');
  });
});
