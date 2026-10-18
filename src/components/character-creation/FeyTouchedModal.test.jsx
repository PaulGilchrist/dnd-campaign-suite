// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FeyTouchedModal, { ShadowTouchedModal } from './FeyTouchedModal.jsx';

const makeSpell = (name, school, overrides = {}) => ({
  index: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  school,
  level: 1,
  description: [`${name} description.`],
  casting_time: '1 action',
  ritual: false,
  concentration: false,
  duration: '1 hour',
  components: ['V', 'S'],
  ...overrides,
});

// Both modals must exclude these from their option lists: wrong school for
// either feat, and a level 2 spell that happens to be Fey-eligible school.
const outOfScopeSpells = [
  makeSpell('Fire Bolt', 'Evocation'),
  makeSpell('Hold Person', 'Enchantment', { level: 2 }),
];

const modalConfigs = [
  {
    name: 'FeyTouchedModal',
    Component: FeyTouchedModal,
    spellField: 'feyTouchedSpell',
    header: 'Fey Magic',
    description: /Choose one level 1 spell from the Divination or Enchantment school/,
    validationError: 'You must choose one level 1 Divination or Enchantment spell',
    schoolValidationError: 'Spell must be from Divination or Enchantment school',
    validSchool: 'Enchantment',
    spells: [
      makeSpell('Animal Friendship', 'Enchantment', { concentration: true, duration: '24 hours' }),
      makeSpell('Comprehend Languages', 'Divination', { ritual: true }),
      makeSpell('Charm Person', 'Enchantment'),
    ],
  },
  {
    name: 'ShadowTouchedModal',
    Component: ShadowTouchedModal,
    spellField: 'shadowTouchedSpell',
    header: 'Shadow Magic',
    description: /Choose one level 1 spell from the Illusion or Necromancy school/,
    validationError: 'You must choose one level 1 Illusion or Necromancy spell',
    schoolValidationError: 'Spell must be from Illusion or Necromancy school',
    validSchool: 'Illusion',
    spells: [
      makeSpell('Disguise Self', 'Illusion'),
      makeSpell('Blight', 'Necromancy', { damage: { damage_type: 'Necrotic' } }),
    ],
  },
];

// Fresh props (and fresh vi.fn mocks) per call — no shared-mock leakage.
// 'in' check (not ??) so an explicit allSpells={null} is honored, not defaulted.
const createProps = (config, options = {}) => ({
  formData: { [config.spellField]: null, spells: [], ...options.formData },
  allSpells: 'allSpells' in options ? options.allSpells : config.spells,
  onArrayFieldChange: vi.fn(),
  onClose: vi.fn(),
});

const getSaveButton = () => screen.getByRole('button', { name: /save/i });

describe.each(modalConfigs)('$name', (config) => {
  const {
    Component,
    spellField,
    header,
    description,
    validationError,
    schoolValidationError,
    validSchool,
    spells,
  } = config;
  const [spell, otherSpell] = spells;
  const wrongSchoolSpell = makeSpell('Wrong School Spell', 'Evocation');
  const lowercaseSpell = makeSpell('Lowercase School Spell', validSchool.toLowerCase());

  it('renders header, description, and exactly the level 1 valid-school spells as options', () => {
    render(<Component {...createProps(config, { allSpells: [...spells, ...outOfScopeSpells] })} />);
    expect(screen.getByText(header)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();

    const select = screen.getByRole('combobox');
    expect(select.value).toBe('');
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.map(o => o.value)).toEqual(['', ...spells.map(s => s.name)]);
    expect(options.map(o => o.textContent)).toEqual([
      'Select a spell...',
      ...spells.map(s => `${s.name} (${s.school})`),
    ]);
  });

  it('renders an empty selector without crashing when allSpells is null', () => {
    render(<Component {...createProps(config, { allSpells: null })} />);
    expect(screen.getByText(header)).toBeInTheDocument();
    expect(screen.getByRole('combobox').querySelectorAll('option')).toHaveLength(1);
  });

  it('reflects the formData pre-selection and tracks the details panel across selection changes', () => {
    render(
      <Component {...createProps(config, {
        formData: { [spellField]: spell.name, spells: [spell.name] },
      })} />
    );
    const select = screen.getByRole('combobox');
    expect(select.value).toBe(spell.name);

    const toggle = screen.getByRole('button', { name: `${spell.name} details` });
    expect(screen.queryByText(`School: ${spell.school}`)).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText(`School: ${spell.school}`)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText(`School: ${spell.school}`)).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: '' } });
    expect(select.value).toBe('');
    expect(screen.queryByText(`${spell.name} details`)).not.toBeInTheDocument();
  });

  it('blocks save with the exact error when nothing is selected, then clears it on selection', () => {
    const props = createProps(config);
    render(<Component {...props} />);
    fireEvent.click(getSaveButton());
    expect(screen.getByText(validationError)).toBeInTheDocument();
    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: spell.name } });
    expect(screen.queryByText(validationError)).not.toBeInTheDocument();
  });

  it.each([
    {
      label: 'fresh selection',
      allSpells: spells,
      existing: [],
      selected: spell.name,
      expected: [spell.name],
    },
    {
      label: 'dedupes an already-saved spell',
      allSpells: spells,
      existing: [spell.name],
      selected: spell.name,
      expected: [spell.name],
    },
    {
      label: 'appends a new spell to existing spells',
      allSpells: spells,
      existing: [spell.name],
      selected: otherSpell.name,
      expected: [spell.name, otherSpell.name],
    },
    {
      label: 'accepts a valid school name in lowercase',
      allSpells: [lowercaseSpell],
      existing: [],
      selected: lowercaseSpell.name,
      expected: [lowercaseSpell.name],
    },
  ])(`saves spells first, then ${spellField}, with exact payloads — $label`, (scenario) => {
    const props = createProps(config, {
      allSpells: scenario.allSpells,
      formData: { spells: scenario.existing },
    });
    render(<Component {...props} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: scenario.selected } });
    fireEvent.click(getSaveButton());

    expect(props.onArrayFieldChange.mock.calls).toEqual([
      ['spells', scenario.expected],
      [spellField, scenario.selected],
    ]);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(validationError)).not.toBeInTheDocument();
    expect(screen.queryByText(schoolValidationError)).not.toBeInTheDocument();
  });

  it('blocks saving a pre-selected spell from the wrong school without writing or closing', () => {
    const props = createProps(config, {
      allSpells: [wrongSchoolSpell],
      formData: { [spellField]: wrongSchoolSpell.name, spells: [] },
    });
    render(<Component {...props} />);
    fireEvent.click(getSaveButton());
    expect(screen.getByText(schoolValidationError)).toBeInTheDocument();
    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('closes via the header button without writing, and ignores overlay clicks', () => {
    const props = createProps(config);
    const { container } = render(<Component {...props} />);
    fireEvent.click(container.querySelector('.mi-overlay'));
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
  });
});
