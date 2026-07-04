// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCRoleplayForm from './NPCRoleplayForm.jsx';
import { ATTITUDE_OPTIONS } from '../../services/npcs/npcFormUtils.js';

describe('NPCRoleplayForm', () => {
  const mockOnFieldChange = vi.fn();

  const defaultFormData = {
    race: 'Human',
    classRole: 'Wizard',
    attitude: 'neutral',
    appearance: 'Tall with a long beard',
    personality: 'Wise and mysterious',
    goals: 'Defeat Sauron',
    secrets: 'He is a Maia',
    notes: 'Carries a staff',
    tags: 'ally, quest-giver',
  };

  const renderForm = (formData = defaultFormData) => {
    return render(
      <NPCRoleplayForm formData={formData} onFieldChange={mockOnFieldChange} />
    );
  };

  describe('Rendering: Fields', () => {
    it('should render all expected field elements', () => {
      renderForm();
      expect(screen.getByLabelText('Race')).toBeInTheDocument();
      expect(screen.getByLabelText('Class / Role')).toBeInTheDocument();
      expect(screen.getByLabelText('Attitude')).toBeInTheDocument();
      expect(screen.getByLabelText('Appearance')).toBeInTheDocument();
      expect(screen.getByLabelText('Personality')).toBeInTheDocument();
      expect(screen.getByLabelText('Goals')).toBeInTheDocument();
      expect(screen.getByLabelText('Secrets')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();
      expect(screen.getByLabelText(/Tags/)).toBeInTheDocument();
    });

    it.each([
      ['race', 'Race', 'Human', 'text', 'npc-race'],
      ['classRole', 'Class / Role', 'Wizard', 'text', 'npc-classRole'],
      ['tags', /Tags/, 'ally, quest-giver', 'text', 'npc-tags'],
    ])(
      'should render %s with correct value, type and id',
      (_fieldName, label, expectedValue, inputType, expectedId) => {
        renderForm();
        const input = typeof label === 'string' ? screen.getByLabelText(label) : screen.getByLabelText(label);
        expect(input.value).toBe(expectedValue);
        expect(input).toHaveAttribute('type', inputType);
        expect(input).toHaveAttribute('id', expectedId);
      },
    );

    it.each([
      ['appearance', 'Appearance', 'Tall with a long beard', 'npc-appearance'],
      ['personality', 'Personality', 'Wise and mysterious', 'npc-personality'],
      ['goals', 'Goals', 'Defeat Sauron', 'npc-goals'],
      ['secrets', 'Secrets', 'He is a Maia', 'npc-secrets'],
      ['notes', 'Notes', 'Carries a staff', 'npc-notes'],
    ])(
      'should render %s with correct value and id',
      (_fieldName, label, expectedValue, expectedId) => {
        renderForm();
        const input = screen.getByLabelText(label);
        expect(input.value).toBe(expectedValue);
        expect(input).toHaveAttribute('id', expectedId);
      },
    );

    it.each([
      ['Race', 'e.g., Human, Elf, Dwarf'],
      ['Class / Role', 'e.g., Fighter, Wizard, Merchant'],
      ['Appearance', 'Physical description…'],
      ['Personality', 'Personality traits, ideals, bonds, flaws…'],
      ['Goals', 'What does this NPC want?'],
      ['Secrets', 'Hidden truths about this NPC…'],
      ['Notes', 'Additional notes…'],
      [/Tags/, 'e.g., ally, enemy, quest-giver'],
    ])('should render %s with correct placeholder', (label, expectedPlaceholder) => {
      renderForm();
      const input = typeof label === 'string' ? screen.getByLabelText(label) : screen.getByLabelText(label);
      expect(input).toHaveAttribute('placeholder', expectedPlaceholder);
    });
  });

  describe('Rendering: Attitude', () => {
    it('should render Attitude select with correct value', () => {
      renderForm();
      const attitudeSelect = screen.getByLabelText('Attitude');
      expect(attitudeSelect.value).toBe('neutral');
    });

    it('should render each attitude option with correct value and label', () => {
      renderForm();
      const select = screen.getByLabelText('Attitude');
      const options = select.querySelectorAll('option');
      ATTITUDE_OPTIONS.forEach((option, index) => {
        expect(options[index].value).toBe(option.value);
        expect(options[index].textContent).toBe(option.label);
      });
    });
  });

  describe('Field Changes', () => {
    const textFields = [
      ['race', 'Race', 'Elf'],
      ['classRole', 'Class / Role', 'Rogue'],
      ['appearance', 'Appearance', 'Short and stout'],
      ['personality', 'Personality', 'Cheerful'],
      ['goals', 'Goals', 'Become a lich'],
      ['secrets', 'Secrets', 'Former thief'],
      ['notes', 'Notes', 'Met at the tavern'],
      ['tags', /Tags/, 'boss, merchant'],
    ];

    it.each(textFields)(
      'should call onFieldChange with %s when input changes',
      (fieldName, label, newValue) => {
        renderForm();
        const input = typeof label === 'string' ? screen.getByLabelText(label) : screen.getByLabelText(label);
        fireEvent.change(input, { target: { value: newValue } });
        expect(mockOnFieldChange).toHaveBeenCalledWith(fieldName, newValue);
      },
    );

    it.each(textFields)(
      'should call onFieldChange with empty string when %s input cleared',
      (fieldName, label) => {
        renderForm();
        const input = typeof label === 'string' ? screen.getByLabelText(label) : screen.getByLabelText(label);
        fireEvent.change(input, { target: { value: '' } });
        expect(mockOnFieldChange).toHaveBeenCalledWith(fieldName, '');
      },
    );

    it('should call onFieldChange with attitude when select changes', () => {
      renderForm();
      const attitudeSelect = screen.getByLabelText('Attitude');
      fireEvent.change(attitudeSelect, { target: { value: 'positive' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', 'positive');
    });

    it('should call onFieldChange with each attitude value when selected', () => {
      renderForm();
      const attitudeSelect = screen.getByLabelText('Attitude');
      ATTITUDE_OPTIONS.forEach((option) => {
        fireEvent.change(attitudeSelect, { target: { value: option.value } });
        expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', option.value);
      });
    });
  });

  describe('PreviewToggle Behavior', () => {
    it.each([
      ['Appearance', 'Tall with a long beard'],
      ['Personality', 'Wise and mysterious'],
      ['Goals', 'Defeat Sauron'],
      ['Secrets', 'He is a Maia'],
      ['Notes', 'Carries a staff'],
    ])(
      'should render %s preview toggle visible by default',
      (fieldName, defaultValue) => {
        renderForm({ ...defaultFormData, [fieldName.toLowerCase()]: defaultValue });
        const textarea = screen.getByLabelText(fieldName);
        expect(textarea).not.toHaveClass('preview-toggle-textarea--hidden');
      },
    );

    it('should render markdown preview when PreviewToggle is in preview mode', () => {
      renderForm();
      const appearanceTextarea = screen.getByLabelText('Appearance');
      const toggleButton = appearanceTextarea.parentElement.querySelector('.preview-toggle-button');
      fireEvent.click(toggleButton);
      const previewContainer = document.querySelector('.preview-toggle-preview');
      expect(previewContainer).not.toHaveClass('preview-toggle-preview--hidden');
    });
  });

  describe('Empty Form Data', () => {
    it('should render with empty string values', () => {
      renderForm({
        race: '',
        classRole: '',
        attitude: 'neutral',
        appearance: '',
        personality: '',
        goals: '',
        secrets: '',
        notes: '',
        tags: '',
      });
      expect(screen.getByLabelText('Race').value).toBe('');
      expect(screen.getByLabelText('Class / Role').value).toBe('');
      expect(screen.getByLabelText(/Tags/).value).toBe('');
    });
  });
});
