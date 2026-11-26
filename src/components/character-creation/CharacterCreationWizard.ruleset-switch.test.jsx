// @maintained-by-ai 2026-11-19
/**
 * Ruleset-switch guard wiring (roadmap Item 2) through the REAL wizard tree.
 *
 * The keep/drop CLASSIFICATION matrix is pinned in
 * services/character/rulesetSwitchPreview.test.js; here we pin only the
 * wizard seam: the click on a ruleset card arms the confirm modal naming live
 * rows (built by the real classifier over real public/data JSON served
 * through the fetch stub), Cancel mutates nothing, and Confirm applies the
 * previewed keep/drop ledger — verified where the data actually surfaces:
 * the Feats step shows the kept feat ticked and the dropped ones gone.
 *
 * Boundaries mocked exactly like CharacterCreationWizard.integration.test.jsx
 * (useWizardData fixture); everything below the click stays real.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';

import realSpells2024 from '../../../public/data/2024/spells.json';
import realSpells5e from '../../../public/data/spells.json';
import realFeats2024 from '../../../public/data/2024/feats.json';
import realFeats5e from '../../../public/data/feats.json';
import realClasses2024 from '../../../public/data/2024/classes.json';
import realClasses5e from '../../../public/data/classes.json';
import realBackgrounds2024 from '../../../public/data/2024/backgrounds.json';
import realRulesValidation from '../../../public/data/rules-validation.json';
import realRulesValidation2024 from '../../../public/data/2024/rules-validation.json';
import realRaces5e from '../../../public/data/races.json';
import realRaces2024 from '../../../public/data/2024/races.json';

vi.mock('../../hooks/wizard/useWizardData.js', () => {
  const FIXTURE = {
    backgrounds: [{ index: 'soldier', name: 'Soldier' }],
    racesData: [
      { name: 'Human', subraces: [], speed: 30, size: 'Medium', languages: ['Common'] },
      { name: 'Elf', subraces: ['High Elf'], speed: 30, size: 'Medium', languages: ['Elvish'] },
    ],
    allRacesData: [{ name: 'Human' }, { name: 'Elf' }],
    classSubtypes: [{ className: 'Fighter', subtypes: [] }],
    allClassesData: [{ name: 'Fighter' }],
    feats: [{ index: 'actor', name: 'Actor' }, { index: 'mobile', name: 'Mobile' }, { index: 'alert', name: 'Alert' }],
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

// Real ruleset data through the shared dataLoader's fetch lane, so the
// classification under test runs over the same bytes the app ships.
const REAL_DATA = {
  '/data/2024/spells.json': realSpells2024,
  '/data/spells.json': realSpells5e,
  '/data/2024/feats.json': realFeats2024,
  '/data/feats.json': realFeats5e,
  '/data/2024/classes.json': realClasses2024,
  '/data/classes.json': realClasses5e,
  '/data/2024/backgrounds.json': realBackgrounds2024,
  '/data/rules-validation.json': realRulesValidation,
  '/data/2024/rules-validation.json': realRulesValidation2024,
  // getFeatLimits' Versatile-race lane (2024 Human Origin-feat slot at
  // level 1) reads the shipped races too.
  '/data/races.json': realRaces5e,
  '/data/2024/races.json': realRaces2024,
  '/data/alignments.json': ['Lawful Good', 'True Neutral', 'Chaotic Evil'],
};

beforeEach(() => {
  global.fetch = vi.fn((path) => jsonResponse(REAL_DATA[path] ?? []));
});

function renderWizard() {
  const utils = render(
    <CharacterCreationWizard
      onComplete={vi.fn()}
      onCancel={vi.fn()}
      allClasses={[]}
      characterData={null}
      isEditing={false}
      campaignName="test-campaign"
      existingCharacters={[]}
    />
  );
  return utils;
}

const next = () => screen.getByRole('button', { name: 'Next' });
const previous = () => screen.getByRole('button', { name: 'Previous' });

async function clickNextWhenEnabled() {
  await waitFor(() => expect(next()).toBeEnabled());
  fireEvent.click(next());
}

// 5e create flow: nothing selected yet — the ruleset card applies directly
// (no choices can vanish, no modal arms — the byte-identical old lane for a
// fresh draft), then a name unlocks the walk to the Feats step (canonical 8).
async function walkToFeats5e() {
  renderWizard();
  fireEvent.click(screen.getByTestId('rules-option-5e'));
  await screen.findByText('Step 2: Basic Information');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Aragorn' } });
  await clickNextWhenEnabled(); // → Race
  await clickNextWhenEnabled(); // → Subrace
  await clickNextWhenEnabled(); // → Class (5e walk skips Background)
  await clickNextWhenEnabled(); // → Subclass
  await clickNextWhenEnabled(); // → Feats
  await screen.findByText('Step 7: Feats');
}

function featItem(name) {
  return Array.from(document.querySelectorAll('.feat-item'))
    .find(el => el.querySelector('.list-item-name')?.textContent.includes(name));
}

function tickFeat(name) {
  fireEvent.click(featItem(name).querySelector('.list-item-checkbox'));
}

const featIsTicked = (name) => Boolean(featItem(name)?.querySelector('.list-item-checkbox.checked'));

describe('CharacterCreationWizard — ruleset-switch confirm guard', () => {
  it('fresh draft with no selections: the card switches straight through, no modal', async () => {
    renderWizard();
    fireEvent.click(screen.getByTestId('rules-option-5e'));
    await screen.findByText('Step 2: Basic Information');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicking the already-selected ruleset card changes nothing (no wipe, no jump)', async () => {
    renderWizard();
    fireEvent.click(screen.getByTestId('rules-option-5e'));
    await screen.findByText('Step 2: Basic Information');
    fireEvent.click(previous());
    await screen.findByText('Select Rules System');

    fireEvent.click(screen.getByTestId('rules-option-5e'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Still parked on the ruleset step — no silent reset to Basic.
    expect(screen.getByText('Select Rules System')).toBeInTheDocument();
  });

  it('switching with selected feats arms a confirm modal naming exactly what is kept vs dropped and why', async () => {
    await walkToFeats5e();
    tickFeat('Actor');
    tickFeat('Mobile');
    tickFeat('Alert');
    expect(featIsTicked('Actor')).toBe(true);

    // Back to the ruleset step (5e walk: Feats→Subclass→Class→Subrace→Race→Basic→Ruleset).
    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(previous());
    }
    await screen.findByText('Select Rules System');

    fireEvent.click(screen.getByTestId('rules-option-2024'));

    const dialog = await screen.findByRole('dialog');
    // Byte-honest, data-derived copy: Alert has no 2024 prerequisite → kept;
    // Actor is a 4th-level feat on a level-1 draft → dropped with its reason;
    // Mobile was retired from the 2024 data → dropped as missing.
    expect(dialog).toHaveTextContent('Switch to 2024 Rules?');
    expect(dialog).toHaveTextContent('1 kept, 2 removed');
    expect(dialog.querySelector('.ruleset-switch-group')).toBeTruthy();
    const dialogText = dialog.textContent;
    expect(dialogText).toContain('Alert');
    expect(dialogText).toContain('kept');
    expect(dialogText).toContain('not in the 2024 Rules feat data');
    // Cancel stays inert; confirm carries the house action label.
    expect(screen.getByRole('button', { name: 'Yes, switch ruleset' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // Still on the ruleset step underneath: nothing has mutated yet.
    expect(screen.getByText('Select Rules System')).toBeInTheDocument();
  });

  it('Cancel closes the dialog inertly: old ruleset, wizard parked on the ruleset step', async () => {
    await walkToFeats5e();
    tickFeat('Actor');
    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(previous());
    }
    await screen.findByText('Select Rules System');

    fireEvent.click(screen.getByTestId('rules-option-2024'));
    await screen.findByRole('dialog');
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Select Rules System')).toBeInTheDocument();
    // Ruleset is still 5e: the Background sidebar tab only exists under 2024.
    expect(screen.queryByRole('button', { name: /Background/ })).not.toBeInTheDocument();
    // And the selection survived the aborted switch.
    for (let i = 0; i < 6; i += 1) {
      await clickNextWhenEnabled();
    }
    await screen.findByText('Step 7: Feats');
    expect(featIsTicked('Actor')).toBe(true);
  });

  it('Confirm re-validates the whole draft: kept feat stays ticked, dropped feats are gone, wizard restarts at Basic', async () => {
    await walkToFeats5e();
    tickFeat('Actor');
    tickFeat('Mobile');
    tickFeat('Alert');
    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(previous());
    }
    await screen.findByText('Select Rules System');

    fireEvent.click(screen.getByTestId('rules-option-2024'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('kept');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, switch ruleset' }));

    // Lands on Basic Information with the ruleset flipped (Background tab now
    // part of the 2024 walk) and no dialog behind.
    await screen.findByText('Step 2: Basic Information');
    expect(screen.getByDisplayValue('Aragorn')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Background/ })).toBeInTheDocument();

    // Walk the 2024 flow (Race→Subrace→Background→Class→Subclass→Feats).
    await clickNextWhenEnabled(); // → Race
    await clickNextWhenEnabled(); // → Subrace
    await clickNextWhenEnabled(); // → Background
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'Soldier' } });
    await clickNextWhenEnabled(); // → Class
    await clickNextWhenEnabled(); // → Subclass
    await clickNextWhenEnabled(); // → Feats
    await screen.findByText('Step 8: Feats');

    // The confirmed ledger is the state: exactly the classified rows survive
    // (the pre-existing draft name was preserved — asserted on the Basic
    // step above, where it lives).
    expect(featIsTicked('Alert')).toBe(true);
    expect(featIsTicked('Actor')).toBe(false);
    expect(featIsTicked('Mobile')).toBe(false);
  });
});
