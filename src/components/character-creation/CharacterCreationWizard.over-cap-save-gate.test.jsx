// @maintained-by-ai
/**
 * Regression lock for the Save-gate belt of
 * `bug-ruleset-switch-ledger-persists-overcap-feats-skills`.
 *
 * Live bug face: an EDIT-mode wizard loaded a saved 5e level-1 draft whose
 * Feats step honestly printed "You have selected 1 of 0 allowed feat(s)" and
 * whose Skills step printed "3 of 2 allowed skill proficiency/ies" — and the
 * sidebar ✓ Save stayed ENABLED, persisting the invalid build to the
 * character file with 200 PUTs, forever re-savable.
 *
 * Pinned here through the real wizard tree (harness mirrors
 * CharacterCreationWizard.edit-ruleset-switch.test.jsx — real classifier/
 * validators over real public/data bytes):
 *  1. a loaded over-cap draft DISABLES the sidebar Save (both lanes feed
 *     the same validators the steps gate Next on — FT-002 parity between
 *     live selection and loaded state);
 *  2. fixing only the feat lane keeps Save gated (the skill row is still
 *     3-of-2 — the half-fix is not an escape hatch);
 *  3. once both lanes sit within cap, Save re-enables and the payload that
 *     reaches the edit-save PUT lane is clean.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import cloneDeep from 'lodash/cloneDeep';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import { DEFAULT_FORM_DATA } from '../../config/constants.js';

import realFeats5e from '../../../public/data/feats.json';
import realClasses5e from '../../../public/data/classes.json';
import realRaces5e from '../../../public/data/races.json';
import realRulesValidation from '../../../public/data/rules-validation.json';
import realAbilityScores from '../../../public/data/ability-scores.json';

vi.mock('../../hooks/wizard/useWizardData.js', () => {
  const FIXTURE = {
    backgrounds: [],
    racesData: [{ name: 'Human', subraces: [], speed: 30, size: 'Medium', languages: ['Common'] }],
    allRacesData: [{ name: 'Human' }],
    classSubtypes: [{ className: 'Fighter', subtypes: [] }],
    allClassesData: [{ name: 'Fighter' }],
    feats: [{ index: 'savage-attacker', name: 'Savage Attacker' }],
    magicItems: [],
    isDataLoading: false,
  };
  return { default: () => FIXTURE };
});

const jsonResponse = (body) => Promise.resolve({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: () => Promise.resolve(body),
});

const REAL_DATA = {
  '/data/feats.json': realFeats5e,
  '/data/classes.json': realClasses5e,
  '/data/races.json': realRaces5e,
  '/data/rules-validation.json': realRulesValidation,
  '/data/ability-scores.json': realAbilityScores,
  '/data/alignments.json': ['Lawful Good', 'True Neutral', 'Chaotic Evil'],
};

beforeEach(() => {
  global.fetch = vi.fn((path) => jsonResponse(REAL_DATA[path] ?? []));
});

// The exact shape witnessed live: a 5e level-1 Fighter carrying the 2024
// origin feat row plus the Soldier-folded third skill (the state the
// un-fixed ledger used to leave behind).
const OVER_CAP_CHARACTER = {
  ...cloneDeep(DEFAULT_FORM_DATA),
  id: 'over-cap-probe-1',
  name: 'OverCapProbe',
  rules: '5e',
  level: 1,
  alignment: 'True Neutral',
  race: { name: 'Human', subrace: { name: '' } },
  class: { name: 'Fighter', subclass: { name: 'Champion' }, divineOrder: '', primalOrder: '' },
  background: '',
  feats: ['Savage Attacker'],
  skillProficiencies: ['Athletics', 'Acrobatics', 'Intimidation'],
};

function renderEditWizard() {
  const onComplete = vi.fn();
  const utils = render(
    <CharacterCreationWizard
      onComplete={onComplete}
      onCancel={vi.fn()}
      allClasses={[]}
      characterData={cloneDeep(OVER_CAP_CHARACTER)}
      isEditing={true}
      campaignName="test-campaign"
      existingCharacters={[]}
    />
  );
  return { onComplete, ...utils };
}

const saveButton = () => document.querySelector('.sidebar-save');

const featItem = (name) =>
  Array.from(document.querySelectorAll('.feat-item'))
    .find(el => el.querySelector('.list-item-name')?.textContent.includes(name));

function goToStep(name) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
}

function skillCheckbox(name) {
  const label = Array.from(document.querySelectorAll('.multi-select-item'))
    .find(el => el.textContent.trim().startsWith(name));
  return label?.querySelector('input[type=checkbox]');
}

describe('CharacterCreationWizard — loaded over-cap feats/skills gate the Save lane', () => {
  it('loaded 1-of-0 feats + 3-of-2 skills: Save is disabled, and one lane at a time must be repaired', async () => {
    const { onComplete } = renderEditWizard();
    await screen.findByText('Step 2: Basic Information');

    // The belt lands async (same validators, same fetch lane the steps use).
    await waitFor(() => expect(saveButton()).toBeDisabled());

    // Feat lane face is real: the step still renders the row as selected.
    goToStep('Feats');
    await screen.findByText('Step 7: Feats');
    expect(featItem('Savage Attacker').querySelector('.list-item-checkbox.checked')).toBeTruthy();

    // Deselect the over-cap feat…
    fireEvent.click(featItem('Savage Attacker').querySelector('.list-item-checkbox'));
    await waitFor(() => expect(featItem('Savage Attacker').querySelector('.list-item-checkbox.checked')).toBeNull());
    // …Save stays GATED — the skill lane is still 3 selected of 2 allowed.
    await waitFor(() => expect(saveButton()).toBeDisabled());

    // Skill lane: render the honest 3-of-2 counter, then deselect one.
    goToStep('Skill Proficiencies');
    await screen.findByText('Step 9: Skill Proficiencies');
    expect(document.querySelector('.skill-count-summary').textContent.replace(/\s+/g, ' '))
      .toMatch(/selected 3 of 2 allowed skill proficiency/);
    fireEvent.click(skillCheckbox('Intimidation'));

    // Both lanes within cap → the ladder's Save gate opens again.
    await waitFor(() => expect(saveButton()).toBeEnabled());
    fireEvent.click(saveButton());

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const payload = onComplete.mock.calls[0][0];
    expect(payload.feats).toEqual([]);
    expect(payload.skillProficiencies).toEqual(['Athletics', 'Acrobatics']);
  });

  it('control: a compliant loaded draft (0 feats of 0, 2 skills of 2) saves freely on the plain ladder', async () => {
    const onComplete = vi.fn();
    render(
      <CharacterCreationWizard
        onComplete={onComplete}
        onCancel={vi.fn()}
        allClasses={[]}
        characterData={cloneDeep({
          ...cloneDeep(OVER_CAP_CHARACTER),
          feats: [],
          skillProficiencies: ['Athletics', 'Acrobatics'],
        })}
        isEditing={true}
        campaignName="test-campaign"
        existingCharacters={[]}
      />
    );
    await screen.findByText('Step 2: Basic Information');
    // No false gate: the belt settles clean and Save rides the plain ladder.
    await waitFor(() => expect(saveButton()).toBeEnabled());
    fireEvent.click(saveButton());
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('footer Save Changes on the last step mirrors the sidebar ✓ Save gate exactly', async () => {
    const { onComplete } = renderEditWizard();
    await screen.findByText('Step 2: Basic Information');
    await waitFor(() => expect(saveButton()).toBeDisabled());

    // The ladder (steps 1-7) is VALID here — only the caps belt blocks —
    // so the last-step tab is reachable and the footer renders its submit.
    const specialTab = await screen.findByRole('button', { name: /Special Actions/ });
    await waitFor(() => expect(specialTab).toBeEnabled());
    fireEvent.click(specialTab);

    const footerSave = await screen.findByRole('button', { name: 'Save Changes' });
    // Same gate: both disabled, and the caps-only block names NO ladder
    // cause on either control (sidebar parity — it owns no title here).
    expect(footerSave).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    expect(footerSave).not.toHaveAttribute('title');
    expect(saveButton()).not.toHaveAttribute('title');

    // Repair the feat lane (the loaded skill row was already 3-of-2; the
    // sibling test owns the full repair walk) — re-derive via deselect here
    // too so BOTH gates flip together with zero extra clicks in between.
    goToStep('Feats');
    await screen.findByText('Step 7: Feats');
    fireEvent.click(featItem('Savage Attacker').querySelector('.list-item-checkbox'));
    goToStep('Skill Proficiencies');
    await screen.findByText('Step 9: Skill Proficiencies');
    fireEvent.click(skillCheckbox('Intimidation'));
    await waitFor(() => expect(saveButton()).toBeEnabled());

    goToStep('Special Actions');
    const armed = await screen.findByRole('button', { name: 'Save Changes' });
    expect(armed).toBeEnabled();
    fireEvent.click(armed);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const payload = onComplete.mock.calls[0][0];
    expect(payload.feats).toEqual([]);
    expect(payload.skillProficiencies).toEqual(['Athletics', 'Acrobatics']);
  });
});
