import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DragonCompanionModal from './DragonCompanionModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/dragonCompanionHandler.js', () => ({
  confirmDragonCompanion: vi.fn(async () => ({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Dragon Companion',
      description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining). Duration: 1 minute.<br/><br/><em>Open your spell sheet and cast Summon Dragon normally — no spell slot or material components will be consumed.</em>',
      automation: { spell: 'Summon Dragon', usesMax: 1 },
    },
  })),
}));

// ── Re-import mocked modules ──

import * as dragonCompanionHandler from '../../../services/automation/handlers/class-sorcerer/dragonCompanionHandler.js';

// ── Test fixtures ──

const baseProps = {
  action: {
    name: 'Dragon Companion',
    automation: { spell: 'Summon Dragon', usesMax: 1 },
  },
  playerStats: { name: 'Sorcerer1', level: 1 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('DragonCompanionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal container with sp-modal class', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders modal header with dragon icon and action name', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.getByText('Dragon Companion')).toBeInTheDocument();
    expect(document.querySelector('.fa-solid.fa-dragon')).toBeInTheDocument();
  });

  it('renders modal header with custom action name', () => {
    render(<DragonCompanionModal {...makeProps({ action: { name: 'My Dragon', automation: {} } })} />);
    expect(screen.getByText('My Dragon')).toBeInTheDocument();
  });

  it('describes the summon dragon behavior in modal body', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('Cast');
    expect(body.textContent).toContain('Summon Dragon');
    expect(body.textContent).toContain('without material components or spell slot');
  });

  it('renders concentration skip checkbox', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.getByLabelText(/Skip Concentration/)).toBeInTheDocument();
  });

  it('renders concentration skip description text', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.getByText(/The dragon companion will require Concentration and last up to 1 hour/)).toBeInTheDocument();
  });

  it('renders Summon Dragon button with dragon icon', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Summon Dragon/ })).toBeInTheDocument();
    expect(document.querySelector('.sp-actions .fa-solid.fa-dragon')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<DragonCompanionModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<DragonCompanionModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<DragonCompanionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Concentration checkbox behavior ──

  it('shows normal concentration description when checkbox is unchecked (default)', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.getByText(/The dragon companion will require Concentration and last up to 1 hour/)).toBeInTheDocument();
    expect(screen.queryByText(/will not require Concentration/)).not.toBeInTheDocument();
  });

  it('toggles checkbox when clicked', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    const checkbox = screen.getByLabelText(/Skip Concentration/);
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('shows skip concentration description when checkbox is checked', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    const checkbox = screen.getByLabelText(/Skip Concentration/);
    fireEvent.click(checkbox);
    expect(screen.getByText(/The dragon companion will not require Concentration and will last 1 minute/)).toBeInTheDocument();
  });

  it('shows skip concentration description when checkbox is checked then unchecked and rechecked', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    const checkbox = screen.getByLabelText(/Skip Concentration/);
    fireEvent.click(checkbox);
    expect(screen.getByText(/will not require Concentration/)).toBeInTheDocument();
    fireEvent.click(checkbox);
    expect(screen.getByText(/require Concentration/)).toBeInTheDocument();
    fireEvent.click(checkbox);
    expect(screen.getByText(/will not require Concentration/)).toBeInTheDocument();
  });

  // ── Confirm flow ──

  it('calls confirmDragonCompanion with noConcentration=false when checkbox is unchecked', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Test description',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    expect(dragonCompanionHandler.confirmDragonCompanion).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dragon Companion' }),
      expect.objectContaining({ name: 'Sorcerer1' }),
      'test-campaign',
      false
    );
  });

  it('calls confirmDragonCompanion with noConcentration=true when checkbox is checked', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Test description',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    const checkbox = screen.getByLabelText(/Skip Concentration/);
    fireEvent.click(checkbox);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    expect(dragonCompanionHandler.confirmDragonCompanion).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dragon Companion' }),
      expect.objectContaining({ name: 'Sorcerer1' }),
      'test-campaign',
      true
    );
  });

  it('shows result after confirm completes', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining).',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Dragon Companion: Free cast of Summon Dragon/)).toBeInTheDocument();
    });
  });

  it('hides initial buttons after confirm completes', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining).',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Summon Dragon/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('hides checkbox after confirm completes', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining).',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      expect(screen.queryByLabelText(/Skip Concentration/)).not.toBeInTheDocument();
    });
  });

  it('hides initial description after confirm completes', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining).',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Cast <.*>Summon Dragon<.*>/)).not.toBeInTheDocument();
    });
  });

  it('shows Done button after confirm completes', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining).',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after confirm', async () => {
    const onClose = vi.fn();
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining).',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Done button is clicked (overlay click)', async () => {
    const onClose = vi.fn();
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining).',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking modal content after confirm', async () => {
    const onClose = vi.fn();
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining).',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders result description with dangerouslySetInnerHTML', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: '<strong>Bold text</strong> and <em>italic text</em>.',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.querySelector('strong')).toBeInTheDocument();
      expect(body.querySelector('em')).toBeInTheDocument();
    });
  });

  it('renders result with header icon and name after confirm', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Test description.',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('Dragon Companion')).toBeInTheDocument();
      expect(document.querySelector('.fa-solid.fa-dragon')).toBeInTheDocument();
    });
  });

  // ── No concentration label in result ──

  it('shows "Does not require Concentration" in result when noConcentration is true', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining). Does not require Concentration. Duration: 1 minute.',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    const checkbox = screen.getByLabelText(/Skip Concentration/);
    fireEvent.click(checkbox);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Does not require Concentration/)).toBeInTheDocument();
    });
  });

  it('shows duration in result when noConcentration is true', async () => {
    dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Dragon Companion',
        description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining). Duration: 1 minute.',
        automation: {},
      },
    });
    render(<DragonCompanionModal {...makeProps()} />);
    const checkbox = screen.getByLabelText(/Skip Concentration/);
    fireEvent.click(checkbox);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Duration: 1 minute/)).toBeInTheDocument();
    });
  });

  // ── Modal CSS classes ──

  it('renders modal with proper CSS classes', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  // ── Initial state assertions ──

  it('does not show result on initial render', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.queryByText(/Dragon Companion: Free cast/)).not.toBeInTheDocument();
  });

  it('does not show Done button on initial render', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('renders initial mode buttons on first render', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Summon Dragon/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('checkbox is unchecked by default', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(screen.getByLabelText(/Skip Concentration/)).not.toBeChecked();
  });

  it('renders Font Awesome dragon icon in header', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(document.querySelector('.fa-solid.fa-dragon')).toBeInTheDocument();
  });

  it('renders Font Awesome dragon icon on Summon Dragon button', () => {
    render(<DragonCompanionModal {...makeProps()} />);
    expect(document.querySelector('.sp-actions .fa-solid.fa-dragon')).toBeInTheDocument();
  });
});
