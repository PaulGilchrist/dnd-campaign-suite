// @maintained-by-ai: 2026-10-14
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

  // Every editable field (text inputs, attitude select, PreviewToggle
  // textareas) shares one contract: render its value, then report only
  // that field's change via onFieldChange(key, value).
  const fields = [
    { label: 'Race', key: 'race', typed: 'Elf' },
    { label: 'Class / Role', key: 'classRole', typed: 'Rogue' },
    { label: 'Attitude', key: 'attitude', typed: 'positive' },
    { label: 'Appearance', key: 'appearance', typed: 'Updated text' },
    { label: 'Personality', key: 'personality', typed: 'Updated text' },
    { label: 'Goals', key: 'goals', typed: 'Updated text' },
    { label: 'Secrets', key: 'secrets', typed: 'Updated text' },
    { label: 'Notes', key: 'notes', typed: 'Updated text' },
    { label: 'Tags (comma separated)', key: 'tags', typed: 'boss, dragon' },
  ];

  it.each(fields)('renders "$label" with its value and reports only the "$key" change', ({ label, key, typed }) => {
    renderForm();
    expect(screen.getByLabelText(label)).toHaveValue(defaultFormData[key]);
    fireEvent.change(screen.getByLabelText(label), { target: { value: typed } });
    expect(mockOnFieldChange).toHaveBeenCalledTimes(1);
    expect(mockOnFieldChange).toHaveBeenCalledWith(key, typed);
  });

  it('renders every option from ATTITUDE_OPTIONS and selects the formData value', () => {
    renderForm({ ...defaultFormData, attitude: 'extreme opposition' });
    const select = screen.getByLabelText('Attitude');
    expect(select).toHaveValue('extreme opposition');
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.map((o) => o.value)).toEqual(ATTITUDE_OPTIONS.map((o) => o.value));
    ATTITUDE_OPTIONS.forEach(({ label }, i) => expect(options[i]).toHaveTextContent(label));
  });
});
