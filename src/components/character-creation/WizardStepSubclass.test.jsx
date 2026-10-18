// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepSubclass from './WizardStepSubclass.jsx';
import classes5e from '../../../public/data/classes.json';
import classes2024 from '../../../public/data/2024/classes.json';

// Disk anchors — verbatim public/data/classes.json and public/data/2024/classes.json
// (verified 2026-10-18). classSubtypes mirrors useWizardData.js exactly for both
// rulesets (subtypes: subclasses || majors || []); allClassesData is the raw file.
// Disk facts: EVERY class in both files has non-empty subclasses/majors, and every
// 5e subclass carries its own class_levels — so the component's allClassesData
// re-lookup and empty-subtype fallbacks are unreachable via the prod feed and are
// not tested. Reachable empty states: no class selected, or classSubtypes pre-load.
const subtypeMap = all => all.map(c => ({ className: c.name, subtypes: c.subclasses || c.majors || [] }));
const SUBTYPES_5E = subtypeMap(classes5e);
const SUBTYPES_2024 = subtypeMap(classes2024);
const FIGHTER_5E = classes5e.find(c => c.name === 'Fighter');
const FIGHTER_2024 = classes2024.find(c => c.name === 'Fighter');
const BM_5E = FIGHTER_5E.subclasses.find(s => s.name === 'Battle Master');
const BM_2024 = FIGHTER_2024.majors.find(m => m.name === 'Battle Master');

// Fresh props (incl. fresh vi.fn) per test — no shared mock state (#362).
function makeProps({ formData, errors = {}, classSubtypes = SUBTYPES_5E, ruleset = '5e', allClassesData = classes5e } = {}) {
  return {
    stepNumber: 7,
    formData: formData ?? { class: { name: '', subclass: { name: '' } } },
    errors,
    classSubtypes,
    ruleset,
    allClassesData,
    onInputChange: vi.fn(),
  };
}

const renderStep = (props = {}) => {
  const p = makeProps(props);
  render(<WizardStepSubclass {...p} />);
  return p;
};

const optionTexts = () => screen.getAllByRole('option').map(o => o.textContent);
const badgeTexts = () => screen.getAllByText(/^Level \d+$/).map(e => e.textContent);
const selectFighterBM = { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } };

describe('WizardStepSubclass', () => {
  it('render contract: lists Fighter subclasses from disk in order, unselected and unerrored, no detail card', () => {
    renderStep({ formData: { class: { name: 'Fighter', subclass: { name: '' } } } });
    expect(screen.getByText('Step 7: Subclass / Major')).toBeInTheDocument();
    expect(screen.getByText('Subclass / Major *')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');
    expect(select).not.toHaveClass('error');
    expect(optionTexts()).toEqual(['Select a subclass / major', ...FIGHTER_5E.subclasses.map(s => s.name)]);
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
  });

  it.each([
    ['no class selected', { formData: undefined }],
    ['classSubtypes not yet loaded', { formData: { class: { name: 'Fighter', subclass: { name: '' } } }, classSubtypes: [] }],
  ])('shows the no-subclass notice with no combobox when %s', (_label, props) => {
    renderStep(props);
    const className = props.formData?.class.name ?? '';
    expect(screen.getByText(new RegExp(`Your selected class \\(${className}\\) has no subclasses/majors\\.`))).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
  });

  it('selecting and clearing a subclass each report ("class", { ...class, subclass }) once', () => {
    const { onInputChange, formData } = renderStep({ formData: { class: { name: 'Fighter', subclass: { name: '' } } } });
    const select = screen.getByRole('combobox');

    fireEvent.change(select, { target: { value: 'Battle Master' } });
    expect(onInputChange).toHaveBeenCalledTimes(1);
    expect(onInputChange).toHaveBeenCalledWith('class', { ...formData.class, subclass: { name: 'Battle Master' } });

    fireEvent.change(select, { target: { value: '' } });
    expect(onInputChange).toHaveBeenCalledTimes(2);
    expect(onInputChange).toHaveBeenLastCalledWith('class', { ...formData.class, subclass: { name: '' } });
  });

  it('expands the 5e Battle Master card verbatim from disk (description, flavor, all class_levels features) and collapses via button or header', () => {
    renderStep({ formData: selectFighterBM });
    const header = screen.getByRole('heading', { name: /Battle Master Details/i });
    const toggle = screen.getByRole('button', { name: 'Show Details' });
    expect(screen.queryByText('Description')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide Details' })).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText(BM_5E.description)).toBeInTheDocument();
    expect(screen.getByText('Flavor')).toBeInTheDocument();
    expect(screen.getByText(BM_5E.subclass_flavor)).toBeInTheDocument(); // disk: 'Martial Archetype'
    expect(screen.getByText('Features')).toBeInTheDocument();

    const diskFeatures = BM_5E.class_levels.flatMap(l => l.features);
    const renderedNames = Array.from(document.querySelectorAll('.feature-item .feature-name')).map(e => e.textContent);
    expect(renderedNames).toEqual(diskFeatures.map(f => f.name)); // disk lists ICS at both 10 and 18 — duplicates included, in order
    expect(badgeTexts()).toEqual(diskFeatures.map(f => `Level ${f.level}`));
    // disk fact: 5e Combat Superiority embeds <br/> — prose renders, tags never leak as text
    expect(BM_5E.class_levels[0].features[0].description).toContain('<');
    expect(screen.getByText(/You learn maneuvers that are fueled/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('<br');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Show Details' })).toBeInTheDocument();
    expect(screen.queryByText('Description')).not.toBeInTheDocument();

    fireEvent.click(header); // header row itself also toggles
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('2024 ruleset lists Fighter majors from disk (incl. Psi Warrior) and renders the major verbatim: description plus all 6 major features', () => {
    const { onInputChange } = renderStep({
      formData: selectFighterBM,
      ruleset: '2024',
      classSubtypes: SUBTYPES_2024,
      allClassesData: classes2024,
    });
    expect(optionTexts()).toEqual(['Select a subclass / major', ...FIGHTER_2024.majors.map(m => m.name)]);

    fireEvent.click(screen.getByRole('button', { name: 'Show Details' }));
    expect(screen.getByText(BM_2024.description)).toBeInTheDocument();
    expect(screen.getByText('Relentless')).toBeInTheDocument(); // 2024 majors list, not 5e class_levels
    expect(badgeTexts()).toEqual(BM_2024.features.map(f => `Level ${f.level}`)); // disk: 3,3,7,10,15,18

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Psi Warrior' } });
    expect(onInputChange).toHaveBeenCalledWith('class', { name: 'Fighter', subclass: { name: 'Psi Warrior' } });
  });

  it('changing class repopulates options from the new class and drops the stale detail card', () => {
    const props = makeProps({ formData: selectFighterBM });
    const { rerender } = render(<WizardStepSubclass {...props} />);
    expect(screen.getByText('Battle Master Details')).toBeInTheDocument();

    const wizard = makeProps({ formData: { class: { name: 'Wizard', subclass: { name: '' } } } });
    rerender(<WizardStepSubclass {...wizard} />);
    const wizDisk = classes5e.find(c => c.name === 'Wizard');
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(optionTexts()).toEqual(['Select a subclass / major', ...wizDisk.subclasses.map(s => s.name)]);
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
    expect(props.onInputChange).not.toHaveBeenCalled(); // repopulation is prop-derived — no auto-report
  });

  it('renders the subclass error message and flags the select with the error class', () => {
    renderStep({
      formData: { class: { name: 'Fighter', subclass: { name: '' } } },
      errors: { subclass: 'Subclass is required' },
    });
    expect(screen.getByText('Subclass is required')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveClass('error');
  });
});
