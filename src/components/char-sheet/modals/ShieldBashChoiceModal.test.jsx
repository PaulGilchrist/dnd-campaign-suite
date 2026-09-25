// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShieldBashChoiceModal from './ShieldBashChoiceModal.jsx';

vi.mock('../../../services/combat/steps/features/shieldBash.js', () => ({
  applyShieldBashEffect: vi.fn(),
}));

import * as shieldBash from '../../../services/combat/steps/features/shieldBash.js';

const baseProps = {
  action: {
    name: 'Shield Bash',
    options: [
      { name: 'Push', effect: 'push', value: 5 },
      { name: 'Prone', effect: 'prone' },
    ],
  },
  playerStats: { name: 'Fighter1', level: 5 },
  campaignName: 'test-campaign',
  targetName: 'Orc',
  saveDc: 13,
  onClose: vi.fn(),
};

function makeProps(overrides = {}) {
  return { ...baseProps, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Initial render ──

describe('ShieldBashChoiceModal - initial render', () => {
  it('renders the modal with header, instruction text, options, and action buttons', () => {
    render(<ShieldBashChoiceModal {...makeProps()} />);
    expect(screen.getByText('Shield Bash')).toBeInTheDocument();
    expect(screen.getByText(/Choose an effect for/)).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText(/DC 13/)).toBeInTheDocument();
    expect(screen.getByText('Push')).toBeInTheDocument();
    expect(screen.getByText('Prone')).toBeInTheDocument();
    expect(screen.getByText(/Push target 5 feet away from you/)).toBeInTheDocument();
    expect(screen.getByText(/Target gains Prone condition/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skip \(do not consume use\)/ })).toBeInTheDocument();
  });

  it('has Apply Effect button disabled when no selection is made', () => {
    render(<ShieldBashChoiceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeDisabled();
  });
});

// ── Selection behavior ──

describe('ShieldBashChoiceModal - selection behavior', () => {
  it.each([['Push'], ['Prone']])(
    'selects %s option when clicked and enables Apply button',
    (option) => {
      render(<ShieldBashChoiceModal {...makeProps()} />);
      fireEvent.click(screen.getByText(option));
      expect(screen.getByRole('radio', { name: new RegExp(`${option}—`) })).toBeChecked();
      expect(screen.getByRole('button', { name: /Apply Effect/ })).not.toBeDisabled();
    },
  );

  it('switches selection when a different option is clicked', () => {
    render(<ShieldBashChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Push'));
    expect(screen.getByRole('radio', { name: /Push—/ })).toBeChecked();
    fireEvent.click(screen.getByText('Prone'));
    expect(screen.getByRole('radio', { name: /Prone—/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Push—/ })).not.toBeChecked();
  });
});

// ── Apply effect flow ──

describe('ShieldBashChoiceModal - apply effect', () => {
  it('does not call applyShieldBashEffect when Apply is clicked with no selection', () => {
    render(<ShieldBashChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
    expect(shieldBash.applyShieldBashEffect).not.toHaveBeenCalled();
  });

  it.each([
    ['Push', 'push', 'Orc pushed 5 ft'],
    ['Prone', 'prone', 'Orc has Prone condition'],
  ])(
    'calls applyShieldBashEffect with "%s" when Apply is clicked',
    async (option, _effectKey, description) => {
      shieldBash.applyShieldBashEffect.mockResolvedValue({
        type: 'popup',
        payload: { description: `Shield Bash: ${description}` },
      });
      render(<ShieldBashChoiceModal {...makeProps()} />);
      fireEvent.click(screen.getByText(option));
      fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      await waitFor(() => {
        expect(shieldBash.applyShieldBashEffect).toHaveBeenCalledWith({
          action: baseProps.action,
          playerStats: baseProps.playerStats,
          campaignName: baseProps.campaignName,
          targetName: baseProps.targetName,
          chosenOption: option,
          saveDc: baseProps.saveDc,
        });
      });
    },
  );

  it('shows result state with description after apply resolves', async () => {
    shieldBash.applyShieldBashEffect.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Shield Bash: Orc pushed 5 ft' },
    });
    render(<ShieldBashChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Push'));
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
    await waitFor(() => {
      expect(screen.getByText('Shield Bash')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.getByText('Shield Bash: Orc pushed 5 ft')).toBeInTheDocument();
    });
  });
});

// ── Done button ──

describe('ShieldBashChoiceModal - done button', () => {
  it('calls onClose when Done is clicked after apply', async () => {
    const onClose = vi.fn();
    shieldBash.applyShieldBashEffect.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Shield Bash: Orc pushed 5 ft' },
    });
    render(<ShieldBashChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Push'));
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Skip flow ──

describe('ShieldBashChoiceModal - skip flow', () => {
  it('calls applyShieldBashEffect with "skip" when Skip is clicked', async () => {
    shieldBash.applyShieldBashEffect.mockResolvedValue(null);
    render(<ShieldBashChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Skip \(do not consume use\)/ }));
    await waitFor(() => {
      expect(shieldBash.applyShieldBashEffect).toHaveBeenCalledWith({
        action: baseProps.action,
        playerStats: baseProps.playerStats,
        campaignName: baseProps.campaignName,
        targetName: baseProps.targetName,
        chosenOption: 'skip',
        saveDc: baseProps.saveDc,
      });
    });
  });

  it('calls onClose when Skip is clicked', async () => {
    const onClose = vi.fn();
    shieldBash.applyShieldBashEffect.mockResolvedValue(null);
    render(<ShieldBashChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Skip \(do not consume use\)/ }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

// ── Overlay click behavior ──

describe('ShieldBashChoiceModal - overlay click', () => {
  it('does not call onClose when overlay background is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<ShieldBashChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(container.querySelector('.sp-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeInTheDocument();
  });

  it('does not close when clicking inside the modal', () => {
    const onClose = vi.fn();
    const { container } = render(<ShieldBashChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(container.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── Null result handling ──

describe('ShieldBashChoiceModal - null result', () => {
  it('does not show result state when applyShieldBashEffect returns null', async () => {
    shieldBash.applyShieldBashEffect.mockResolvedValue(null);
    render(<ShieldBashChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Push'));
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });
});

// ── Error handling ──

describe('ShieldBashChoiceModal - error handling', () => {
  it('leaves modal in choice state when applyShieldBashEffect rejects', async () => {
    shieldBash.applyShieldBashEffect.mockRejectedValue(new Error('Network error'));
    render(<ShieldBashChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Push'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Choose an effect for/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });
});
