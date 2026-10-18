// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MagicInitiateModal, createProps } from './MagicInitiateModal.test-utils.js';

// Lane: SpellDetails slice only — detail rendering/toggling inside the editor.
// Main save/select routing lives in MagicInitiateModal.test.*.test.jsx siblings.

const selectFor = (labelText) => screen.getByText(`${labelText}:`).nextElementSibling;

const metaPinned = () =>
  [...document.querySelectorAll('.mi-spell-meta span')].map(s => s.textContent);

// Fresh render + fresh mocks per test via createProps factory.
const openEditor = (className) => {
  render(<MagicInitiateModal {...createProps()} />);
  fireEvent.click(screen.getByRole('button', { name: /Add Another Instance/ }));
  fireEvent.change(selectFor('Class'), { target: { value: className } });
};

describe('MagicInitiateModal - SpellDetails', () => {
  it('renders no details toggle until a spell is selected', () => {
    openEditor('Wizard');
    expect(screen.queryAllByRole('button', { name: /details/ })).toHaveLength(0);

    fireEvent.change(selectFor('Level 1 Spell'), { target: { value: 'Burning Hands' } });
    expect(screen.getByRole('button', { name: 'Burning Hands details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chill Touch details' })).not.toBeInTheDocument();
  });

  // Exact full meta-line pins per spell (SpellDetails.jsx renders each field
  // conditionally; the pinned list proves inclusion, exclusion, and order).
  it.each([
    ['Wizard', 'Level 1 Spell', 'Burning Hands', [
      'School: Evocation', 'Casting: 1 action', 'Duration: Instantaneous',
      'Components: V, S', 'Damage: Fire',
    ]],
    ['Cleric', 'Level 1 Spell', 'Bless', [
      'School: Enchantment', 'Casting: 1 action', 'Concentration',
      'Duration: Concentration, up to 1 minute', 'Components: V, S, M',
    ]],
    ['Wizard', 'Level 1 Spell', 'Alarm', [
      'School: Abjuration', 'Casting: 1 action', 'Ritual', 'Duration: 8 hours',
      'Components: V, S, M', 'Material: a small bell and 2 pins',
    ]],
    ['Cleric', 'Level 1 Spell', 'Command', [
      'School: Enchantment', 'Casting: 1 action', 'Duration: 1 round',
    ]],
    ['Wizard', 'Cantrip 1', 'Acid Splash', [
      'School: Conjuration', 'Casting: 1 action', 'Duration: Instantaneous',
      'Components: V, S', 'Damage: Acid',
    ]],
  ])('shows exact meta for %s %s (%s)', (className, slot, spell, expected) => {
    openEditor(className);
    fireEvent.change(selectFor(slot), { target: { value: spell } });
    fireEvent.click(screen.getByRole('button', { name: `${spell} details` }));
    expect(metaPinned()).toEqual(expected);
  });

  it('renders the spell description as markdown, not raw text', () => {
    openEditor('Wizard');
    fireEvent.change(selectFor('Level 1 Spell'), { target: { value: 'Burning Hands' } });
    fireEvent.click(screen.getByRole('button', { name: 'Burning Hands details' }));

    const desc = document.querySelector('.mi-spell-desc');
    expect(desc).toBeInTheDocument();
    expect(desc.textContent).toBe('Burst of flame.\n');
    // marked wraps output in <p> — absent if the description were inserted raw
    expect(desc.querySelector('p')).not.toBeNull();
  });

  it('expands one panel at a time and flips the caret', () => {
    openEditor('Wizard');
    fireEvent.change(selectFor('Cantrip 1'), { target: { value: 'Acid Splash' } });
    fireEvent.change(selectFor('Cantrip 2'), { target: { value: 'Chill Touch' } });

    const acidToggle = screen.getByRole('button', { name: 'Acid Splash details' });
    expect(acidToggle.querySelector('.fa-caret-right')).toBeInTheDocument();
    expect(screen.queryByText('School: Conjuration')).not.toBeInTheDocument();

    // Expand Acid Splash — content appears, other panel stays collapsed
    fireEvent.click(acidToggle);
    expect(acidToggle.querySelector('.fa-caret-down')).toBeInTheDocument();
    expect(screen.getByText('School: Conjuration')).toBeInTheDocument();
    expect(screen.queryByText('School: Necromancy')).not.toBeInTheDocument();

    // Expanding Chill Touch collapses Acid Splash
    const chillToggle = screen.getByRole('button', { name: 'Chill Touch details' });
    fireEvent.click(chillToggle);
    expect(screen.getByText('School: Necromancy')).toBeInTheDocument();
    expect(screen.queryByText('School: Conjuration')).not.toBeInTheDocument();

    // Collapsing again hides everything
    fireEvent.click(chillToggle);
    expect(screen.queryByText('School: Necromancy')).not.toBeInTheDocument();
  });
});
