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

  // One sequence test for every happy-path input shape (fix#252 merge-to-
  // sequence idiom): the full ordered mock.calls array is pinned byte-exact,
  // which subsumes per-call nth assertions and the call-count assertion.
  // Pre-existing formData.spells proves it is preserved, prepended, and
  // deduplicated against the instances' spells (empty in scenario 1,
  // 'Magic Missile' prepended ahead of cross-instance duplicate
  // Acid Splash — picked in both instances of scenario 2).
  it.each([
    {
      title: 'one new Wizard instance onto an empty spell list',
      existingSpells: [],
      entries: [
        { class: 'Wizard', cantrip1: 'Acid Splash', cantrip2: 'Chill Touch', level1Spell: 'Burning Hands' },
      ],
      expectedSpells: ['Acid Splash', 'Chill Touch', 'Burning Hands'],
      expectedInstances: [
        {
          class: 'Wizard',
          cantrips: ['Acid Splash', 'Chill Touch'],
          level1Spell: 'Burning Hands',
        },
      ],
    },
    {
      title: 'two instances, existing spells merged ahead of cross-instance duplicates',
      existingSpells: ['Magic Missile'],
      entries: [
        { class: 'Wizard', cantrip1: 'Acid Splash', cantrip2: 'Chill Touch', level1Spell: 'Burning Hands' },
        { class: 'Sorcerer', cantrip1: 'Dancing Lights', cantrip2: 'Acid Splash', level1Spell: 'Shield' },
      ],
      expectedSpells: [
        'Magic Missile',
        'Acid Splash',
        'Chill Touch',
        'Burning Hands',
        'Dancing Lights',
        'Shield',
      ],
      expectedInstances: [
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
      ],
    },
  ])(
    'persists byte-exact spells then instances, then closes, on Save All with $title',
    ({ existingSpells, entries, expectedSpells, expectedInstances }) => {
      const props = createProps({
        formData: { magicInitiateInstances: [], spells: existingSpells },
      });
      render(<MagicInitiateModal {...props} />);

      entries.forEach((entry) => {
        fireEvent.click(screen.getByText('Add Another Instance'));
        fireEvent.change(selectFor('Class:'), { target: { value: entry.class } });
        fireEvent.change(selectFor('Cantrip 1:'), { target: { value: entry.cantrip1 } });
        fireEvent.change(selectFor('Cantrip 2:'), { target: { value: entry.cantrip2 } });
        fireEvent.change(selectFor('Level 1 Spell:'), { target: { value: entry.level1Spell } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Instance' }));
      });

      fireEvent.click(screen.getByRole('button', { name: /Save All/ }));

      // Payload order is pinned: spells first, instances second, then close.
      expect(props.onArrayFieldChange.mock.calls).toEqual([
        ['spells', expectedSpells],
        ['magicInitiateInstances', expectedInstances],
      ]);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    },
  );

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
