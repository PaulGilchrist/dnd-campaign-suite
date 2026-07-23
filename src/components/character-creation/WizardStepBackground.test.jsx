// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepBackground from './WizardStepBackground.jsx';

const mockBackgrounds = [
  { index: 'acolyte', name: 'Acolyte', description: 'You devoted yourself to service in a temple.', ability_scores: 'Intelligence, Wisdom, Charisma', feat: 'Magic Initiate', skill_proficiencies: 'Insight and Religion', tool_proficiencies: "Calligrapher's Supplies" },
  { index: 'soldier', name: 'Soldier', description: 'You were a soldier.', ability_scores: 'Strength, Constitution', feat: 'Alert', skill_proficiencies: 'Athletics and Perception', tool_proficiencies: 'One kind of Gaming Set or Musical Instrument' },
];

function createMockProps(overrides = {}) {
  return {
    formData: overrides.formData || { background: '' },
    errors: overrides.errors || {},
    backgrounds: overrides.backgrounds || mockBackgrounds,
    ruleset: overrides.ruleset || '2024',
    onInputChange: overrides.onInputChange || vi.fn(),
  };
}

describe('WizardStepBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('2024 ruleset', () => {
    it('should display the step heading', () => {
      render(<WizardStepBackground {...createMockProps()} />);
      expect(screen.getByText('Step 5: Background')).toBeInTheDocument();
    });

    it('should render the background dropdown with options', () => {
      render(<WizardStepBackground {...createMockProps()} />);
      expect(screen.getByText('Background *')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select.querySelector('option:nth-child(1)')).toHaveTextContent('Select a background');
      expect(select.querySelector('option:nth-child(2)')).toHaveTextContent('Acolyte');
      expect(select.querySelector('option:nth-child(3)')).toHaveTextContent('Soldier');
    });

    it('should show background details when expanded', () => {
      render(
        <WizardStepBackground
          {...createMockProps({
            formData: { background: 'Acolyte' },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Acolyte Details')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('You devoted yourself to service in a temple.')).toBeInTheDocument();
    });

    it('should show ability scores when expanded', () => {
      render(
        <WizardStepBackground
          {...createMockProps({
            formData: { background: 'Acolyte' },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Ability Scores')).toBeInTheDocument();
      expect(screen.getByText('Intelligence, Wisdom, Charisma')).toBeInTheDocument();
    });

    it('should show feat when expanded', () => {
      render(
        <WizardStepBackground
          {...createMockProps({
            formData: { background: 'Acolyte' },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Feat')).toBeInTheDocument();
      expect(screen.getByText('Magic Initiate')).toBeInTheDocument();
    });

    it('should show skill proficiencies when expanded', () => {
      render(
        <WizardStepBackground
          {...createMockProps({
            formData: { background: 'Acolyte' },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Skill Proficiencies')).toBeInTheDocument();
      expect(screen.getByText('Insight and Religion')).toBeInTheDocument();
    });

    it('should show tool proficiencies when expanded', () => {
      render(
        <WizardStepBackground
          {...createMockProps({
            formData: { background: 'Acolyte' },
          })}
        />
      );
      const header = document.querySelector('.detail-card-header');
      fireEvent.click(header);
      expect(screen.getByText('Tool Proficiencies')).toBeInTheDocument();
    });

    it('should call onInputChange when background changes', () => {
      const mockOnChange = vi.fn();
      render(
        <WizardStepBackground
          {...createMockProps({
            onInputChange: mockOnChange,
          })}
        />
      );
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: 'Soldier' } });
      expect(mockOnChange).toHaveBeenCalledWith('background', 'Soldier');
    });
  });

  describe('5e ruleset', () => {
    it('should show background-not-available message for 5e', () => {
      render(
        <WizardStepBackground
          {...createMockProps({
            ruleset: '5e',
          })}
        />
      );
      expect(screen.getByText(/Backgrounds are only available for 2024/)).toBeInTheDocument();
    });
  });

  describe('Error display', () => {
    it('should render error message and error class when background error exists', () => {
      render(
        <WizardStepBackground
          {...createMockProps({
            formData: { background: '' },
            errors: { background: 'Background is required' },
          })}
        />
      );
      expect(screen.getByText('Background is required')).toBeInTheDocument();
      const select = document.querySelector('select');
      expect(select).toHaveClass('error');
    });
  });

  describe('Empty backgrounds', () => {
    it('should show loading message when no backgrounds available', () => {
      render(
        <WizardStepBackground
          {...createMockProps({
            backgrounds: [],
          })}
        />
      );
      expect(screen.getByText('Background data not yet loaded. Please try again.')).toBeInTheDocument();
    });
  });
});
