// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardSidebar from './WizardSidebar.jsx';

const createProps = (overrides = {}) => ({
  currentStep: 2,
  isEditing: false,
  ruleset: '5e',
  getStepEnabled: () => true,
  goToStep: vi.fn(),
  isSaveEnabled: true,
  onSave: vi.fn(),
  ...overrides,
});

const renderSidebar = (overrides = {}) => render(<WizardSidebar {...createProps(overrides)} />);

// Step tabs carry a numeric prefix ("1Ruleset"); the save tab is prefixed with ✓ instead.
const stepTabTitles = () =>
  screen.getAllByRole('button', { name: /^\d/ }).map((btn) => btn.textContent.replace(/^\d+/, ''));
const tabByTitle = (title) => screen.getByRole('button', { name: new RegExp(title) });
const saveButton = () => screen.getByRole('button', { name: /Save/ });

const ALL_TITLES = [
  'Ruleset',
  'Basic Information',
  'Race',
  'Subrace',
  'Background',
  'Class',
  'Subclass / Major',
  'Feats',
  'Ability Scores',
  'Skill Proficiencies',
  'Tool Proficiencies',
  'Languages & Fighting Styles',
  'Resistances & Immunities',
  'Spells',
  'Magic Items',
  'Inventory',
  'Special Actions',
];

describe('WizardSidebar', () => {
  it.each([
    ['5e', false, ALL_TITLES.filter((t) => t !== 'Background')],
    ['2024', false, ALL_TITLES],
    ['5e', true, ALL_TITLES.filter((t) => t !== 'Ruleset' && t !== 'Background')],
    ['2024', true, ALL_TITLES.filter((t) => t !== 'Ruleset')],
  ])('renders the exact ordered step list for ruleset %s (isEditing=%s)', (ruleset, isEditing, expected) => {
    renderSidebar({ ruleset, isEditing });
    expect(stepTabTitles()).toEqual(expected);
  });

  it('marks only the current step tab as active', () => {
    renderSidebar({ currentStep: 3 });
    expect(tabByTitle('Race')).toHaveClass('active');
    expect(tabByTitle('Basic Information')).not.toHaveClass('active');
  });

  it('clicking an enabled tab navigates to its canonical step number', () => {
    const props = createProps();
    render(<WizardSidebar {...props} />);
    fireEvent.click(tabByTitle('Basic Information'));
    // Class is the 5th visible tab in the 5e flow but must emit canonical step 6.
    fireEvent.click(tabByTitle('Class'));
    expect(props.goToStep).toHaveBeenCalledTimes(2);
    expect(props.goToStep).toHaveBeenNthCalledWith(1, 2);
    expect(props.goToStep).toHaveBeenNthCalledWith(2, 6);
  });

  it('disables tabs for steps the wizard has not enabled, leaving enabled tabs clickable', () => {
    renderSidebar({ currentStep: 2, getStepEnabled: (step) => step <= 2 });
    expect(tabByTitle('Basic Information')).not.toBeDisabled();
    expect(tabByTitle('Race')).toBeDisabled();
    expect(tabByTitle('Special Actions')).toBeDisabled();
  });

  it('clicking the enabled save button calls onSave exactly once', () => {
    const props = createProps();
    render(<WizardSidebar {...props} />);
    fireEvent.click(saveButton());
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('pins the save button as disabled when isSaveEnabled is false', () => {
    renderSidebar({ isSaveEnabled: false });
    expect(saveButton()).toBeDisabled();
  });
});
