// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

// Lane: CREATURES-selection UI — how the `creatures` prop composes the
// effects-tab "Source (who caused this)" dropdown (exact census BY NAME).
// NOT owned here: tab/overlay machinery (rendering.test.jsx), config field
// defaults + onApply payload flow incl. source byte mapping and custom
// "Other…" input (effects-config.test.jsx), conditions dispatch (#856),
// concentration dispatch (#855), handler write-side landing (#839).
// Old -> new: sort + filter-nullish + dedupe + special-chars censuses ->
// single exact-option census (#1); empty/undefined/null honesty kept (#2);
// whitespace-name truthiness characterization removed (impl detail of
// `.filter(Boolean)`, not authored game data).

const openGoadSourceConfig = () => {
  // 'Goad' declares fields: ['source'] — the only combobox in the config view.
  fireEvent.click(screen.getByRole('button', { name: 'Goad' }));
};

const sourceOptionValues = () =>
  Array.from(screen.getByRole('combobox').options).map(o => o.value);

describe('EffectAdder - creatures populate the source dropdown', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'effects',
      onCancel: vi.fn(),
      onApply: vi.fn(),
    };
  });

  it('lists unique creature names alphabetically, dropping nameless entries, with default preselection', () => {
    render(
      <EffectAdder
        {...props}
        creatures={[
          { name: 'Zombie' },
          { name: 'Bob' },
          { name: 'Alice' },
          { name: 'Alice' }, // duplicate collapses to one option
          { name: null }, // nameless entries are dropped
          { name: undefined },
          { name: '' },
          { name: "Dreadnought's Bane" }, // special characters pass through
          { name: 'Elf-Prince' },
        ]}
      />
    );
    openGoadSourceConfig();

    const select = screen.getByRole('combobox');
    expect(sourceOptionValues()).toEqual([
      '',
      'Alice',
      'Bob',
      "Dreadnought's Bane",
      'Elf-Prince',
      'Zombie',
      '__other__',
    ]);
    // Option labels show the creature name byte-for-byte.
    expect(Array.from(select.options).map(o => o.textContent)).toEqual([
      'Select source…',
      'Alice',
      'Bob',
      "Dreadnought's Bane",
      'Elf-Prince',
      'Zombie',
      'Other…',
    ]);
    // No authored default source for Goad — nothing preselected.
    expect(select).toHaveValue('');
  });

  it.each`
    creatures
    ${[]}
    ${undefined}
    ${null}
  `('offers only placeholder options when creatures is $creatures', ({ creatures }) => {
    render(<EffectAdder {...props} creatures={creatures} />);
    openGoadSourceConfig();
    expect(document.querySelector('.ea-modal')).toBeInTheDocument();
    expect(sourceOptionValues()).toEqual(['', '__other__']);
  });
});
