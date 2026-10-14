import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCStatBlockForm from './NPCStatBlockForm';

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
    actions: [
      { name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8+3', damage_type_primary: 'slashing', damage_dice_secondary: '', damage_type_secondary: '', description: 'Melee Weapon Attack.' },
    ],
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

function getAbilityInputs(container) {
  return within(container.querySelector('.npcs-abilities-grid')).getAllByRole('spinbutton');
}

function getSaveInputs(container) {
  return within(container.querySelector('.npcs-abilities-grid')).getAllByTitle('Saving throw bonus');
}

function getSkillNameInputs(container) {
  return within(container.querySelector('.npcs-skills-section')).getAllByPlaceholderText('Skill name');
}

function getSkillBonusInputs(container) {
  return within(container.querySelector('.npcs-skills-section')).getAllByPlaceholderText('+0');
}

function getInitiativeInput() {
  return screen.getAllByPlaceholderText('+0').find((input) => input.type === 'number');
}

describe('NPCStatBlockForm interactions', () => {
  describe('combat stat fields', () => {
    it('updates AC when a new number is entered', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '18' } });
      expect(getState().armorClass).toBe(18);
    });

    it('sets AC to null when the AC input is cleared', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '' } });
      expect(getState().armorClass).toBeNull();
    });

    it('updates HP when the text input changes', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('e.g., 45'), { target: { value: '100' } });
      expect(getState().hitPoints).toBe('100');
    });

    it('clears HP to an empty string when the input is cleared', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('e.g., 45'), { target: { value: '' } });
      expect(getState().hitPoints).toBe('');
    });

    it('updates Hit Dice when the text input changes', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('e.g., 6d8'), { target: { value: '10d10' } });
      expect(getState().hitDice).toBe('10d10');
    });

    it('updates Initiative Bonus as a string', () => {
      const { getState } = setup();
      fireEvent.change(getInitiativeInput(), { target: { value: '5' } });
      expect(getState().initiativeBonus).toBe('5');
    });
  });

  describe('speed field', () => {
    it('retains non-walk speeds when walk is edited', () => {
      const { getState } = setup(createFormData({ speed: { walk: '30 ft.', climb: '15 ft.' } }));
      fireEvent.change(screen.getByPlaceholderText('30 ft.'), { target: { value: '40 ft.' } });
      const speed = getState().speed;
      expect(speed.walk).toBe('40 ft.');
      expect(speed.climb).toBe('15 ft.');
    });

    it('creates a speed object when none exists yet', () => {
      const { getState } = setup(createFormData({ speed: undefined }));
      fireEvent.change(screen.getByPlaceholderText('30 ft.'), { target: { value: '40 ft.' } });
      expect(getState().speed).toEqual({ walk: '40 ft.' });
    });
  });

  describe('ability scores', () => {
    it('updates multiple scores while preserving the rest', () => {
      const { container, getState } = setup();
      const abilityInputs = getAbilityInputs(container);
      fireEvent.change(abilityInputs[0], { target: { value: '18' } });
      fireEvent.change(abilityInputs[2], { target: { value: '20' } });
      const scores = getState().abilityScores;
      expect(scores.str).toBe(18);
      expect(scores.con).toBe(20);
      expect(scores.dex).toBe(14);
      expect(scores.int).toBe(8);
    });

    it('defaults to 0 for empty or non-numeric ability score inputs', () => {
      const { container, getState } = setup();
      const abilityInputs = getAbilityInputs(container);
      for (const value of ['', 'abc']) {
        fireEvent.change(abilityInputs[0], { target: { value } });
        expect(getState().abilityScores.str).toBe(0);
      }
    });
  });

  describe('saving throw bonuses', () => {
    it('updates existing bonuses and adds new ones without affecting the rest', () => {
      const { container, getState } = setup();
      const saveInputs = getSaveInputs(container);
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
    it('adds a new skill via the Add Skill button', () => {
      const { getState } = setup();
      fireEvent.click(screen.getByRole('button', { name: /Add Skill/i }));
      expect(getState().skillBonuses['']).toBe('');
    });

    it('removes a skill via its remove button', () => {
      const { getState } = setup();
      fireEvent.click(screen.getAllByRole('button', { name: /Remove skill/i })[0]);
      const bonuses = getState().skillBonuses;
      expect(bonuses.perception).toBeUndefined();
      expect(bonuses.stealth).toBe('+5');
    });

    it('renames a skill by editing its name input', () => {
      const { container, getState } = setup();
      fireEvent.change(getSkillNameInputs(container)[0], { target: { value: 'investigation' } });
      const bonuses = getState().skillBonuses;
      expect(bonuses.investigation).toBe('+3');
      expect(bonuses.perception).toBeUndefined();
      expect(bonuses.stealth).toBe('+5');
    });

    it('updates a skill bonus value', () => {
      const { container, getState } = setup();
      fireEvent.change(getSkillBonusInputs(container)[0], { target: { value: '+7' } });
      expect(getState().skillBonuses.perception).toBe('+7');
    });
  });

  describe('defense fields', () => {
    it('parses comma-separated values ignoring surrounding whitespace', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('fire, cold, poison'), { target: { value: '  fire  ,  cold  ,  lightning  ' } });
      expect(getState().damageResistances).toEqual(['fire', 'cold', 'lightning']);
    });

    it('filters empty entries from comma-separated input', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('fire, cold, poison'), { target: { value: 'fire,,poison,  ' } });
      expect(getState().damageResistances).toEqual(['fire', 'poison']);
    });

    it('clears condition immunities when the input is emptied', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('charmed, frightened'), { target: { value: '' } });
      expect(getState().conditionImmunities).toEqual([]);
    });
  });

  describe('actions', () => {
    it('adds a new empty action via the Add Action button', () => {
      const { getState } = setup();
      fireEvent.click(screen.getByRole('button', { name: /Add Action/i }));
      expect(getState().actions).toHaveLength(2);
      expect(getState().actions[1]).toEqual({
        name: '', attack_bonus: '', damage_dice_primary: '', damage_type_primary: '',
        damage_dice_secondary: '', damage_type_secondary: '', description: '',
      });
    });

    it('removes an action via its remove button', () => {
      const { getState } = setup();
      fireEvent.click(screen.getByRole('button', { name: /Remove action/i }));
      expect(getState().actions).toEqual([]);
    });

    it('removes the correct action when multiple exist', () => {
      const { getState } = setup(createFormData({
        actions: [
          { name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8+3', damage_type_primary: 'slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
          { name: 'Shortbow', attack_bonus: '+4', damage_dice_primary: '1d6+2', damage_type_primary: 'piercing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
        ],
      }));
      const removeButtons = screen.getAllByRole('button', { name: /Remove action/i });
      expect(removeButtons).toHaveLength(2);
      fireEvent.click(removeButtons[0]);
      const actions = getState().actions;
      expect(actions).toHaveLength(1);
      expect(actions[0].name).toBe('Shortbow');
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

    it('updates only the targeted action when multiple exist', () => {
      const { getState } = setup(createFormData({
        actions: [
          { name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8+3', damage_type_primary: 'slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
          { name: 'Shortbow', attack_bonus: '+4', damage_dice_primary: '1d6+2', damage_type_primary: 'piercing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
        ],
      }));
      fireEvent.change(screen.getAllByPlaceholderText('Action name')[0], { target: { value: 'Mace' } });
      const actions = getState().actions;
      expect(actions[0].name).toBe('Mace');
      expect(actions[0].attack_bonus).toBe('+5');
      expect(actions[1]).toEqual({
        name: 'Shortbow', attack_bonus: '+4', damage_dice_primary: '1d6+2', damage_type_primary: 'piercing', damage_dice_secondary: '', damage_type_secondary: '', description: '',
      });
    });
  });

  describe('traits and reactions', () => {
    it('updates the traits textarea', () => {
      const { getState } = setup();
      fireEvent.change(screen.getByPlaceholderText('Special traits (one per line or markdown)'), { target: { value: 'New traits text' } });
      expect(getState().traits).toBe('New traits text');
    });

  });
});
