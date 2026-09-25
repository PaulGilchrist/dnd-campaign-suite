// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FeyTouchedModal, { ShadowTouchedModal } from './FeyTouchedModal.jsx';

const createDivinationEnchantmentSpell = (overrides = {}) => ({
  index: overrides.index || 'test-spell',
  name: overrides.name || 'Test Spell',
  school: overrides.school || 'Enchantment',
  level: overrides.level ?? 1,
  description: overrides.description || ['Test description.'],
  casting_time: overrides.casting_time || '1 action',
  ritual: overrides.ritual || false,
  concentration: overrides.concentration || false,
  duration: overrides.duration || '1 hour',
  components: overrides.components || ['V', 'S'],
  damage: overrides.damage || null,
  material: overrides.material || null,
});

const createIllusionNecromancySpell = (overrides = {}) =>
  createDivinationEnchantmentSpell({
    school: overrides.school || 'Illusion',
    index: overrides.index || 'test-spell',
    name: overrides.name || 'Test Spell',
    description: overrides.description || ['Test description.'],
    components: overrides.components || ['V', 'S'],
    damage: overrides.damage || null,
    material: overrides.material || null,
  });

const divinationEnchantmentSpells = [
  createDivinationEnchantmentSpell({
    index: 'animal-friendship',
    name: 'Animal Friendship',
    school: 'Enchantment',
    description: ['Convince a beast to be friendly.'],
    concentration: true,
    duration: '24 hours',
    components: ['V', 'S', 'M'],
    material: 'A morsel of food.',
  }),
  createDivinationEnchantmentSpell({
    index: 'comprehend-r',
    name: 'Comprehend Languages',
    school: 'Divination',
    description: ['Understand all spoken and written languages.'],
    ritual: true,
  }),
  createDivinationEnchantmentSpell({
    index: 'charm-person',
    name: 'Charm Person',
    school: 'Enchantment',
    description: ['Charm a humanoid.'],
  }),
];

const illusionNecromancySpells = [
  createIllusionNecromancySpell({
    index: 'disguise-self',
    name: 'Disguise Self',
    school: 'Illusion',
    description: ['Disguise your appearance.'],
  }),
  createIllusionNecromancySpell({
    index: 'blight',
    name: 'Blight',
    school: 'Necromancy',
    description: ['Deal 8d8 necrotic damage.'],
    damage: { damage_type: 'Necrotic' },
  }),
];

const modalConfigs = [
  {
    name: 'FeyTouchedModal',
    Component: FeyTouchedModal,
    spellField: 'feyTouchedSpell',
    spellName: 'Animal Friendship',
    allSpells: divinationEnchantmentSpells,
    header: 'Fey Magic',
    description: /Choose one level 1 spell from the Divination or Enchantment school/,
    saveField: 'spells',
    otherSpell: 'Charm Person',
    spellWithDetails: 'Animal Friendship',
    validationError: 'You must choose one level 1 Divination or Enchantment spell',
    schoolValidationError: 'Spell must be from Divination or Enchantment school',
    validSchools: ['Divination', 'Enchantment'],
  },
  {
    name: 'ShadowTouchedModal',
    Component: ShadowTouchedModal,
    spellField: 'shadowTouchedSpell',
    spellName: 'Disguise Self',
    allSpells: illusionNecromancySpells,
    header: 'Shadow Magic',
    description: /Choose one level 1 spell from the Illusion or Necromancy school/,
    saveField: 'spells',
    otherSpell: 'Blight',
    spellWithDetails: 'Disguise Self',
    validationError: 'You must choose one level 1 Illusion or Necromancy spell',
    schoolValidationError: 'Spell must be from Illusion or Necromancy school',
    validSchools: ['Illusion', 'Necromancy'],
  },
];

function createProps(config, overrides = {}) {
  const spellField = config.spellField;
  const baseFormData = {
    [spellField]: null,
    spells: [],
    ...overrides.formData,
  };
  return {
    formData: baseFormData,
    allSpells: overrides.allSpells ?? config.allSpells,
    onArrayFieldChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe.each(modalConfigs)('$name', (config) => {
  const {
    Component,
    spellField,
    spellName,
    allSpells,
    header,
    description,
    saveField,
    otherSpell,
    spellWithDetails,
    validationError,
    schoolValidationError,
    validSchools,
  } = config;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the modal overlay and header', () => {
      render(<Component {...createProps(config)} />);
      expect(screen.getByText(header)).toBeInTheDocument();
    });

    it('should render the description text', () => {
      render(<Component {...createProps(config)} />);
      expect(screen.getByText(description)).toBeInTheDocument();
    });

    it('should render a label for the spell selector', () => {
      render(<Component {...createProps(config)} />);
      expect(screen.getByText('Level 1 Spell:')).toBeInTheDocument();
    });

    it('should render the select dropdown with a default empty option', () => {
      render(<Component {...createProps(config)} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      const defaultOption = select.querySelector('option[value=""]');
      expect(defaultOption).toBeInTheDocument();
      expect(defaultOption.textContent).toBe('Select a spell...');
    });

    it('should render available spells from the correct schools', () => {
      render(<Component {...createProps(config)} />);
      for (const spell of allSpells) {
        expect(screen.getByText(`${spell.name} (${spell.school})`)).toBeInTheDocument();
      }
    });

    it('should filter out spells from non-matching schools', () => {
      const wrongSchoolSpell = createDivinationEnchantmentSpell({
        name: 'Fire Bolt',
        school: 'Evocation',
      });
      render(
        <Component {...createProps(config, { allSpells: [...allSpells, wrongSchoolSpell] })} />
      );
      expect(screen.getByText(`${allSpells[0].name} (${allSpells[0].school})`)).toBeInTheDocument();
      expect(screen.queryByText('Fire Bolt (Evocation)')).not.toBeInTheDocument();
    });

    it('should render the Save button', () => {
      render(<Component {...createProps(config)} />);
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('should render an empty select when allSpells is null', () => {
      render(<Component {...createProps(config, { allSpells: null })} />);
      expect(screen.getByText(header)).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      expect(select.options.length).toBe(1);
    });

    it('should not render spells that are not level 1', () => {
      const level2Spell = createDivinationEnchantmentSpell({ name: 'Hold Person', level: 2 });
      render(
        <Component {...createProps(config, { allSpells: [...allSpells, level2Spell] })} />
      );
      expect(screen.queryByText('Hold Person (Enchantment)')).not.toBeInTheDocument();
    });
  });

  describe('initial state with existing spell', () => {
    it('should pre-select an existing spell from formData', () => {
      render(
        <Component {...createProps(config, {
          formData: { [spellField]: spellName, spells: [spellName] },
        })} />
      );
      const select = screen.getByRole('combobox');
      expect(select.value).toBe(spellName);
    });

    it('should not pre-select when the spell field is null in formData', () => {
      render(
        <Component {...createProps(config, { formData: { [spellField]: null } })} />
      );
      const select = screen.getByRole('combobox');
      expect(select.value).toBe('');
    });

    it('should not show spell details when pre-selected spell is not in allSpells', () => {
      render(
        <Component {...createProps(config, {
          formData: { [spellField]: 'Nonexistent Spell', spells: [] },
          allSpells,
        })} />
      );
      const select = screen.getByRole('combobox');
      expect(select.value).toBe('');
      expect(screen.queryByText(/details/)).not.toBeInTheDocument();
    });
  });

  describe('spell selection', () => {
    it('should update selected spell when user selects from dropdown', () => {
      render(<Component {...createProps(config)} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: otherSpell } });
      expect(screen.getByText(`${otherSpell} details`)).toBeInTheDocument();
    });

    it('should clear selection when user selects the empty option', () => {
      render(
        <Component {...createProps(config, {
          formData: { [spellField]: spellName, spells: [] },
        })} />
      );
      const select = screen.getByRole('combobox');
      expect(select.value).toBe(spellName);
      fireEvent.change(select, { target: { value: '' } });
      expect(select.value).toBe('');
    });

    it('should clear error when user changes selection after an error', () => {
      render(<Component {...createProps(config)} />);
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(screen.getByText(/You must choose/)).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: spellWithDetails } });
      expect(screen.queryByText(/You must choose/)).not.toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('should show error when saving without selecting a spell', () => {
      render(<Component {...createProps(config)} />);
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(screen.getByText(validationError)).toBeInTheDocument();
    });

    it('should not show error when a valid spell is selected', () => {
      render(<Component {...createProps(config)} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: spellName } });
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(screen.queryByText(validationError)).not.toBeInTheDocument();
    });

    it('should show school validation error for wrong school', () => {
      const wrongSchoolSpell = createDivinationEnchantmentSpell({
        name: 'Wrong School Spell',
        school: 'Evocation',
      });
      render(
        <Component {...createProps(config, {
          formData: { [spellField]: 'Wrong School Spell', spells: [] },
          allSpells: [wrongSchoolSpell],
        })} />
      );
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(screen.getByText(schoolValidationError)).toBeInTheDocument();
    });

    it('should not show school error for valid school names with different casing', () => {
      const spell = createDivinationEnchantmentSpell({
        name: 'Lowercase School',
        school: validSchools[0].toLowerCase(),
      });
      render(
        <Component {...createProps(config, {
          formData: { [spellField]: 'Lowercase School', spells: [] },
          allSpells: [spell],
        })} />
      );
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(screen.queryByText(schoolValidationError)).not.toBeInTheDocument();
    });
  });

  describe('save behavior', () => {
    it('should call onArrayFieldChange for spells with the selected spell added', () => {
      const props = createProps(config);
      render(<Component {...props} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: spellName } });
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(props.onArrayFieldChange).toHaveBeenCalledWith(saveField, [spellName]);
    });

    it('should call onArrayFieldChange for the spell field', () => {
      const props = createProps(config);
      render(<Component {...props} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: otherSpell } });
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(props.onArrayFieldChange).toHaveBeenCalledWith(spellField, otherSpell);
    });

    it('should call onClose after saving', () => {
      const props = createProps(config);
      render(<Component {...props} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: spellName } });
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when validation fails', () => {
      const props = createProps(config);
      render(<Component {...props} />);
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('should deduplicate when adding to existing spells array', () => {
      const props = createProps(config, {
        formData: { spells: [spellName] },
      });
      render(<Component {...props} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: spellName } });
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(props.onArrayFieldChange).toHaveBeenCalledWith(saveField, [spellName]);
    });

    it('should append to existing spells array when spell is new', () => {
      const props = createProps(config, {
        formData: { spells: [spellName] },
      });
      render(<Component {...props} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: otherSpell } });
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(props.onArrayFieldChange).toHaveBeenCalledWith(saveField, [spellName, otherSpell]);
    });

    it('should call onArrayFieldChange in order: spells first, then the spell field', () => {
      const props = createProps(config);
      render(<Component {...props} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: spellName } });
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(props.onArrayFieldChange).toHaveBeenNthCalledWith(1, saveField, [spellName]);
      expect(props.onArrayFieldChange).toHaveBeenNthCalledWith(2, spellField, spellName);
    });
  });

  describe('overlay interaction', () => {
    it('should not call onClose when clicking the overlay (outside the modal)', () => {
      const props = createProps(config);
      render(<Component {...props} />);
      const overlay = document.querySelector('.mi-overlay');
      fireEvent.click(overlay);
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByText(header)).toBeInTheDocument();
    });

    it('should not call onClose when clicking inside the modal', () => {
      const props = createProps(config);
      render(<Component {...props} />);
      const modal = document.querySelector('.mi-modal');
      fireEvent.click(modal);
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when clicking the header close button', () => {
      const props = createProps(config);
      render(<Component {...props} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
