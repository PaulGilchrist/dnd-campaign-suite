import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CelestialRevelationModal from './CelestialRevelationModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/celestialRevelationHandler.js', () => ({
  confirmCelestialRevelation: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as celestialRevelationHandler from '../../../services/automation/handlers/class-sorcerer/celestialRevelationHandler.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Celestial Revelation' },
  playerStats: { name: 'Sorcerer1', level: 5, proficiency: 3 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('CelestialRevelationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay and header', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    expect(screen.getByText('Celestial Revelation')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders Font Awesome star icon in header', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    const icon = document.querySelector('.fa-star');
    expect(icon).toBeInTheDocument();
  });

  it('displays transformation instruction text', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    expect(screen.getByText(/Choose a transformation option/)).toBeInTheDocument();
  });

  it('renders all three transformation options', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    expect(screen.getByText('Heavenly Wings')).toBeInTheDocument();
    expect(screen.getByText('Inner Radiance')).toBeInTheDocument();
    expect(screen.getByText('Necrotic Shroud')).toBeInTheDocument();
  });

  it('renders Font Awesome icons for each transformation option', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    expect(document.querySelector('.fa-feather-pointed')).toBeInTheDocument();
    expect(document.querySelector('.fa-sun')).toBeInTheDocument();
    expect(document.querySelector('.fa-skull')).toBeInTheDocument();
  });

  it('displays description for each transformation option', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    expect(screen.getByText(/Two spectral wings sprout from your back/)).toBeInTheDocument();
    expect(screen.getByText(/Searing light radiates from your eyes/)).toBeInTheDocument();
    expect(screen.getByText(/Your eyes become pools of darkness/)).toBeInTheDocument();
  });

  it('renders proficiency bonus info with playerStats value', () => {
    render(<CelestialRevelationModal {...makeProps({ playerStats: { name: 'S1', level: 3, proficiency: 5 } })} />);
    expect(screen.getByText(/Proficiency Bonus \(5\)/)).toBeInTheDocument();
  });

  it('renders proficiency bonus info with default 0 when not provided', () => {
    render(<CelestialRevelationModal {...makeProps({ playerStats: { name: 'S1', level: 3 } })} />);
    expect(screen.getByText(/Proficiency Bonus \(0\)/)).toBeInTheDocument();
  });

  it('shows dash for damage type when no option selected', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    expect(screen.getByText(/— type per turn/)).toBeInTheDocument();
  });

  it('renders Transform button disabled when no option selected', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    const transformBtn = screen.getByRole('button', { name: /Transform/ });
    expect(transformBtn).toBeDisabled();
  });

  it('renders Font Awesome star icon on Transform button', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    const transformBtn = screen.getByRole('button', { name: /Transform/ });
    expect(transformBtn.querySelector('.fa-star')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders modal with proper CSS classes', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<CelestialRevelationModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<CelestialRevelationModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<CelestialRevelationModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Selection behavior ──

  it('allows selecting Heavenly Wings option', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Heavenly Wings'));
    expect(screen.getByText(/Proficiency Bonus \(3\) of Radiant type per turn/)).toBeInTheDocument();
  });

  it('allows selecting Inner Radiance option', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Inner Radiance'));
    expect(screen.getByText(/Proficiency Bonus \(3\) of Radiant type per turn/)).toBeInTheDocument();
  });

  it('allows selecting Necrotic Shroud option', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Necrotic Shroud'));
    expect(screen.getByText(/Proficiency Bonus \(3\) of Necrotic type per turn/)).toBeInTheDocument();
  });

  it('enables Transform button after selecting an option', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Heavenly Wings'));
    const transformBtn = screen.getByRole('button', { name: /Transform/ });
    expect(transformBtn).toBeEnabled();
  });

  it('switches selection when clicking a different option', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Heavenly Wings'));
    expect(screen.getByText(/Proficiency Bonus \(3\) of Radiant type per turn/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Necrotic Shroud'));
    expect(screen.getByText(/Proficiency Bonus \(3\) of Necrotic type per turn/)).toBeInTheDocument();
  });

  it('highlights selected option with different background', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    const labels = document.querySelectorAll('label[style*="cursor: pointer"]');
    expect(labels.length).toBe(3);
    fireEvent.click(screen.getByText('Inner Radiance'));
    const selectedLabel = [...labels].find(l => l.textContent.includes('Inner Radiance'));
    expect(selectedLabel).toHaveStyle({ background: 'rgba(255,255,255,0.15)' });
  });

  // ── Apply / transformation flow ──

  it('calls confirmCelestialRevelation with correct arguments when Transform is clicked', async () => {
    celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Celestial Revelation',
        description: 'Transforming into Heavenly Wings. Two spectral wings sprout from your back. You gain a Fly Speed equal to your Speed. The transformation lasts for 1 minute or until you end it.',
      },
    });
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Heavenly Wings'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    expect(celestialRevelationHandler.confirmCelestialRevelation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sorcerer1', level: 5, proficiency: 3 }),
      'Heavenly Wings',
      'test-campaign'
    );
  });

  it('displays result description after Transform is clicked', async () => {
    celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Celestial Revelation',
        description: 'Transforming into Inner Radiance. Searing light radiates from your eyes and mouth. The transformation lasts for 1 minute or until you end it.',
      },
    });
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Inner Radiance'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Searing light radiates from your eyes/)).toBeInTheDocument();
    });
  });

  it('shows Done button after transformation', async () => {
    celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Celestial Revelation',
        description: 'Transforming into Necrotic Shroud. Your eyes become pools of darkness. The transformation lasts for 1 minute or until you end it.',
      },
    });
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Necrotic Shroud'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides selection options and Transform button after transformation', async () => {
    celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Celestial Revelation',
        description: 'Transforming into Heavenly Wings. Two spectral wings sprout from your back. The transformation lasts for 1 minute or until you end it.',
      },
    });
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Heavenly Wings'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Choose a transformation option/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Transform/ })).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after transformation', async () => {
    const onClose = vi.fn();
    celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Celestial Revelation',
        description: 'Transforming into Heavenly Wings.',
      },
    });
    render(<CelestialRevelationModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Heavenly Wings'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Done button is clicked (overlay click)', async () => {
    const onClose = vi.fn();
    celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Celestial Revelation',
        description: 'Transforming into Inner Radiance.',
      },
    });
    render(<CelestialRevelationModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Inner Radiance'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside result modal', async () => {
    const onClose = vi.fn();
    celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Celestial Revelation',
        description: 'Transforming into Necrotic Shroud.',
      },
    });
    render(<CelestialRevelationModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Necrotic Shroud'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders star icon in result header', async () => {
    celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Celestial Revelation',
        description: 'Transforming into Heavenly Wings.',
      },
    });
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Heavenly Wings'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-header .fa-star')).toBeInTheDocument();
    });
  });

  it('renders result with proper CSS classes', async () => {
    celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Celestial Revelation',
        description: 'Transforming into Inner Radiance.',
      },
    });
    render(<CelestialRevelationModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Inner Radiance'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  it('does not call confirmCelestialRevelation when no option is selected', async () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    });
    expect(celestialRevelationHandler.confirmCelestialRevelation).not.toHaveBeenCalled();
  });

  it('renders correctly when playerStats is minimal', () => {
    render(<CelestialRevelationModal {...makeProps({ playerStats: {} })} />);
    expect(screen.getByText(/Choose a transformation option/)).toBeInTheDocument();
    expect(screen.getByText(/Proficiency Bonus \(0\)/)).toBeInTheDocument();
  });

  it('renders all three options with their icons on initial render', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    const heavenlyLabel = [...document.querySelectorAll('label')].find(l => l.textContent.includes('Heavenly Wings'));
    expect(heavenlyLabel.querySelector('.fa-feather-pointed')).toBeInTheDocument();
    const innerLabel = [...document.querySelectorAll('label')].find(l => l.textContent.includes('Inner Radiance'));
    expect(innerLabel.querySelector('.fa-sun')).toBeInTheDocument();
    const necroticLabel = [...document.querySelectorAll('label')].find(l => l.textContent.includes('Necrotic Shroud'));
    expect(necroticLabel.querySelector('.fa-skull')).toBeInTheDocument();
  });

  it('shows correct damage type for each option', () => {
    render(<CelestialRevelationModal {...makeProps()} />);
    // Initially shows dash
    expect(document.body.textContent).toContain('— type per turn');
    // Select Heavenly Wings (Radiant)
    fireEvent.click(screen.getByText('Heavenly Wings'));
    expect(document.body.textContent).toContain('Radiant type per turn');
    // Select Inner Radiance (Radiant)
    fireEvent.click(screen.getByText('Inner Radiance'));
    expect(document.body.textContent).toContain('Radiant type per turn');
    // Select Necrotic Shroud (Necrotic)
    fireEvent.click(screen.getByText('Necrotic Shroud'));
    expect(document.body.textContent).toContain('Necrotic type per turn');
  });

});
