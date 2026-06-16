import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConstellationSelectionModal from './ConstellationSelectionModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
  applyConstellationOption: vi.fn(async () => ({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Starry Form',
      automationType: 'constellation_selection',
      description: 'Archer constellation chosen. Ranged Spell Attack: 1d8 + Wisdom Modifier Radiant damage.',
      automation: { type: 'constellation_selection' },
    },
  })),
}));

// ── Re-import mocked modules ──

import * as starryFormHandler from '../../../services/automation/handlers/class-sorcerer/starryFormHandler.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Starry Form', automation: { type: 'constellation_selection' } },
  playerStats: { name: 'Sorcerer1', level: 5 },
  campaignName: 'test-campaign',
  isTwinkled: false,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('ConstellationSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    starryFormHandler.applyConstellationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Starry Form',
        automationType: 'constellation_selection',
        description: 'Archer constellation chosen. Ranged Spell Attack: 1d8 + Wisdom Modifier Radiant damage.',
        automation: { type: 'constellation_selection' },
      },
    });
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal container with proper CSS classes', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders modal header with action name', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    expect(screen.getByText('Starry Form')).toBeInTheDocument();
  });

  it('renders Font Awesome star icon in header', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    const icon = document.querySelector('.fa-star');
    expect(icon).toBeInTheDocument();
  });

  it('displays "Choose a constellation:" prompt', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    expect(screen.getByText('Choose a constellation:')).toBeInTheDocument();
  });

  it('renders all three constellation option buttons', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Archer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chalice/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dragon/ })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Choose button disabled when nothing selected', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    const chooseBtn = screen.getByRole('button', { name: 'Choose' });
    expect(chooseBtn).toBeDisabled();
  });

  // ── Archer option display ──

  it('shows Archer ranged spell attack effect text', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
    const archerBtn = screen.getByRole('button', { name: /Archer/ });
    expect(archerBtn.textContent).toContain('Ranged Spell Attack: 1d8 + Wisdom Modifier Radiant damage');
  });

  it('shows Archer 2d8 when twinkled', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
    const archerBtn = screen.getByRole('button', { name: /Archer/ });
    expect(archerBtn.textContent).toContain('2d8');
  });

  // ── Chalice option display ──

  it('shows Chalice healing spell effect text', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
    const chaliceBtn = screen.getByRole('button', { name: /Chalice/ });
    expect(chaliceBtn.textContent).toContain('Healing Spell: 1d8 + Wisdom Modifier HP to ally within 30 feet');
  });

  it('shows Chalice 2d8 when twinkled', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
    const chaliceBtn = screen.getByRole('button', { name: /Chalice/ });
    expect(chaliceBtn.textContent).toContain('2d8');
  });

  // ── Dragon option display ──

  it('shows Dragon concentration benefit text', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
    const dragonBtn = screen.getByRole('button', { name: /Dragon/ });
    expect(dragonBtn.textContent).toContain('Treat d20 rolls of 9 or lower as 10');
  });

  it('does not show fly speed when not twinkled', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
    const dragonBtn = screen.getByRole('button', { name: /Dragon/ });
    expect(dragonBtn.textContent).not.toContain('Fly Speed');
  });

  it('shows Dragon fly speed when twinkled', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
    const dragonBtn = screen.getByRole('button', { name: /Dragon/ });
    expect(dragonBtn.textContent).toContain('Fly Speed 20 feet (hover)');
  });

  // ── Selection behavior ──

  it('enables Choose button after selecting a constellation', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    const chooseBtn = screen.getByRole('button', { name: 'Choose' });
    expect(chooseBtn).toBeEnabled();
  });

  it('tracks selected constellation internally', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Chalice/ }));
    expect(screen.getByRole('button', { name: 'Choose' })).toBeEnabled();
  });

  it('allows switching selection between options', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Dragon/ }));
    expect(screen.getByRole('button', { name: 'Choose' })).toBeEnabled();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Choose flow ──

  it('calls applyConstellationOption with selected option on Choose click', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledWith(
      baseProps.action,
      baseProps.playerStats,
      baseProps.campaignName,
      'Archer'
    );
  });

  it('calls onConfirm with selected option on Choose click', async () => {
    const onConfirm = vi.fn();
    render(<ConstellationSelectionModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: /Chalice/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    expect(onConfirm).toHaveBeenCalledWith('Chalice');
  });

  it('shows success result state after choosing', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });
  });

  it('displays action name in result header', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Starry Form')).toBeInTheDocument();
    });
  });

  it('renders Font Awesome star icon in result header', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      const icon = document.querySelector('.sp-header .fa-star');
      expect(icon).toBeInTheDocument();
    });
  });

  it('displays result payload description in body', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Archer constellation chosen');
    });
  });

  it('renders Done button after choosing', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides Cancel button after choosing', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('hides constellation options after choosing', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      expect(screen.queryByText('Choose a constellation:')).not.toBeInTheDocument();
    });
  });

  it('hides Choose button after choosing', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after choosing', async () => {
    const onClose = vi.fn();
    render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Choose button disabled when no selection ──

  it('does not call applyConstellationOption when choosing with no selection', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    expect(starryFormHandler.applyConstellationOption).not.toHaveBeenCalled();
  });

  it('does not call onConfirm when choosing with no selection', async () => {
    const onConfirm = vi.fn();
    render(<ConstellationSelectionModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Different constellation options ──

  it('calls applyConstellationOption with Dragon option', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Dragon/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledWith(
      baseProps.action,
      baseProps.playerStats,
      baseProps.campaignName,
      'Dragon'
    );
  });

  it('calls onConfirm with Dragon option', async () => {
    const onConfirm = vi.fn();
    render(<ConstellationSelectionModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: /Dragon/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    expect(onConfirm).toHaveBeenCalledWith('Dragon');
  });

  // ── Result state with different mock responses ──

  it('displays Chalice description in result body', async () => {
    starryFormHandler.applyConstellationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Starry Form',
        automationType: 'constellation_selection',
        description: 'Chalice constellation chosen. Healing Spell Ally Buff.',
        automation: { type: 'constellation_selection' },
      },
    });
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Chalice/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Chalice constellation chosen');
    });
  });

  it('displays Dragon description in result body', async () => {
    starryFormHandler.applyConstellationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Starry Form',
        automationType: 'constellation_selection',
        description: 'Dragon constellation chosen. Concentration Benefit.',
        automation: { type: 'constellation_selection' },
      },
    });
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Dragon/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Dragon constellation chosen');
    });
  });

  // ── Custom action name ──

  it('renders custom action name in header', () => {
    render(<ConstellationSelectionModal {...makeProps({ action: { name: 'My Custom Starry Form', automation: { type: 'constellation_selection' } } })} />);
    expect(screen.getByText('My Custom Starry Form')).toBeInTheDocument();
  });

  it('renders custom action name in result header', async () => {
    render(<ConstellationSelectionModal {...makeProps({ action: { name: 'My Custom Starry Form', automation: { type: 'constellation_selection' } } })} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      expect(screen.getByText('My Custom Starry Form')).toBeInTheDocument();
    });
  });

  // ── Result state uses dangerouslySetInnerHTML ──

  it('renders result description via dangerouslySetInnerHTML', async () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.innerHTML).toContain('Archer constellation chosen');
    });
  });

  // ── Overlay click after result ──

  it('calls onClose when clicking overlay after choosing', async () => {
    const onClose = vi.fn();
    render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── isTwinkled false (default) ──

  it('shows 1d8 for Archer when isTwinkled is false', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
    const archerBtn = screen.getByRole('button', { name: /Archer/ });
    expect(archerBtn.textContent).toContain('1d8');
  });

  it('shows 1d8 for Chalice when isTwinkled is false', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
    const chaliceBtn = screen.getByRole('button', { name: /Chalice/ });
    expect(chaliceBtn.textContent).toContain('1d8');
  });

  // ── isTwinkled true ──

  it('shows 2d8 for Archer when isTwinkled is true', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
    const archerBtn = screen.getByRole('button', { name: /Archer/ });
    expect(archerBtn.textContent).toContain('2d8');
  });

  it('shows 2d8 for Chalice when isTwinkled is true', () => {
    render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
    const chaliceBtn = screen.getByRole('button', { name: /Chalice/ });
    expect(chaliceBtn.textContent).toContain('2d8');
  });

  // ── No result state on initial render ──

  it('does not show result on initial render', () => {
    render(<ConstellationSelectionModal {...makeProps()} />);
    expect(screen.getByText('Choose a constellation:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });
});
