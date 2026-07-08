// @cleaned-by-ai
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

  // ── Rendering ───────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders all expected fields', () => {
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

    it('renders all attitude options from ATTITUDE_OPTIONS', () => {
      renderForm();
      const attitudeSelect = screen.getByLabelText('Attitude');
      const options = Array.from(attitudeSelect.querySelectorAll('option'));
      expect(options).toHaveLength(ATTITUDE_OPTIONS.length);
      for (const option of ATTITUDE_OPTIONS) {
        expect(attitudeSelect).toContainHTML(
          `<option value="${option.value}">${option.label}</option>`
        );
      }
    });

    it('renders text inputs with correct placeholder text', () => {
      renderForm();
      expect(screen.getByLabelText('Race')).toHaveAttribute('placeholder', 'e.g., Human, Elf, Dwarf');
      expect(screen.getByLabelText('Class / Role')).toHaveAttribute('placeholder', 'e.g., Fighter, Wizard, Merchant');
      expect(screen.getByLabelText(/Tags/)).toHaveAttribute('placeholder', 'e.g., ally, enemy, quest-giver');
    });

    it('renders with empty string values', () => {
      const emptyFormData = {
        race: '',
        classRole: '',
        attitude: 'neutral',
        appearance: '',
        personality: '',
        goals: '',
        secrets: '',
        notes: '',
        tags: '',
      };
      renderForm(emptyFormData);
      const raceInput = screen.getByLabelText('Race');
      expect(raceInput).toHaveValue('');
      const tagsInput = screen.getByLabelText(/Tags/);
      expect(tagsInput).toHaveValue('');
    });

    it('renders inputs with correct HTML types and classes', () => {
      renderForm();
      const raceInput = screen.getByLabelText('Race');
      expect(raceInput).toHaveAttribute('type', 'text');
      expect(raceInput).toHaveClass('ct-input');

      const attitudeSelect = screen.getByLabelText('Attitude');
      expect(attitudeSelect).toHaveClass('ct-select');
    });
  });

  // ── Text input field changes ────────────────────────────────────────

  describe('Text input changes', () => {
    it('calls onFieldChange with correct field name and value for race', () => {
      renderForm();
      const raceInput = screen.getByLabelText('Race');
      fireEvent.change(raceInput, { target: { value: 'Elf' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('race', 'Elf');
    });

    it('calls onFieldChange with correct field name and value for classRole', () => {
      renderForm();
      const classRoleInput = screen.getByLabelText('Class / Role');
      fireEvent.change(classRoleInput, { target: { value: 'Rogue' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('classRole', 'Rogue');
    });

    it('calls onFieldChange with correct field name and value for tags', () => {
      renderForm();
      const tagsInput = screen.getByLabelText(/Tags/);
      fireEvent.change(tagsInput, { target: { value: 'boss, dragon' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('tags', 'boss, dragon');
    });

    it('handles empty string input changes', () => {
      renderForm();
      const raceInput = screen.getByLabelText('Race');
      fireEvent.change(raceInput, { target: { value: '' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('race', '');
    });

    it('handles special characters in text inputs', () => {
      renderForm();
      const raceInput = screen.getByLabelText('Race');
      fireEvent.change(raceInput, { target: { value: "O'Brien" } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('race', "O'Brien");
    });
  });

  // ── Attitude select changes ─────────────────────────────────────────

  describe('Attitude select changes', () => {
    it('calls onFieldChange with correct field name and value when attitude changes', () => {
      renderForm();
      const attitudeSelect = screen.getByLabelText('Attitude');
      fireEvent.change(attitudeSelect, { target: { value: 'positive' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', 'positive');
    });

    it('calls onFieldChange for all attitude options', () => {
      renderForm();
      const attitudeSelect = screen.getByLabelText('Attitude');
      for (const option of ATTITUDE_OPTIONS) {
        fireEvent.change(attitudeSelect, { target: { value: option.value } });
        expect(mockOnFieldChange).toHaveBeenCalledWith('attitude', option.value);
        mockOnFieldChange.mockClear();
      }
    });

    it('defaults to neutral attitude value', () => {
      renderForm();
      const attitudeSelect = screen.getByLabelText('Attitude');
      expect(attitudeSelect.value).toBe('neutral');
    });
  });

  // ── PreviewToggle interactions ──────────────────────────────────────

  describe('PreviewToggle fields', () => {
    it('renders textarea for each PreviewToggle field', () => {
      renderForm();
      expect(screen.getByDisplayValue('Tall with a long beard')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Wise and mysterious')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Defeat Sauron')).toBeInTheDocument();
      expect(screen.getByDisplayValue('He is a Maia')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Carries a staff')).toBeInTheDocument();
    });

    it('renders PreviewToggle with label and preview button', () => {
      renderForm();
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Personality')).toBeInTheDocument();
      expect(screen.getByText('Goals')).toBeInTheDocument();
      expect(screen.getByText('Secrets')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getAllByText('Preview')).toHaveLength(5);
    });

    it('toggles Appearance preview mode and back', () => {
      renderForm();
      const appearanceTextarea = screen.getByDisplayValue('Tall with a long beard');
      const appearanceWrapper = appearanceTextarea.closest('.preview-toggle-wrapper');

      // Click the Preview button for Appearance
      const appearancePreviewBtn = appearanceWrapper.querySelector('.preview-toggle-button');
      fireEvent.click(appearancePreviewBtn);

      const appearanceEditBtn = appearanceWrapper.querySelector('.preview-toggle-button');
      expect(appearanceEditBtn.textContent).toBe('Edit');
      expect(appearanceTextarea).toHaveClass('preview-toggle-textarea--hidden');

      // Toggle back to edit
      fireEvent.click(appearanceEditBtn);

      expect(appearanceEditBtn.textContent).toBe('Preview');
      expect(appearanceTextarea).not.toHaveClass('preview-toggle-textarea--hidden');
    });

    it('calls onChange when textarea in PreviewToggle is edited', () => {
      renderForm();
      const appearanceTextarea = screen.getByDisplayValue('Tall with a long beard');
      fireEvent.change(appearanceTextarea, { target: { value: 'Short and stout' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('appearance', 'Short and stout');
    });

    it('calls onChange for all PreviewToggle textareas', () => {
      renderForm();
      const textareas = [
        { label: 'appearance', value: 'New appearance' },
        { label: 'personality', value: 'New personality' },
        { label: 'goals', value: 'New goals' },
        { label: 'secrets', value: 'New secrets' },
        { label: 'notes', value: 'New notes' },
      ];

      for (const { label, value } of textareas) {
        const textarea = screen.getByDisplayValue(defaultFormData[label]);
        fireEvent.change(textarea, { target: { value } });
        expect(mockOnFieldChange).toHaveBeenCalledWith(label, value);
        mockOnFieldChange.mockClear();
      }
    });

    it('renders empty textarea when PreviewToggle value is empty', () => {
      const emptyFormData = {
        ...defaultFormData,
        appearance: '',
        personality: '',
        goals: '',
        secrets: '',
        notes: '',
      };
      renderForm(emptyFormData);
      const textareas = document.querySelectorAll('.preview-toggle-textarea');
      expect(textareas).toHaveLength(5);
      for (const textarea of textareas) {
        expect(textarea).toHaveValue('');
      }
    });

    it('renders MarkdownPreview content when in preview mode', async () => {
      renderForm();
      const appearanceTextarea = screen.getByDisplayValue('Tall with a long beard');
      const appearanceWrapper = appearanceTextarea.closest('.preview-toggle-wrapper');

      // Toggle to preview mode
      const appearancePreviewBtn = appearanceWrapper.querySelector('.preview-toggle-button');
      fireEvent.click(appearancePreviewBtn);

      // The preview div should be visible and contain the rendered markdown
      const previewDiv = appearanceWrapper.querySelector('.preview-toggle-preview');
      expect(previewDiv).not.toHaveClass('preview-toggle-preview--hidden');
      const markdownPreview = previewDiv.querySelector('.markdown-preview');
      expect(markdownPreview).toBeInTheDocument();
    });

    it('toggles each PreviewToggle independently', () => {
      renderForm();
      const appearanceTextarea = screen.getByDisplayValue('Tall with a long beard');
      const personalityTextarea = screen.getByDisplayValue('Wise and mysterious');
      const appearanceWrapper = appearanceTextarea.closest('.preview-toggle-wrapper');
      const personalityWrapper = personalityTextarea.closest('.preview-toggle-wrapper');

      // Toggle Appearance to preview
      const appearancePreviewBtn = appearanceWrapper.querySelector('.preview-toggle-button');
      fireEvent.click(appearancePreviewBtn);

      // Appearance textarea should be hidden
      expect(appearanceTextarea).toHaveClass('preview-toggle-textarea--hidden');

      // Personality textarea should still be visible
      expect(personalityTextarea).not.toHaveClass('preview-toggle-textarea--hidden');

      // Toggle Personality to preview
      const personalityPreviewBtn = personalityWrapper.querySelector('.preview-toggle-button');
      fireEvent.click(personalityPreviewBtn);

      // Now both should be hidden
      expect(appearanceTextarea).toHaveClass('preview-toggle-textarea--hidden');
      expect(personalityTextarea).toHaveClass('preview-toggle-textarea--hidden');

      // Toggle Appearance back to edit
      const appearanceEditBtn = appearanceWrapper.querySelector('.preview-toggle-button');
      fireEvent.click(appearanceEditBtn);

      // Appearance visible, Personality still hidden
      expect(appearanceTextarea).not.toHaveClass('preview-toggle-textarea--hidden');
      expect(personalityTextarea).toHaveClass('preview-toggle-textarea--hidden');
    });
  });
});
