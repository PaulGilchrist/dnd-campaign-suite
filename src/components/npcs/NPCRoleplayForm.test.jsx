// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCRoleplayForm from './NPCRoleplayForm.jsx';

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

  const renderForm = (formData = defaultFormData) =>
    render(<NPCRoleplayForm formData={formData} onFieldChange={mockOnFieldChange} />);

  describe('Rendering', () => {
    it('should render all form fields', () => {
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

    it('should reflect formData values in the rendered fields', () => {
      renderForm({
        ...defaultFormData,
        race: 'Elf',
        tags: 'enemy',
      });
      expect(screen.getByLabelText('Race').value).toBe('Elf');
      expect(screen.getByLabelText(/Tags/).value).toBe('enemy');
    });

    it('should render with empty string values when formData is empty', () => {
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
      expect(screen.getByLabelText(/Tags/).value).toBe('');
    });
  });

  describe('Field changes', () => {
    it('should call onFieldChange with the correct field name and value when a text input changes', () => {
      renderForm();
      const raceInput = screen.getByLabelText('Race');
      fireEvent.change(raceInput, { target: { value: 'Elf' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('race', 'Elf');
    });

    it('should call onFieldChange with empty string when a text input is cleared', () => {
      renderForm();
      const raceInput = screen.getByLabelText('Race');
      fireEvent.change(raceInput, { target: { value: '' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('race', '');
    });

    it('should call onFieldChange with the correct field name and value when the attitude select changes', () => {
      renderForm();
      const attitudeSelect = screen.getByLabelText('Attitude');
      fireEvent.change(attitudeSelect, { target: { value: 'positive' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', 'positive');
    });
  });
});
