// @maintained-by-ai 2026-11-28
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({
  renderMarkdown: vi.fn((md) => `<p>${md}</p>`),
}));

const selectFor = (labelText) =>
  screen.getByText(labelText).closest('.mi-selector').querySelector('select');

describe('MagicInitiateModal - Save All lane', () => {
  // Save Instance-only gates are owned by -validation; this file owns what
  // Save All persists: exact payload assembly, write order, close, and the
  // all-or-nothing zero-write gate.

  // One sequence test pins the full ordered mock.calls array byte-exact,
  // subsuming per-call nth assertions and the call-count assertion. A single
  // fixture exercises every branch of payload assembly at once: pre-existing
  // 'Magic Missile' proves existing spells are preserved and prepended; the
  // cross-instance duplicate 'Acid Splash' (picked in both instances) proves
  // deduplication; two instances prove accumulation and instance payload shape.
  it('persists byte-exact spells then instances, then closes, on Save All', () => {
    const props = createProps({
      formData: { magicInitiateInstances: [], spells: ['Magic Missile'] },
    });
    render(<MagicInitiateModal {...props} />);

    const entries = [
      { class: 'Wizard', cantrip1: 'Acid Splash', cantrip2: 'Chill Touch', level1Spell: 'Burning Hands' },
      { class: 'Sorcerer', cantrip1: 'Dancing Lights', cantrip2: 'Acid Splash', level1Spell: 'Shield' },
    ];
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
      [
        'spells',
        [
          'Magic Missile',
          'Acid Splash',
          'Chill Touch',
          'Burning Hands',
          'Dancing Lights',
          'Shield',
        ],
      ],
      [
        'magicInitiateInstances',
        [
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
      ],
    ]);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('writes nothing and never closes when Save All hits an invalid saved instance', () => {
    // Mixed fixture (one valid + one invalid SAVED instance): saveAll's
    // validateInstance loop must block every write, not just the invalid
    // instance's — a lenient permissive-skip mutant would leak the valid
    // instance's spells here. Error copy is owned by -validation (#368).
    const props = createProps({
      formData: {
        magicInitiateInstances: [
          { class: 'Wizard', cantrips: ['Acid Splash', 'Chill Touch'], level1Spell: 'Burning Hands' },
          { class: 'Wizard', cantrips: [null, null], level1Spell: null },
        ],
        spells: [],
      },
    });
    render(<MagicInitiateModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Save All/ }));

    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
