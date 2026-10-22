// @maintained-by-ai
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

const optionValues = (select) => Array.from(select.querySelectorAll('option')).map((o) => o.value);

describe('WizardStepClass', () => {
  it('renders the class dropdown with the exact options from data and no detail card before selection', () => {
    renderStep();
    // Number mirrors the prop; canonical step numbering is owned by WizardStepNumbering.test.jsx.
    expect(screen.getByText('Step 6: Class')).toBeInTheDocument();
    expect(screen.getByText('Class *')).toBeInTheDocument();
    const selects = document.querySelectorAll('select');
    expect(selects).toHaveLength(1); // 5e never renders an order dropdown
    expect(optionValues(selects[0])).toEqual(['', 'Barbarian', 'Wizard']);
    expect(selects[0].querySelector('option[value=""]')).toHaveTextContent('Select a class');
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
    fireEvent.change(document.querySelector('select'), { target: { value: 'Wizard' } });
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
    fireEvent.change(document.querySelector('select'), { target: { value: '' } });
    expect(onInputChange).toHaveBeenLastCalledWith('class', {
      name: '', subclass: { name: '' }, divineOrder: '', primalOrder: '',
    });
  });

  it.each([
    {
      className: 'Cleric', ruleset: '2024',
      label: 'Divine Order *', options: ['', 'Protector', 'Thaumaturge'],
      field: 'divineOrder', value: 'Protector',
    },
    {
      className: 'Druid', ruleset: '2024',
      label: 'Primal Order *', options: ['', 'Magician', 'Warden'],
      field: 'primalOrder', value: 'Warden',
    },
  ])('2024 $className renders $label with exact options and change payload', ({ className, ruleset, label, options, field, value }) => {
    const onInputChange = vi.fn();
    render(
      <WizardStepClass
        stepNumber={6}
        formData={{ class: classValue(className) }}
        errors={{}}
        allClassesData={classes2024}
        ruleset={ruleset}
        onInputChange={onInputChange}
      />
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    const orderSelect = document.querySelectorAll('select')[1];
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
      name: 'Barbarian', ruleset: '5e', allClassesData: classes5e,
      description: 'A fierce warrior of primitive background who can enter a battle rage',
      info: {
        'Hit Die': 'd12',
        'Saving Throws': 'STR, CON',
        'Proficiencies': 'Light Armor, Medium Armor, Shields, Simple Weapons, Martial Weapons',
      },
      absent: ['Tool Proficiencies', 'Weapon Proficiencies'],
    },
    {
      name: 'Wizard', ruleset: '5e', allClassesData: classes5e,
      description: 'A scholarly magic-user capable of manipulating the structures of reality',
      info: {
        'Hit Die': 'd6',
        'Saving Throws': 'INT, WIS',
        'Proficiencies': 'Daggers, Quarterstaffs, Darts, Slings',
      },
      absent: ['Tool Proficiencies', 'Weapon Proficiencies'],
    },
    {
      name: 'Barbarian', ruleset: '2024', allClassesData: classes2024,
      description: 'A fierce warrior of primal rage.',
      info: {
        'Primary Ability': 'Strength',
        'Hit Point Die': '12',
        'Saving Throws': 'Strength, Constitution',
        'Weapon Proficiencies': 'Simple and Martial weapons',
        'Armor Training': 'Light and Medium armor and Shields',
      },
      absent: ['Tool Proficiencies'],
    },
    {
      name: 'Druid', ruleset: '2024', allClassesData: classes2024,
      description: 'Druids belong to ancient orders that call on the forces of nature.',
      info: {
        'Saving Throws': 'Intelligence, Wisdom',
        'Armor Training': 'Light armor and Shields',
        'Tool Proficiencies': 'Herbalism Kit',
      },
      absent: [],
    },
  ])('$ruleset detail card shows disk fields for $name', ({ name, ruleset, allClassesData, description, info, absent }) => {
    renderStep({ name, ruleset, allClassesData });
    expect(screen.getByText(`${name} Details`)).toBeInTheDocument();
    fireEvent.click(document.querySelector('.detail-card-header'));
    expect(screen.getByText(description)).toBeInTheDocument();
    for (const [label, value] of Object.entries(info)) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    for (const label of absent) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  // Disk-truth pin (public/data/classes.json, byte-exact via import — not retyped):
  // 5e `proficiencies` carries mixed armor/shields/weapons/tools, so ClassDetailCard
  // must render it under the honest flat label 'Proficiencies' (house precedent:
  // CharSummary.jsx:275 and FeatItemDetails.jsx:50), never 'Weapon Proficiencies'.
  it.each(['Fighter', 'Cleric', 'Rogue'])('5e %s: disk-mixed proficiencies render under exact label Proficiencies', (name) => {
    const diskClass = classesDisk5e.find((c) => c.name === name);
    renderStep({ name, allClassesData: classesDisk5e });
    fireEvent.click(document.querySelector('.detail-card-header'));
    expect(screen.getByText('Proficiencies')).toBeInTheDocument();
    expect(screen.getByText(diskClass.proficiencies.join(', '))).toBeInTheDocument();
    expect(screen.queryByText('Weapon Proficiencies')).not.toBeInTheDocument();
    expect(screen.queryByText('Armor Training')).not.toBeInTheDocument();
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
    { ruleset: '5e', errorKey: 'class', name: '', allClassesData: classes5e, errorMessage: 'Class is required', selectIndex: 0 },
    { ruleset: '2024', errorKey: 'divineOrder', name: 'Cleric', allClassesData: classes2024, errorMessage: 'Divine Order is required', selectIndex: 1 },
    { ruleset: '2024', errorKey: 'primalOrder', name: 'Druid', allClassesData: classes2024, errorMessage: 'Primal Order is required', selectIndex: 1 },
  ])('renders $errorMessage on the matching select', ({ ruleset, errorKey, name, allClassesData, errorMessage, selectIndex }) => {
    renderStep({ ruleset, name, allClassesData, errors: { [errorKey]: errorMessage } });
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(document.querySelectorAll('select')[selectIndex]).toHaveClass('error');
  });

  it('with empty class data renders only the placeholder and no detail card even for a selected class', () => {
    renderStep({ name: 'Barbarian', allClassesData: [] });
    const select = document.querySelector('select');
    expect(optionValues(select)).toEqual(['']);
    expect(select.querySelector('option[value=""]')).toHaveTextContent('Select a class');
    expect(screen.queryByText(/Details$/)).not.toBeInTheDocument();
  });
});
