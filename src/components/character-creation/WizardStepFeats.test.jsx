// @maintained-by-ai
// WizardStepFeats owns: the feat-step wiring over SelectableList (SelectableList.test.jsx
// owns the shared list/search/toggle internals), the exact onArrayFieldChange payloads
// through this component's checkbox/Add Another/Remove One controls, the selection-count
// summary sentence, the pre-selected lock (this component's DOM guards), the
// repeatable-badge/Remove-One gates (RepeatableFeatActions lives here), the
// computedBuffs summary, warning display, and the 2024 Versatile-trait panel.
// Prereq/description rendering rules live in FeatItemDetails; prerequisite *formats on
// disk are dict-or-null only (public/data/2024/feats.json), so fixtures stay disk-faithful.
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepFeats from './WizardStepFeats.jsx';
import * as featValidation from '../../services/character/featValidation.js';

// Async rule services hit the network via dataLoader — mocked with disk-faithful
// outputs for level 8 '2024' (public/data/rules-validation.json feats.available_levels
// [4,8,12,16,19] → allowed 2; details copied verbatim from featValidation.getFeatLimits).
// normalizeFeatDescription is pure and stays REAL via importActual.
vi.mock('../../services/character/featValidation.js', async (importActual) => ({
  ...(await importActual()),
  validateFeats: vi.fn(async () => []),
  getFeatLimits: vi.fn(async () => ({
    allowed: 2,
    originRequired: true,
    details: 'Level 1 2024 characters get 1 Origin feat from their background, plus additional feats at levels 4, 8, 12, 16, 19',
  })),
  getRaceFeatChoices: vi.fn(async () => []),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

// Per-feat buff math is owned by featBuffService's own test suites; keep it inert here.
vi.mock('../../services/character/featBuffService.js', () => ({
  computeFeatBuffs: vi.fn(() => ({
    abilityScoreIncreases: [],
    proficiencies: [],
    resistances: [],
    features: [],
  })),
}));

// Faithful excerpts of public/data/2024/feats.json (names, types, descriptions,
// prerequisites dict-or-null, repeatable flags all match disk exactly).
const ASI = {
  index: 'ability-score-improvement',
  name: 'Ability Score Improvement',
  type: 'General Feat',
  description: '<p>Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1. This feat can’t increase an ability score above 20.</p>',
  prerequisites: { level: 4 },
  repeatable: true,
};
const ALERT = {
  index: 'alert',
  name: 'Alert',
  description: 'Always on the lookout for danger, you gain the following benefits:',
};
const LUCKY = {
  index: 'lucky',
  name: 'Lucky',
  type: 'Origin Feat',
  description: '<p><b>Luck Points.</b> You have a number of Luck Points equal to your Proficiency Bonus and can spend the points on the benefits below.</p>',
  prerequisites: null,
};
const MAGIC_INITIATE = {
  index: 'magic-initiate',
  name: 'Magic Initiate',
  type: 'Origin Feat',
  description: '<p><b>Two Cantrips.</b> You learn two cantrips of your choice from the Cleric, Druid, or Wizard spell list.</p>',
  prerequisites: null,
};
const DISK_FEATS = [ASI, ALERT, LUCKY, MAGIC_INITIATE];

const HUMAN_VERSATILE_FROM = ['Crafter', 'Fey Touched', 'Healer', 'Lucky', 'Magic Initiate', 'Musician', 'Savage Attacker', 'Shadow Touched', 'Skilled', 'Tavern Brawler', 'Tough'];

const baseFormData = () => ({ feats: [], level: 8, rules: '2024' });

function renderComponent(props = {}) {
  return render(
    <WizardStepFeats
      stepNumber={8}
      formData={baseFormData()}
      allFeats={DISK_FEATS}
      onArrayFieldChange={vi.fn()}
      preSelectedFeats={[]}
      {...props}
    />,
  );
}

const featRow = (name) => screen.getByText(name).closest('.list-item');

describe('WizardStepFeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step title, disk feat list with type badges, rules details and zero-count summary — and the loading message when allFeats is missing', async () => {
    const { unmount } = renderComponent();

    expect(screen.getByRole('heading', { name: 'Step 8: Feats' })).toBeInTheDocument();
    DISK_FEATS.forEach((feat) => expect(screen.getByText(feat.name)).toBeInTheDocument());
    expect(within(featRow('Ability Score Improvement')).getByText('General Feat')).toBeInTheDocument();
    expect(within(featRow('Lucky')).getByText('Origin Feat')).toBeInTheDocument();
    expect(featRow('Alert').querySelector('.feat-type')).toBeNull(); // disk Alert has no type
    await screen.findByText(/plus additional feats at levels 4, 8, 12, 16, 19/);
    expect(screen.getByText('You have selected 0 of 2 allowed feat(s).')).toBeInTheDocument();
    expect(document.querySelector('.warning-container')).toBeNull();
    unmount();

    renderComponent({ allFeats: null });
    expect(screen.getByText('Feat data not yet loaded. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Ability Score Improvement')).not.toBeInTheDocument();
  });

  it.each([
    [[], [], 'You have selected 0 of 2 allowed feat(s).'],
    [['Alert', 'Lucky'], [], 'You have selected 2 of 2 allowed feat(s).'],
    [['Alert', 'Lucky'], ['Alert'], 'You have selected 1 of 2 allowed feat(s) (plus 1 pre-selected feat).'],
  ])('summary counts %j selected with %j pre-selected as the exact sentence', async (feats, preSelected, sentence) => {
    renderComponent({ formData: { ...baseFormData(), feats }, preSelectedFeats: preSelected });
    expect(await screen.findByText(sentence)).toBeInTheDocument();
  });

  it.each([
    ['ticks a feat', [], 'Alert', ['Alert']],
    ['ticks Ability Score Improvement alongside others', ['Magic Initiate'], 'Ability Score Improvement', ['Magic Initiate', 'Ability Score Improvement']],
    ['un-ticks Ability Score Improvement (FT-001 serialization)', ['Alert', 'Ability Score Improvement'], 'Ability Score Improvement', ['Alert']],
  ])('checkbox click %s emits the exact onChange payload', (_case, selected, clickName, expected) => {
    const onArrayFieldChange = vi.fn();
    renderComponent({
      formData: { ...baseFormData(), feats: selected },
      allFeats: DISK_FEATS,
      onArrayFieldChange,
    });
    fireEvent.click(featRow(clickName).querySelector('.list-item-checkbox'));
    expect(onArrayFieldChange).toHaveBeenCalledTimes(1);
    expect(onArrayFieldChange).toHaveBeenCalledWith('feats', expected);
  });

  it('marks pre-selected feats and locks them: label shown, checkbox and body clicks are inert', () => {
    const onArrayFieldChange = vi.fn();
    renderComponent({
      formData: { ...baseFormData(), feats: ['Lucky'] },
      preSelectedFeats: ['Lucky'],
      onArrayFieldChange,
    });

    const row = featRow('Lucky');
    expect(row).toHaveClass('pre-selected');
    expect(within(row).getByText('(Pre-selected)')).toBeInTheDocument();
    expect(row.querySelector('.list-item-checkbox')).toHaveClass('checked');

    fireEvent.click(row.querySelector('.list-item-body'));
    fireEvent.click(row.querySelector('.list-item-checkbox'));
    expect(onArrayFieldChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/Luck Points/)).not.toBeInTheDocument(); // body click did not expand
  });

  it('expands a feat on body click with disk prerequisite text and description, and omits the prerequisites block when disk has none', () => {
    renderComponent();

    const asiRow = featRow('Ability Score Improvement');
    fireEvent.click(asiRow.querySelector('.list-item-body'));
    expect(asiRow.querySelector('.feat-prerequisites').textContent).toBe('Prerequisites: {"level":4}'); // disk shape: { level: 4 }
    expect(asiRow.querySelector('.feat-description').textContent).toContain('increase two ability scores of your choice by 1');
    expect(within(asiRow).getByRole('button', { name: 'Show Less' })).toBeInTheDocument();

    const alertRow = featRow('Alert');
    fireEvent.click(alertRow.querySelector('.list-item-body'));
    expect(alertRow.querySelector('.feat-description').textContent).toContain('Always on the lookout for danger');
    expect(alertRow.querySelector('.feat-prerequisites')).toBeNull();
  });

  it.each([
    ['selected twice by the user', ['Ability Score Improvement', 'Ability Score Improvement'], [], true, ['Ability Score Improvement']],
    ['selected once by the user', ['Ability Score Improvement'], [], true, []],
    ['pre-selected twice', ['Ability Score Improvement', 'Ability Score Improvement'], ['Ability Score Improvement'], false, null],
  ])('repeatable feat %s shows badge and gates Remove One behind %s', (_case, feats, preSelected, removeAllowed, removePayload) => {
    const onArrayFieldChange = vi.fn();
    renderComponent({
      formData: { ...baseFormData(), feats },
      preSelectedFeats: preSelected,
      onArrayFieldChange,
    });

    const row = featRow('Ability Score Improvement');
    if (feats.length > 1) {
      expect(within(row).getByText('(2)')).toBeInTheDocument();
    } else {
      expect(within(row).queryByText(/\(\d+\)/)).not.toBeInTheDocument();
    }
    expect(row.querySelector('.add-another-btn')).toBeInTheDocument();
    expect(!!row.querySelector('.remove-feat-btn')).toBe(removeAllowed);

    if (removeAllowed) {
      fireEvent.click(row.querySelector('.remove-feat-btn'));
      expect(onArrayFieldChange).toHaveBeenCalledTimes(1);
      expect(onArrayFieldChange).toHaveBeenCalledWith('feats', removePayload);
    } else {
      expect(onArrayFieldChange).not.toHaveBeenCalled();
    }
  });

  // Pins CURRENT wiring defect: "Add Another" routes through SelectableList's generic
  // toggle, which REMOVES all instances of an already-selected repeatable instead of
  // adding one. When the defect is fixed this pin must flip to expect another copy added.
  it('Add Another currently re-toggles instead of adding — clicking it drops the whole repeatable selection', () => {
    const onArrayFieldChange = vi.fn();
    renderComponent({
      formData: { ...baseFormData(), feats: ['Magic Initiate', 'Ability Score Improvement'] },
      onArrayFieldChange,
    });
    fireEvent.click(featRow('Ability Score Improvement').querySelector('.add-another-btn'));
    expect(onArrayFieldChange).toHaveBeenCalledWith('feats', ['Magic Initiate']);
  });

  it('summarizes computedBuffs by category, filtering "any" ASI choices, and omits the section when everything is empty', () => {
    const { unmount } = renderComponent({
      formData: { ...baseFormData(), feats: ['Ability Score Improvement'] },
      computedBuffs: {
        abilityScoreIncreases: [{ name: 'Wisdom', amount: 2 }, { name: 'any', amount: 2 }],
        proficiencies: [{ name: 'Medium Armor' }],
        resistances: ['Necrotic'],
        features: [{ name: 'Darkvision' }],
      },
    });

    const summary = document.querySelector('.feat-buffs-summary');
    expect(summary).toHaveTextContent('Applied Buffs');
    expect(within(summary).getByText('• 1 ability score increase(s)')).toBeInTheDocument();
    expect(within(summary).getByText('• 1 proficiency/proficiencie(s)')).toBeInTheDocument();
    expect(within(summary).getByText('• 1 resistance(s)')).toBeInTheDocument();
    expect(within(summary).getByText('• 1 passive/feature buff(s)')).toBeInTheDocument();
    unmount();

    renderComponent({
      computedBuffs: { abilityScoreIncreases: [{ name: 'any', amount: 2 }], proficiencies: [], resistances: [], features: [] },
    });
    expect(document.querySelector('.feat-buffs-summary')).toBeNull();
  });

  it('renders validateFeats warnings and infos inside typed warning messages', async () => {
    featValidation.validateFeats.mockResolvedValueOnce([
      { message: 'Rules allow 2 feat(s) at level 8. You have selected 3.', type: 'warning' },
      { message: 'Lucky requires: Charisma 13 or higher. Verify your character meets this requirement.', type: 'info' },
    ]);

    renderComponent({ formData: { ...baseFormData(), feats: ['Alert', 'Lucky', 'Magic Initiate'] } });

    const messages = await screen.findAllByText(/Rules allow 2 feat\(s\) at level 8|Lucky requires: Charisma 13/);
    expect(messages).toHaveLength(2);
    expect(document.querySelectorAll('.warning-message.warning')).toHaveLength(1);
    expect(document.querySelectorAll('.warning-message.info')).toHaveLength(1);
  });

  it('shows 2024 Versatile-trait Origin feat choices from disk, and stays silent for 5e or races without choices', async () => {
    const { unmount } = renderComponent({ formData: { ...baseFormData(), rules: '5e' } });
    expect(screen.queryByText(/Versatile Trait:/)).not.toBeInTheDocument();
    expect(featValidation.getRaceFeatChoices).not.toHaveBeenCalled(); // 5e guard
    unmount();

    renderComponent({ formData: { ...baseFormData(), rules: '2024', race: null } });
    await screen.findByRole('heading', { name: 'Step 8: Feats' });
    expect(screen.queryByText(/Versatile Trait:/)).not.toBeInTheDocument(); // 2024 but no choices
    unmount();

    featValidation.getRaceFeatChoices.mockResolvedValueOnce(HUMAN_VERSATILE_FROM);
    renderComponent({
      formData: {
        ...baseFormData(),
        race: {
          name: 'Human',
          traits: [{ name: 'Versatile', description: 'You gain an Origin feat of your choice (see chapter 5). Skilled is recommended.', proficiency_choices: { choose: 1, from: HUMAN_VERSATILE_FROM } }],
        },
      },
    });

    const section = await screen.findByText(/Available options: Crafter, Fey Touched, Healer, Lucky, Magic Initiate, Musician, Savage Attacker, Shadow Touched, Skilled, Tavern Brawler, Tough\. Skilled is recommended\./);
    expect(section.closest('.versatile-trait-info')).toBeInTheDocument();
  });
});
