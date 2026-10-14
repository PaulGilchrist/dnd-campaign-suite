import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  const renderForm = (formData = defaultFormData) =>
    render(<NPCRoleplayForm formData={formData} onFieldChange={mockOnFieldChange} />);

  beforeEach(() => {
    mockOnFieldChange.mockClear();
  });

  // ── Text inputs ─────────────────────────────────────────────────────

  describe('Text inputs', () => {
    const textFields = [
      { label: 'Race', key: 'race', value: 'Human' },
      { label: 'Class / Role', key: 'classRole', value: 'Wizard' },
      { label: 'Tags (comma separated)', key: 'tags', value: 'ally, quest-giver' },
    ];

    it.each(textFields)('renders the "$label" input with its current value', ({ label, value }) => {
      renderForm();
      expect(screen.getByLabelText(label)).toHaveValue(value);
    });

    it.each([
      { label: 'Race', key: 'race', typed: 'Elf' },
      { label: 'Class / Role', key: 'classRole', typed: 'Rogue' },
      { label: 'Tags (comma separated)', key: 'tags', typed: 'boss, dragon' },
    ])('reports only the "$label" change with the "$key" key', ({ label, key, typed }) => {
      renderForm();
      fireEvent.change(screen.getByLabelText(label), { target: { value: typed } });
      expect(mockOnFieldChange).toHaveBeenCalledTimes(1);
      expect(mockOnFieldChange).toHaveBeenCalledWith(key, typed);
    });
  });

  // ── Attitude select ─────────────────────────────────────────────────

  describe('Attitude select', () => {
    it('renders a select labeled "Attitude"', () => {
      renderForm();
      screen.getByLabelText('Attitude');
    });

    it.each([
      { input: 'neutral', expected: 'neutral' },
      { input: 'negative', expected: 'negative' },
    ])('shows the attitude value ($input)', ({ input, expected }) => {
      renderForm({ ...defaultFormData, attitude: input });
      expect(screen.getByLabelText('Attitude')).toHaveValue(expected);
    });

    it('renders every option from ATTITUDE_OPTIONS', () => {
      renderForm();
      const options = Array.from(screen.getByLabelText('Attitude').querySelectorAll('option'));
      expect(options).toHaveLength(ATTITUDE_OPTIONS.length);
      for (const option of ATTITUDE_OPTIONS) {
        expect(options.find((o) => o.value === option.value)).toHaveTextContent(option.label);
      }
    });

    it('reports only the attitude change', () => {
      renderForm();
      fireEvent.change(screen.getByLabelText('Attitude'), { target: { value: 'positive' } });
      expect(mockOnFieldChange).toHaveBeenCalledTimes(1);
      expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', 'positive');
    });
  });

  // ── PreviewToggle fields ────────────────────────────────────────────

  describe('PreviewToggle fields', () => {
    const previewFields = [
      { label: 'Appearance', key: 'appearance', value: 'Tall with a long beard' },
      { label: 'Personality', key: 'personality', value: 'Wise and mysterious' },
      { label: 'Goals', key: 'goals', value: 'Defeat Sauron' },
      { label: 'Secrets', key: 'secrets', value: 'He is a Maia' },
      { label: 'Notes', key: 'notes', value: 'Carries a staff' },
    ];

    it.each(previewFields)('renders the "$label" field with its current value', ({ label, value }) => {
      renderForm();
      expect(screen.getByLabelText(label)).toHaveValue(value);
    });

    it.each(previewFields)('reports only the "$key" change from the "$label" textarea', ({ label, key }) => {
      renderForm();
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'Updated text' } });
      expect(mockOnFieldChange).toHaveBeenCalledTimes(1);
      expect(mockOnFieldChange).toHaveBeenCalledWith(key, 'Updated text');
    });
  });
});
