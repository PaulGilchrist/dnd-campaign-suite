import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GiantAncestryModal from './GiantAncestryModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-other/giantAncestryHandler.js', () => ({
  confirmGiantAncestry: vi.fn(() => Promise.resolve(true)),
  getGiantAncestryOptions: vi.fn(() => [
    { name: "Cloud's Jaunt", type: 'teleport', range: '30_ft', description: 'Teleport up to 30 feet to an unoccupied space you can see.', icon: 'fa-cloud' },
    { name: "Fire's Burn", type: 'damage', damage: '1d10', damageType: 'Fire', description: 'Deal 1d10 fire damage to a creature within 30 feet.', icon: 'fa-fire' },
    { name: "Frost's Chill", type: 'damage_with_condition', damage: '1d6', damageType: 'Cold', description: 'Deal 1d6 cold damage and reduce target speed by 10 feet for 1 minute.', icon: 'fa-snowflake' },
    { name: "Hill's Tumble", type: 'auto_effect', trigger: 'melee_hit', effect: 'prone', description: 'When you hit a creature with a melee attack, you can knock it prone.', icon: 'fa-person-falling' },
    { name: "Stone's Endurance", type: 'damage_reduction', reductionExpression: '1d10 + CON modifier', description: 'When you take damage, you can reduce it by 1d10 + CON modifier.', icon: 'fa-shield' },
    { name: "Storm's Thunder", type: 'reaction_damage', damage: '1d8', damageType: 'Thunder', range: '60_ft', description: 'As a reaction, make a ranged spell attack against one creature within 60 feet. On a hit, the target takes 1d8 thunder damage.', icon: 'fa-bolt' },
  ]),
}));

// ── Re-import mocked modules ──

import { getGiantAncestryOptions } from '../../../services/automation/handlers/class-other/giantAncestryHandler.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Giant Ancestry', automation: { type: 'resource_pool' } },
  playerStats: { name: 'GiantFighter', level: 5, proficiency: 3 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('GiantAncestryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay and header with title', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByText('Giant Ancestry')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders mountain icon in header', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const icon = document.querySelector('.fa-mountain');
    expect(icon).toBeInTheDocument();
  });

  it('discribes the giant ancestry benefit in modal body', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByText(/Choose a giant ancestry benefit/)).toBeInTheDocument();
  });

  it('displays usage info mentioning Proficiency Bonus and Long Rest', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByText(/Proficiency Bonus/)).toBeInTheDocument();
    expect(screen.getByText(/Long Rest/)).toBeInTheDocument();
  });

  it('renders all giant ancestry options', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const options = getGiantAncestryOptions();
    for (const opt of options) {
      expect(screen.getByText(opt.name)).toBeInTheDocument();
    }
  });

  it('renders Font Awesome icon for each option', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const options = getGiantAncestryOptions();
    for (const opt of options) {
      const icon = document.querySelector(`.fa-solid.${opt.icon}`);
      expect(icon).toBeInTheDocument();
    }
  });

  it('renders description for each option', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const options = getGiantAncestryOptions();
    for (const opt of options) {
      expect(screen.getByText(new RegExp(opt.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    }
  });

  it('renders radio inputs for each option', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const options = getGiantAncestryOptions();
    const radioInputs = document.querySelectorAll('input[type="radio"]');
    expect(radioInputs).toHaveLength(options.length);
  });

  it('renders Select Ancestry button', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Select Ancestry' })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders with check icon on Select Ancestry button', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-check');
    expect(icon).toBeInTheDocument();
  });

  it('has Select Ancestry button disabled when no option selected', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Select Ancestry' })).toBeDisabled();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<GiantAncestryModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<GiantAncestryModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<GiantAncestryModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Selection behavior ──

  it('selects an option when its radio input is clicked', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    expect(screen.getByRole('button', { name: 'Select Ancestry' })).toBeEnabled();
  });

  it('enables Select Ancestry button after selecting an option', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    expect(screen.getByRole('button', { name: 'Select Ancestry' })).toBeEnabled();
  });

  it('switches selection when a different option is clicked', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    expect(radios[0]).toBeChecked();
    fireEvent.click(radios[2]);
    expect(radios[0]).not.toBeChecked();
  });

  it('highlights selected option visually via checked radio', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[3]);
    expect(radios[3]).toBeChecked();
  });

  // ── Apply / confirm flow ──

  it('calls confirmGiantAncestry with correct arguments when selecting', async () => {
    const { confirmGiantAncestry } = await import('../../../services/automation/handlers/class-other/giantAncestryHandler.js');
    render(<GiantAncestryModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
    });
    const options = getGiantAncestryOptions();
    expect(confirmGiantAncestry).toHaveBeenCalledWith(
      baseProps.playerStats,
      options[0].name,
      baseProps.campaignName
    );
  });

  it('calls confirmGiantAncestry with second option when selected', async () => {
    const { confirmGiantAncestry } = await import('../../../services/automation/handlers/class-other/giantAncestryHandler.js');
    render(<GiantAncestryModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[2]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
    });
    const options = getGiantAncestryOptions();
    expect(confirmGiantAncestry).toHaveBeenCalledWith(
      baseProps.playerStats,
      options[2].name,
      baseProps.campaignName
    );
  });

  it('calls onClose when confirmGiantAncestry resolves true', async () => {
    const onClose = vi.fn();
    render(<GiantAncestryModal {...makeProps({ onClose })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call confirmGiantAncestry when no option is selected', async () => {
    const { confirmGiantAncestry } = await import('../../../services/automation/handlers/class-other/giantAncestryHandler.js');
    render(<GiantAncestryModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
    });
    expect(confirmGiantAncestry).not.toHaveBeenCalled();
  });

  // ── CSS classes ──

  it('renders modal with proper CSS classes', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders option labels with radio inputs sharing same name', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"][name="giantAncestryOption"]');
    expect(radios.length).toBeGreaterThan(0);
  });

  // ── All option details ──

  it('renders Clouds Jaunt option with cloud icon', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByText("Cloud's Jaunt")).toBeInTheDocument();
    expect(document.querySelector('.fa-cloud')).toBeInTheDocument();
  });

  it('renders Fire Burn option with fire icon', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByText("Fire's Burn")).toBeInTheDocument();
    expect(document.querySelector('.fa-fire')).toBeInTheDocument();
  });

  it('renders Frosts Chill option with snowflake icon', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByText("Frost's Chill")).toBeInTheDocument();
    expect(document.querySelector('.fa-snowflake')).toBeInTheDocument();
  });

  it('renders Hills Tumble option with falling person icon', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByText("Hill's Tumble")).toBeInTheDocument();
    expect(document.querySelector('.fa-person-falling')).toBeInTheDocument();
  });

  it('renders Stones Endurance option with shield icon', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByText("Stone's Endurance")).toBeInTheDocument();
    expect(document.querySelector('.fa-shield')).toBeInTheDocument();
  });

  it('renders Storms Thunder option with bolt icon', () => {
    render(<GiantAncestryModal {...makeProps()} />);
    expect(screen.getByText("Storm's Thunder")).toBeInTheDocument();
    expect(document.querySelector('.fa-bolt')).toBeInTheDocument();
  });
});
