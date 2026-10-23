// @maintained-by-ai
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpells from './WizardStepSpells.jsx';

// ── Flake hardening (registered ⚠ bugs.md:710 FLAKE-watch #183 half; fix#187) ──
// fix#171 pins landed on the ElementalAttunement siblings only (player-save :77, summary :59);
// this lane carried no async-util budget pin. Same contention class: full-suite CPU starvation
// delays React passive-effect flush chains (archived stall bytes 1020/1023/1624ms,
// /tmp/batch183.log), so give every async util here the proven 3000ms patience (3x observed
// worst stall, far below the 5000ms test timeout). The lane's own #183 failure was a
// wrong-anchor race, NOT budget expiry — root cause + causal gate documented at the test below.
// Assertions unchanged: a wrong or missing commit still fails byte-exact.
configure({ asyncUtilTimeout: 3000 });

// Step-wiring lane only: modal internals belong to FeyTouchedModal/MagicInitiateModal lanes
// and list internals to SelectableList — stubbed here to pin dispatch and counts.
vi.mock('./MagicInitiateModal.jsx', () => ({
  default: vi.fn(({ onClose }) => (
    <div data-testid="magic-initiate-modal">
      <button onClick={onClose}>CloseMagicInitiate</button>
    </div>
  )),
}));

vi.mock('./FeyTouchedModal.jsx', () => ({
  default: vi.fn(({ onClose }) => (
    <div data-testid="fey-touched-modal">
      <button onClick={onClose}>CloseFeyTouched</button>
    </div>
  )),
  ShadowTouchedModal: vi.fn(({ onClose }) => (
    <div data-testid="shadow-touched-modal">
      <button onClick={onClose}>CloseShadowTouched</button>
    </div>
  )),
}));

vi.mock('./SelectableList.jsx', () => ({
  default: vi.fn(({ renderSummary }) => (
    <div data-testid="selectable-list">{renderSummary ? renderSummary() : null}</div>
  )),
}));

const defaultSpellLimits = {
  cantrip: 3,
  level1: 2, level2: 0, level3: 0, level4: 0,
  level5: 0, level6: 0, level7: 0, level8: 0, level9: 0,
  spellType: 'known',
  preparedSpells: null,
};

// Shared mutable limits so each test can steer the async getSpellLimits mock
let currentSpellLimits = { ...defaultSpellLimits };

vi.mock('../../services/rules/spells/spellLimits.js', () => ({
  getSpellLimits: vi.fn().mockImplementation(async () => currentSpellLimits),
  validateSpellSelection: vi.fn().mockResolvedValue({ valid: true, violations: [] }),
}));

vi.mock('../../services/rules/spells/spellValidation.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getSpellValidationInfo: vi.fn().mockResolvedValue({ warnings: [] }),
}));

const DEFAULT_SPELLS = [
  { name: 'Magic Missile', index: 'magic-missile', level: 0, school: 'Evocation', description: ['A missile.'], classes: ['Wizard'] },
  { name: 'Fireball', index: 'fireball', level: 3, school: 'Evocation', description: ['A ball of fire.'], classes: ['Wizard', 'Sorcerer'] },
  { name: 'Guidance', index: 'guidance', level: 0, school: 'Divination', description: ['Guidance.'], classes: ['Cleric'] },
  { name: 'Light', index: 'light', level: 0, school: 'Evocation', description: ['Light.'], classes: ['Cleric', 'Sorcerer', 'Wizard'] },
  { name: 'Healing Word', index: 'healing-word', level: 1, school: 'Evocation', description: ['Healing word.'], classes: ['Bard', 'Cleric', 'Druid'] },
  { name: 'Misty Step', index: 'misty-step', level: 1, school: 'Conjuration', description: ['Misty step.'], classes: ['Sorcerer', 'Warlock', 'Wizard'] },
  { name: 'Invisibility', index: 'invisibility', level: 2, school: 'Illusion', description: ['Invisibility.'], classes: ['Sorcerer', 'Warlock', 'Wizard'] },
];

const WARLOCK_SPELLS = [
  { name: 'True Seeing', index: 'true-seeing', level: 6, school: 'Divination', description: ['See everything as it truly is.'], classes: ['Cleric', 'Warlock'] },
  { name: 'Power Word Stun', index: 'power-word-stun', level: 7, school: 'Enchantment', description: ['Stun a creature.'], classes: ['Bard', 'Sorcerer', 'Warlock'] },
  { name: 'Demiplane', index: 'demiplane', level: 8, school: 'Conjuration', description: ['Create a demiplane.'], classes: ['Warlock'] },
  // Filter negatives: real warlock spells that must NOT appear (no qualifying slot, or wrong class)
  { name: 'Vampiric Touch', index: 'vampiric-touch', level: 3, school: 'Necromancy', description: ['Drain life.'], classes: ['Sorcerer', 'Warlock', 'Wizard'] },
  { name: 'Fireball', index: 'fireball', level: 3, school: 'Evocation', description: ['A ball of fire.'], classes: ['Wizard', 'Sorcerer'] },
  { name: 'Magic Missile', index: 'magic-missile', level: 0, school: 'Evocation', description: ['A missile.'], classes: ['Wizard'] },
];

const ALL_ARCANUM_LABELS = ['6th Level Arcanum:', '7th Level Arcanum:', '8th Level Arcanum:', '9th Level Arcanum:'];

const makeProps = ({ formData = {}, allSpells = DEFAULT_SPELLS, onArrayFieldChange } = {}) => ({
  stepNumber: 14,
  formData: {
    class: { name: 'Wizard', subclass: { name: 'Evocation' } },
    level: 5,
    rules: '5e',
    spells: [],
    feats: [],
    ...formData,
  },
  allSpells,
  onArrayFieldChange: onArrayFieldChange || vi.fn(),
});

const warlockProps = ({ level = 17, arcanums = [], onArrayFieldChange } = {}) =>
  makeProps({
    allSpells: WARLOCK_SPELLS,
    onArrayFieldChange,
    formData: { class: { name: 'Warlock', subclass: { name: 'The Fiend' }, arcanums }, level },
  });

const miInstance = () => ({ class: 'Cleric', cantrips: ['Guidance', 'Light'], level1Spell: 'Healing Word' });

describe('WizardStepSpells feat wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSpellLimits = { ...defaultSpellLimits };
  });

  describe('Mystic Arcanum', () => {
    it.each([
      { level: 10, expected: [] },
      { level: 11, expected: [ALL_ARCANUM_LABELS[0]] },
      { level: 13, expected: ALL_ARCANUM_LABELS.slice(0, 2) },
      { level: 15, expected: ALL_ARCANUM_LABELS.slice(0, 3) },
      { level: 17, expected: ALL_ARCANUM_LABELS },
    ])('warlock level $level unlocks exactly the qualifying arcanum slots', ({ level, expected }) => {
      render(<WizardStepSpells {...warlockProps({ level })} />);

      if (expected.length === 0) {
        expect(screen.queryByText('Mystic Arcanum')).not.toBeInTheDocument();
        return;
      }
      expect(screen.getByText('Mystic Arcanum')).toBeInTheDocument();
      expected.forEach(label => expect(screen.getByText(label)).toBeInTheDocument());
      ALL_ARCANUM_LABELS.filter(l => !expected.includes(l))
        .forEach(label => expect(screen.queryByText(label)).not.toBeInTheDocument());
    });

    it('renders no Mystic Arcanum for a non-Warlock even at character level 17', () => {
      render(<WizardStepSpells {...makeProps({ formData: { level: 17 } })} />);
      expect(screen.queryByText('Mystic Arcanum')).not.toBeInTheDocument();
    });

    it('offers only warlock spells at qualifying levels, flags empty slots, and expands details without writing', () => {
      const onArrayFieldChange = vi.fn();
      render(<WizardStepSpells {...warlockProps({ level: 17, onArrayFieldChange })} />);

      expect(screen.getByText('True Seeing')).toBeInTheDocument();
      expect(screen.getByText('Power Word Stun')).toBeInTheDocument();
      expect(screen.getByText('Demiplane')).toBeInTheDocument();
      // Class filter excludes wizard-only spells; level filter excludes sub-slot spells
      expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
      expect(screen.queryByText('Magic Missile')).not.toBeInTheDocument();
      expect(screen.queryByText('Vampiric Touch')).not.toBeInTheDocument();
      expect(screen.getByText('No warlock spells available at this level.')).toBeInTheDocument();

      fireEvent.click(screen.getAllByTitle('View spell details')[0]);
      expect(screen.getByText('See everything as it truly is.')).toBeInTheDocument();
      expect(screen.getByText('School: Divination')).toBeInTheDocument();
      expect(onArrayFieldChange).not.toHaveBeenCalled();

      fireEvent.click(screen.getAllByTitle('View spell details')[0]);
      expect(screen.queryByText('School: Divination')).not.toBeInTheDocument();
    });

    it('routes arcanum add and remove row clicks to exact class.arcanums payloads', () => {
      const onArrayFieldChange = vi.fn();
      render(<WizardStepSpells {...warlockProps({ level: 17, arcanums: ['True Seeing'], onArrayFieldChange })} />);

      expect(screen.getByText('1/1')).toBeInTheDocument();
      expect(screen.getAllByText('0/1')).toHaveLength(3);

      fireEvent.click(screen.getByText('Demiplane'));
      expect(onArrayFieldChange).toHaveBeenNthCalledWith(1, 'class.arcanums', ['True Seeing', 'Demiplane']);

      fireEvent.click(screen.getByText('True Seeing'));
      expect(onArrayFieldChange).toHaveBeenNthCalledWith(2, 'class.arcanums', []);
    });
  });

  describe('Magic Initiate', () => {
    it.each([
      ['no instances recorded', ['Magic Initiate'], undefined],
      ['an empty instances array', ['Magic Initiate'], []],
      ['fewer instances than feats', ['Magic Initiate', 'Magic Initiate'], [miInstance()]],
    ])('auto-opens the modal while configured instances mismatch ($#)', async (_label, feats, instances) => {
      render(<WizardStepSpells {...makeProps({
        formData: { feats, ...(instances ? { magicInitiateInstances: instances } : {}) },
      })} />);

      expect(screen.getByTestId('magic-initiate-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'CloseMagicInitiate' }));
      expect(screen.queryByTestId('magic-initiate-modal')).not.toBeInTheDocument();

      // Closing without configuring must not silently pass — banner offers a reopen
      fireEvent.click(screen.getByRole('button', { name: 'Edit Magic Initiate' }));
      expect(screen.getByTestId('magic-initiate-modal')).toBeInTheDocument();
    });

    it('shows the Edit Magic Initiate banner once instances match the feats taken', () => {
      render(<WizardStepSpells {...makeProps({
        formData: { feats: ['Magic Initiate'], magicInitiateInstances: [miInstance()] },
      })} />);

      expect(screen.queryByTestId('magic-initiate-modal')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Edit Magic Initiate' }));
      expect(screen.getByTestId('magic-initiate-modal')).toBeInTheDocument();
    });
  });

  describe('Fey Touched / Shadow Touched', () => {
    const touchedCases = [
      { feat: 'Fey Touched', field: 'feyTouchedSpell', spell: 'Misty Step', modalId: 'fey-touched-modal', banner: 'Edit Fey Magic', close: 'CloseFeyTouched' },
      { feat: 'Shadow Touched', field: 'shadowTouchedSpell', spell: 'Invisibility', modalId: 'shadow-touched-modal', banner: 'Edit Shadow Magic', close: 'CloseShadowTouched' },
    ];

    it.each(touchedCases)('$feat auto-opens its modal while unconfigured', ({ feat, modalId, close }) => {
      render(<WizardStepSpells {...makeProps({ formData: { feats: [feat] } })} />);

      expect(screen.getByTestId(modalId)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: close }));
      expect(screen.queryByTestId(modalId)).not.toBeInTheDocument();
    });

    it.each(touchedCases)('$feat banner reopens the modal once its spell is configured', ({ feat, field, spell, modalId, banner }) => {
      render(<WizardStepSpells {...makeProps({ formData: { feats: [feat], [field]: spell } })} />);

      expect(screen.queryByTestId(modalId)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: banner }));
      expect(screen.getByTestId(modalId)).toBeInTheDocument();
    });

    it('renders no feat modals or edit banners when no feats are selected', () => {
      render(<WizardStepSpells {...makeProps()} />);

      ['magic-initiate-modal', 'fey-touched-modal', 'shadow-touched-modal'].forEach(id =>
        expect(screen.queryByTestId(id)).not.toBeInTheDocument());
      ['Edit Magic Initiate', 'Edit Fey Magic', 'Edit Shadow Magic'].forEach(name =>
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
    });
  });

  it('excludes Magic Initiate, Fey Touched, and Shadow Touched spells from user spell counts while still counting its own', async () => {
    currentSpellLimits = { ...defaultSpellLimits, cantrip: 2, level1: 2, level2: 2, level3: 2 };
    render(<WizardStepSpells {...makeProps({
      formData: {
        feats: ['Magic Initiate', 'Fey Touched', 'Shadow Touched'],
        spells: ['Guidance', 'Light', 'Healing Word', 'Misty Step', 'Invisibility', 'Fireball'],
        magicInitiateInstances: [miInstance()],
        feyTouchedSpell: 'Misty Step',
        shadowTouchedSpell: 'Invisibility',
      },
    })} />);

    // Causal gate (fix#187, #183 root cause): findByText('Spell Selection Summary') resolved on
    // the FIRST commit — the header renders unconditionally from zero-initialised spellLimits
    // (WizardStepSpells.jsx:181; header :330/:353; denominator `spellLimits.cantrip || 0`), so
    // the interim paint is 'Cantrips:0/0'. The resolved limits land in a LATER commit from the
    // awaited getSpellLimits passive-effect fetch (:203-204), which CPU contention starves.
    // Archived bytes (/tmp/batch183.log:36, 16ms — inside budget, so patience on the old anchor
    // alone cannot fix it): "AssertionError: expected 'Cantrips:0/0' to be 'Cantrips:0/2'" at
    // old :244. Gate on the SUCCESS commit carrying the exact bytes — fix#152 waitFor-causal-gate
    // idiom, house pattern from sibling WizardStepSpells.test.jsx:108-115; all four toBe strings
    // byte-identical to the original pins, zero weakening.
    await waitFor(() => {
      expect(screen.getByText('Cantrips:').parentElement.textContent).toBe('Cantrips:0/2');
      expect(screen.getByText('1th level:').parentElement.textContent).toBe('1th level:0/2');
      expect(screen.getByText('2th level:').parentElement.textContent).toBe('2th level:0/2');
      expect(screen.getByText('3th level:').parentElement.textContent).toBe('3th level:1/2');
    });
  });
});
