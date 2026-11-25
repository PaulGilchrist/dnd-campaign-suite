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
import { generateQuickBuildDraft } from '../../services/character/quickBuildService.js';
import { DUPLICATE_CHARACTER_NAME_ERROR, CHARACTER_NAME_REQUIRED_ERROR, RULESET_REQUIRED_ERROR } from '../../config/utils.js';

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

// Quick-build boundary: the service itself is unit-tested against the real
// rules data (quickBuildService.test.js); here we pin only WHEN the wizard
// calls it (quick mode, step 7, race+class chosen) and that its draft lands
// in formData for the review steps.
vi.mock('../../services/character/quickBuildService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateQuickBuildDraft: vi.fn(async (formData) => ({
      ...formData,
      class: { ...formData.class, subclass: { name: 'Champion' }, fightingStyles: ['Defense'] },
      abilities: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map((name, i) => ({
        name, baseScore: [15, 14, 13, 10, 12, 8][i], featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0,
      })),
      skillProficiencies: ['Athletics', 'Acrobatics', 'Arcana', 'Animal Handling'],
      languages: ['Common', 'Dwarvish'],
      spells: [],
      feats: [],
      resistances: [],
      immunities: [],
      toolProficiencies: [],
      expertSkills: [],
      inventory: { backpack: ["Dungeoneer's Pack"], equipped: ['Chain Mail', 'Longsword', 'Shield'], gold: 40, magicItems: [] },
    })),
  };
});

const jsonResponse = (body) => Promise.resolve({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
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

  // Step-1 ruleset gate (parity with the step-2 name gate, backlog 2026-10-28-P):
  // a fresh create has NO ruleset (useState seeds from characterData?.rules =
  // null even though formData.rules defaults to '5e'), so the step itself shows
  // the inline hint and Next is disabled; sidebar tabs + Save stay locked.
  it('create flow: ruleset step hard-gates Next with an inline hint until a card is picked', async () => {
    renderWizard();
    const next = () => screen.getByRole('button', { name: 'Next' });

    expect(await screen.findByText(RULESET_REQUIRED_ERROR)).toBeInTheDocument();
    await waitFor(() => expect(next()).toBeDisabled());
    // Sidebar lane (already gated via step1Valid — pinned so it cannot regress):
    // later tabs and Save stay locked with no ruleset.
    expect(screen.getByRole('button', { name: /Basic Information/ })).toBeDisabled();
    expect(document.querySelector('.sidebar-save')).toBeDisabled();

    // Picking a card clears the hint and auto-advances to Step 2.
    fireEvent.click(screen.getByTestId('rules-option-5e'));
    expect(await screen.findByText('Step 2: Basic Information')).toBeInTheDocument();
    expect(screen.queryByText(RULESET_REQUIRED_ERROR)).not.toBeInTheDocument();

    // Back on step 1 with the ruleset chosen: hint gone, Next re-enabled,
    // sidebar unlocked.
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Select Rules System')).toBeInTheDocument();
    expect(screen.queryByText(RULESET_REQUIRED_ERROR)).not.toBeInTheDocument();
    await waitFor(() => expect(next()).toBeEnabled());
    expect(screen.getByRole('button', { name: /Basic Information/ })).toBeEnabled();
  });

  it('live duplicate-name guard blocks advancement with the collision error while the name still collides', async () => {
    renderWizard({ existingCharacters: ['Aragorn'] });

    fireEvent.click(screen.getByTestId('rules-option-5e'));
    // The ruleset switch classifies the draft against the target ruleset's
    // data first (Item 2 guard), so step 2 lands a tick later — await it.
    const nameInput = await screen.findByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'Aragorn' } });

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

    // Non-last edit steps carry NO submit in the footer — neither the
    // edit-mode Save Changes nor the create-mode Create Character.
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();

    fireEvent.click(specialTab);

    // Reaching canonical step 17 flips the footer to the submit button —
    // the edit-mode twin of create-mode's Create Character, enabled exactly
    // while the sidebar ✓ Save is.
    const save = await screen.findByRole('button', { name: 'Save Changes' });
    expect(save).toBeEnabled();
    expect(document.querySelector('.sidebar-save')).toBeEnabled();
    fireEvent.click(save);

    // Exact payload, byte-for-byte: the full merged form state, untouched
    // by navigation, including the passed-through id.
    const expected = cloneDeep(characterData);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith(expected);
  });

  it('edit flow: clearing the name shows a live inline required-hint and keeps ✓ Save disabled until a valid name is typed', async () => {
    const characterData = {
      ...cloneDeep(DEFAULT_FORM_DATA),
      id: 'edgin-1',
      name: 'Edgin',
      rules: '5e',
    };
    renderWizard({ characterData, isEditing: true });

    // Open prefilled: no hint, sidebar ✓ Save enabled.
    const nameInput = await screen.findByDisplayValue('Edgin');
    const saveBtn = () => document.querySelector('.sidebar-save');
    await waitFor(() => expect(saveBtn()).toBeEnabled());
    expect(screen.queryByText(CHARACTER_NAME_REQUIRED_ERROR)).not.toBeInTheDocument();

    // Whitespace-only counts as empty: hint appears next to the input,
    // Save stays disabled (existing gate, unchanged).
    fireEvent.change(nameInput, { target: { value: '   ' } });
    expect(await screen.findByText(CHARACTER_NAME_REQUIRED_ERROR)).toBeInTheDocument();
    expect(nameInput.closest('.form-group').querySelector('.error-message')).toHaveTextContent(CHARACTER_NAME_REQUIRED_ERROR);
    expect(saveBtn()).toBeDisabled();

    // Valid name → hint clears immediately, Save re-arms.
    fireEvent.change(nameInput, { target: { value: 'Edgin' } });
    await waitFor(() => expect(screen.queryByText(CHARACTER_NAME_REQUIRED_ERROR)).not.toBeInTheDocument());
    await waitFor(() => expect(saveBtn()).toBeEnabled());
  });

  it('create flow: pristine empty name on the Basic step shows NO error until first touch', async () => {
    renderWizard();

    fireEvent.click(screen.getByTestId('rules-option-5e'));
    const nameInput = await screen.findByRole('textbox');
    const next = () => screen.getByRole('button', { name: 'Next' });

    // Arrival at Step 2 with an untouched empty name: no red hint, no error
    // styling. The retired eager-validations self-fired the required error
    // ~300 ms after arrival — sample at 0 ms and past that window.
    expect(screen.queryByText(CHARACTER_NAME_REQUIRED_ERROR)).not.toBeInTheDocument();
    expect(nameInput).not.toHaveClass('error');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByText(CHARACTER_NAME_REQUIRED_ERROR)).not.toBeInTheDocument();
    // Advancement is still hard-gated (unchanged lane, just silent).
    await waitFor(() => expect(next()).toBeDisabled());

    // First blur with the field still empty arms the hint; Next stays shut.
    fireEvent.blur(nameInput);
    expect(await screen.findByText(CHARACTER_NAME_REQUIRED_ERROR)).toBeInTheDocument();
    expect(nameInput.closest('.form-group').querySelector('.error-message')).toHaveTextContent(CHARACTER_NAME_REQUIRED_ERROR);
    expect(nameInput).toHaveClass('error');
    expect(next()).toBeDisabled();
  });

  it('create flow: typing then clearing the name shows the required hint, a valid name clears it', async () => {
    renderWizard();

    fireEvent.click(screen.getByTestId('rules-option-5e'));
    const nameInput = await screen.findByRole('textbox');
    const next = () => screen.getByRole('button', { name: 'Next' });

    fireEvent.change(nameInput, { target: { value: 'Aragorn' } });
    await waitFor(() => expect(next()).toBeEnabled());
    expect(screen.queryByText(CHARACTER_NAME_REQUIRED_ERROR)).not.toBeInTheDocument();

    // Clearing after interaction re-arms the required hint immediately.
    fireEvent.change(nameInput, { target: { value: '' } });
    expect(await screen.findByText(CHARACTER_NAME_REQUIRED_ERROR)).toBeInTheDocument();
    await waitFor(() => expect(next()).toBeDisabled());
  });
});

// Quick build wiring lane: mode toggle on the ruleset step, draft applied
// ONCE on arrival at step 7 (race + class chosen), custom path never calls
// the service. Draft contents themselves are pinned in quickBuildService.test.js.
describe('CharacterCreationWizard - quick build wiring', () => {
  async function walkToSubclassStep({ quick }) {
    renderWizard();
    if (quick) {
      fireEvent.click(screen.getByTestId('build-mode-quick'));
    }
    fireEvent.click(screen.getByTestId('rules-option-5e'));
    const nameInput = await screen.findByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'Aragorn' } });

    const next = () => screen.getByRole('button', { name: 'Next' });
    await waitFor(() => expect(next()).toBeEnabled());
    fireEvent.click(next()); // → Race

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'Human' } });
    await waitFor(() => expect(next()).toBeEnabled());
    fireEvent.click(next()); // → Subrace (Human has none in the fixture)
    await waitFor(() => expect(next()).toBeEnabled());
    fireEvent.click(next()); // → Class (fixture default is Fighter)
    await waitFor(() => expect(next()).toBeEnabled());
    fireEvent.click(next()); // → Subclass / Major (fixture Fighter has none)
  }

  beforeEach(() => {
    generateQuickBuildDraft.mockClear();
  });

  it('quick mode applies the derived draft on the subclass step and the review steps show it', async () => {
    await walkToSubclassStep({ quick: true });

    await waitFor(() => expect(generateQuickBuildDraft).toHaveBeenCalledTimes(1));
    // The draft arrives merged with the user's choices, not a blank form.
    const seed = generateQuickBuildDraft.mock.calls[0][0];
    expect(seed.name).toBe('Aragorn');
    expect(seed.race.name).toBe('Human');
    expect(seed.class.name).toBe('Fighter');

    // Review mode: walk Feats → Ability Scores and see prefilled scores.
    const next = () => screen.getByRole('button', { name: 'Next' });
    fireEvent.click(next());
    fireEvent.click(next());
    await waitFor(() => expect(screen.getAllByDisplayValue('15').length).toBeGreaterThan(0));
  });

  it('custom mode never invokes the quick-build service', async () => {
    await walkToSubclassStep({ quick: false });

    expect(generateQuickBuildDraft).not.toHaveBeenCalled();

    const next = () => screen.getByRole('button', { name: 'Next' });
    fireEvent.click(next());
    fireEvent.click(next());
    // Untouched blank wizard: every base score still at the 8 default.
    expect(await screen.findByText(/Ability Scores/)).toBeInTheDocument();
    expect(screen.queryAllByDisplayValue('15')).toHaveLength(0);
  });
});
