// @maintained-by-ai
/**
 * Edit-mode ruleset-switch lane (RG 2026-11-19 backlog, owner ruling
 * 2026-11-19): a SAVED character reaches the Ruleset step through the sidebar
 * (the old isEditing hide-lane is dead — getVisibleSteps carries the same
 * index for both flows) and switches through the SAME keep/remove ledger as
 * fresh builds, computed from the saved character's rows.
 *
 * Pins here (mirror of CharacterCreationWizard.ruleset-switch.test.jsx for
 * fresh builds):
 *  (a) edit-mode Ruleset-step visibility + arrival on Basic Information with
 *      the character's current `rules` pre-selected + step navigable;
 *  (b) the ledger modal is built from the SAVED-character shape (string
 *      spells/feats + background exactly as the char files store them),
 *      classified over the real public/data JSON; Cancel stays fully inert;
 *  (c) the apply/swap seam: after Confirm, the existing edit-save lane
 *      (✓ Save → onComplete) writes the flipped `rules` field plus exactly
 *      the ledger's kept rows — dropped spells/feats/background are gone
 *      from the payload the PUT persists.
 *
 * Harness mirrors the fresh-build lane exactly (real classifier + data files
 * through the fetch stub; useWizardData fixture). Everything below the click
 * stays real.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import cloneDeep from 'lodash/cloneDeep';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import { DEFAULT_FORM_DATA } from '../../config/constants.js';

import realSpells2024 from '../../../public/data/2024/spells.json';
import realSpells5e from '../../../public/data/spells.json';
import realFeats2024 from '../../../public/data/2024/feats.json';
import realFeats5e from '../../../public/data/feats.json';
import realClasses2024 from '../../../public/data/2024/classes.json';
import realClasses5e from '../../../public/data/classes.json';
import realBackgrounds2024 from '../../../public/data/2024/backgrounds.json';
import realRulesValidation from '../../../public/data/rules-validation.json';
import realRulesValidation2024 from '../../../public/data/2024/rules-validation.json';

vi.mock('../../hooks/wizard/useWizardData.js', () => {
  const FIXTURE = {
    backgrounds: [{ index: 'soldier', name: 'Soldier' }],
    racesData: [{ name: 'Human', subraces: [], speed: 30, size: 'Medium', languages: ['Common'] }],
    allRacesData: [{ name: 'Human' }],
    classSubtypes: [{ className: 'Wizard', subtypes: [{ name: 'Evoker' }] }],
    allClassesData: [{ name: 'Wizard' }],
    feats: [{ index: 'alert', name: 'Alert' }, { index: 'lucky', name: 'Lucky' }],
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
  '/data/2024/spells.json': realSpells2024,
  '/data/spells.json': realSpells5e,
  '/data/2024/feats.json': realFeats2024,
  '/data/feats.json': realFeats5e,
  '/data/2024/classes.json': realClasses2024,
  '/data/classes.json': realClasses5e,
  '/data/2024/backgrounds.json': realBackgrounds2024,
  '/data/rules-validation.json': realRulesValidation,
  '/data/2024/rules-validation.json': realRulesValidation2024,
  '/data/alignments.json': ['Lawful Good', 'True Neutral', 'Chaotic Evil'],
};

beforeEach(() => {
  global.fetch = vi.fn((path) => jsonResponse(REAL_DATA[path] ?? []));
});

// A SAVED 2024 character in the exact shape the campaign char files store
// (string spells/feats rows, plain background name — cf. the baseline files).
const SAVED_CHARACTER = {
  ...cloneDeep(DEFAULT_FORM_DATA),
  id: 'ledger-rider-1',
  name: 'LedgerRider',
  rules: '2024',
  level: 1,
  alignment: 'Lawful Good',
  race: { name: 'Human', subrace: { name: '' } },
  class: { name: 'Wizard', subclass: { name: 'Evoker' }, divineOrder: '', primalOrder: '' },
  background: 'Soldier',
  spells: ['Fire Bolt', 'Magic Missile', 'Elementalism'],
  // Alert + the retired-in-5e boon are explicit rows; Savage Attacker is the
  // Soldier grant row the draft materialises on mount (getPreSelectedFeats),
  // exactly the face a fresh build with the same picks carries into the ledger.
  feats: ['Alert', 'Savage Attacker', 'Boon Of Combat Prowess'],
};

// A SAVED 5e character with NOTHING the switch ledger ever lists: no spells,
// no feats, no background. Switching it to 2024 leaves `hasSelections` false,
// so the switch COMMITS SILENTLY (no ledger modal) and INSERTS the required
// Background step into the walk — the RH blindside face.
const SAVED_5E_CHARACTER = {
  ...cloneDeep(DEFAULT_FORM_DATA),
  id: 'cause-hint-1',
  name: 'CauseHintRider',
  rules: '5e',
  level: 1,
  alignment: 'Lawful Good',
  race: { name: 'Human', subrace: { name: '' } },
  class: { name: 'Wizard', subclass: { name: 'Evoker' }, divineOrder: '', primalOrder: '' },
  background: '',
  spells: [],
  feats: [],
};

function renderEditWizard({ character = SAVED_CHARACTER, ...props } = {}) {
  const onComplete = vi.fn();
  const utils = render(
    <CharacterCreationWizard
      onComplete={onComplete}
      onCancel={vi.fn()}
      allClasses={[]}
      characterData={cloneDeep(character)}
      isEditing={true}
      campaignName="test-campaign"
      existingCharacters={[]}
      {...props}
    />
  );
  return { onComplete, ...utils };
}

const rulesetTab = () => screen.getByRole('button', { name: /Ruleset/ });
const saveButton = () => document.querySelector('.sidebar-save');

async function walkToRulesetStep() {
  renderEditWizard();
  // Arrival is the edit reference: Basic Information, Ruleset visible as tab 1.
  await screen.findByText('Step 2: Basic Information');
  fireEvent.click(rulesetTab());
  await screen.findByText('Select Rules System');
}

describe('CharacterCreationWizard — edit-mode ruleset switch (saved characters)', () => {
  it('edit mode shows the Ruleset step with the saved ruleset pre-selected and the create-only build-mode cards hidden', async () => {
    renderEditWizard();

    // Arrives on Basic Information; the Ruleset tab is part of the sidebar
    // (it carried the old isEditing hide — dead now), numbered 1.
    await screen.findByText('Step 2: Basic Information');
    expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();
    const tab = rulesetTab();
    expect(tab).toBeEnabled();
    expect(tab.textContent).toMatch(/^1Ruleset/);

    // Navigable like fresh builds: click lands on the ruleset step.
    fireEvent.click(tab);
    await screen.findByText('Select Rules System');
    expect(screen.getByTestId('rules-option-2024')).toHaveClass('selected');
    expect(screen.getByTestId('rules-option-5e')).not.toHaveClass('selected');
    // Quick/Custom build entry is a creation-time concept: hidden in edit.
    expect(screen.queryByTestId('build-mode-quick')).not.toBeInTheDocument();
    expect(screen.queryByTestId('build-mode-custom')).not.toBeInTheDocument();
  });

  it('switching away arms the SAME ledger modal, computed from the SAVED rows over the target data', async () => {
    await walkToRulesetStep();

    fireEvent.click(screen.getByTestId('rules-option-5e'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Switch to 5th Edition (5e)?');
    // The feat SLOTS are part of the ledger now: a 5e level-1 build grants
    // zero feats, so even the name-legal Alert/Savage Attacker rows are
    // removed (over-cap) — the switch can no longer persist "1 of 0 allowed".
    expect(dialog).toHaveTextContent('2 kept, 5 removed');
    // Byte-honest classification over the real shipped 5e data: the two
    // Wizard-list spells survive; Elementalism is 2024-only; both no-prereq
    // feats are over-cap; the 2024 boon is retired from 5e; Background is
    // 2024-only.
    expect(dialog).toHaveTextContent('Spells — 2 kept, 1 removed');
    expect(dialog).toHaveTextContent('Feats — 0 kept, 3 removed');
    expect(dialog).toHaveTextContent('Background — 0 kept, 1 removed');
    const text = dialog.textContent;
    expect(text).toContain('Fire Bolt');
    expect(text).toContain('Magic Missile');
    expect(text).toContain('Alert');
    expect(text).toContain('the 5th Edition (5e) grants no feats at level 1');
    expect(text).toContain('Savage Attacker');
    expect(text).toContain('Elementalism');
    expect(text).toContain('not in the 5th Edition (5e) spell data');
    expect(text).toContain('Boon Of Combat Prowess');
    expect(text).toContain('not in the 5th Edition (5e) feat data');
    expect(text).toContain('Soldier');
    expect(text).toContain('the Background step only exists under 2024 Rules');
    // Nothing has mutated underneath: still parked on the ruleset step with
    // the saved ruleset highlighted.
    expect(screen.getByText('Select Rules System')).toBeInTheDocument();
    expect(screen.getByTestId('rules-option-2024')).toHaveClass('selected');
  });

  it('Cancel closes the ledger inertly: saved ruleset untouched, zero writes', async () => {
    const { onComplete } = renderEditWizard();
    await screen.findByText('Step 2: Basic Information');
    fireEvent.click(rulesetTab());
    await screen.findByText('Select Rules System');

    fireEvent.click(screen.getByTestId('rules-option-5e'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The switch never landed: ruleset stays 2024 (Background tab present),
    // the ruleset card still highlights 2024, and no save was requested.
    expect(screen.getByTestId('rules-option-2024')).toHaveClass('selected');
    expect(screen.getByRole('button', { name: /Background/ })).toBeInTheDocument();
    expect(screen.queryByText('Step 2: Basic Information')).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('Confirm applies the ledger and the existing edit-save lane writes the flipped rules + kept rows only', async () => {
    const { onComplete } = renderEditWizard();
    await screen.findByText('Step 2: Basic Information');
    fireEvent.click(rulesetTab());
    await screen.findByText('Select Rules System');

    fireEvent.click(screen.getByTestId('rules-option-5e'));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, switch ruleset' }));

    // Restarts at Basic Information under the new ruleset: the 2024-only
    // Background step drops out of the sidebar.
    await screen.findByText('Step 2: Basic Information');
    expect(screen.queryByRole('button', { name: /Background/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The switch is gated by the ledger modal ALONE — no invented extra
    // confirm tier on the save lane (level is untouched here).
    await waitFor(() => expect(saveButton()).toBeEnabled());
    fireEvent.click(saveButton());

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const payload = onComplete.mock.calls[0][0];
    expect(payload.rules).toBe('5e');
    expect(payload.name).toBe('LedgerRider');
    // Exactly the ledger's kept rows survive; removal-set rows are gone —
    // the over-cap fix means a 5e level-1 build keeps NOTHING from the
    // 2024 feat list (both name-legal rows were removed as over-cap).
    expect(payload.spells).toEqual(['Fire Bolt', 'Magic Missile']);
    expect(payload.feats).toEqual([]);
    expect(payload.background).toBe('');
  });

  // RH 2026-11-24 improvement: the 5e→2024 switch has NOTHING removable, so
  // it commits silently and a never-seen Background step joins the walk —
  // the moment the monotonic ladder blindsides the rider. Every control the
  // ladder disables must NAME the cause instead.
  it('silent 5e→2024 switch: ladder-disabled sidebar steps and Save name the new Background step as the cause', async () => {
    renderEditWizard({ character: SAVED_5E_CHARACTER });
    await screen.findByText('Step 2: Basic Information');
    fireEvent.click(rulesetTab());
    await screen.findByText('Select Rules System');

    fireEvent.click(screen.getByTestId('rules-option-2024'));

    // The Background step appears...
    const backgroundTab = await screen.findByRole('button', { name: /Background/ });
    // ...and with nothing removable the switch committed silently — no ledger
    // dialog ever opened, and the behavior itself is untouched.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The blocking step itself stays navigable (that is where the fix lives).
    expect(backgroundTab).toBeEnabled();
    expect(backgroundTab).not.toHaveAttribute('title');

    // Every step AFTER it, and Save, wait on Background — and say so.
    const cause = 'Complete "Background" first';
    await waitFor(() => expect(saveButton()).toHaveAttribute('title', cause));
    expect(screen.getByRole('button', { name: /Class/ })).toHaveAttribute('title', cause);
    expect(screen.getByRole('button', { name: /Spells/ })).toHaveAttribute('title', cause);
    expect(screen.getByRole('button', { name: /Special Actions/ })).toHaveAttribute('title', cause);
    // Earlier valid-prefix steps carry no misleading title.
    expect(screen.getByRole('button', { name: /Basic Information/ })).not.toHaveAttribute('title');

    // Picking a background re-arms the ladder: the steps unlock and every
    // cause title is gone.
    fireEvent.click(backgroundTab);
    await screen.findByText('Step 5: Background');
    // The step's `<label>Background *</label>` is a sibling (not a wrapper),
    // so there is no programmatic association — target the select itself.
    fireEvent.change(document.querySelector('.wizard-step-background select'), { target: { value: 'Soldier' } });

    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(saveButton()).not.toHaveAttribute('title');
    expect(screen.getByRole('button', { name: /Spells/ })).not.toHaveAttribute('title');
    expect(screen.getByRole('button', { name: /Special Actions/ })).not.toHaveAttribute('title');
  });
});
