// @maintained-by-ai
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepRules from './WizardStepRules.jsx';

// Disk-faithful option content copied verbatim from WizardStepRules.jsx (#387).
const OPTION_5E = {
  testId: 'rules-option-5e',
  label: '5th Edition (5e)',
  blurb: 'The classic D&D ruleset from 2014. Features traditional spell slots, class features, and ability scores.',
  features: [
    'Traditional spell slots',
    'Classic class features',
    'Standard ability improvements',
    'Original subclass system',
  ],
};
const OPTION_2024 = {
  testId: 'rules-option-2024',
  label: '2024 Rules (Essentials)',
  blurb: 'The updated D&D ruleset with streamlined mechanics and modernized features.',
  features: [
    'Revised spell mechanics',
    'Updated class features',
    'Improved ability improvements',
    'Modern subclass system',
  ],
};

function renderStep(props = {}) {
  // Fresh props per render (#362); stepNumber is not a prop of this component.
  return render(
    <WizardStepRules ruleset="5e" errors={{}} onRulesetChange={vi.fn()} {...props} />
  );
}

describe('WizardStepRules', () => {
  it('renders the exact ruleset option list: heading, description, blurbs, and ordered feature lists', () => {
    renderStep();

    expect(screen.getByRole('heading', { name: 'Select Rules System' })).toBeInTheDocument();
    expect(screen.getByText('Choose which D&D ruleset your character will follow:')).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    ).toEqual([OPTION_5E.label, OPTION_2024.label]);
    expect(screen.getByText(OPTION_5E.blurb)).toBeInTheDocument();
    expect(screen.getByText(OPTION_2024.blurb)).toBeInTheDocument();

    for (const option of [OPTION_5E, OPTION_2024]) {
      expect(
        within(screen.getByTestId(option.testId)).getAllByRole('listitem').map(li => li.textContent)
      ).toEqual(option.features);
    }
  });

  // 'selected' is CSS-load-bearing: it renders the chosen-option highlight
  // (.character-creation-wizard .rules-option.selected, CharacterCreationWizard.css:339).
  it.each([OPTION_5E, OPTION_2024])(
    'marks only $testId as selected when ruleset is its value', ({ testId }) => {
      const ruleset = testId === OPTION_5E.testId ? '5e' : '2024';
      renderStep({ ruleset });

      expect(screen.getByTestId(testId)).toHaveClass('selected');
      const other = testId === OPTION_5E.testId ? OPTION_2024 : OPTION_5E;
      expect(screen.getByTestId(other.testId)).not.toHaveClass('selected');
    }
  );

  it.each([OPTION_5E, OPTION_2024])(
    'clicking $testId calls onRulesetChange once with the exact ruleset value', ({ testId }) => {
      const onRulesetChange = vi.fn();
      renderStep({ onRulesetChange });

      fireEvent.click(screen.getByTestId(testId));

      const ruleset = testId === OPTION_5E.testId ? '5e' : '2024';
      expect(onRulesetChange).toHaveBeenCalledTimes(1);
      expect(onRulesetChange).toHaveBeenCalledWith(ruleset);
    }
  );

  it.each([
    [{ ruleset: 'Please select a ruleset' }, 'Please select a ruleset'],
    [{}, null],
    [undefined, null],
  ])('with errors %j renders error text %s', (errors, expected) => {
    renderStep({ errors });

    if (expected) {
      const errorEl = screen.getByText(expected);
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveClass('error-message');
    } else {
      expect(screen.queryByText('Please select a ruleset')).not.toBeInTheDocument();
      expect(document.querySelector('.error-message')).not.toBeInTheDocument();
    }
  });
});
