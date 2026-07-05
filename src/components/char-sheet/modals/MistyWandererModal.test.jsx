// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MistyWandererModal from './MistyWandererModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-warlock/mistyWandererHandler.js', () => ({
  confirmMistyWanderer: vi.fn(),
}));

// ── Re-import mocked modules ──

import { confirmMistyWanderer } from '../../../services/automation/handlers/class-warlock/mistyWandererHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Misty Wanderer',
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

function makeAction(overrides) {
  return { ...baseAction, ...(overrides || {}) };
}

// ── Tests ──

describe('MistyWandererModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the modal overlay, container, header, body, and actions sections', () => {
      render(<MistyWandererModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the header with cloud icon and action name', () => {
      render(<MistyWandererModal {...makeProps()} />);
      expect(screen.getByText('Misty Wanderer')).toBeInTheDocument();
      expect(document.querySelector('.sp-header .fa-solid.fa-cloud')).toBeInTheDocument();
    });

    it('renders the Misty Step description with teleport details', () => {
      render(<MistyWandererModal {...makeProps()} />);
      const body = document.querySelector('.sp-body p');
      expect(body.textContent).toContain('Cast');
      expect(body.textContent).toContain('Misty Step');
      expect(body.textContent).toContain('teleport up to 30 feet');
    });

    it('renders the ally selection prompt and description', () => {
      render(<MistyWandererModal {...makeProps()} />);
      expect(screen.getByText(/Bring a willing creature within 5 feet/)).toBeInTheDocument();
      expect(screen.getByText(/The creature appears in an unoccupied space within 5 feet/)).toBeInTheDocument();
    });

    it('renders a select dropdown with None as the default option', () => {
      render(<MistyWandererModal {...makeProps()} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('');
      const options = select.querySelectorAll('option');
      expect(options.length).toBe(1);
      expect(options[0].textContent).toBe('None');
    });

    it('renders the Cast Misty Step button with cloud icon', () => {
      render(<MistyWandererModal {...makeProps()} />);
      const button = screen.getByRole('button', { name: /Cast Misty Step/ });
      expect(button).toBeInTheDocument();
      expect(button.querySelector('.fa-solid.fa-cloud')).toBeInTheDocument();
    });

    it('renders the Cancel button', () => {
      render(<MistyWandererModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not show Done button or result on initial render', () => {
      render(<MistyWandererModal {...makeProps()} />);
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Misty Wanderer: Cast Misty Step/)).not.toBeInTheDocument();
    });
  });

  // ── Custom action name ──

  it('displays the custom action name in the header', () => {
    render(<MistyWandererModal {...makeProps({ action: makeAction({ name: 'Custom Misty Step' }) })} />);
    expect(screen.getByText('Custom Misty Step')).toBeInTheDocument();
  });

  // ── Ally selection ──

  describe('ally selection', () => {
    it('calls confirmMistyWanderer with bringAlly=false and null when no ally is selected', async () => {
      confirmMistyWanderer.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Misty Wanderer',
          description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
        },
      });
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(confirmMistyWanderer).toHaveBeenCalledWith(
          baseAction,
          basePlayerStats,
          'test-campaign',
          false,
          null
        );
      });
    });

    it('calls confirmMistyWanderer with bringAlly=true and ally name when an ally is selected', async () => {
      confirmMistyWanderer.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Misty Wanderer',
          description: 'Misty Wanderer: Cast Misty Step (0 remaining). Brought Ally1 to an unoccupied space within 5 feet of your destination.',
        },
      });
      render(<MistyWandererModal {...makeProps()} />);
      const select = screen.getByRole('combobox');
      Object.defineProperty(select, 'value', { get: () => 'Ally1', configurable: true });
      fireEvent.change(select);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(confirmMistyWanderer).toHaveBeenCalledWith(
          baseAction,
          basePlayerStats,
          'test-campaign',
          true,
          'Ally1'
        );
      });
    });
  });

  // ── Confirm flow and result display ──

  describe('confirm flow', () => {
    const mockResult = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    };

    beforeEach(() => {
      confirmMistyWanderer.mockResolvedValue(mockResult);
    });

    it('replaces initial content with result after confirm', async () => {
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
    });

    it('renders the result description via dangerouslySetInnerHTML', async () => {
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(document.querySelector('.sp-body')).toHaveTextContent('Misty Wanderer: Cast Misty Step');
      });
    });

    it('hides the initial content after confirm', async () => {
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(screen.queryByText(/Cast Misty Step.*teleport/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Bring a willing creature/)).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Cast Misty Step/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('hides Cast Misty Step button after confirm', async () => {
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Cast Misty Step/ })).not.toBeInTheDocument();
      });
    });

    it('hides Cancel button after confirm', async () => {
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('hides the ally select dropdown after confirm', async () => {
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      });
    });

    it('shows ally name in result description when ally was brought', async () => {
      confirmMistyWanderer.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Misty Wanderer',
          description: 'Misty Wanderer: Cast Misty Step (0 remaining). Brought Ally1 to an unoccupied space within 5 feet of your destination.',
        },
      });
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(document.querySelector('.sp-body')).toHaveTextContent('Ally1');
        expect(document.querySelector('.sp-body')).toHaveTextContent('Brought');
      });
    });

    it('renders the cloud icon in the result header', async () => {
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(document.querySelector('.sp-header .fa-solid.fa-cloud')).toBeInTheDocument();
      });
    });
  });

  // ── Result close behavior ──

  describe('result close behavior', () => {
    const mockResult = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Misty Wanderer',
        description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
      },
    };

    beforeEach(() => {
      confirmMistyWanderer.mockResolvedValue(mockResult);
    });

    it('calls onClose when Done button is clicked after confirm', async () => {
      const onClose = vi.fn();
      render(<MistyWandererModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
