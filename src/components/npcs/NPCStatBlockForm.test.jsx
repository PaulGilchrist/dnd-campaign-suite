// @maintained-by-ai: 2026-10-14
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCStatBlockForm from './NPCStatBlockForm';
import { ABILITY_ABBR, ABILITY_LABELS } from '../../services/npcs/npcFormUtils.js';
import { calculateAbilityModifier } from '../../services/encounters/npcStatBlockUtils.js';

const SECTION_HEADINGS = [
  'Combat Stats',
  'Ability Scores',
  'Skill Bonuses',
  'Defenses',
  'Actions',
  'Traits',
  'Reactions',
];

const DEFAULT_SCORES = { str: 10, dex: 14, con: 12, int: 8, wis: 10, cha: 7 };

const LONGSWORD = {
  name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8+3', damage_type_primary: 'slashing',
  damage_dice_secondary: '', damage_type_secondary: '', description: 'Melee Weapon Attack.',
};

function createFormData(overrides = {}) {
  return {
    name: 'Goblin',
    race: 'Humanoid',
    classRole: 'Scout',
    armorClass: 15,
    hitPoints: '45',
    hitDice: '6d8',
    speed: { walk: '30 ft.' },
    initiativeBonus: '2',
    abilityScores: DEFAULT_SCORES,
    savingThrowBonuses: { str: '+2', dex: '+4' },
    skillBonuses: { perception: '+3', stealth: '+5' },
    damageResistances: ['fire'],
    damageImmunities: [],
    conditionImmunities: ['charmed'],
    actions: [LONGSWORD],
    traits: 'Darkvision.',
    reactions: 'Reaction text.',
    ...overrides,
  };
}

function renderForm(formData = createFormData()) {
  return render(<NPCStatBlockForm formData={formData} setFormData={vi.fn()} />);
}

function abilityGrid(container) {
  return within(container.querySelector('.npcs-abilities-grid'));
}

// The initiative number input shares its "+0" placeholder with skill bonus text inputs.
function initiativeInput() {
  return screen.getAllByPlaceholderText('+0').find((input) => input.type === 'number');
}

describe('NPCStatBlockForm rendering', () => {
  it('renders every section heading', () => {
    renderForm();
    SECTION_HEADINGS.forEach((heading) => {
      expect(screen.getByText(heading)).toBeInTheDocument();
    });
  });

  describe('combat stats fields', () => {
    it('displays combat stat values in their inputs', () => {
      renderForm();
      expect(screen.getByPlaceholderText('10').value).toBe('15');
      expect(screen.getByPlaceholderText('e.g., 45')).toHaveValue('45');
      expect(screen.getByPlaceholderText('e.g., 6d8')).toHaveValue('6d8');
      expect(screen.getByPlaceholderText('30 ft.')).toHaveValue('30 ft.');
      expect(initiativeInput().value).toBe('2');
    });
  });

  describe('ability scores', () => {
    it('renders ability rows in ABILITY_ABBR order with labels, scores, and save bonuses', () => {
      const { container } = renderForm();
      const groups = Array.from(container.querySelectorAll('.npcs-ability-group'));
      expect(groups).toHaveLength(ABILITY_ABBR.length);
      expect(groups.map((el) => el.querySelector('.npcs-ability-label').textContent))
        .toEqual(ABILITY_ABBR.map((ab) => ABILITY_LABELS[ab]));
      expect(groups.map((el) => el.querySelector('input[type="number"]').value))
        .toEqual(ABILITY_ABBR.map((ab) => String(DEFAULT_SCORES[ab])));
      expect(abilityGrid(container).getAllByTitle('Saving throw bonus').map((input) => input.value))
        .toEqual(['+2', '+4', '', '', '', '']);
    });

    it.each([
      { label: 'partial scores', scores: { str: 16 }, expected: ['16', '10', '10', '10', '10', '10'] },
      { label: 'no abilityScores', scores: undefined, expected: ['10', '10', '10', '10', '10', '10'] },
      { label: 'boundary scores', scores: { str: 0, dex: 30 }, expected: ['0', '30', '10', '10', '10', '10'] },
    ])('displays $label with missing scores defaulting to 10 and matching modifiers', ({ scores, expected }) => {
      const { container } = renderForm(createFormData({ abilityScores: scores }));
      expect(abilityGrid(container).getAllByRole('spinbutton').map((input) => input.value)).toEqual(expected);
      const mods = Array.from(container.querySelectorAll('.npcs-ability-mod')).map((el) => el.textContent);
      expect(mods).toEqual(expected.map((score) => {
        const mod = calculateAbilityModifier(parseInt(score, 10));
        return `${mod >= 0 ? '+' : ''}${mod}`;
      }));
    });
  });

  describe('skill bonuses', () => {
    it('renders a row per skill with remove buttons and the Add Skill button', () => {
      renderForm();
      expect(screen.getAllByPlaceholderText('Skill name').map((input) => input.value))
        .toEqual(['perception', 'stealth']);
      expect(screen.getAllByRole('button', { name: /Remove skill/i })).toHaveLength(2);
      expect(screen.getByRole('button', { name: /Add Skill/i })).toBeInTheDocument();
    });
  });

  describe('defenses', () => {
    it('displays resistance and immunity lists joined into comma-separated inputs', () => {
      renderForm();
      expect(screen.getByPlaceholderText('fire, cold, poison')).toHaveValue('fire');
      expect(screen.getByPlaceholderText('necrotic, psychic')).toHaveValue('');
      expect(screen.getByPlaceholderText('charmed, frightened')).toHaveValue('charmed');
    });
  });

  describe('actions', () => {
    it('renders an editable row per action plus the Add Action button', () => {
      renderForm();
      expect(screen.getByPlaceholderText('Action name')).toHaveValue('Longsword');
      expect(screen.getByPlaceholderText('Atk bonus')).toHaveValue('+5');
      expect(screen.getByPlaceholderText('Primary Damage Dice')).toHaveValue('1d8+3');
      expect(screen.getByPlaceholderText('Primary Type')).toHaveValue('slashing');
      expect(screen.getByPlaceholderText('Secondary Damage Dice')).toHaveValue('');
      expect(screen.getByPlaceholderText('Secondary Type')).toHaveValue('');
      expect(screen.getByPlaceholderText('Description')).toHaveValue('Melee Weapon Attack.');
      expect(screen.getAllByRole('button', { name: /Remove action/i })).toHaveLength(1);
      expect(screen.getByRole('button', { name: /Add Action/i })).toBeInTheDocument();
    });
  });

  describe('traits and reactions', () => {
    it('displays traits and reactions textarea values', () => {
      renderForm();
      expect(screen.getByPlaceholderText('Special traits (one per line or markdown)')).toHaveValue('Darkvision.');
      expect(screen.getByPlaceholderText('Reactions (one per line or markdown)')).toHaveValue('Reaction text.');
    });
  });

  describe('empty form data', () => {
    it.each([
      { label: 'missing fields', data: {} },
      {
        label: 'explicitly cleared fields',
        data: createFormData({
          armorClass: null,
          hitPoints: '',
          hitDice: '',
          speed: {},
          initiativeBonus: '',
          abilityScores: {},
          savingThrowBonuses: {},
          skillBonuses: {},
          damageResistances: [],
          damageImmunities: [],
          conditionImmunities: [],
          actions: [],
          traits: '',
          reactions: '',
        }),
      },
    ])('renders the full section skeleton with empty inputs when $label', ({ data }) => {
      renderForm(data);
      SECTION_HEADINGS.forEach((heading) => {
        expect(screen.getByText(heading)).toBeInTheDocument();
      });
      expect(screen.getByPlaceholderText('10').value).toBe('');
      expect(screen.getByPlaceholderText('e.g., 45').value).toBe('');
      expect(screen.getByPlaceholderText('e.g., 6d8').value).toBe('');
      expect(screen.getByPlaceholderText('30 ft.').value).toBe('');
      expect(initiativeInput().value).toBe('');
      expect(screen.getByPlaceholderText('fire, cold, poison')).toHaveValue('');
      expect(screen.getByPlaceholderText('necrotic, psychic')).toHaveValue('');
      expect(screen.getByPlaceholderText('charmed, frightened')).toHaveValue('');
      expect(screen.getByPlaceholderText('Special traits (one per line or markdown)')).toHaveValue('');
      expect(screen.getByPlaceholderText('Reactions (one per line or markdown)')).toHaveValue('');
      expect(screen.queryAllByRole('button', { name: /Remove skill/i })).toHaveLength(0);
      expect(screen.queryAllByRole('button', { name: /Remove action/i })).toHaveLength(0);
    });
  });
});
