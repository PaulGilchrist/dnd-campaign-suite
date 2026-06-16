import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WildMagicDoubleRollModal from './WildMagicDoubleRollModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js', () => ({
  onDoubleRollSelected: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as wildMagicSurgeHandler from '../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';

// ── Test fixtures ──

const surgeTable = [
  { min: 1, max: 5, effect: 'You lose track of where you are until the spell ends. You disappear from the current plane of existence and appear in the Astral Plane. You remain there until the spell ends, at which point you return to the space you left behind or the closest available space.' },
  { min: 6, max: 10, effect: 'Each creature within 30 feet of you must succeed on a DC 15 Constitution saving throw or take 2d10 fire damage and be blinded for 1 minute. A creature takes half damage on a successful save.' },
  { min: 11, max: 15, effect: 'Your body becomes larger than normal. You gain advantage on Strength checks and Strength saving throws, your carrying capacity doubles, and you have disadvantage on Dexterity checks and Dexterity saving throws.' },
  { min: 16, max: 20, effect: 'You temporarily become untethered from reality. You gain resistance to all damage for 1 minute. You also can\'t be targeted by attacks or be chosen as the target of a spell.' },
];

const baseProps = {
  featureName: 'Wild Magic Surge',
  roll1: 14,
  roll2: 7,
  surgeTable,
  campaignName: 'test-campaign',
  playerStats: { name: 'Sorcerer1', level: 3 },
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('WildMagicDoubleRollModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    wildMagicSurgeHandler.onDoubleRollSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Wild Magic Surge',
        description: '<b>Wild Magic Surge: SURGE! (Rolled 14)</b><br/><br/>Your body becomes larger than normal...',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal content container', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders modal header with feature name', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(screen.getByText('Wild Magic Surge')).toBeInTheDocument();
  });

  it('renders Font Awesome bolt icon in header', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-bolt');
    expect(icon).toBeInTheDocument();
  });

  it('displays "Choose your roll" instruction', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(screen.getByText(/Choose your roll/)).toBeInTheDocument();
  });

  it('renders Roll 1 button with roll value', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Roll 1: 14/ })).toBeInTheDocument();
  });

  it('renders Roll 2 button with roll value', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Roll 2: 7/ })).toBeInTheDocument();
  });

  it('shows surge effect preview for roll 1', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    const roll1Btn = screen.getByRole('button', { name: /Roll 1: 14/ });
    expect(roll1Btn.textContent).toContain('Your body becomes larger than normal');
  });

  it('shows surge effect preview for roll 2', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    const roll2Btn = screen.getByRole('button', { name: /Roll 2: 7/ });
    expect(roll2Btn.textContent).toContain('Each creature within 30 feet');
  });

  it('truncates long surge effect descriptions at 80 characters', () => {
    render(<WildMagicDoubleRollModal {...makeProps({ roll1: 1, roll2: 20 })} />);
    const roll1Btn = screen.getByRole('button', { name: /Roll 1: 1/ });
    expect(roll1Btn.textContent).toContain('...');
  });

  it('does not show surge effect text when no matching surge entry', () => {
    render(<WildMagicDoubleRollModal {...makeProps({ surgeTable: [] })} />);
    const roll1Btn = screen.getByRole('button', { name: /Roll 1: 14/ });
    expect(roll1Btn.textContent).not.toContain('...');
  });

  it('renders Cancel button', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Done button after selection', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides Cancel button after selection', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('hides roll selection buttons after selection', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Roll 1: 14/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Roll 2: 7/ })).not.toBeInTheDocument();
    });
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<WildMagicDoubleRollModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<WildMagicDoubleRollModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<WildMagicDoubleRollModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Roll 1 selection ──

  it('calls onDoubleRollSelected with selected roll 1', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    expect(wildMagicSurgeHandler.onDoubleRollSelected).toHaveBeenCalledWith(
      { featureName: 'Wild Magic Surge', surgeTable },
      { name: 'Sorcerer1', level: 3 },
      'test-campaign',
      14
    );
  });

  it('calls onDoubleRollSelected with selected roll 2', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 2: 7/ }));
    });
    expect(wildMagicSurgeHandler.onDoubleRollSelected).toHaveBeenCalledWith(
      { featureName: 'Wild Magic Surge', surgeTable },
      { name: 'Sorcerer1', level: 3 },
      'test-campaign',
      7
    );
  });

  it('displays surge result description after selection', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/SURGE/)).toBeInTheDocument();
    });
  });

  it('renders result body with dangerouslySetInnerHTML', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body).toHaveProperty('innerHTML');
    });
  });

  it('shows Done button in actions after selection', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });
  });

  // ── Roll 2 selection ──

  it('displays surge result for roll 2 selection', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 2: 7/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/SURGE/)).toBeInTheDocument();
    });
  });

  // ── Done button ──

  it('calls onClose when Done button is clicked', async () => {
    const onClose = vi.fn();
    render(<WildMagicDoubleRollModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Done button is clicked after roll 2', async () => {
    const onClose = vi.fn();
    render(<WildMagicDoubleRollModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 2: 7/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Overlay click after selection ──

  it('calls onClose when clicking overlay after selection', async () => {
    const onClose = vi.fn();
    render(<WildMagicDoubleRollModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Edge cases ──

  it('renders with null playerStats using default name', async () => {
    render(<WildMagicDoubleRollModal {...makeProps({ playerStats: null })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    expect(wildMagicSurgeHandler.onDoubleRollSelected).toHaveBeenCalledWith(
      { featureName: 'Wild Magic Surge', surgeTable },
      { name: 'Player' },
      'test-campaign',
      14
    );
  });

  it('renders with empty surge table without crashing', () => {
    render(<WildMagicDoubleRollModal {...makeProps({ surgeTable: [] })} />);
    expect(screen.getByRole('button', { name: /Roll 1: 14/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Roll 2: 7/ })).toBeInTheDocument();
  });

  it('handles onDoubleRollSelected rejection without crashing', async () => {
    const err = new Error('Network error');
    wildMagicSurgeHandler.onDoubleRollSelected.mockRejectedValue(err);
    const { UNSAFE_warning } = console;
    console.warn = () => {};
    const unhandlerHandler = () => {};
    process.on('unhandledRejection', unhandlerHandler);
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    console.warn = UNSAFE_warning;
    process.off('unhandledRejection', unhandlerHandler);
    await waitFor(() => {
      expect(screen.queryByText(/SURGE/)).not.toBeInTheDocument();
    });
  });

  it('renders with custom feature name', () => {
    render(<WildMagicDoubleRollModal {...makeProps({ featureName: 'Arcane Chaos' })} />);
    expect(screen.getByText('Arcane Chaos')).toBeInTheDocument();
  });

  it('renders with different roll values', () => {
    render(<WildMagicDoubleRollModal {...makeProps({ roll1: 1, roll2: 20 })} />);
    expect(screen.getByRole('button', { name: /Roll 1: 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Roll 2: 20/ })).toBeInTheDocument();
  });

  it('renders all modal CSS structure classes', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('shows "Controlled Chaos" label in modal body', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(screen.getByText(/Controlled Chaos/)).toBeInTheDocument();
  });

  it('renders roll buttons with sp-roll-btn class', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    expect(buttons).toHaveLength(2);
  });

  it('renders cancel button with sp-dismiss-btn class', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    const cancelBtn = document.querySelector('.sp-dismiss-btn');
    expect(cancelBtn).toBeInTheDocument();
    expect(cancelBtn.textContent).toBe('Cancel');
  });

  it('renders done button with sp-roll-btn class', async () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
    });
    await waitFor(() => {
      const doneBtn = document.querySelector('.sp-actions .sp-roll-btn');
      expect(doneBtn).toBeInTheDocument();
      expect(doneBtn.textContent).toBe('Done');
    });
  });

  it('does not show result on initial render', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(screen.queryByText(/SURGE/)).not.toBeInTheDocument();
  });

  it('does not show Done button on initial render', () => {
    render(<WildMagicDoubleRollModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });
});
