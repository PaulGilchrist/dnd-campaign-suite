import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MistyWandererModal from './MistyWandererModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-warlock/mistyWandererHandler.js', () => ({
  confirmMistyWanderer: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 1),
}));

// ── Re-import mocked modules ──

import { confirmMistyWanderer } from '../../../services/automation/handlers/class-warlock/mistyWandererHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Misty Wanderer',
  automation: {
    uses_expression: 'WIS modifier_min_1',
  },
};

const basePlayerStats = {
  name: 'Warlock1',
  level: 3,
};

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('MistyWandererModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal container', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders modal header with action name', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.getByText('Misty Wanderer')).toBeInTheDocument();
  });

  it('renders Font Awesome cloud icon in header', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(document.querySelector('.fa-solid.fa-cloud')).toBeInTheDocument();
  });

  it('displays Misty Step description text', () => {
    render(<MistyWandererModal {...makeProps()} />);
    const body = document.querySelector('.sp-body p');
    expect(body.textContent).toContain('Cast');
    expect(body.textContent).toContain('Misty Step');
    expect(body.textContent).toContain('teleport up to 30 feet');
  });

  it('displays ally selection prompt', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.getByText(/Bring a willing creature within 5 feet/)).toBeInTheDocument();
  });

  it('renders select dropdown for ally selection', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders None option as default in select', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('displays ally description text', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.getByText(/The creature appears in an unoccupied space within 5 feet/)).toBeInTheDocument();
  });

  it('renders Cast Misty Step button', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Cast Misty Step/ })).toBeInTheDocument();
  });

  it('renders Font Awesome cloud icon on Cast Misty Step button', () => {
    render(<MistyWandererModal {...makeProps()} />);
    const button = screen.getByRole('button', { name: /Cast Misty Step/ });
    expect(button.querySelector('.fa-solid.fa-cloud')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<MistyWandererModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<MistyWandererModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<MistyWandererModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Ally selection ──

  it('renders select with no ally options populated', () => {
    render(<MistyWandererModal {...makeProps()} />);
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(1);
    expect(options[0].value).toBe('');
    expect(options[0].textContent).toBe('None');
  });

  // ── Confirm flow ──

  it('calls confirmMistyWanderer with bringAlly=false when no ally selected', async () => {
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    expect(confirmMistyWanderer).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      false,
      null
    );
  });

  it('includes ally name in result description when ally is brought', async () => {
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining). Brought Ally1 to an unoccupied space within 5 feet of your destination.',
      },
    });
    render(<MistyWandererModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Ally1');
      expect(body.textContent).toContain('Brought');
    });
  });

  it('shows result after confirm', async () => {
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('displays result description in the result view', async () => {
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body).toHaveTextContent('Misty Wanderer: Cast Misty Step');
    });
  });

  it('hides initial content after confirm', async () => {
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Cast Misty Step.*teleport/)).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after confirm', async () => {
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('hides Cast Misty Step button after confirm', async () => {
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Cast Misty Step/ })).not.toBeInTheDocument();
    });
  });

  it('hides ally select after confirm', async () => {
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after confirm', async () => {
    const onClose = vi.fn();
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking result overlay', async () => {
    const onClose = vi.fn();
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close result when clicking result modal content', async () => {
    const onClose = vi.fn();
    confirmMistyWanderer.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    });
    render(<MistyWandererModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Ally description text visibility ──

  it('displays ally description text on initial render', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.getByText(/The creature appears in an unoccupied space within 5 feet/)).toBeInTheDocument();
  });

  // ── Modal CSS classes ──

  it('renders modal with proper CSS classes', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  // ── Custom action name ──

  it('displays custom action name in header', () => {
    render(<MistyWandererModal {...makeProps({ action: { name: 'Custom Misty Step', automation: {} } })} />);
    expect(screen.getByText('Custom Misty Step')).toBeInTheDocument();
  });

  // ── Initial render state ──

  it('does not show Done button on initial render', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('does not show result description on initial render', () => {
    render(<MistyWandererModal {...makeProps()} />);
    expect(screen.queryByText(/Misty Wanderer: Cast Misty Step/)).not.toBeInTheDocument();
  });
});
