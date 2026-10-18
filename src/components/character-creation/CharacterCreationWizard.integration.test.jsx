// @maintained-by-ai
/**
 * Integration lane for CharacterCreationWizard.
 *
 * Renders the REAL wizard: real useWizardForm, useWizardNavigation,
 * steps-config, config/utils validators, header/footer/sidebar and step
 * components. The only mocks are data-loading boundaries (useWizardData
 * fixture + fetch stub), so every navigation gate here exercises the real
 * validateStep logic.
 *
 * Lane partition (do not restate here):
 *  - per-step field behavior -> WizardStep*.test.jsx lanes
 *  - footer/header/sidebar/progress unit details -> their own test files
 *  - submit handler wiring with mocked validators -> submission.test.jsx
 *  - navigation hook contract -> useWizardNavigation.test.js
 * This file pins only the flow glue: step order, blocked/advance gates,
 * the live duplicate-name guard, and the exact submitted payload.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import { DEFAULT_FORM_DATA } from '../../config/constants.js';
import { DUPLICATE_CHARACTER_NAME_ERROR } from '../../config/utils.js';

// Data-load boundary only: fixed arrays with the same shape the wizard
// consumes, so the component tree below it stays fully real. The fixture
// identity must be stable across renders (real consumers keep it in effect
// deps), hence the constant returned from the factory closure.
vi.mock('../../hooks/wizard/useWizardData.js', () => {
  const FIXTURE = {
    backgrounds: [{ name: 'Soldier' }],
    racesData: [
      { name: 'Human', subraces: [], speed: 30, size: 'Medium', languages: ['Common'] },
      { name: 'Elf', subraces: ['High Elf'], speed: 30, size: 'Medium', languages: ['Elvish'] },
    ],
    allRacesData: [{ name: 'Human' }, { name: 'Elf' }],
    classSubtypes: [{ className: 'Fighter', subtypes: [] }],
    allClassesData: [{ name: 'Fighter' }],
    feats: [],
    magicItems: [],
    isDataLoading: false,
  };
  return { default: () => FIXTURE };
});

const jsonResponse = (body) => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

beforeEach(() => {
  global.fetch = vi.fn((path) => {
    if (path === '/data/alignments.json') {
      return jsonResponse(['Lawful Good', 'True Neutral', 'Chaotic Evil']);
    }
    return jsonResponse([]);
  });
});

function renderWizard(props = {}) {
  const onComplete = vi.fn();
  const onCancel = vi.fn();
  render(
    <CharacterCreationWizard
      onComplete={onComplete}
      onCancel={onCancel}
      allClasses={[]}
      characterData={null}
      isEditing={false}
      campaignName="test-campaign"
      existingCharacters={[]}
      {...props}
    />
  );
  return { onComplete };
}

describe('CharacterCreationWizard - Integration', () => {
  it('walks the create flow: ruleset selection enters step 2, Next stays blocked without a name and advances to Race once valid', async () => {
    renderWizard();

    // Step 1 is the ruleset chooser; step 2 renders only after selecting.
    expect(screen.getByText('Select Rules System')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rules-option-5e'));
    expect(await screen.findByText('Step 2: Basic Information')).toBeInTheDocument();

    // Real basics validator: default empty name blocks Next.
    const next = () => screen.getByRole('button', { name: 'Next' });
    await waitFor(() => expect(next()).toBeDisabled());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Aragorn' } });

    await waitFor(() => expect(next()).toBeEnabled());
    fireEvent.click(next());

    // Step order glue: step 2 walks to step 3 (Race), not any other step.
    expect(await screen.findByText('Step 3: Race')).toBeInTheDocument();
    expect(screen.queryByText('Step 2: Basic Information')).not.toBeInTheDocument();
  });

  it('live duplicate-name guard blocks advancement with the collision error while the name still collides', async () => {
    renderWizard({ existingCharacters: ['Aragorn'] });

    fireEvent.click(screen.getByTestId('rules-option-5e'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Aragorn' } });

    // Visible-text oracle: exact error from utils surfaces inline, and the
    // gate stays shut (assert disabled state — never click a disabled Next).
    expect(await screen.findByText(DUPLICATE_CHARACTER_NAME_ERROR)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByText('Step 3: Race')).not.toBeInTheDocument();
  });

  it('edit flow submits the exact merged payload once every prior step is valid', async () => {
    const characterData = {
      ...cloneDeep(DEFAULT_FORM_DATA),
      id: 'edgin-1',
      name: 'Edgin',
      rules: '5e',
    };
    const { onComplete } = renderWizard({
      characterData,
      isEditing: true,
    });

    // Sidebar jumps to the last visible step only after the full validity
    // prefix passes (real getStepEnabled / isSaveEnabled wiring).
    const specialTab = await screen.findByRole('button', { name: /Special Actions/ });
    await waitFor(() => expect(specialTab).toBeEnabled());
    fireEvent.click(specialTab);

    // Reaching canonical step 17 flips the footer to the submit button.
    const save = await screen.findByRole('button', { name: 'Save Changes' });
    fireEvent.click(save);

    // Exact payload, byte-for-byte: the full merged form state, untouched
    // by navigation, including the passed-through id.
    const expected = cloneDeep(characterData);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith(expected);
  });
});
