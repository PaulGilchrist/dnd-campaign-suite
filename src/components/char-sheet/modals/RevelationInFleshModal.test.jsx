import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RevelationInFleshModal from './RevelationInFleshModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-warlock/revelationInFleshHandler.js', () => ({
  applyRevelationOption: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as revelationHandler from '../../../services/automation/handlers/class-warlock/revelationInFleshHandler.js';

// ── Test fixtures ──

const mockAction = {
  name: 'Revelation in Flesh',
  automation: {
    type: 'revelation',
    options: [
      { name: 'Charm Person', description: 'Gain the ability to charm others' },
      { name: 'Detect Thoughts', description: 'Read the thoughts of others' },
      { name: 'Elongated Fingers', description: 'Your fingers stretch and become prehensile' },
    ],
    duration: '10_minutes',
  },
};

const mockPlayerStats = {
  name: 'Warlock1',
  level: 5,
  hitPoints: 30,
};

const mockCampaignName = 'test-campaign';

const mockOnClose = vi.fn();

function makeProps(overrides) {
  return {
    action: mockAction,
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    onClose: mockOnClose,
    ...overrides,
  };
}

// ── Tests ──

describe('RevelationInFleshModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay and header with action name', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    expect(screen.getByText('Revelation in Flesh')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders Font Awesome DNA icon in header', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const icon = document.querySelector('.fa-dna');
    expect(icon).toBeInTheDocument();
  });

  it('displays instruction text in modal body', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    expect(screen.getByText(/Choose a bodily alteration/)).toBeInTheDocument();
  });

  it('renders all available options as radio buttons', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    expect(radios).toHaveLength(3);
  });

  it('displays option descriptions next to option names', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('Charm Person');
    expect(body.textContent).toContain('charm others');
    expect(body.textContent).toContain('Detect Thoughts');
    expect(body.textContent).toContain('Read the thoughts');
  });

  it('renders activate button with action name', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Activate Revelation in Flesh/ })).toBeInTheDocument();
  });

  it('renders Font Awesome DNA icon on activate button', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-dna');
    expect(icon).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('has activate button disabled with no selection', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Activate/ })).toBeDisabled();
  });

  it('renders modal with proper CSS classes', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  // ── Option selection ──

  it('selects option when radio button is clicked', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[1]);
    expect(radios[1]).toBeChecked();
  });

  it('enables activate button after selection', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    expect(screen.getByRole('button', { name: /Activate/ })).toBeEnabled();
  });

  it('deselects previous option when another is selected', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    expect(radios[0]).toBeChecked();
    fireEvent.click(radios[2]);
    expect(radios[0]).not.toBeChecked();
    expect(radios[2]).toBeChecked();
  });

  it('highlights selected option visually', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    const charmLabel = radios[0].parentElement;
    const beforeStyle = window.getComputedStyle(charmLabel).borderColor;
    fireEvent.click(radios[0]);
    const afterStyle = window.getComputedStyle(charmLabel).borderColor;
    expect(afterStyle).not.toBe(beforeStyle);
  });

  // ── Apply / activation flow ──

  it('calls applyRevelationOption with correct arguments when activate is clicked', async () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revelation in Flesh',
        description: 'Revelation in Flesh: Charm Person chosen. Gain the ability to charm others. (1 SP spent, duration: 10 minutes)',
      },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    expect(revelationHandler.applyRevelationOption).toHaveBeenCalledWith(
      mockAction,
      mockPlayerStats,
      mockCampaignName,
      'Charm Person'
    );
  });

  it('does not call applyRevelationOption when no option selected', async () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({});
    render(<RevelationInFleshModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    expect(revelationHandler.applyRevelationOption).not.toHaveBeenCalled();
  });

  it('shows result after successful apply', async () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revelation in Flesh',
        description: 'Revelation in Flesh: Charm Person chosen. (1 SP spent)',
      },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('Revelation in Flesh: Charm Person chosen. (1 SP spent)')).toBeInTheDocument();
    });
  });

  it('renders Done button after apply', async () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revelation in Flesh',
        description: 'Test result',
      },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides selection options after apply', async () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revelation in Flesh',
        description: 'Test result',
      },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('input[name="revelationOption"]')).not.toBeInTheDocument();
    });
  });

  it('hides activate and cancel buttons after apply', async () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revelation in Flesh',
        description: 'Test result',
      },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Activate/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  // ── Result rendering ──

  it('renders Font Awesome DNA icon in result header', async () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revelation in Flesh',
        description: 'Test result',
      },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    await waitFor(() => {
      const icon = document.querySelector('.sp-header .fa-dna');
      expect(icon).toBeInTheDocument();
    });
  });

  it('renders result description in modal body', async () => {
    const desc = 'Revelation in Flesh: Detect Thoughts chosen. Read the thoughts of others. (1 SP spent, duration: 10 minutes)';
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revelation in Flesh',
        description: desc,
      },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[1]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(desc)).toBeInTheDocument();
    });
  });

  it('renders result with HTML description using dangerouslySetInnerHTML', async () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revelation in Flesh',
        description: '<p>Special <strong>ability</strong> activated</p>',
      },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.querySelector('p strong')).toBeInTheDocument();
    });
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ── Done button ──

  it('calls onClose when Done button is clicked after apply', async () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revelation in Flesh',
        description: 'Test result',
      },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ── Options from action ──

  it('renders no options when action has no automation options', () => {
    const emptyAction = { name: 'Revelation in Flesh', automation: {} };
    render(<RevelationInFleshModal {...makeProps({ action: emptyAction })} />);
    expect(screen.queryByLabelText('Charm Person')).not.toBeInTheDocument();
  });

  it('renders options without descriptions when description is missing', () => {
    const actionNoDesc = {
      name: 'Revelation in Flesh',
      automation: {
        options: [
          { name: 'Option No Description' },
        ],
      },
    };
    render(<RevelationInFleshModal {...makeProps({ action: actionNoDesc })} />);
    expect(screen.getByText('Option No Description')).toBeInTheDocument();
  });

  it('renders all options when some have descriptions and some do not', () => {
    const actionMixed = {
      name: 'Revelation in Flesh',
      automation: {
        options: [
          { name: 'With Desc', description: 'Has description' },
          { name: 'Without Desc' },
        ],
      },
    };
    render(<RevelationInFleshModal {...makeProps({ action: actionMixed })} />);
    expect(screen.getByText('With Desc')).toBeInTheDocument();
    expect(screen.getByText('Without Desc')).toBeInTheDocument();
  });

  // ── Multiple selection state ──

  it('updates result state when applyRevelationOption returns different result', async () => {
    revelationHandler.applyRevelationOption
      .mockResolvedValueOnce({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Revelation in Flesh', description: 'First result' },
      })
      .mockResolvedValueOnce({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Revelation in Flesh', description: 'Second result' },
      });

    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('First result')).toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  it('renders with empty options array', () => {
    const emptyOptionsAction = { name: 'Revelation in Flesh', automation: { options: [] } };
    render(<RevelationInFleshModal {...makeProps({ action: emptyOptionsAction })} />);
    expect(screen.getByText(/Choose a bodily alteration/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('does not show result on initial render', () => {
    revelationHandler.applyRevelationOption.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Revelation in Flesh', description: 'Test result' },
    });
    render(<RevelationInFleshModal {...makeProps()} />);
    expect(screen.queryByText('Test result')).not.toBeInTheDocument();
  });

  it('shows selection UI on initial render', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    expect(screen.getByText(/Choose a bodily alteration/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activate/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders radio buttons with correct name attribute', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="revelationOption"]');
    expect(radios).toHaveLength(3);
  });
});
