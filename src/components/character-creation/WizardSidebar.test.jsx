// @maintained-by-ai 2026-11-28
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

// Tabs render as "<displayNumber><title>"; the save tab carries ✓ instead of a
// number and always sits last. Pinning the marker keeps tab NUMBERS (gap-free
// display numbers, ✓ on Save) covered alongside titles and order. DOM-order
// query (not a role query, whose order follows the tab-sorted accessibility
// tree) so DOCUMENT ORDER is what gets pinned.
const renderedTabs = () =>
  Array.from(document.querySelectorAll('.wizard-sidebar button')).map((btn) => {
    const [, marker, title] = btn.textContent.match(/^(\d+|✓)(.*)$/);
    return { marker, title };
  });

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

const expectedTabs = (titles) => [
  ...titles.map((title, index) => ({ marker: String(index + 1), title })),
  { marker: '✓', title: 'Save' },
];

describe('WizardSidebar', () => {
  // The Ruleset tab is part of BOTH flows (edit switches rulesets through the
  // ledger-guarded lane), so only the 2024-only Background step varies here.
  // 5e is the shifted flow: renumbered 1..16 with no gap at Background.
  it.each([
    ['5e', ALL_TITLES.filter((t) => t !== 'Background')],
    ['2024', ALL_TITLES],
  ])('renders the exact numbered step list and ✓ Save for ruleset %s', (ruleset, titles) => {
    renderSidebar({ ruleset });
    expect(renderedTabs()).toEqual(expectedTabs(titles));
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

  it('disables tabs the wizard has not enabled, leaving enabled tabs clickable', () => {
    renderSidebar({ currentStep: 2, getStepEnabled: (step) => step <= 2 });
    expect(tabByTitle('Basic Information')).not.toBeDisabled();
    expect(tabByTitle('Race')).toBeDisabled();
    expect(tabByTitle('Special Actions')).toBeDisabled();
    // With no ladder step blocking, disabled tabs stay silent and enabled
    // ones stay bare.
    expect(tabByTitle('Basic Information')).not.toHaveAttribute('title');
    expect(tabByTitle('Special Actions')).not.toHaveAttribute('title');
  });

  it('arms Save for clicks when enabled and pins it disabled otherwise, titleless when nothing blocks', () => {
    const props = createProps();
    const { unmount } = render(<WizardSidebar {...props} />);
    expect(saveButton()).not.toBeDisabled();
    expect(saveButton()).not.toHaveAttribute('title');
    fireEvent.click(saveButton());
    expect(props.onSave).toHaveBeenCalledTimes(1);
    unmount();

    renderSidebar({ isSaveEnabled: false, firstInvalidStep: null });
    expect(saveButton()).toBeDisabled();
    expect(saveButton()).not.toHaveAttribute('title');
  });

  describe('ladder cause titles (firstInvalidStep)', () => {
    // Mirror of the NPC list's disabled Add-to-Initiative chip: the cause is
    // named on the disabled control itself, never on an enabled one.
    it('names the blocking step on every ladder-disabled tab and on Save, leaving enabled tabs titleless', () => {
      // The 5e→2024 switch face: Background (step 5) is the new requirement.
      // Save's title here also pins the ladder-cause fallback when the wizard
      // supplies no saveCauseTitle sentence.
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
      // Enabled tabs stay bare — including the first invalid step itself,
      // which remains navigable.
      expect(tabByTitle('Basic Information')).not.toHaveAttribute('title');
      expect(tabByTitle('Background')).not.toHaveAttribute('title');
    });

    it('names the caps cause from saveCauseTitle on a non-ladder disablement', () => {
      // The wizard's over-cap gates close the Save belt while the ladder is
      // fully valid; the sentence rides the disabled button so the block is
      // never silent. (Tabs have no caps stake — titleless coverage lives in
      // the enablement test.)
      const caps = 'Feats/skills exceed the rules limit — fix highlighted steps';
      renderSidebar({ isSaveEnabled: false, firstInvalidStep: null, saveCauseTitle: caps });
      expect(saveButton()).toHaveAttribute('title', caps);
    });

    it('the wizard sentence wins over the ladder fallback on mixed drafts', () => {
      // Distinct sentences: Save must ride the wizard's combined sentence
      // even though a ladder cause is available...
      const caps = 'Feats/skills exceed the rules limit — fix highlighted steps';
      renderSidebar({
        ruleset: '2024',
        currentStep: 2,
        getStepEnabled: (step) => step <= 5,
        isSaveEnabled: false,
        firstInvalidStep: 5,
        saveCauseTitle: caps,
      });
      expect(saveButton()).toHaveAttribute('title', caps);
      // ...while tabs keep naming the ladder step they wait on.
      expect(tabByTitle('Class')).toHaveAttribute('title', 'Complete "Background" first');
    });

    it('omits the title when the blocking step is not part of the visible flow', () => {
      // Defensive face: a stale step number from a mid-switch render must not
      // name a step the sidebar does not show. Also pins that the sidebar
      // feeds `ruleset` into the cause lookup — a default (all-steps) flow
      // would wrongly find Background here. Cause-title unit logic itself
      // lives in steps-config.test.js.
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
