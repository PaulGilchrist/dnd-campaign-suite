// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({
  renderMarkdown: vi.fn((md) => `<p>${md}</p>`),
}));

const selectFor = (labelText) =>
  screen.getByText(labelText).closest('.mi-selector').querySelector('select');

describe('MagicInitiateModal - Save All lane', () => {
  // Save Instance only gates (owned by -validation); this file owns what
  // Save All persists: exact payload assembly, call order, onClose, and the
  // zero-write gate.

  it('persists byte-exact spells and instances, then closes, on Save All with one Wizard instance', () => {
    const props = createProps();
    render(<MagicInitiateModal {...props} />);

    fireEvent.click(screen.getByText('Add Another Instance'));
    fireEvent.change(selectFor('Class:'), { target: { value: 'Wizard' } });
    fireEvent.change(selectFor('Cantrip 1:'), { target: { value: 'Acid Splash' } });
    fireEvent.change(selectFor('Cantrip 2:'), { target: { value: 'Chill Touch' } });
    fireEvent.change(selectFor('Level 1 Spell:'), { target: { value: 'Burning Hands' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));
    fireEvent.click(screen.getByRole('button', { name: /Save All/ }));

    // Payload order is pinned: spells first, instances second, then close.
    expect(props.onArrayFieldChange).toHaveBeenNthCalledWith(1, 'spells', [
      'Acid Splash',
      'Chill Touch',
      'Burning Hands',
    ]);
    expect(props.onArrayFieldChange).toHaveBeenNthCalledWith(2, 'magicInitiateInstances', [
      {
        class: 'Wizard',
        cantrips: ['Acid Splash', 'Chill Touch'],
        level1Spell: 'Burning Hands',
      },
    ]);
    expect(props.onArrayFieldChange).toHaveBeenCalledTimes(2);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('merges existing spells ahead of cross-instance duplicates when saving two instances', () => {
    const props = createProps({
      // Pre-existing spell list proves formData.spells is preserved,
      // prepended, and deduplicated against the instances' spells
      // (Acid Splash is picked in both instances).
      formData: { magicInitiateInstances: [], spells: ['Magic Missile'] },
    });
    render(<MagicInitiateModal {...props} />);

    // Instance 1: Wizard
    fireEvent.click(screen.getByText('Add Another Instance'));
    fireEvent.change(selectFor('Class:'), { target: { value: 'Wizard' } });
    fireEvent.change(selectFor('Cantrip 1:'), { target: { value: 'Acid Splash' } });
    fireEvent.change(selectFor('Cantrip 2:'), { target: { value: 'Chill Touch' } });
    fireEvent.change(selectFor('Level 1 Spell:'), { target: { value: 'Burning Hands' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));

    // Instance 2: Sorcerer, overlapping cantrip Acid Splash
    fireEvent.click(screen.getByText('Add Another Instance'));
    fireEvent.change(selectFor('Class:'), { target: { value: 'Sorcerer' } });
    fireEvent.change(selectFor('Cantrip 1:'), { target: { value: 'Dancing Lights' } });
    fireEvent.change(selectFor('Cantrip 2:'), { target: { value: 'Acid Splash' } });
    fireEvent.change(selectFor('Level 1 Spell:'), { target: { value: 'Shield' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));

    fireEvent.click(screen.getByRole('button', { name: /Save All/ }));

    expect(props.onArrayFieldChange).toHaveBeenNthCalledWith(1, 'spells', [
      'Magic Missile',
      'Acid Splash',
      'Chill Touch',
      'Burning Hands',
      'Dancing Lights',
      'Shield',
    ]);
    expect(props.onArrayFieldChange).toHaveBeenNthCalledWith(2, 'magicInitiateInstances', [
      {
        class: 'Wizard',
        cantrips: ['Acid Splash', 'Chill Touch'],
        level1Spell: 'Burning Hands',
      },
      {
        class: 'Sorcerer',
        cantrips: ['Dancing Lights', 'Acid Splash'],
        level1Spell: 'Shield',
      },
    ]);
    expect(props.onArrayFieldChange).toHaveBeenCalledTimes(2);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('writes nothing and never closes when Save All hits an invalid saved instance', () => {
    // Saved (not edited) invalid instance: saveAll's validateInstance loop
    // must block every write. Error copy is owned by -validation (#368).
    const props = createProps({
      formData: {
        magicInitiateInstances: [{ class: 'Wizard', cantrips: [null, null], level1Spell: null }],
        spells: [],
      },
    });
    render(<MagicInitiateModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Save All/ }));

    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
