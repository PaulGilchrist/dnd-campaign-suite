// @maintained-by-ai
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepMagicItems from './WizardStepMagicItems.jsx';

// Item fixtures: verbatim values from public/data/magic-items.json, trimmed to
// the fields this step reads. Ring of Protection / Boots of Speed / Ring of
// Spell Storing / Wand of Magic Missiles descriptions truncated at paragraph
// boundaries (only Amulet of Health's is rendered in full by an expand test).
const AMULET_OF_HEALTH = {
  index: 'amulet_of_health',
  name: 'Amulet of Health',
  type: 'Amulet',
  rarity: 'rare',
  requiresAttunement: true,
  description:
    '<p>Wondrous item, Rare (requires attunement), 1 lb.</p><p>Your Constitution score is 19 while you wear this amulet. It has no effect on you if your Constitution is already 19 or higher without it.</p>',
};
const BAG_OF_HOLDING = {
  index: 'bag_of_holding',
  name: 'Bag of Holding',
  type: 'Wondrous Item',
  rarity: 'uncommon',
  requiresAttunement: false,
  description:
    '<p>Wondrous item, Uncommon</p><p>This bag has an interior space considerably larger than its outside dimensions.</p>',
};
const BOOTS_OF_SPEED = {
  index: 'boots_of_speed',
  name: 'Boots of Speed',
  type: 'Wondrous Item',
  rarity: 'rare',
  requiresAttunement: true,
  description:
    "<p>Wondrous item, rare (requires attunement)</p><p>While you wear these boots, you can take a Bonus Action to click the boots' heels together.</p>",
};
const CLOAK_OF_PROTECTION = {
  index: 'cloak_of_protection',
  name: 'Cloak of Protection',
  type: 'Wondrous Item',
  rarity: 'uncommon',
  requiresAttunement: true,
  description:
    '<p>Wondrous item, uncommon (requires attunement)</p><p>You gain a +1 bonus to Armor Class and saving throws while you wear this cloak.</p>',
};
const RING_OF_SPELL_STORING = {
  index: 'ring_of_spell_storing',
  name: 'Ring of Spell Storing',
  type: 'Ring',
  rarity: 'rare',
  requiresAttunement: true,
  description:
    'This ring stores spells cast into it, holding them until the attuned wearer uses them.',
};
const RING_OF_PROTECTION = {
  index: 'ring_of_protection',
  name: 'Ring of Protection',
  type: 'Ring',
  rarity: 'rare',
  requiresAttunement: true,
  description:
    'You gain a +1 bonus to Armor Class and saving throws while wearing this ring.',
};
const WAND_OF_MAGIC_MISSILES = {
  index: 'wand_of_magic_missiles',
  name: 'Wand of Magic Missiles',
  type: 'Wand',
  rarity: 'uncommon',
  requiresAttunement: false,
  description:
    "This wand has 7 charges. While holding it, you can expend no more than 3 charges to cast Magic Missile from it.",
};

// Every attuned fixture on disk that the base-limit tests need.
const FOUR_ATTUNED = [AMULET_OF_HEALTH, BOOTS_OF_SPEED, CLOAK_OF_PROTECTION, RING_OF_SPELL_STORING];
const FIVE_ATTUNED = [...FOUR_ATTUNED, RING_OF_PROTECTION];
const ALL_FIXTURE_ITEMS = [...FIVE_ATTUNED, BAG_OF_HOLDING, WAND_OF_MAGIC_MISSILES];
const names = (items) => items.map((i) => i.name);
const indexes = (items) => items.map((i) => i.index);

// classSubtypes shape produced by useWizardData.js:
// 5e   → subtypes: cls.subclasses (Use Magic Device nested under class_levels[])
// 2024 → subtypes: cls.subclasses || cls.majors (features[] flat) — CLA-374.
// Feature entries verbatim from public/data/classes.json + public/data/2024/classes.json.
const thief5e = {
  name: 'Thief',
  class_levels: [
    {
      level: 13,
      features: [
        {
          name: 'Use Magic Device',
          level: 13,
          prerequisites: [],
          description:
            'You have learned enough about the workings of magic that you can improvise the use of items even when they are not intended for you.',
          automation: { type: 'use_magic_device', attunementLimit: 4 },
        },
      ],
    },
  ],
};
const thief2024 = {
  name: 'Thief',
  subtitle: 'Hunt for Treasure as a Classic Adventurer',
  features: [
    {
      name: 'Use Magic Device',
      level: 13,
      description:
        'Attunement: attune to up to 4 magic items at once.',
      automation: { type: 'use_magic_device', attunementLimit: 4 },
    },
  ],
};
const assassin5e = {
  name: 'Assassin',
  class_levels: [
    {
      level: 3,
      features: [
        {
          name: 'Assassinate',
          level: 3,
          prerequisites: [],
          description:
            "You are at your deadliest when you get the drop on your enemies.",
        },
      ],
    },
  ],
};
const rogueSubtypes = (subclass) => [{ className: 'Rogue', subtypes: [subclass] }];

// Fresh props per test (#362).
const magicItemsProps = ({
  selected = [],
  allItems = [BAG_OF_HOLDING, AMULET_OF_HEALTH],
  classData,
  classSubtypes,
  level,
} = {}) => ({
  stepNumber: 15,
  formData: {
    ...(classData ? { class: classData } : {}),
    ...(level ? { level } : {}),
    inventory: { magicItems: selected },
  },
  allMagicItems: allItems,
  ruleset: '5e',
  classSubtypes,
  onArrayFieldChange: vi.fn(),
});

describe('WizardStepMagicItems', () => {
  describe('attunement limit and warnings', () => {
    // Source: WizardStepMagicItems.jsx:65 `attunementItems.length > maxAttunement`.
    // The 'at the limit' row fails if > becomes >= (mutation-checked 2026-10-18).
    it.each([
      [
        'warns with exact count text when 4 attuned exceed the base limit of 3',
        names(FOUR_ATTUNED),
        FOUR_ATTUNED,
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.',
      ],
      ['stays silent at exactly the limit of 3', names(FOUR_ATTUNED.slice(0, 3)), FOUR_ATTUNED, null],
      [
        'counts only attuned items (3 attuned + 1 non-attuned is silent)',
        [...names(FOUR_ATTUNED.slice(0, 3)), 'Bag of Holding'],
        [...FOUR_ATTUNED, BAG_OF_HOLDING],
        null,
      ],
      ['stays silent when nothing is selected', [], ALL_FIXTURE_ITEMS, null],
    ])('base limit — %s', (_case, selected, allItems, warningText) => {
      render(<WizardStepMagicItems {...magicItemsProps({ selected, allItems })} />);
      if (warningText) {
        expect(screen.getByText(warningText)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/requiring attunement, but/)).not.toBeInTheDocument();
      }
    });

    // CLA-374: Use Magic Device (Thief lv13+) raises the cap 3 → 4. Distinct
    // branches: 5e nested class_levels gate, 2024 flat features gate,
    // class.subclass vs class.major naming, and each fall-through to base 3.
    it.each([
      [
        '5e nested class_levels raises cap to 4 (Thief lv13, 5 attuned)',
        { name: 'Rogue', subclass: { name: 'Thief' } },
        rogueSubtypes(thief5e),
        13,
        names(FIVE_ATTUNED),
        'You have selected 5 items requiring attunement, but a character can only attune to a maximum of 4 items.',
      ],
      [
        '5e nested below lv13 stays at 3',
        { name: 'Rogue', subclass: { name: 'Thief' } },
        rogueSubtypes(thief5e),
        12,
        names(FOUR_ATTUNED),
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.',
      ],
      [
        '2024 flat features under class.subclass raises cap (lv20, 4 attuned silent)',
        { name: 'Rogue', subclass: { name: 'Thief' } },
        rogueSubtypes(thief2024),
        20,
        names(FOUR_ATTUNED),
        null,
      ],
      [
        '2024 flat features under class.major naming raises cap (lv13, 4 attuned silent)',
        { name: 'Rogue', major: { name: 'Thief' } },
        rogueSubtypes(thief2024),
        13,
        names(FOUR_ATTUNED),
        null,
      ],
      [
        '2024 flat below lv13 stays at 3',
        { name: 'Rogue', subclass: { name: 'Thief' } },
        rogueSubtypes(thief2024),
        12,
        names(FOUR_ATTUNED),
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.',
      ],
      [
        'subclass without Use Magic Device stays at 3 (flat shape)',
        { name: 'Rogue', subclass: { name: 'Assassin' } },
        rogueSubtypes(assassin5e),
        20,
        names(FOUR_ATTUNED),
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.',
      ],
      [
        'class not present in classSubtypes stays at 3',
        { name: 'Wizard', subclass: { name: 'Thief' } },
        rogueSubtypes(thief5e),
        20,
        names(FOUR_ATTUNED),
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.',
      ],
      [
        'classSubtypes not yet loaded stays at 3',
        { name: 'Rogue', subclass: { name: 'Thief' } },
        undefined,
        20,
        names(FOUR_ATTUNED),
        'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.',
      ],
    ])(
      'Use Magic Device cap — %s',
      (_case, classData, classSubtypes, level, selected, warningText) => {
        render(
          <WizardStepMagicItems
            {...magicItemsProps({ selected, allItems: FIVE_ATTUNED, classData, level, classSubtypes })}
          />
        );
        if (warningText) {
          expect(screen.getByText(warningText)).toBeInTheDocument();
        } else {
          expect(screen.queryByText(/requiring attunement, but/)).not.toBeInTheDocument();
        }
      }
    );

    // Selections may store item indexes; the warning lookup matches
    // `i.name === itemName || i.index === itemName` (WizardStepMagicItems.jsx:61).
    it('counts selected items matched by index, not only by name', () => {
      render(
        <WizardStepMagicItems
          {...magicItemsProps({ selected: indexes(FOUR_ATTUNED), allItems: FOUR_ATTUNED })}
        />
      );
      expect(
        screen.getByText(
          'You have selected 4 items requiring attunement, but a character can only attune to a maximum of 3 items.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('step chrome', () => {
    it('renders the step title, search box, Item Type filter options, counts, and loading message', () => {
      const { unmount } = render(
        <WizardStepMagicItems
          {...magicItemsProps({
            selected: ['Bag of Holding'],
            allItems: ALL_FIXTURE_ITEMS,
          })}
        />
      );
      expect(screen.getByRole('heading', { name: 'Step 15: Magic Items' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search magic items...')).toBeInTheDocument();
      const typeSelect = screen.getByLabelText('Item Type');
      expect(Array.from(typeSelect.options).map((o) => o.value)).toEqual([
        'All',
        'Amulet',
        'Ring',
        'Wand',
        'Wondrous Item',
      ]);
      expect(screen.getByText(`Showing ${ALL_FIXTURE_ITEMS.length} magic items`)).toBeInTheDocument();
      expect(screen.getByText('1 selected)')).toBeInTheDocument();

      unmount();
      render(<WizardStepMagicItems {...magicItemsProps({ allItems: [] })} />);
      expect(screen.getByText('Magic item data not yet loaded. Please try again.')).toBeInTheDocument();
      expect(screen.queryByText('Amulet of Health')).not.toBeInTheDocument();
    });
  });

  describe('item row contract', () => {
    it('renders type/rarity/attunement badges, omits the badge for non-attuned items, and expands the description in place', () => {
      render(
        <WizardStepMagicItems
          {...magicItemsProps({ allItems: [AMULET_OF_HEALTH, BAG_OF_HOLDING] })}
        />
      );

      const amuletRow = screen.getByText('Amulet of Health').closest('.magic-item');
      expect(within(amuletRow).getByText('Amulet')).toBeInTheDocument();
      expect(within(amuletRow).getByText('rare')).toBeInTheDocument();
      expect(within(amuletRow).getByText('requires attunement')).toBeInTheDocument();

      const bagRow = screen.getByText('Bag of Holding').closest('.magic-item');
      expect(within(bagRow).getByText('Wondrous Item')).toBeInTheDocument();
      expect(within(bagRow).getByText('uncommon')).toBeInTheDocument();
      expect(within(bagRow).queryByText('requires attunement')).not.toBeInTheDocument();

      expect(document.querySelector('.magic-item-description')).not.toBeInTheDocument();
      fireEvent.click(within(amuletRow).getByRole('button', { name: 'Show More' }));
      expect(amuletRow.querySelector('.magic-item-description')).toHaveTextContent(
        'Your Constitution score is 19 while you wear this amulet.'
      );
      fireEvent.click(within(amuletRow).getByRole('button', { name: 'Show Less' }));
      expect(amuletRow.querySelector('.magic-item-description')).not.toBeInTheDocument();
    });
  });

  describe('selection', () => {
    // Exact onChange payload on the step's own fieldName. Checkbox identity via
    // row query, not bare checkboxes[i] (#289 lane).
    it.each([
      [
        'adds an unselected item to the end of the current selection',
        ['Bag of Holding'],
        'Amulet of Health',
        ['Bag of Holding', 'Amulet of Health'],
      ],
      [
        'removes a selected item, keeping the rest',
        ['Amulet of Health', 'Bag of Holding'],
        'Bag of Holding',
        ['Amulet of Health'],
      ],
    ])('checkbox toggle — %s', (_case, selected, clickedName, expectedPayload) => {
      const props = magicItemsProps({ selected, allItems: [AMULET_OF_HEALTH, BAG_OF_HOLDING] });
      render(<WizardStepMagicItems {...props} />);

      const checkbox = screen
        .getByText(clickedName)
        .closest('.magic-item')
        .querySelector('.list-item-checkbox-trigger');
      expect(checkbox.className).toContain(selected.includes(clickedName) ? 'checked' : 'list-item-checkbox');

      fireEvent.click(checkbox);
      expect(props.onArrayFieldChange).toHaveBeenCalledTimes(1);
      expect(props.onArrayFieldChange).toHaveBeenCalledWith('inventory.magicItems', expectedPayload);
    });
  });

  describe('custom magic items', () => {
    const STORMCALLER = {
      name: 'Stormcaller Blade',
      type: 'Weapon',
      rarity: 'rare',
      requiresAttunement: true,
      description: 'A sentient longsword that hums before a storm.',
      custom: true,
    };

    it('opens the custom item modal from the Add button and writes a full custom object on save', () => {
      const props = magicItemsProps();
      render(<WizardStepMagicItems {...props} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Custom Magic Item/ }));

      fireEvent.change(screen.getByLabelText(/Name \*/), { target: { value: 'Stormcaller Blade' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));

      expect(props.onArrayFieldChange).toHaveBeenCalledWith('inventory.magicItems', [
        {
          name: 'Stormcaller Blade',
          type: 'Wondrous Item',
          rarity: 'uncommon',
          requiresAttunement: false,
          description: '',
          custom: true,
        },
      ]);
      expect(screen.queryByLabelText(/Name \*/)).not.toBeInTheDocument();
    });

    it('refuses to save without a name and rejects names that collide with the catalog', () => {
      render(<WizardStepMagicItems {...magicItemsProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Custom Magic Item/ }));

      fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
      expect(screen.getByText('A name is required.')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Name \*/), { target: { value: 'bag of holding' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
      expect(
        screen.getByText(/"Bag of Holding" is an official magic item and already exists in the item catalog/)
      ).toBeInTheDocument();
    });

    it('rejects names that collide with another custom item using custom-specific copy', () => {
      const props = magicItemsProps({ selected: [STORMCALLER] });
      render(<WizardStepMagicItems {...props} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Custom Magic Item/ }));

      fireEvent.change(screen.getByLabelText(/Name \*/), { target: { value: 'stormcaller blade' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
      expect(
        screen.getByText('A custom item named "stormcaller blade" already exists.')
      ).toBeInTheDocument();
      expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    });

    it('renders a stored custom object as a selected row with badge and Edit, and unticking confirms before removing it', () => {
      const props = magicItemsProps({ selected: [STORMCALLER] });
      render(<WizardStepMagicItems {...props} />);

      const row = screen.getByText('Stormcaller Blade').closest('.magic-item');
      expect(row.className).toContain('selected');
      expect(within(row).getByText('custom')).toBeInTheDocument();
      expect(within(row).getByText('requires attunement')).toBeInTheDocument();

      // QA improve 2026-11-08 EL: untick arms the DeleteConfirmModal first.
      fireEvent.click(row.querySelector('.list-item-checkbox-trigger'));
      fireEvent.click(screen.getByRole('button', { name: 'Yes, Remove' }));
      expect(props.onArrayFieldChange).toHaveBeenCalledWith('inventory.magicItems', []);
    });

    // QA improve 2026-11-08: expectation-setting fieldnote + discoverable
    // untick-to-remove affordance (both lock the copy rendered adjacent to
    // the Add button and the title on every row checkbox).
    it('shows a fieldnote next to the Add button stating custom items live on this character only', () => {
      render(<WizardStepMagicItems {...magicItemsProps()} />);
      const summary = document.querySelector('.magic-item-custom-summary');
      const note = within(summary).getByText(
        /Custom items live on this character only — they are not added to a campaign-wide item registry\./
      );
      expect(note).toHaveClass('field-description');
      expect(note.textContent).toMatch(/Untick a selected row's checkbox to remove it\./);
      expect(within(summary).getByRole('button', { name: /Add Custom Magic Item/ })).toBeInTheDocument();
    });

    // QA improve 2026-11-08 EL split: both row kinds still advertise
    // "Un-tick to remove"; only catalog rows deselect instantly (custom rows
    // arm the confirm modal — covered in custom-untick-guard).
    it('selected catalog row carries an "Un-tick to remove" title and unticking deselects it instantly', () => {
      const props = magicItemsProps({ selected: ['Bag of Holding'], allItems: [AMULET_OF_HEALTH, BAG_OF_HOLDING] });
      render(<WizardStepMagicItems {...props} />);

      const checkbox = screen
        .getByText('Bag of Holding')
        .closest('.magic-item')
        .querySelector('.list-item-checkbox-trigger');
      expect(checkbox).toHaveAttribute('title', 'Un-tick to remove Bag of Holding');

      fireEvent.click(checkbox);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(props.onArrayFieldChange).toHaveBeenCalledWith('inventory.magicItems', []);
    });

    it('selected custom row advertises "Un-tick to remove" but arms the confirm modal instead of deselecting', () => {
      const props = magicItemsProps({ selected: [STORMCALLER], allItems: [AMULET_OF_HEALTH, BAG_OF_HOLDING] });
      render(<WizardStepMagicItems {...props} />);

      const checkbox = screen
        .getByText('Stormcaller Blade')
        .closest('.magic-item')
        .querySelector('.list-item-checkbox-trigger');
      expect(checkbox).toHaveAttribute('title', 'Un-tick to remove Stormcaller Blade');

      fireEvent.click(checkbox);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    });

    it('unselected rows advertise selection via the checkbox title', () => {
      render(
        <WizardStepMagicItems
          {...magicItemsProps({ selected: [], allItems: [AMULET_OF_HEALTH, BAG_OF_HOLDING] })}
        />
      );
      expect(
        screen.getByText('Bag of Holding').closest('.magic-item').querySelector('.list-item-checkbox-trigger')
      ).toHaveAttribute('title', 'Select Bag of Holding');
    });

    it('Edit reopens the modal prefilled and saving replaces the entry in place', () => {
      const props = magicItemsProps({ selected: ['Bag of Holding', STORMCALLER], allItems: [BAG_OF_HOLDING] });
      render(<WizardStepMagicItems {...props} />);

      const row = screen.getByText('Stormcaller Blade').closest('.magic-item');
      fireEvent.click(within(row).getByRole('button', { name: /Edit/ }));
      expect(screen.getByLabelText(/Name \*/)).toHaveValue('Stormcaller Blade');
      expect(screen.getByLabelText(/Description/)).toHaveValue(STORMCALLER.description);

      fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Revised text.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(props.onArrayFieldChange).toHaveBeenCalledWith('inventory.magicItems', [
        'Bag of Holding',
        { ...STORMCALLER, description: 'Revised text.' },
      ]);
    });

    it('counts custom attunement items toward the attunement-limit warning', () => {
      render(
        <WizardStepMagicItems
          {...magicItemsProps({
            selected: [...names(FOUR_ATTUNED.slice(0, 2)), STORMCALLER],
            allItems: FOUR_ATTUNED,
          })}
        />
      );
      // 3 attuned total — under the base limit of 3, silent.
      expect(screen.queryByText(/requiring attunement, but/)).not.toBeInTheDocument();

      render(
        <WizardStepMagicItems
          {...magicItemsProps({
            selected: [...names(FOUR_ATTUNED), STORMCALLER],
            allItems: FOUR_ATTUNED,
          })}
        />
      );
      expect(
        screen.getByText(
          'You have selected 5 items requiring attunement, but a character can only attune to a maximum of 3 items.'
        )
      ).toBeInTheDocument();
    });
  });
});
