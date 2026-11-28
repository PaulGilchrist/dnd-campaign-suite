// @maintained-by-ai 2026-11-28
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepRules from './WizardStepRules.jsx';
import { RULESET_REQUIRED_ERROR } from '../../config/utils.js';

// Disk-faithful option content copied verbatim from WizardStepRules.jsx (#387).
const OPTION_5E = {
  value: '5e',
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
  value: '2024',
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
const RULESET_OPTIONS = [OPTION_5E, OPTION_2024];
const otherOption = (option) => RULESET_OPTIONS.find(o => o !== option);

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

    for (const option of RULESET_OPTIONS) {
      expect(
        within(screen.getByTestId(option.testId)).getAllByRole('listitem').map(li => li.textContent)
      ).toEqual(option.features);
    }
  });

  // 'selected' is CSS-load-bearing: it renders the chosen-option highlight
  // (.character-creation-wizard .rules-option.selected, CharacterCreationWizard.css:339).
  it.each(RULESET_OPTIONS)(
    'marks only $testId as selected when ruleset is $value', (option) => {
      renderStep({ ruleset: option.value });

      expect(screen.getByTestId(option.testId)).toHaveClass('selected');
      expect(screen.getByTestId(otherOption(option).testId)).not.toHaveClass('selected');
    }
  );

  it.each(RULESET_OPTIONS)(
    'clicking $testId calls onRulesetChange once with the exact ruleset value', ({ testId, value }) => {
      const onRulesetChange = vi.fn();
      renderStep({ onRulesetChange });

      fireEvent.click(screen.getByTestId(testId));

      expect(onRulesetChange).toHaveBeenCalledTimes(1);
      expect(onRulesetChange).toHaveBeenCalledWith(value);
    }
  );

  // One error line derived from errors.ruleset and the ruleset prop: an explicit
  // validator message wins (even over a selection); otherwise the step-1 blocker
  // hint (parity with the step-2 name gate) shows until a pick clears it on the
  // very same re-render. The whole matrix asserts exactly ONE .error-message.
  const VALIDATOR_MSG = 'Please select a ruleset';
  it.each([
    // [ruleset, errors, sole .error-message text (null = none)]
    ['5e', { ruleset: VALIDATOR_MSG }, VALIDATOR_MSG],
    [null, { ruleset: VALIDATOR_MSG }, VALIDATOR_MSG],
    [null, {}, RULESET_REQUIRED_ERROR],
    ['5e', undefined, null],
  ])(
    'ruleset=%s with errors %j renders only %s as the error line',
    (ruleset, errors, expected) => {
      renderStep({ ruleset, errors });

      expect(
        [...document.querySelectorAll('.error-message')].map(el => el.textContent)
      ).toEqual(expected === null ? [] : [expected]);
    }
  );

  // ——— Quick build / Custom build entry affordance (Item 1, foundation plan) ———
  it.each([
    // buildMode prop defaults to 'custom'
    [undefined, 'custom', 'quick'],
    ['quick', 'quick', 'custom'],
  ])(
    'buildMode %s marks only build-mode-%s selected', (buildMode, selected, unselected) => {
      renderStep({ buildMode });

      expect(screen.getByTestId(`build-mode-${selected}`)).toHaveClass('selected');
      expect(screen.getByTestId(`build-mode-${unselected}`)).not.toHaveClass('selected');
    }
  );

  it.each(['quick', 'custom'])(
    'clicking build-mode-%s calls onBuildModeChange once with that mode and leaves the ruleset untouched',
    (mode) => {
      const onBuildModeChange = vi.fn();
      const onRulesetChange = vi.fn();
      renderStep({ buildMode: mode === 'quick' ? 'custom' : 'quick', onBuildModeChange, onRulesetChange });

      fireEvent.click(screen.getByTestId(`build-mode-${mode}`));

      expect(onBuildModeChange).toHaveBeenCalledTimes(1);
      expect(onBuildModeChange).toHaveBeenCalledWith(mode);
      expect(onRulesetChange).not.toHaveBeenCalled();
    }
  );

  // Edit-mode card hiding (the {!isEditing && ...} branch) is covered at the
  // integration level by CharacterCreationWizard.edit-ruleset-switch.test.jsx
  // ('create-only build-mode cards hidden') — not re-asserted here.
});
