// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCStatBlockForm from './NPCStatBlockForm';

const EMPTY_ACTION = {
  name: '', attack_bonus: '', damage_dice_primary: '', damage_type_primary: '',
  damage_dice_secondary: '', damage_type_secondary: '', description: '',
};

const SHORTBOW = {
  name: 'Shortbow', attack_bonus: '+4', damage_dice_primary: '1d6+2', damage_type_primary: 'piercing',
  damage_dice_secondary: '', damage_type_secondary: '', description: '',
};

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
    initiativeBonus: '+2',
    abilityScores: { str: 10, dex: 14, con: 12, int: 8, wis: 10, cha: 7 },
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

// Renders the form with a stateful mock that applies every setFormData
// update immediately, mirroring React's functional state updates, so tests
// can assert on the resulting form state via getState() instead of
// re-invoking captured updater functions by hand.
function setup(formData = createFormData()) {
  let state = formData;
  const setFormData = vi.fn((updater) => {
    state = typeof updater === 'function' ? updater(state) : updater;
  });
  const utils = render(<NPCStatBlockForm formData={formData} setFormData={setFormData} />);
  return { ...utils, setFormData, getState: () => state };
}

function abilitiesGrid(container) {
  return within(container.querySelector('.npcs-abilities-grid'));
}

function skillsSection(container) {
  return within(container.querySelector('.npcs-skills-section'));
}

function getInitiativeInput() {
  return screen.getAllByPlaceholderText('+0').find((input) => input.type === 'number');
}

describe('NPCStatBlockForm interactions', () => {
  describe('combat stat fields', () => {
    it('parses AC as a number and stores null when cleared', () => {
      const { getState } = setup();
      const ac = screen.getByPlaceholderText('10');
      fireEvent.change(ac, { target: { value: '18' } });
      expect(getState().armorClass).toBe(18);
      fireEvent.change(ac, { target: { value: '' } });
      expect(getState().armorClass).toBeNull();
    });

    it('passes HP and Hit Dice through as raw strings, including empty', () => {
      const { getState } = setup();
      const hp = screen.getByPlaceholderText('e.g., 45');
      fireEvent.change(hp, { target: { value: '100' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., 6d8'), { target: { value: '10d10' } });
      expect(getState().hitPoints).toBe('100');
      expect(getState().hitDice).toBe('10d10');
      fireEvent.change(hp, { target: { value: '' } });
      expect(getState().hitPoints).toBe('');
    });

    it('keeps initiative bonus as a string even on a number input', () => {
      const { getState } = setup();
      fireEvent.change(getInitiativeInput(), { target: { value: '5' } });
      expect(getState().initiativeBonus).toBe('5');
    });
  });

  describe('speed field', () => {
    it('retains non-walk speeds when walk is edited', () => {
      const { getState } = setup(createFormData({ speed: { walk: '30 ft.', climb: '15 ft.' } }));
      fireEvent.change(screen.getByPlaceholderText('30 ft.'), { target: { value: '40 ft.' } });
      expect(getState().speed).toEqual({ walk: '40 ft.', climb: '15 ft.' });
    });

    it('creates a speed object when none exists yet', () => {
      const { getState } = setup(createFormData({ speed: undefined }));
      fireEvent.change(screen.getByPlaceholderText('30 ft.'), { target: { value: '40 ft.' } });
      expect(getState().speed).toEqual({ walk: '40 ft.' });
    });
  });

  describe('ability scores', () => {
    it('updates scores as integers, preserving the rest, and defaults invalid input to 0', () => {
      const { container, getState } = setup();
      const abilityInputs = abilitiesGrid(container).getAllByRole('spinbutton');
      fireEvent.change(abilityInputs[0], { target: { value: '18' } });
      fireEvent.change(abilityInputs[2], { target: { value: '20' } });
      let scores = getState().abilityScores;
      expect(scores.str).toBe(18);
      expect(scores.con).toBe(20);
      expect(scores.dex).toBe(14);
      expect(scores.int).toBe(8);
      for (const value of ['', 'abc']) {
        fireEvent.change(abilityInputs[0], { target: { value } });
        expect(getState().abilityScores.str).toBe(0);
      }
    });
  });

  describe('saving throw bonuses', () => {
    it('updates existing bonuses and adds new ones without affecting the rest', () => {
      const { container, getState } = setup();
      const saveInputs = abilitiesGrid(container).getAllByTitle('Saving throw bonus');
      fireEvent.change(saveInputs[0], { target: { value: '+6' } });
      fireEvent.change(saveInputs[1], { target: { value: '+8' } });
      fireEvent.change(saveInputs[4], { target: { value: '+1' } });
      const bonuses = getState().savingThrowBonuses;
      expect(bonuses.str).toBe('+6');
      expect(bonuses.dex).toBe('+8');
      expect(bonuses.wis).toBe('+1');
      expect(bonuses.con).toBeUndefined();
    });
  });

  describe('skill bonuses', () => {
    it('adds a blank skill, edits a bonus, and removes a skill', () => {
      const { container, getState } = setup();
      fireEvent.click(screen.getByRole('button', { name: /Add Skill/i }));
      expect(getState().skillBonuses['']).toBe('');
      fireEvent.change(skillsSection(container).getAllByPlaceholderText('+0')[0], { target: { value: '+7' } });
      expect(getState().skillBonuses.perception).toBe('+7');
      fireEvent.click(screen.getAllByRole('button', { name: /Remove skill/i })[0]);
      const bonuses = getState().skillBonuses;
      expect(bonuses.perception).toBeUndefined();
      expect(bonuses.stealth).toBe('+5');
      expect(bonuses['']).toBe('');
    });

    it('renames a skill by moving its bonus to the new key', () => {
      const { container, getState } = setup();
      fireEvent.change(skillsSection(container).getAllByPlaceholderText('Skill name')[0], { target: { value: 'investigation' } });
      const bonuses = getState().skillBonuses;
      expect(bonuses.investigation).toBe('+3');
      expect(bonuses.perception).toBeUndefined();
      expect(bonuses.stealth).toBe('+5');
    });
  });

  describe('defense fields', () => {
    it('parses comma-separated lists into trimmed, non-empty arrays', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('fire, cold, poison'), { target: { value: '  fire  ,, cold ,  ' } });
      expect(getState().damageResistances).toEqual(['fire', 'cold']);
      fireEvent.change(screen.getByPlaceholderText('necrotic, psychic'), { target: { value: 'necrotic , psychic' } });
      expect(getState().damageImmunities).toEqual(['necrotic', 'psychic']);
      fireEvent.change(screen.getByPlaceholderText('charmed, frightened'), { target: { value: '' } });
      expect(getState().conditionImmunities).toEqual([]);
    });
  });

  describe('actions', () => {
    it('adds a new empty action via the Add Action button', () => {
      const { getState } = setup();
      fireEvent.click(screen.getByRole('button', { name: /Add Action/i }));
      const actions = getState().actions;
      expect(actions).toHaveLength(2);
      expect(actions[1]).toEqual(EMPTY_ACTION);
    });

    it('updates every field of an existing action', () => {
      const { getState } = setup();
      const edits = [
        ['Action name', 'Greatsword', 'name'],
        ['Atk bonus', '+6', 'attack_bonus'],
        ['Primary Damage Dice', '2d6+4', 'damage_dice_primary'],
        ['Primary Type', 'slashing', 'damage_type_primary'],
        ['Secondary Damage Dice', '1d4', 'damage_dice_secondary'],
        ['Secondary Type', 'radiant', 'damage_type_secondary'],
        ['Description', 'A heavy greatsword.', 'description'],
      ];
      edits.forEach(([placeholder, value]) => {
        fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
      });
      const action = getState().actions[0];
      edits.forEach(([, value, key]) => {
        expect(action[key]).toBe(value);
      });
    });

    it('edits and removes only the targeted action when multiple exist', () => {
      const { getState } = setup(createFormData({ actions: [LONGSWORD, SHORTBOW] }));
      fireEvent.change(screen.getAllByPlaceholderText('Action name')[0], { target: { value: 'Mace' } });
      let actions = getState().actions;
      expect(actions[0].name).toBe('Mace');
      expect(actions[1]).toEqual(SHORTBOW);
      fireEvent.click(screen.getAllByRole('button', { name: /Remove action/i })[0]);
      actions = getState().actions;
      expect(actions).toEqual([SHORTBOW]);
    });
  });

  describe('traits and reactions', () => {
    it('updates the traits and reactions textareas', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('Special traits (one per line or markdown)'), { target: { value: 'New traits text' } });
      fireEvent.change(screen.getByPlaceholderText('Reactions (one per line or markdown)'), { target: { value: 'New reactions text' } });
      expect(getState().traits).toBe('New traits text');
      expect(getState().reactions).toBe('New reactions text');
    });
  });
});
