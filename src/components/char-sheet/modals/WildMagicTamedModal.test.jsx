import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WildMagicTamedModal from './WildMagicTamedModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js', () => ({
  onTamedSurgeSelected: vi.fn(),
}));

// ── Re-import mocked modules ──

import { onTamedSurgeSelected } from '../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';

// ── Test fixtures ──

const baseProps = {
  featureName: 'Tamed Surge',
  availableSurges: [
    { effect: 'You gain advantage on the next attack roll you make this turn.' },
    { effect: 'Your speed doubles until the end of your next turn.' },
    { effect: 'You regain 2d8 hit points.' },
    { effect: 'A random creature within 60 feet of you becomes charmed until the end of your next turn.' },
    { effect: 'You emit a bright flash of light in a 10-foot radius. Each creature in that radius must succeed on a CON saving throw or be blinded until the end of your next turn.' },
  ],
  campaignName: 'test-campaign',
  playerStats: { name: 'Sorcerer1' },
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('WildMagicTamedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal with proper CSS classes', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders header with bolt icon and feature name', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    expect(screen.getByText('Tamed Surge')).toBeInTheDocument();
    const icon = document.querySelector('.fa-solid.fa-bolt');
    expect(icon).toBeInTheDocument();
  });

  it('renders feature name from props', () => {
    render(<WildMagicTamedModal {...makeProps({ featureName: 'Wild Magic Tamed' })} />);
    expect(screen.getByText('Wild Magic Tamed')).toBeInTheDocument();
  });

  it('displays instructional text', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    expect(screen.getByText(/Tamed Surge — Choose your effect:/)).toBeInTheDocument();
    expect(screen.getByText(/Choose one effect from the Wild Magic Surge table/)).toBeInTheDocument();
  });

  it('renders surge selection buttons for each available surge', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    expect(buttons).toHaveLength(5);
  });

  it('truncates long surge effect text to 120 characters', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    // The last surge effect is longer than 120 chars
    expect(buttons[4].textContent).toContain('...');
    expect(buttons[4].textContent.length).toBeLessThanOrEqual(123);
  });

  it('does not truncate short surge effect text', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    // First surge effect is short
    expect(buttons[0].textContent).toBe('You gain advantage on the next attack roll you make this turn.');
  });

  it('renders Cancel button', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not render Done button on initial render', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<WildMagicTamedModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<WildMagicTamedModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<WildMagicTamedModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Surge selection ──

  it('calls onTamedSurgeSelected when a surge button is clicked', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(onTamedSurgeSelected).toHaveBeenCalledWith(
      { name: 'Tamed Surge', automation: { type: 'wild_magic_tamed' } },
      { name: 'Sorcerer1' },
      'test-campaign',
      baseProps.availableSurges[0]
    );
  });

  it('displays result after surge selection', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      expect(screen.getByText('Tamed Surge')).toBeInTheDocument();
    });
  });

  it('renders Done button after surge selection', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides surge selection buttons after surge selection', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /advantage/ })).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after surge selection', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('displays surge description from result payload', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage on the next attack.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      expect(screen.getByText(/Tamed Surge!/)).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after surge selection', async () => {
    const onClose = vi.fn();
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps({ onClose })} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onTamedSurgeSelected with correct selected surge object', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>Speed doubles.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[2]);
    });
    expect(onTamedSurgeSelected).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(String),
      baseProps.availableSurges[2]
    );
  });

  it('renders result overlay with bolt icon', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      const icon = document.querySelector('.fa-solid.fa-bolt');
      expect(icon).toBeInTheDocument();
    });
  });

  it('calls onTamedSurgeSelected with featureName and automation type', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(onTamedSurgeSelected).toHaveBeenCalledWith(
      { name: 'Tamed Surge', automation: { type: 'wild_magic_tamed' } },
      expect.any(Object),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('calls onTamedSurgeSelected with campaignName', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps({ campaignName: 'my-campaign' })} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(onTamedSurgeSelected).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'my-campaign',
      expect.any(Object)
    );
  });

  it('calls onTamedSurgeSelected with playerStats', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    const customStats = { name: 'Mage1', level: 5 };
    render(<WildMagicTamedModal {...makeProps({ playerStats: customStats })} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(onTamedSurgeSelected).toHaveBeenCalledWith(
      expect.any(Object),
      customStats,
      expect.any(String),
      expect.any(Object)
    );
  });

  // ── Edge cases ──

  it('renders with empty availableSurges array', () => {
    render(<WildMagicTamedModal {...makeProps({ availableSurges: [] })} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(screen.getByText(/Tamed Surge — Choose your effect:/)).toBeInTheDocument();
    const buttons = document.querySelectorAll('.sp-roll-btn');
    expect(buttons).toHaveLength(0);
  });

  it('renders with default playerStats when undefined', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps({ playerStats: undefined })} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(onTamedSurgeSelected).toHaveBeenCalledWith(
      expect.any(Object),
      { name: 'Player' },
      expect.any(String),
      expect.any(Object)
    );
  });

  it('renders result with featureName in header after selection', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Wild Magic Tamed',
        description: '<b>Wild Magic Tamed: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps({ featureName: 'Wild Magic Tamed' })} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      expect(screen.getByText('Wild Magic Tamed')).toBeInTheDocument();
    });
  });

  it('renders result with surge description HTML content', async () => {
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage on the next attack roll.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.innerHTML).toContain('Tamed Surge!');
    });
  });

  it('calls onClose when clicking overlay after result', async () => {
    const onClose = vi.fn();
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps({ onClose })} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking modal content after result', async () => {
    const onClose = vi.fn();
    onTamedSurgeSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Tamed Surge',
        description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
        automation: { type: 'wild_magic_tamed' },
      },
    });
    render(<WildMagicTamedModal {...makeProps({ onClose })} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders surge buttons with correct truncated text lengths', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    buttons.forEach((btn) => {
      expect(btn.textContent.length).toBeLessThanOrEqual(123);
    });
  });

  it('renders each surge button with unique key', () => {
    render(<WildMagicTamedModal {...makeProps()} />);
    const buttons = document.querySelectorAll('.sp-roll-btn');
    const texts = Array.from(buttons).map(b => b.textContent);
    // First two are short and unique
    expect(texts[0]).toBe('You gain advantage on the next attack roll you make this turn.');
    expect(texts[1]).toBe('Your speed doubles until the end of your next turn.');
    expect(texts[0]).not.toBe(texts[1]);
  });
});
