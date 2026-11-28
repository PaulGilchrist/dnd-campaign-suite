// @maintained-by-ai 2026-11-28
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepClass from './WizardStepClass.jsx';
import classesDisk5e from '../../../public/data/classes.json';

// Fixtures are disk-faithful excerpts of public/data/classes.json (5e) and
// public/data/2024/classes.json (descriptions are verbatim first-paragraph prefixes).
const barbarian5e = {
  index: 'barbarian', name: 'Barbarian', hit_die: 12,
  description: 'A fierce warrior of primitive background who can enter a battle rage',
  proficiencies: ['Light Armor', 'Medium Armor', 'Shields', 'Simple Weapons', 'Martial Weapons'],
  saving_throws: ['STR', 'CON'],
};
const wizard5e = {
  index: 'wizard', name: 'Wizard', hit_die: 6,
  description: 'A scholarly magic-user capable of manipulating the structures of reality',
  proficiencies: ['Daggers', 'Quarterstaffs', 'Darts', 'Slings'],
  saving_throws: ['INT', 'WIS'],
};
const classes5e = [barbarian5e, wizard5e];

const barbarian2024 = {
  index: 'barbarian', name: 'Barbarian', primary_ability: 'Strength', hit_point_die: '12',
  class_description: '<p><b>A fierce warrior of primal rage.</b></p>',
  saving_throw_proficiencies: ['Strength', 'Constitution'],
  weapon_proficiencies: 'Simple and Martial weapons',
  armor_training: 'Light and Medium armor and Shields',
  tool_proficiencies: '',
};
const cleric2024 = {
  index: 'cleric', name: 'Cleric', primary_ability: 'Wisdom', hit_point_die: '8',
  class_description: '<p><b>Clerics draw power from the realms of the gods and harness it to work miracles.</b></p>',
  saving_throw_proficiencies: ['Wisdom', 'Charisma'],
  weapon_proficiencies: 'Simple weapons',
  armor_training: 'Light and Medium armor and Shields',
  tool_proficiencies: '',
};
const druid2024 = {
  index: 'druid', name: 'Druid', primary_ability: 'Wisdom', hit_point_die: '8',
  class_description: '<p><b>Druids belong to ancient orders that call on the forces of nature.</b></p>',
  saving_throw_proficiencies: ['Intelligence', 'Wisdom'],
  weapon_proficiencies: 'Simple weapons',
  armor_training: 'Light armor and Shields',
  tool_proficiencies: 'Herbalism Kit',
};
const classes2024 = [barbarian2024, cleric2024, druid2024];

const classValue = (name, subclass = '') => ({
  name, subclass: { name: subclass }, divineOrder: '', primalOrder: '',
});

// Fresh props per test: a new onInputChange mock is created on every render.
function renderStep({ stepNumber = 6, name = '', ruleset = '5e', allClassesData = classes5e, errors = {} } = {}) {
  const onInputChange = vi.fn();
  render(
    <WizardStepClass
      stepNumber={stepNumber}
      formData={{ class: classValue(name) }}
      errors={errors}
      allClassesData={allClassesData}
      ruleset={ruleset}
      onInputChange={onInputChange}
    />
  );
  return { onInputChange };
}

// Locate a select by its visible field label instead of child order.
const selectFor = (label) => screen.getByText(label).closest('.form-group').querySelector('select');
const optionValues = (select) => Array.from(select.querySelectorAll('option')).map((o) => o.value);

describe('WizardStepClass', () => {
  it('renders the class dropdown with the exact options from data and no detail card before selection', () => {
    renderStep();
    // Number mirrors the prop; canonical step numbering is owned by WizardStepNumbering.test.jsx.
    expect(screen.getByText('Step 6: Class')).toBeInTheDocument();
    const classSelect = selectFor('Class *');
    expect(document.querySelectorAll('select')).toHaveLength(1); // 5e never renders an order dropdown
    expect(optionValues(classSelect)).toEqual(['', 'Barbarian', 'Wizard']);
    expect(classSelect.querySelector('option[value=""]')).toHaveTextContent('Select a class');
    expect(screen.queryByText(/Details$/)).not.toBeInTheDocument();
  });

  it('class change emits exact class payload (switch resets subclass; empty resets all)', () => {
    const onInputChange = vi.fn();
    const { rerender } = render(
      <WizardStepClass
        stepNumber={6}
        formData={{ class: classValue('Barbarian', 'Path of the Berserker') }}
        errors={{}}
        allClassesData={classes5e}
        ruleset="5e"
        onInputChange={onInputChange}
      />
    );
    fireEvent.change(selectFor('Class *'), { target: { value: 'Wizard' } });
    expect(onInputChange).toHaveBeenCalledWith('class', {
      name: 'Wizard', subclass: { name: '' }, divineOrder: '', primalOrder: '',
    });

    rerender(
      <WizardStepClass
        stepNumber={6}
        formData={{ class: classValue('Wizard', 'School of Evocation') }}
        errors={{}}
        allClassesData={classes5e}
        ruleset="5e"
        onInputChange={onInputChange}
      />
    );
    fireEvent.change(selectFor('Class *'), { target: { value: '' } });
    expect(onInputChange).toHaveBeenLastCalledWith('class', {
      name: '', subclass: { name: '' }, divineOrder: '', primalOrder: '',
    });
  });

  it.each([
    {
      className: 'Cleric', label: 'Divine Order *', options: ['', 'Protector', 'Thaumaturge'],
      field: 'divineOrder', value: 'Protector',
    },
    {
      className: 'Druid', label: 'Primal Order *', options: ['', 'Magician', 'Warden'],
      field: 'primalOrder', value: 'Warden',
    },
  ])('2024 $className renders $label with exact options and change payload', ({ className, label, options, field, value }) => {
    const onInputChange = vi.fn();
    render(
      <WizardStepClass
        stepNumber={6}
        formData={{ class: classValue(className) }}
        errors={{}}
        allClassesData={classes2024}
        ruleset="2024"
        onInputChange={onInputChange}
      />
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    const orderSelect = selectFor(label);
    expect(optionValues(orderSelect)).toEqual(options);
    fireEvent.change(orderSelect, { target: { value } });
    expect(onInputChange).toHaveBeenCalledWith('class', { ...classValue(className), [field]: value });
  });

  it('shows no order dropdown for Barbarian 2024 (class without an order config)', () => {
    renderStep({ ruleset: '2024', allClassesData: classes2024, name: 'Barbarian' });
    expect(screen.queryByText(/Order/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('select')).toHaveLength(1);
  });

  it.each([
    {
      name: 'Barbarian',
      description: 'A fierce warrior of primal rage.',
      info: {
        'Primary Ability': 'Strength',
        'Hit Point Die': '12',
        'Saving Throws': 'Strength, Constitution',
        'Weapon Proficiencies': 'Simple and Martial weapons',
        'Armor Training': 'Light and Medium armor and Shields',
      },
      absent: ['Tool Proficiencies'], // empty-string tool_proficiencies renders nothing
    },
    {
      name: 'Druid',
      description: 'Druids belong to ancient orders that call on the forces of nature.',
      info: {
        'Saving Throws': 'Intelligence, Wisdom',
        'Armor Training': 'Light armor and Shields',
        'Tool Proficiencies': 'Herbalism Kit', // the non-empty tool branch
      },
      absent: [],
    },
  ])('2024 detail card shows disk fields for $name', ({ name, description, info, absent }) => {
    renderStep({ name, ruleset: '2024', allClassesData: classes2024 });
    expect(screen.getByText(`${name} Details`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show Details' }));
    expect(screen.getByText(description)).toBeInTheDocument();
    for (const [label, value] of Object.entries(info)) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    for (const label of absent) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  // Disk-truth lock (public/data/classes.json via import — not retyped). 5e
  // `proficiencies` carries mixed armor/shields/weapons/tools, so ClassDetailCard
  // must render it under the honest flat label 'Proficiencies' (house precedent:
  // CharSummary.jsx:275 and FeatItemDetails.jsx:50), never split into 'Weapon
  // Proficiencies'/'Armor Training'/'Tool Proficiencies'. Rogue is the strongest
  // single witness: its list contains Thieves' Tools. This test also locks the
  // whole 5e detail-card render path (plain `description` branch, d-prefixed hit
  // die, joined saving throws), subsuming the former fixture Barbarian/Wizard
  // legs and the Fighter/Cleric legs that repeated the same path on other data.
  it('5e detail card renders disk Rogue verbatim: flat Proficiencies label, d-hit-die, joined saves, no 2024-only labels', () => {
    const diskRogue = classesDisk5e.find((c) => c.name === 'Rogue');
    expect(diskRogue.proficiencies).toContain("Thieves' Tools"); // premise of the flat-label claim
    renderStep({ name: 'Rogue', allClassesData: classesDisk5e });
    expect(screen.getByText('Rogue Details')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show Details' }));
    expect(screen.getByText('A scoundrel who uses stealth and trickery to overcome obstacles and enemies')).toBeInTheDocument();
    expect(screen.getByText('d8')).toBeInTheDocument();
    expect(screen.getByText('DEX, INT')).toBeInTheDocument();
    expect(screen.getByText('Hit Die')).toBeInTheDocument(); // 5e key hit_die, d-prefixed above
    expect(screen.getByText('Proficiencies')).toBeInTheDocument();
    expect(screen.getByText(diskRogue.proficiencies.join(', '))).toBeInTheDocument();
    expect(screen.queryByText('Hit Point Die')).not.toBeInTheDocument();
    expect(screen.queryByText('Weapon Proficiencies')).not.toBeInTheDocument();
    expect(screen.queryByText('Armor Training')).not.toBeInTheDocument();
    expect(screen.queryByText('Tool Proficiencies')).not.toBeInTheDocument();
  });

  it('toggle button cycles details collapsed → expanded → collapsed', () => {
    renderStep({ name: 'Barbarian' });
    expect(screen.getByRole('button', { name: 'Show Details' })).toBeInTheDocument();
    expect(screen.queryByText(/fierce warrior of primitive background/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show Details' }));
    expect(screen.getByRole('button', { name: 'Hide Details' })).toBeInTheDocument();
    expect(screen.getByText(/fierce warrior of primitive background/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Details' }));
    expect(screen.getByRole('button', { name: 'Show Details' })).toBeInTheDocument();
    expect(screen.queryByText(/fierce warrior of primitive background/)).not.toBeInTheDocument();
  });

  it.each([
    { errorKey: 'class', label: 'Class *', name: '', ruleset: '5e', allClassesData: classes5e, errorMessage: 'Class is required' },
    { errorKey: 'divineOrder', label: 'Divine Order *', name: 'Cleric', ruleset: '2024', allClassesData: classes2024, errorMessage: 'Divine Order is required' },
    { errorKey: 'primalOrder', label: 'Primal Order *', name: 'Druid', ruleset: '2024', allClassesData: classes2024, errorMessage: 'Primal Order is required' },
  ])('renders $errorMessage on the $label select', ({ ruleset, errorKey, label, name, allClassesData, errorMessage }) => {
    renderStep({ ruleset, name, allClassesData, errors: { [errorKey]: errorMessage } });
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(selectFor(label)).toHaveClass('error');
  });

  it('with empty class data renders only the placeholder and no detail card even for a selected class', () => {
    renderStep({ name: 'Barbarian', allClassesData: [] });
    const select = selectFor('Class *');
    expect(optionValues(select)).toEqual(['']);
    expect(select.querySelector('option[value=""]')).toHaveTextContent('Select a class');
    expect(screen.queryByText(/Details$/)).not.toBeInTheDocument();
  });
});
