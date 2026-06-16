import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ThirdEyeModal from './ThirdEyeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-wizard/thirdEyeHandler.js', () => ({
  applyThirdEye: vi.fn(() => Promise.resolve({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Third Eye',
      description: 'Third Eye: Darkvision (120 feet) chosen. You gain Darkvision out to a range of 120 feet. (Duration: until start of Short or Long Rest)',
    },
  })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

// ── Re-import mocked modules ──

import * as thirdEyeHandler from '../../../services/automation/handlers/class-wizard/thirdEyeHandler.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Third Eye', automation: { duration: 'short_or_long_rest' } },
  playerStats: { name: 'Wizard1', level: 14 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('ThirdEyeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thirdEyeHandler.applyThirdEye.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Third Eye',
        description: 'Third Eye: Darkvision (120 feet) chosen. You gain Darkvision out to a range of 120 feet. (Duration: until start of Short or Long Rest)',
      },
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay and header with action name', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    expect(screen.getByText('Third Eye')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders Font Awesome eye icon in header', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const icon = document.querySelector('.fa-eye');
    expect(icon).toBeInTheDocument();
  });

  it('has first option selected by default so Apply button is enabled', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: /Use Bonus Action/ });
    expect(applyBtn).toBeEnabled();
  });

  it('renders three radio options with name thirdEye', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="thirdEye"]');
    expect(radios).toHaveLength(3);
  });

  it('selects first option by default', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="thirdEye"]');
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
    expect(radios[2]).not.toBeChecked();
  });

  it('renders description text for each option', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    expect(screen.getByText(/You gain Darkvision out to a range of 120 feet/)).toBeInTheDocument();
    expect(screen.getByText(/You can read any language/)).toBeInTheDocument();
    expect(screen.getByText(/You can see invisible creatures/)).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Apply button with Font Awesome icon', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: /Use Bonus Action/ });
    expect(applyBtn.querySelector('.fa-eye')).toBeInTheDocument();
  });

  it('shows instruction text', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    expect(screen.getByText(/Choose a benefit/)).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<ThirdEyeModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<ThirdEyeModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Radio selection ──

  it('selects Greater Comprehension option on click', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="thirdEye"]');
    fireEvent.click(radios[1]);
    expect(radios[1]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
  });

  it('selects See Invisibility option on click', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="thirdEye"]');
    fireEvent.click(radios[2]);
    expect(radios[2]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
  });

  it('keeps Apply button enabled after selecting an option', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: /Use Bonus Action/ });
    expect(applyBtn).toBeEnabled();
    const radios = document.querySelectorAll('input[name="thirdEye"]');
    fireEvent.click(radios[1]);
    expect(applyBtn).toBeEnabled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<ThirdEyeModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Apply / success flow ──

  it('calls applyThirdEye with correct arguments when apply is clicked', async () => {
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    expect(thirdEyeHandler.applyThirdEye).toHaveBeenCalledWith(
      baseProps.action,
      baseProps.playerStats,
      baseProps.campaignName,
      'Darkvision (120 feet)'
    );
  });

  it('calls applyThirdEye with selected option when not first option', async () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="thirdEye"]');
    await act(async () => {
      fireEvent.click(radios[2]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    expect(thirdEyeHandler.applyThirdEye).toHaveBeenCalledWith(
      baseProps.action,
      baseProps.playerStats,
      baseProps.campaignName,
      'See Invisibility'
    );
  });

  it('displays result description after apply', async () => {
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Darkvision out to a range of 120 feet/)).toBeInTheDocument();
    });
  });

  it('displays Done button after apply', async () => {
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides Cancel button after apply', async () => {
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('hides radio options after apply', async () => {
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Darkvision (120 feet)')).not.toBeInTheDocument();
    });
  });

  it('hides Apply button after apply', async () => {
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Use Bonus Action/ })).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after apply', async () => {
    const onClose = vi.fn();
    render(<ThirdEyeModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Font Awesome eye icon in result header', async () => {
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    await waitFor(() => {
      const icon = document.querySelector('.sp-header .fa-eye');
      expect(icon).toBeInTheDocument();
    });
  });

  // ── Modal CSS classes ──

  it('renders modal with proper CSS classes', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders proper CSS classes in result state', async () => {
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });
  });

  // ── Result state with custom description ──

  it('displays custom description from result payload', async () => {
    thirdEyeHandler.applyThirdEye.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Third Eye',
        description: 'Custom description text',
      },
    });
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('Custom description text')).toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  it('throws when action is null', () => {
    expect(() => render(<ThirdEyeModal {...makeProps({ action: null })} />)).toThrow();
  });

  it('does not render result on initial render', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('renders selected option with highlighted background', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    const selectedLabel = document.querySelector('input[name="thirdEye"]:checked')?.closest('label');
    expect(selectedLabel).toHaveStyle({ background: 'rgba(255,255,255,0.15)' });
  });
});
