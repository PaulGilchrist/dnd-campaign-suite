// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HexAbilityModal from './HexAbilityModal.jsx';

const baseProps = {
  onAbilitySelected: vi.fn(),
  onCancel: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) }
}

// ── Default abilities ──

const DEFAULT_ABILITIES = [
  { key: 'STR', label: 'Strength' },
  { key: 'DEX', label: 'Dexterity' },
  { key: 'CON', label: 'Constitution' },
  { key: 'INT', label: 'Intelligence' },
  { key: 'WIS', label: 'Wisdom' },
  { key: 'CHA', label: 'Charisma' },
];

// ── Tests ──

describe('HexAbilityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it.each([
      { input: undefined, expected: 'Hex — Choose Ability' },
      { input: null, expected: 'Hex — Choose Ability' },
      { input: 'Custom Title', expected: 'Custom Title' },
    ])('renders title: $expected', ({ input, expected }) => {
      render(<HexAbilityModal {...makeProps(input !== undefined ? { title: input } : {})} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it.each([
      { input: undefined, expected: 'Choose an ability check for the target to have disadvantage on:' },
      { input: null, expected: 'Choose an ability check for the target to have disadvantage on:' },
      { input: 'Choose wisely:', expected: 'Choose wisely:' },
    ])('renders prompt: $expected', ({ input, expected }) => {
      render(<HexAbilityModal {...makeProps(input !== undefined ? { prompt: input } : {})} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it.each([
      { icon: undefined, expectedClass: 'fa-solid fa-eye' },
      { icon: 'fa-eye', expectedClass: 'fa-solid fa-eye' },
      { icon: 'fa-skull', expectedClass: 'fa-solid fa-skull' },
    ])('renders icon "$expectedClass" for icon prop "$icon"', ({ icon, expectedClass }) => {
      render(<HexAbilityModal {...makeProps(icon !== undefined ? { icon } : {})} />);
      const headerIcon = document.querySelector('.sp-header i');
      expect(headerIcon).toHaveClass(expectedClass);
    });

    it('renders all six default ability buttons', () => {
      render(<HexAbilityModal {...baseProps} />);
      for (const { label, key } of DEFAULT_ABILITIES) {
        expect(screen.getByRole('button', { name: `${label} (${key})` })).toBeInTheDocument();
      }
    });

    it('renders custom abilities when provided', () => {
      const customAbilities = [
        { key: 'PER', label: 'Perception' },
        { key: 'STE', label: 'Stealth' },
      ];
      render(<HexAbilityModal {...makeProps({ abilities: customAbilities })} />);
      expect(screen.getByRole('button', { name: 'Perception (PER)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Stealth (STE)' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Strength (STR)' })).not.toBeInTheDocument();
    });

    it('renders no ability buttons when abilities is an empty array', () => {
      render(<HexAbilityModal {...makeProps({ abilities: [] })} />);
      expect(document.querySelectorAll('.hex-ability-btn')).toHaveLength(0);
    });

    it('renders the Cancel button', () => {
      render(<HexAbilityModal {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('ability selection', () => {
    it.each(DEFAULT_ABILITIES)('calls onAbilitySelected with "%s" when %s is clicked', (ability) => {
      render(<HexAbilityModal {...baseProps} />);
      fireEvent.click(screen.getByRole('button', { name: `${ability.label} (${ability.key})` }));
      expect(baseProps.onAbilitySelected).toHaveBeenCalledWith(ability.key);
    });

    it('calls onAbilitySelected with custom ability keys', () => {
      const customAbilities = [
        { key: 'PER', label: 'Perception' },
        { key: 'STE', label: 'Stealth' },
      ];
      render(<HexAbilityModal {...makeProps({ abilities: customAbilities })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Perception (PER)' }));
      expect(baseProps.onAbilitySelected).toHaveBeenCalledWith('PER');
      fireEvent.click(screen.getByRole('button', { name: 'Stealth (STE)' }));
      expect(baseProps.onAbilitySelected).toHaveBeenCalledWith('STE');
    });
  });

  describe('close behavior', () => {
    it('calls onCancel when Cancel button is clicked', () => {
      render(<HexAbilityModal {...baseProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when the overlay is clicked', () => {
      render(<HexAbilityModal {...baseProps} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(baseProps.onCancel).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });
  });
});
