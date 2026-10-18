// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({
  renderMarkdown: vi.fn((md) => `<p>${md}</p>`),
}));

const errorTexts = () =>
  Array.from(document.querySelectorAll('.mi-error')).map((el) => el.textContent);

const selectFor = (labelText) =>
  screen.getByText(labelText).closest('.mi-selector').querySelector('select');

describe('MagicInitiateModal - Validation', () => {
  // Each case exercises a DISTINCT validateInstance gate: exact error copy,
  // exact error set, and zero writes / editor stays blocked on save attempt.
  describe('save-instance gate branches', () => {
    const blockedCases = [
      {
        title: 'class is cleared',
        instances: [{ class: 'Bard', cantrips: ['Dancing Lights', 'Acid Splash'], level1Spell: 'Heroism' }],
        changes: [['Class:', '']],
        errors: ['Class is required'],
      },
      {
        title: 'no spells are selected',
        instances: [{ class: 'Wizard', cantrips: [null, null], level1Spell: null }],
        changes: [],
        errors: ['Cantrip 1 is required', 'Cantrip 2 is required', 'Level 1 spell is required'],
      },
      {
        // Guidance is a Cleric/Druid cantrip, not a Wizard cantrip.
        title: 'cantrip is not from the selected class',
        instances: [{ class: 'Wizard', cantrips: ['Guidance', 'Acid Splash'], level1Spell: 'Burning Hands' }],
        changes: [],
        errors: ['Not a valid Wizard cantrip'],
      },
      {
        // Bless is a Cleric spell, not a Wizard spell.
        title: 'level 1 spell is not from the selected class',
        instances: [{ class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Bless' }],
        changes: [],
        errors: ['Not a valid Wizard level 1 spell'],
      },
      {
        // Duplicate cantrips can only enter via saved data — the UI's
        // updateCantrip auto-clears duplicates made through the selects.
        title: 'both cantrips are the same saved value',
        instances: [{ class: 'Wizard', cantrips: ['Acid Splash', 'Acid Splash'], level1Spell: 'Burning Hands' }],
        changes: [],
        errors: ['Must be different from Cantrip 1'],
      },
      {
        // Guidance is the only Cleric cantrip in mock data, so cantrip 2
        // can never be filled without triggering duplicate prevention.
        title: 'class cannot supply a second cantrip',
        instances: null,
        changes: [['Class:', 'Cleric'], ['Cantrip 1:', 'Guidance'], ['Level 1 Spell:', 'Bless']],
        errors: ['Cantrip 2 is required'],
      },
    ];

    it.each(blockedCases)('blocks Save Instance with exact errors when $title', ({ instances, changes, errors }) => {
      const props = createProps({
        formData: { magicInitiateInstances: instances || [], spells: [] },
      });
      render(<MagicInitiateModal {...props} />);

      if (instances) {
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      } else {
        fireEvent.click(screen.getByText('Add Another Instance'));
      }
      changes.forEach(([label, value]) =>
        fireEvent.change(selectFor(label), { target: { value } })
      );

      fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));

      expect(errorTexts()).toEqual(errors);
      // Save blocked: still in editor, no summary re-render, zero writes.
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.queryByText(/^Instance \d+: /)).not.toBeInTheDocument();
      expect(props.onArrayFieldChange).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  it('opens the gate and shows the saved instance in the summary when all fields are valid', () => {
    const props = createProps();
    render(<MagicInitiateModal {...props} />);

    fireEvent.click(screen.getByText('Add Another Instance'));
    fireEvent.change(selectFor('Class:'), { target: { value: 'Wizard' } });
    fireEvent.change(selectFor('Cantrip 1:'), { target: { value: 'Acid Splash' } });
    fireEvent.change(selectFor('Cantrip 2:'), { target: { value: 'Chill Touch' } });
    fireEvent.change(selectFor('Level 1 Spell:'), { target: { value: 'Burning Hands' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));

    // Gate passed: editor closes and the instance appears in the summary.
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByText('Instance 1: Wizard')).toBeInTheDocument();
    expect(errorTexts()).toEqual([]);
    // Save Instance only gates; persisting is Save All's job (save lane).
    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
  });

  it('clears all errors as soon as any editor field changes', () => {
    const props = createProps({
      formData: {
        magicInitiateInstances: [{ class: 'Wizard', cantrips: [null, null], level1Spell: null }],
        spells: [],
      },
    });
    render(<MagicInitiateModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));
    expect(errorTexts()).toEqual([
      'Cantrip 1 is required',
      'Cantrip 2 is required',
      'Level 1 spell is required',
    ]);

    fireEvent.change(selectFor('Class:'), { target: { value: 'Cleric' } });

    expect(errorTexts()).toEqual([]);
  });

  it.each([
    { entry: 'Edit', instances: [{ class: 'Wizard', cantrips: [null, null], level1Spell: null }] },
    { entry: 'Add Another Instance', instances: [] },
  ])('clears stale errors when re-entering the editor via $entry', ({ entry, instances }) => {
    const props = createProps({
      formData: { magicInitiateInstances: instances, spells: [] },
    });
    render(<MagicInitiateModal {...props} />);

    const openEditor = () =>
      entry === 'Edit'
        ? fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        : fireEvent.click(screen.getByText('Add Another Instance'));

    openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));
    expect(errorTexts().length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    openEditor();

    expect(errorTexts()).toEqual([]);
  });
});
