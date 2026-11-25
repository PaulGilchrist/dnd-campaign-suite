// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardSidebar from './WizardSidebar.jsx';

const createProps = (overrides = {}) => ({
  currentStep: 2,
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
  // The Ruleset tab is part of BOTH flows (edit switches rulesets through the
  // ledger-guarded lane), so only the 2024-only Background step varies here.
  it.each([
    ['5e', ALL_TITLES.filter((t) => t !== 'Background')],
    ['2024', ALL_TITLES],
  ])('renders the exact ordered step list for ruleset %s', (ruleset, expected) => {
    renderSidebar({ ruleset });
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

  describe('ladder cause titles (firstInvalidStep)', () => {
    // Mirror of the NPC list's disabled Add-to-Initiative chip: the cause is
    // named on the disabled control itself, never on an enabled one.
    it('names the first invalid step on every ladder-disabled tab and on Save', () => {
      // The 5e→2024 switch face: Background (step 5) is the new requirement.
      renderSidebar({
        ruleset: '2024',
        currentStep: 2,
        getStepEnabled: (step) => step <= 5,
        isSaveEnabled: false,
        firstInvalidStep: 5,
      });
      const cause = 'Complete "Background" first';
      expect(tabByTitle('Class')).toHaveAttribute('title', cause);
      expect(tabByTitle('Special Actions')).toHaveAttribute('title', cause);
      expect(saveButton()).toHaveAttribute('title', cause);
    });

    it('leaves enabled tabs titleless, including the first invalid step itself (it stays navigable)', () => {
      renderSidebar({
        ruleset: '2024',
        currentStep: 2,
        getStepEnabled: (step) => step <= 5,
        isSaveEnabled: false,
        firstInvalidStep: 5,
      });
      expect(tabByTitle('Basic Information')).not.toHaveAttribute('title');
      expect(tabByTitle('Background')).not.toHaveAttribute('title');
    });

    it('labels the cause with the step title from the CURRENT ruleset flow', () => {
      // 5e flow: step 4 is Subrace; Background is not part of the walk.
      renderSidebar({
        ruleset: '5e',
        currentStep: 2,
        getStepEnabled: (step) => step <= 4,
        isSaveEnabled: false,
        firstInvalidStep: 4,
      });
      expect(tabByTitle('Class')).toHaveAttribute('title', 'Complete "Subrace" first');
      expect(saveButton()).toHaveAttribute('title', 'Complete "Subrace" first');
    });

    it('shows no cause title when nothing blocks the ladder', () => {
      renderSidebar({ firstInvalidStep: null });
      expect(tabByTitle('Special Actions')).not.toHaveAttribute('title');
      expect(saveButton()).not.toHaveAttribute('title');
    });

    it('stays silent on a non-ladder disablement (no firstInvalidStep given)', () => {
      // Save can also be disabled by the wizard's over-cap gates — that lane
      // owns its own messaging, so the ladder cause must not be fabricated.
      renderSidebar({ isSaveEnabled: false, firstInvalidStep: null });
      expect(saveButton()).toBeDisabled();
      expect(saveButton()).not.toHaveAttribute('title');
    });

    it('omits the title when the blocking step is not part of the visible flow', () => {
      // Defensive face: a stale step number from a mid-switch render must not
      // name a step the sidebar does not show.
      renderSidebar({
        ruleset: '5e',
        currentStep: 2,
        getStepEnabled: (step) => step !== 5 && step <= 6,
        isSaveEnabled: false,
        firstInvalidStep: 5,
      });
      expect(tabByTitle('Class')).not.toHaveAttribute('title');
    });
  });
});
