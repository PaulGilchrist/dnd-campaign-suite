// @maintained-by-ai 2026-11-28
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShieldBashChoiceModal from './ShieldBashChoiceModal.jsx';

vi.mock('../../../services/combat/steps/features/shieldBash.js', () => ({
  applyShieldBashEffect: vi.fn(),
}));

import * as shieldBash from '../../../services/combat/steps/features/shieldBash.js';

// The component forwards `action` verbatim and renders its own hardcoded
// Push/Prone options — only these six props are read.
const baseProps = {
  action: { name: 'Shield Bash' },
  playerStats: { name: 'Fighter1', level: 5 },
  campaignName: 'test-campaign',
  targetName: 'Orc',
  saveDc: 13,
  onClose: vi.fn(),
};

function makeProps(overrides = {}) {
  return { ...baseProps, ...overrides };
}

function expectedPayload(chosenOption) {
  return {
    action: baseProps.action,
    playerStats: baseProps.playerStats,
    campaignName: baseProps.campaignName,
    targetName: baseProps.targetName,
    chosenOption,
    saveDc: baseProps.saveDc,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ShieldBashChoiceModal', () => {
  it('renders both options with target/DC context, "<Option> <target>" radio names (multi-word target), and an inert Apply', () => {
    // Rendered with a multi-word target so the accessible names prove the
    // aria-label interpolation ("Push Goblin 2"): without it the computed
    // name would be the mashed label text ("Push — Push target 5 feet...")
    // and these role queries would fail. Also pins the fix#313 no-inline-style
    // recipe at rest (RAW 5-foot fallback copy lives here too).
    render(<ShieldBashChoiceModal {...makeProps({ targetName: 'Goblin 2' })} />);

    expect(screen.getByText('Shield Bash')).toBeInTheDocument();
    expect(screen.getByText(/Choose an effect for/)).toBeInTheDocument();
    expect(screen.getByText('Goblin 2')).toBeInTheDocument();
    expect(screen.getByText(/DC 13/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Push Goblin 2' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Prone Goblin 2' })).not.toBeChecked();
    expect(screen.getByText(/Push target 5 feet away from you/)).toBeInTheDocument();
    expect(screen.getByText(/Target gains Prone condition/)).toBeInTheDocument();
    expect(document.querySelector('[style]')).toBeNull();

    const apply = screen.getByRole('button', { name: /Apply Effect/ });
    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(shieldBash.applyShieldBashEffect).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('selects an option on click, enforces single-choice until Apply, and keeps zero inline styles when the highlight moves', () => {
    const { container } = render(<ShieldBashChoiceModal {...makeProps()} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Push Orc' }));
    expect(screen.getByRole('radio', { name: 'Push Orc' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'Prone Orc' }));
    expect(screen.getByRole('radio', { name: 'Prone Orc' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Push Orc' })).not.toBeChecked();
    expect(shieldBash.applyShieldBashEffect).not.toHaveBeenCalled();
    // Selection highlight is class-driven even in its dynamic state (fix#313).
    expect(container.querySelector('[style]')).toBeNull();
  });

  it.each(['Push', 'Prone'])(
    'dispatches %s with the exact payload, shows the result view, and closes via Done',
    async (option) => {
      const description = `Shield Bash: Orc ${option === 'Push' ? 'pushed 5 ft' : 'is Prone'}`;
      shieldBash.applyShieldBashEffect.mockResolvedValue({ type: 'popup', payload: { description } });
      const onClose = vi.fn();
      render(<ShieldBashChoiceModal {...makeProps({ onClose })} />);

      fireEvent.click(screen.getByRole('radio', { name: `${option} Orc` }));
      fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

      expect(shieldBash.applyShieldBashEffect).toHaveBeenCalledWith(expectedPayload(option));

      await waitFor(() => {
        expect(screen.getByText(description)).toBeInTheDocument();
      });
      expect(screen.queryByText(/Choose an effect for/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    },
  );

  it('dispatches skip without a selection and closes immediately', () => {
    shieldBash.applyShieldBashEffect.mockResolvedValue(null);
    const onClose = vi.fn();
    render(<ShieldBashChoiceModal {...makeProps({ onClose })} />);

    fireEvent.click(screen.getByRole('button', { name: /Skip \(do not consume use\)/ }));

    expect(shieldBash.applyShieldBashEffect).toHaveBeenCalledWith(expectedPayload('skip'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays in the choice view when apply resolves with a null result', async () => {
    shieldBash.applyShieldBashEffect.mockResolvedValue(null);
    render(<ShieldBashChoiceModal {...makeProps()} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Push Orc' }));
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
    await waitFor(() => {
      expect(shieldBash.applyShieldBashEffect).toHaveBeenCalled();
    });

    expect(screen.getByText(/Choose an effect for/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to apply/)).not.toBeInTheDocument();
    // selection retained, so the player can retry
    expect(screen.getByRole('radio', { name: 'Push Orc' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).not.toBeDisabled();
  });

  it('shows an inline error and keeps the selection retryable when apply rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    shieldBash.applyShieldBashEffect.mockRejectedValue(new Error('Network error'));
    render(<ShieldBashChoiceModal {...makeProps()} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Push Orc' }));
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Failed to apply Shield Bash: Network error')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Push Orc' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).not.toBeDisabled();
    consoleError.mockRestore();
  });

  it('is not dismissed by clicking the overlay backdrop or the modal body', () => {
    const onClose = vi.fn();
    const { container } = render(<ShieldBashChoiceModal {...makeProps({ onClose })} />);

    // Class-independent: root element is the backdrop, its child the modal.
    const backdrop = container.firstElementChild;
    fireEvent.click(backdrop);
    fireEvent.click(backdrop.firstElementChild);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeInTheDocument();
  });

  it('derives Push copy from caller action.options value, falling back to the RAW 5 feet', () => {
    // Copy-normalization lane: the RAW Shield Bash feat fixes the push at
    // 5 feet (public/data/2024/feats.json:2633 "push the target 5 feet from
    // you") and every current caller passes value: 5 (shieldBash.js:158), so
    // the hardcoded copy was RULE-CORRECT (refuted with RAW cite). This pin
    // guarantees the honest middle: options-driven copy when present, RAW
    // default otherwise. Base-props lane (no options → "5 feet") is pinned
    // by the first test above.
    render(<ShieldBashChoiceModal {...makeProps({
      action: {
        name: 'Shield Bash',
        options: [
          { name: 'Push', effect: 'push', value: 10 },
          { name: 'Prone', effect: 'prone' },
        ],
      },
    })} />);

    expect(screen.getByText(/Push target 10 feet away from you/)).toBeInTheDocument();
    expect(screen.queryByText(/Push target 5 feet away from you/)).not.toBeInTheDocument();
    expect(screen.getByText(/Target gains Prone condition/)).toBeInTheDocument();
  });
});
