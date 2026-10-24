// @maintained-by-ai
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
  it('renders the choice UI with both options, target/DC context, and an inert Apply until selected', () => {
    render(<ShieldBashChoiceModal {...makeProps()} />);

    expect(screen.getByText('Shield Bash')).toBeInTheDocument();
    expect(screen.getByText(/Choose an effect for/)).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText(/DC 13/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /Push/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Prone/ })).not.toBeChecked();
    expect(screen.getByText(/Push target 5 feet away from you/)).toBeInTheDocument();
    expect(screen.getByText(/Target gains Prone condition/)).toBeInTheDocument();

    const apply = screen.getByRole('button', { name: /Apply Effect/ });
    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(shieldBash.applyShieldBashEffect).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('selects an option on click and enforces single-choice until Apply', () => {
    render(<ShieldBashChoiceModal {...makeProps()} />);

    fireEvent.click(screen.getByRole('radio', { name: /Push/ }));
    expect(screen.getByRole('radio', { name: /Push/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /Prone/ }));
    expect(screen.getByRole('radio', { name: /Prone/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Push/ })).not.toBeChecked();
    expect(shieldBash.applyShieldBashEffect).not.toHaveBeenCalled();
  });

  it.each(['Push', 'Prone'])(
    'dispatches %s with the exact payload, shows the result view, and closes via Done',
    async (option) => {
      const description = `Shield Bash: Orc ${option === 'Push' ? 'pushed 5 ft' : 'is Prone'}`;
      shieldBash.applyShieldBashEffect.mockResolvedValue({ type: 'popup', payload: { description } });
      const onClose = vi.fn();
      render(<ShieldBashChoiceModal {...makeProps({ onClose })} />);

      fireEvent.click(screen.getByRole('radio', { name: new RegExp(option) }));
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

    fireEvent.click(screen.getByRole('radio', { name: /Push/ }));
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
    await waitFor(() => {
      expect(shieldBash.applyShieldBashEffect).toHaveBeenCalled();
    });

    expect(screen.getByText(/Choose an effect for/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to apply/)).not.toBeInTheDocument();
    // selection retained, so the player can retry
    expect(screen.getByRole('radio', { name: /Push/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).not.toBeDisabled();
  });

  it('shows an inline error and keeps the selection retryable when apply rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    shieldBash.applyShieldBashEffect.mockRejectedValue(new Error('Network error'));
    render(<ShieldBashChoiceModal {...makeProps()} />);

    fireEvent.click(screen.getByRole('radio', { name: /Push/ }));
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Failed to apply Shield Bash: Network error')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Push/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).not.toBeDisabled();
    consoleError.mockRestore();
  });

  it('is not dismissed by clicking the overlay or the modal body', () => {
    const onClose = vi.fn();
    const { container } = render(<ShieldBashChoiceModal {...makeProps({ onClose })} />);

    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeInTheDocument();
  });

  it('styles the choice list via scoped classes with zero inline styles (no-inline-styles convention)', () => {
    // fix#313 recipe pin: the former inline styles on the options container,
    // option labels, radio inputs, and effect spans (:50/:57/:63/:66-era) now
    // live in ShieldBashChoiceModal.css (exact-value migration). Selection
    // highlight rides the .selected modifier class (WarBondChooserModal
    // precedent), so even the dynamic selection state needs no inline style.
    render(<ShieldBashChoiceModal {...makeProps()} />);

    const list = document.querySelector('.shield-bash-options');
    expect(list).toBeTruthy();
    expect(list.getAttribute('style')).toBeNull();

    const rows = list.querySelectorAll('.shield-bash-option');
    expect(rows).toHaveLength(2);
    expect(list.querySelectorAll('.shield-bash-option-input')).toHaveLength(2);
    expect(list.querySelectorAll('.shield-bash-option-effect')).toHaveLength(2);

    // Choice view at rest AND after selecting Push: zero inline style attrs in the body.
    expect(document.querySelectorAll('.sp-body [style]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('radio', { name: /Push/ }));
    expect(rows[0].className).toContain('selected');
    expect(rows[1].className).not.toContain('selected');
    expect(document.querySelectorAll('.sp-body [style]')).toHaveLength(0);
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
    expect(document.querySelectorAll('.sp-body [style]')).toHaveLength(0);
  });
});
