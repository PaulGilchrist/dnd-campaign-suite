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

  const renderForm = (formData = defaultFormData) => {
    return render(
      <NPCRoleplayForm formData={formData} onFieldChange={mockOnFieldChange} />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering: Fields ─────────────────────────────────────────────

  it('should render Race label and input', () => {
    renderForm();
    expect(screen.getByLabelText('Race')).toBeInTheDocument();
  });

  it('should render Class / Role label and input', () => {
    renderForm();
    expect(screen.getByLabelText('Class / Role')).toBeInTheDocument();
  });

  it('should render Attitude label and select', () => {
    renderForm();
    expect(screen.getByLabelText('Attitude')).toBeInTheDocument();
  });

  it('should render Appearance PreviewToggle', () => {
    renderForm();
    expect(screen.getByLabelText('Appearance')).toBeInTheDocument();
  });

  it('should render Personality PreviewToggle', () => {
    renderForm();
    expect(screen.getByLabelText('Personality')).toBeInTheDocument();
  });

  it('should render Goals PreviewToggle', () => {
    renderForm();
    expect(screen.getByLabelText('Goals')).toBeInTheDocument();
  });

  it('should render Secrets PreviewToggle', () => {
    renderForm();
    expect(screen.getByLabelText('Secrets')).toBeInTheDocument();
  });

  it('should render Notes PreviewToggle', () => {
    renderForm();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('should render Tags label and input', () => {
    renderForm();
    expect(screen.getByLabelText(/Tags/)).toBeInTheDocument();
  });

  // ── Rendering: Values ─────────────────────────────────────────────

  it('should render Race input with correct value', () => {
    renderForm();
    const raceInput = screen.getByLabelText('Race');
    expect(raceInput.value).toBe('Human');
  });

  it('should render Class / Role input with correct value', () => {
    renderForm();
    const classRoleInput = screen.getByLabelText('Class / Role');
    expect(classRoleInput.value).toBe('Wizard');
  });

  it('should render Attitude select with correct value', () => {
    renderForm();
    const attitudeSelect = screen.getByLabelText('Attitude');
    expect(attitudeSelect.value).toBe('neutral');
  });

  it('should render Appearance textarea with correct value', () => {
    renderForm();
    const appearanceTextarea = screen.getByLabelText('Appearance');
    expect(appearanceTextarea.value).toBe('Tall with a long beard');
  });

  it('should render Personality textarea with correct value', () => {
    renderForm();
    const personalityTextarea = screen.getByLabelText('Personality');
    expect(personalityTextarea.value).toBe('Wise and mysterious');
  });

  it('should render Goals textarea with correct value', () => {
    renderForm();
    const goalsTextarea = screen.getByLabelText('Goals');
    expect(goalsTextarea.value).toBe('Defeat Sauron');
  });

  it('should render Secrets textarea with correct value', () => {
    renderForm();
    const secretsTextarea = screen.getByLabelText('Secrets');
    expect(secretsTextarea.value).toBe('He is a Maia');
  });

  it('should render Notes textarea with correct value', () => {
    renderForm();
    const notesTextarea = screen.getByLabelText('Notes');
    expect(notesTextarea.value).toBe('Carries a staff');
  });

  it('should render Tags input with correct value', () => {
    renderForm();
    const tagsInput = screen.getByLabelText(/Tags/);
    expect(tagsInput.value).toBe('ally, quest-giver');
  });

  // ── Rendering: Placeholders ───────────────────────────────────────

  it('should render Race input with placeholder', () => {
    renderForm();
    const raceInput = screen.getByLabelText('Race');
    expect(raceInput).toHaveAttribute('placeholder', 'e.g., Human, Elf, Dwarf');
  });

  it('should render Class / Role input with placeholder', () => {
    renderForm();
    const classRoleInput = screen.getByLabelText('Class / Role');
    expect(classRoleInput).toHaveAttribute('placeholder', 'e.g., Fighter, Wizard, Merchant');
  });

  it('should render Tags input with placeholder', () => {
    renderForm();
    const tagsInput = screen.getByLabelText(/Tags/);
    expect(tagsInput).toHaveAttribute('placeholder', 'e.g., ally, enemy, quest-giver');
  });

  // ── Rendering: Input Types ────────────────────────────────────────

  it('should render Race input as text type', () => {
    renderForm();
    const raceInput = screen.getByLabelText('Race');
    expect(raceInput).toHaveAttribute('type', 'text');
  });

  it('should render Class / Role input as text type', () => {
    renderForm();
    const classRoleInput = screen.getByLabelText('Class / Role');
    expect(classRoleInput).toHaveAttribute('type', 'text');
  });

  it('should render Attitude as a select element', () => {
    renderForm();
    const attitudeSelect = screen.getByLabelText('Attitude');
    expect(attitudeSelect.tagName).toBe('SELECT');
  });

  it('should render Tags input as text type', () => {
    renderForm();
    const tagsInput = screen.getByLabelText(/Tags/);
    expect(tagsInput).toHaveAttribute('type', 'text');
  });

  // ── Rendering: CSS Classes ────────────────────────────────────────

  it('should render Race input with ct-input class', () => {
    renderForm();
    const raceInput = screen.getByLabelText('Race');
    expect(raceInput).toHaveClass('ct-input');
  });

  it('should render Class / Role input with ct-input class', () => {
    renderForm();
    const classRoleInput = screen.getByLabelText('Class / Role');
    expect(classRoleInput).toHaveClass('ct-input');
  });

  it('should render Attitude select with ct-select class', () => {
    renderForm();
    const attitudeSelect = screen.getByLabelText('Attitude');
    expect(attitudeSelect).toHaveClass('ct-select');
  });

  it('should render Tags input with ct-input class', () => {
    renderForm();
    const tagsInput = screen.getByLabelText(/Tags/);
    expect(tagsInput).toHaveClass('ct-input');
  });

  it('should render labels with ct-label class', () => {
    renderForm();
    const labels = document.querySelectorAll('.ct-label');
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });

  // ── Rendering: Attitude Options ───────────────────────────────────

  it('should render all attitude options', () => {
    renderForm();
    const options = screen.getByLabelText('Attitude').querySelectorAll('option');
    expect(options.length).toBe(ATTITUDE_OPTIONS.length);
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

  it('should have neutral selected by default', () => {
    renderForm();
    const select = screen.getByLabelText('Attitude');
    expect(select.value).toBe('neutral');
  });

  it('should have correct attitude values', () => {
    renderForm();
    const select = screen.getByLabelText('Attitude');
    const optionValues = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(optionValues).toEqual(ATTITUDE_OPTIONS.map((o) => o.value));
  });

  // ── Field Changes: Race ───────────────────────────────────────────

  it('should call onFieldChange with race when race input changes', () => {
    renderForm();
    const raceInput = screen.getByLabelText('Race');
    fireEvent.change(raceInput, { target: { value: 'Elf' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('race', 'Elf');
  });

  it('should call onFieldChange with empty string when race input cleared', () => {
    renderForm();
    const raceInput = screen.getByLabelText('Race');
    fireEvent.change(raceInput, { target: { value: '' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('race', '');
  });

  // ── Field Changes: Class / Role ───────────────────────────────────

  it('should call onFieldChange with classRole when classRole input changes', () => {
    renderForm();
    const classRoleInput = screen.getByLabelText('Class / Role');
    fireEvent.change(classRoleInput, { target: { value: 'Rogue' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('classRole', 'Rogue');
  });

  it('should call onFieldChange with empty string when classRole input cleared', () => {
    renderForm();
    const classRoleInput = screen.getByLabelText('Class / Role');
    fireEvent.change(classRoleInput, { target: { value: '' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('classRole', '');
  });

  // ── Field Changes: Attitude ───────────────────────────────────────

  it('should call onFieldChange with attitude when select changes', () => {
    renderForm();
    const attitudeSelect = screen.getByLabelText('Attitude');
    fireEvent.change(attitudeSelect, { target: { value: 'positive' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', 'positive');
  });

  it('should call onFieldChange with negative when negative selected', () => {
    renderForm();
    const attitudeSelect = screen.getByLabelText('Attitude');
    fireEvent.change(attitudeSelect, { target: { value: 'negative' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', 'negative');
  });

  it('should call onFieldChange with deep bonds when deep bonds selected', () => {
    renderForm();
    const attitudeSelect = screen.getByLabelText('Attitude');
    fireEvent.change(attitudeSelect, { target: { value: 'deep bonds' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', 'deep bonds');
  });

  it('should call onFieldChange with extreme opposition when selected', () => {
    renderForm();
    const attitudeSelect = screen.getByLabelText('Attitude');
    fireEvent.change(attitudeSelect, { target: { value: 'extreme opposition' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', 'extreme opposition');
  });

  // ── Field Changes: Appearance ─────────────────────────────────────

  it('should call onFieldChange with appearance when appearance textarea changes', () => {
    renderForm();
    const appearanceTextarea = screen.getByLabelText('Appearance');
    fireEvent.change(appearanceTextarea, { target: { value: 'Short and stout' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('appearance', 'Short and stout');
  });

  it('should call onFieldChange with empty string when appearance cleared', () => {
    renderForm();
    const appearanceTextarea = screen.getByLabelText('Appearance');
    fireEvent.change(appearanceTextarea, { target: { value: '' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('appearance', '');
  });

  // ── Field Changes: Personality ────────────────────────────────────

  it('should call onFieldChange with personality when personality textarea changes', () => {
    renderForm();
    const personalityTextarea = screen.getByLabelText('Personality');
    fireEvent.change(personalityTextarea, { target: { value: 'Cheerful' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('personality', 'Cheerful');
  });

  it('should call onFieldChange with empty string when personality cleared', () => {
    renderForm();
    const personalityTextarea = screen.getByLabelText('Personality');
    fireEvent.change(personalityTextarea, { target: { value: '' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('personality', '');
  });

  // ── Field Changes: Goals ──────────────────────────────────────────

  it('should call onFieldChange with goals when goals textarea changes', () => {
    renderForm();
    const goalsTextarea = screen.getByLabelText('Goals');
    fireEvent.change(goalsTextarea, { target: { value: 'Become a lich' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('goals', 'Become a lich');
  });

  it('should call onFieldChange with empty string when goals cleared', () => {
    renderForm();
    const goalsTextarea = screen.getByLabelText('Goals');
    fireEvent.change(goalsTextarea, { target: { value: '' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('goals', '');
  });

  // ── Field Changes: Secrets ────────────────────────────────────────

  it('should call onFieldChange with secrets when secrets textarea changes', () => {
    renderForm();
    const secretsTextarea = screen.getByLabelText('Secrets');
    fireEvent.change(secretsTextarea, { target: { value: 'Former thief' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('secrets', 'Former thief');
  });

  it('should call onFieldChange with empty string when secrets cleared', () => {
    renderForm();
    const secretsTextarea = screen.getByLabelText('Secrets');
    fireEvent.change(secretsTextarea, { target: { value: '' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('secrets', '');
  });

  // ── Field Changes: Notes ──────────────────────────────────────────

  it('should call onFieldChange with notes when notes textarea changes', () => {
    renderForm();
    const notesTextarea = screen.getByLabelText('Notes');
    fireEvent.change(notesTextarea, { target: { value: 'Met at the tavern' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('notes', 'Met at the tavern');
  });

  it('should call onFieldChange with empty string when notes cleared', () => {
    renderForm();
    const notesTextarea = screen.getByLabelText('Notes');
    fireEvent.change(notesTextarea, { target: { value: '' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('notes', '');
  });

  // ── Field Changes: Tags ───────────────────────────────────────────

  it('should call onFieldChange with tags when tags input changes', () => {
    renderForm();
    const tagsInput = screen.getByLabelText(/Tags/);
    fireEvent.change(tagsInput, { target: { value: 'boss, merchant' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('tags', 'boss, merchant');
  });

  it('should call onFieldChange with empty string when tags cleared', () => {
    renderForm();
    const tagsInput = screen.getByLabelText(/Tags/);
    fireEvent.change(tagsInput, { target: { value: '' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('tags', '');
  });

  // ── PreviewToggle Behavior ────────────────────────────────────────

  it('should render PreviewToggle for appearance in edit mode by default', () => {
    renderForm();
    const appearanceTextarea = screen.getByLabelText('Appearance');
    expect(appearanceTextarea).not.toHaveClass('preview-toggle-textarea--hidden');
  });

  it('should render PreviewToggle for personality in edit mode by default', () => {
    renderForm();
    const personalityTextarea = screen.getByLabelText('Personality');
    expect(personalityTextarea).not.toHaveClass('preview-toggle-textarea--hidden');
  });

  it('should render PreviewToggle for goals in edit mode by default', () => {
    renderForm();
    const goalsTextarea = screen.getByLabelText('Goals');
    expect(goalsTextarea).not.toHaveClass('preview-toggle-textarea--hidden');
  });

  it('should render PreviewToggle for secrets in edit mode by default', () => {
    renderForm();
    const secretsTextarea = screen.getByLabelText('Secrets');
    expect(secretsTextarea).not.toHaveClass('preview-toggle-textarea--hidden');
  });

  it('should render PreviewToggle for notes in edit mode by default', () => {
    renderForm();
    const notesTextarea = screen.getByLabelText('Notes');
    expect(notesTextarea).not.toHaveClass('preview-toggle-textarea--hidden');
  });

  it('should render toggle buttons on PreviewToggle components', () => {
    renderForm();
    const toggleButtons = document.querySelectorAll('.preview-toggle-button');
    expect(toggleButtons.length).toBe(5);
  });

  it('should render preview toggle labels', () => {
    renderForm();
    const previewLabels = document.querySelectorAll('.preview-toggle-label');
    expect(previewLabels.length).toBe(5);
  });

  // ── PreviewToggle with Preview Content ────────────────────────────

  it('should render markdown preview when PreviewToggle is in preview mode', () => {
    renderForm();
    const appearanceTextarea = screen.getByLabelText('Appearance');
    const toggleButton = appearanceTextarea.parentElement.querySelector('.preview-toggle-button');
    fireEvent.click(toggleButton);
    const previewContainer = document.querySelector('.preview-toggle-preview');
    expect(previewContainer).not.toHaveClass('preview-toggle-preview--hidden');
  });

  it('should not render preview content when textarea value is empty', () => {
    render(
      <NPCRoleplayForm
        formData={{ ...defaultFormData, appearance: '' }}
        onFieldChange={mockOnFieldChange}
      />
    );
    const appearanceTextarea = screen.getByLabelText('Appearance');
    const toggleButton = appearanceTextarea.parentElement.querySelector('.preview-toggle-button');
    fireEvent.click(toggleButton);
    const previewContainer = document.querySelector('.preview-toggle-preview');
    expect(previewContainer).not.toHaveClass('preview-toggle-preview--hidden');
  });

  // ── Multiple Field Changes ────────────────────────────────────────

  it('should handle multiple field changes in sequence', () => {
    renderForm();
    const raceInput = screen.getByLabelText('Race');
    fireEvent.change(raceInput, { target: { value: 'Dwarf' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('race', 'Dwarf');

    const classRoleInput = screen.getByLabelText('Class / Role');
    fireEvent.change(classRoleInput, { target: { value: 'Cleric' } });
    expect(mockOnFieldChange).toHaveBeenCalledWith('classRole', 'Cleric');
  });

  // ── Empty Form Data ───────────────────────────────────────────────

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
    const raceInput = screen.getByLabelText('Race');
    expect(raceInput.value).toBe('');
    const tagsInput = screen.getByLabelText(/Tags/);
    expect(tagsInput.value).toBe('');
  });

  // ── HTML IDs ──────────────────────────────────────────────────────

  it('should render Race input with correct id', () => {
    renderForm();
    const raceInput = screen.getByLabelText('Race');
    expect(raceInput).toHaveAttribute('id', 'npc-race');
  });

  it('should render Class / Role input with correct id', () => {
    renderForm();
    const classRoleInput = screen.getByLabelText('Class / Role');
    expect(classRoleInput).toHaveAttribute('id', 'npc-classRole');
  });

  it('should render Attitude select with correct id', () => {
    renderForm();
    const attitudeSelect = screen.getByLabelText('Attitude');
    expect(attitudeSelect).toHaveAttribute('id', 'npc-attitude');
  });

  it('should render Appearance textarea with correct id', () => {
    renderForm();
    const appearanceTextarea = screen.getByLabelText('Appearance');
    expect(appearanceTextarea).toHaveAttribute('id', 'npc-appearance');
  });

  it('should render Personality textarea with correct id', () => {
    renderForm();
    const personalityTextarea = screen.getByLabelText('Personality');
    expect(personalityTextarea).toHaveAttribute('id', 'npc-personality');
  });

  it('should render Goals textarea with correct id', () => {
    renderForm();
    const goalsTextarea = screen.getByLabelText('Goals');
    expect(goalsTextarea).toHaveAttribute('id', 'npc-goals');
  });

  it('should render Secrets textarea with correct id', () => {
    renderForm();
    const secretsTextarea = screen.getByLabelText('Secrets');
    expect(secretsTextarea).toHaveAttribute('id', 'npc-secrets');
  });

  it('should render Notes textarea with correct id', () => {
    renderForm();
    const notesTextarea = screen.getByLabelText('Notes');
    expect(notesTextarea).toHaveAttribute('id', 'npc-notes');
  });

  it('should render Tags input with correct id', () => {
    renderForm();
    const tagsInput = screen.getByLabelText(/Tags/);
    expect(tagsInput).toHaveAttribute('id', 'npc-tags');
  });

  // ── PreviewToggle IDs ─────────────────────────────────────────────

  it('should render PreviewToggle appearance with correct id', () => {
    renderForm();
    const appearanceTextarea = screen.getByLabelText('Appearance');
    expect(appearanceTextarea).toHaveAttribute('id', 'npc-appearance');
  });

  it('should render PreviewToggle personality with correct id', () => {
    renderForm();
    const personalityTextarea = screen.getByLabelText('Personality');
    expect(personalityTextarea).toHaveAttribute('id', 'npc-personality');
  });

  it('should render PreviewToggle goals with correct id', () => {
    renderForm();
    const goalsTextarea = screen.getByLabelText('Goals');
    expect(goalsTextarea).toHaveAttribute('id', 'npc-goals');
  });

  it('should render PreviewToggle secrets with correct id', () => {
    renderForm();
    const secretsTextarea = screen.getByLabelText('Secrets');
    expect(secretsTextarea).toHaveAttribute('id', 'npc-secrets');
  });

  it('should render PreviewToggle notes with correct id', () => {
    renderForm();
    const notesTextarea = screen.getByLabelText('Notes');
    expect(notesTextarea).toHaveAttribute('id', 'npc-notes');
  });

  // ── PreviewToggle Placeholder Text ────────────────────────────────

  it('should render Appearance with correct placeholder', () => {
    renderForm();
    const appearanceTextarea = screen.getByLabelText('Appearance');
    expect(appearanceTextarea).toHaveAttribute('placeholder', 'Physical description…');
  });

  it('should render Personality with correct placeholder', () => {
    renderForm();
    const personalityTextarea = screen.getByLabelText('Personality');
    expect(personalityTextarea).toHaveAttribute('placeholder', 'Personality traits, ideals, bonds, flaws…');
  });

  it('should render Goals with correct placeholder', () => {
    renderForm();
    const goalsTextarea = screen.getByLabelText('Goals');
    expect(goalsTextarea).toHaveAttribute('placeholder', 'What does this NPC want?');
  });

  it('should render Secrets with correct placeholder', () => {
    renderForm();
    const secretsTextarea = screen.getByLabelText('Secrets');
    expect(secretsTextarea).toHaveAttribute('placeholder', 'Hidden truths about this NPC…');
  });

  it('should render Notes with correct placeholder', () => {
    renderForm();
    const notesTextarea = screen.getByLabelText('Notes');
    expect(notesTextarea).toHaveAttribute('placeholder', 'Additional notes…');
  });

  // ── Wrapper Structure ─────────────────────────────────────────────

  it('should render as a fragment (no wrapper element)', () => {
    renderForm();
    const labels = document.querySelectorAll('label[for]');
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });

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
});
