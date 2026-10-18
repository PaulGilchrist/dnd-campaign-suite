// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepSubrace from './WizardStepSubrace.jsx';
import races5e from '../../../public/data/races.json';
import races2024 from '../../../public/data/2024/races.json';

// Disk anchors — verbatim public/data/races.json and public/data/2024/races.json
// (verified 2026-10-18). The prod feed is useWizardData.js: 5e → races.json,
// 2024 → 2024/races.json, passed straight through as racesData.
// Disk facts: 5e Half-Elf/Half-Orc/Human/Tiefling and 2024 Aasimar/Halfling/
// Human/Orc carry NO subraces field → the no-subraces empty state is genuinely
// reachable. 5e subraces never carry a `traits` array (only damage_resistance);
// the traits-array branch is reachable only via 2024 Goliath subraces.
// Disk facts: no subrace description or trait description contains '<' anywhere
// on either disk, and every disk subrace has a non-empty description except 2024
// Hill Dwarf/Mountain Dwarf — so the HTML-sanitize branch is untestable via the
// prod feed (deleted) while the missing-description branch pins on Hill Dwarf.
const DRAGONBORN_5E = races5e.find(r => r.name === 'Dragonborn');
const ELF_5E = races5e.find(r => r.name === 'Elf');
const RED_5E = DRAGONBORN_5E.subraces.find(s => s.name === 'Red Dragonborn');
const CLOUD_2024 = races2024.find(r => r.name === 'Goliath').subraces.find(s => s.name === 'Cloud Giant');

// Fresh props (incl. fresh vi.fn) per test — no shared mock state (#362).
function makeProps({ formData, errors = {}, racesData = races5e } = {}) {
  return {
    stepNumber: 4,
    formData,
    errors,
    racesData,
    onInputChange: vi.fn(),
  };
}

const renderStep = (props = {}) => {
  const p = makeProps(props);
  render(<WizardStepSubrace {...p} />);
  return p;
};

const optionTexts = () => screen.getAllByRole('option').map(o => o.textContent);
const traitItems = () => Array.from(document.querySelectorAll('.trait-item'));
const selectDragonRed = { race: { name: 'Dragonborn', subrace: { name: 'Red Dragonborn' } } };
const unselected = name => ({ race: { name, subrace: { name: '' } } });

describe('WizardStepSubrace', () => {
  it('render contract: lists Dragonborn subraces from disk in order, unselected and unerrored, no detail card', () => {
    renderStep({ formData: unselected('Dragonborn') });
    expect(screen.getByText('Step 4: Subrace')).toBeInTheDocument();
    expect(screen.getByText('Subrace *')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');
    expect(select).not.toHaveClass('error');
    expect(optionTexts()).toEqual(['Select a subrace', ...DRAGONBORN_5E.subraces.map(s => s.name)]);
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
  });

  it.each([
    ['race has no subraces on disk', { formData: unselected('Human') }],
    ['racesData not yet loaded', { formData: unselected('Dragonborn'), racesData: [] }],
  ])('shows the no-subrace notice with no combobox when %s', (_label, props) => {
    renderStep(props);
    const raceName = props.formData.race.name;
    expect(screen.getByText(new RegExp(`Your selected race \\(${raceName}\\) has no subraces\\. You can proceed to the next step\\.`))).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
  });

  it('selecting and clearing a subrace each report ("race", { ...race, subrace }) once', () => {
    const { onInputChange, formData } = renderStep({ formData: unselected('Dragonborn') });
    const select = screen.getByRole('combobox');

    fireEvent.change(select, { target: { value: 'Blue Dragonborn' } });
    expect(onInputChange).toHaveBeenCalledTimes(1);
    expect(onInputChange).toHaveBeenCalledWith('race', { ...formData.race, subrace: { name: 'Blue Dragonborn' } });

    fireEvent.change(select, { target: { value: '' } });
    expect(onInputChange).toHaveBeenCalledTimes(2);
    expect(onInputChange).toHaveBeenLastCalledWith('race', { ...formData.race, subrace: { name: '' } });
  });

  it('expands and collapses the selected Red Dragonborn card verbatim from disk; button and header row both toggle', () => {
    renderStep({ formData: selectDragonRed });
    expect(screen.getByRole('combobox')).toHaveValue('Red Dragonborn');
    const header = screen.getByRole('heading', { name: 'Red Dragonborn Details' });
    const toggle = screen.getByRole('button', { name: 'Show Details' });
    expect(screen.queryByText('Description')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide Details' })).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText(RED_5E.description)).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Show Details' })).toBeInTheDocument();
    expect(screen.queryByText('Description')).not.toBeInTheDocument();

    fireEvent.click(header); // header row itself also toggles
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it.each([
    ['5e Red Dragonborn', races5e, 'Dragonborn', 'Red Dragonborn', true, ['Damage Resistance'], 'You have resistance to Fire damage.'],
    ['2024 Cloud Giant', races2024, 'Goliath', 'Cloud Giant', true, ['Cloud\'s Jaunt'], CLOUD_2024.traits[0].description],
    ['5e High Elf', races5e, 'Elf', 'High Elf', true, [], null],
    ['2024 Hill Dwarf', races2024, 'Dwarf', 'Hill Dwarf', false, [], null], // disk: empty description
  ])('detail card sections for %s: description %s, traits exactly as disk', (_label, racesData, race, subrace, hasDescription, expectedNames, verbatimTrait) => {
    renderStep({ formData: { race: { name: race, subrace: { name: subrace } } }, racesData });
    fireEvent.click(screen.getByRole('button', { name: 'Show Details' }));
    expect(!!screen.queryByText('Description')).toBe(hasDescription);
    expect(!!screen.queryByText('Subrace Traits')).toBe(expectedNames.length > 0);
    expect(traitItems().map(i => i.querySelector('.trait-name').textContent)).toEqual(expectedNames);
    if (verbatimTrait) {
      expect(traitItems()[0].querySelector('.trait-description').textContent).toBe(verbatimTrait);
    }
  });

  it('changing race repopulates options from the new race and drops the stale detail card', () => {
    const props = makeProps({ formData: selectDragonRed });
    const { rerender } = render(<WizardStepSubrace {...props} />);
    expect(screen.getByText('Red Dragonborn Details')).toBeInTheDocument();

    const wizard = makeProps({ formData: unselected('Elf') });
    rerender(<WizardStepSubrace {...wizard} />);
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(optionTexts()).toEqual(['Select a subrace', ...ELF_5E.subraces.map(s => s.name)]);
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
    expect(props.onInputChange).not.toHaveBeenCalled(); // repopulation is prop-derived — no auto-report
  });

  it('renders the subrace error message and flags the select with the error class', () => {
    renderStep({ formData: unselected('Dragonborn'), errors: { subrace: 'Subrace is required' } });
    expect(screen.getByText('Subrace is required')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveClass('error');
  });
});
