// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCStatBlockForm from './NPCStatBlockForm';

const baseFormData = {
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
};

function getSetFormData() {
  const setFormData = vi.fn();
  return { setFormData, getUpdates: () => {
    const updates = setFormData.mock.calls.map(call => call[0]);
    return updates;
  }};
}

describe('NPCStatBlockForm interactions', () => {
  describe('Combat stats field changes', () => {
    it('changes AC value', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const acInput = container.querySelector('input[type="number"][min="0"]');
      fireEvent.change(acInput, { target: { value: '18' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.armorClass).toBe(18);
    });

    it('sets AC to null when input is empty', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const acInput = container.querySelector('input[type="number"][min="0"]');
      fireEvent.change(acInput, { target: { value: '' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.armorClass).toBeNull();
    });

    it('changes HP value', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const hpInput = container.querySelector('input[placeholder="e.g., 45"]');
      fireEvent.change(hpInput, { target: { value: '100' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.hitPoints).toBe('100');
    });

    it('changes Hit Dice value', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const hdInput = container.querySelector('input[placeholder="e.g., 6d8"]');
      fireEvent.change(hdInput, { target: { value: '10d10' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.hitDice).toBe('10d10');
    });

    it('changes Initiative Bonus value', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      // The initiative input is a number input in the stats grid, 5th input (index 4)
      const numberInputs = container.querySelectorAll('input[type="number"]');
      // AC is first (min="0"), initiative is second (no min)
      // The initiative field stores raw string value
      fireEvent.change(numberInputs[1], { target: { value: '5' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.initiativeBonus).toBe('5');
    });
  });

  describe('Speed change preserves other speed properties', () => {
    it('retains climb speed when walk is edited', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const formWithExtraSpeed = {
        ...baseFormData,
        speed: { walk: '30 ft.', climb: '15 ft.' },
      };
      const { container } = render(<NPCStatBlockForm formData={formWithExtraSpeed} setFormData={setFormData} />);
      const speedInput = container.querySelector('input[placeholder="30 ft."]');
      fireEvent.change(speedInput, { target: { value: '40 ft.' } });
      const updates = getUpdates();
      const result = updates[0](formWithExtraSpeed);
      expect(result.speed.walk).toBe('40 ft.');
      expect(result.speed.climb).toBe('15 ft.');
    });
  });

  describe('Ability score changes', () => {
    it('updates a single ability score', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const abilityInputs = container.querySelectorAll('.npcs-ability-input');
      // STR is the first ability input
      fireEvent.change(abilityInputs[0], { target: { value: '18' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.abilityScores.str).toBe(18);
      expect(result.abilityScores.dex).toBe(14);
    });

    it('defaults to 0 when non-numeric value is entered', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const abilityInputs = container.querySelectorAll('.npcs-ability-input');
      fireEvent.change(abilityInputs[0], { target: { value: 'abc' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.abilityScores.str).toBe(0);
    });

    it('updates CON ability score', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const abilityInputs = container.querySelectorAll('.npcs-ability-input');
      // CON is the 3rd ability input (str, dex, con)
      fireEvent.change(abilityInputs[2], { target: { value: '20' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.abilityScores.con).toBe(20);
    });
  });

  describe('Saving throw bonus changes', () => {
    it('updates a saving throw bonus', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const saveInputs = container.querySelectorAll('.npcs-save-input');
      // STR is the first save input
      fireEvent.change(saveInputs[0], { target: { value: '+6' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.savingThrowBonuses.str).toBe('+6');
    });

    it('updates dex saving throw bonus', () => {
      const { setFormData, getUpdates } = getSetFormData();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const inputs = screen.getAllByTitle('Saving throw bonus');
      fireEvent.change(inputs[1], { target: { value: '+8' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.savingThrowBonuses.dex).toBe('+8');
    });
  });

  describe('Skill bonus mutations', () => {
    it('adds a new skill via Add Skill button', () => {
      const { setFormData, getUpdates } = getSetFormData();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Skill/i }));
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.skillBonuses['']).toBe('');
    });

    it('removes a skill via remove button', () => {
      const { setFormData, getUpdates } = getSetFormData();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const removeButtons = screen.getAllByRole('button', { name: /Remove skill/i });
      fireEvent.click(removeButtons[0]);
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.skillBonuses.perception).toBeUndefined();
      expect(result.skillBonuses.stealth).toBe('+5');
    });

    it('renames a skill by changing its name input', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const skillNameInputs = container.querySelectorAll('.npcs-skill-name');
      fireEvent.change(skillNameInputs[0], { target: { value: 'investigation' } });

      const updates = getUpdates();
      expect(updates.length).toBe(2);
      const removeResult = updates[0](baseFormData);
      expect(removeResult.skillBonuses.perception).toBeUndefined();
      const addResult = updates[1](baseFormData);
      expect(addResult.skillBonuses.investigation).toBe('+3');
    });

    it('does not rename when the name is unchanged', () => {
      const { setFormData } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const skillNameInputs = container.querySelectorAll('.npcs-skill-name');
      fireEvent.change(skillNameInputs[0], { target: { value: 'perception' } });
      expect(setFormData).not.toHaveBeenCalled();
    });

    it('updates skill bonus value', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const bonusInputs = container.querySelectorAll('.npcs-skill-bonus');
      fireEvent.change(bonusInputs[0], { target: { value: '+7' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.skillBonuses.perception).toBe('+7');
    });
  });

  describe('Defense array field parsing', () => {
    it('parses comma-separated values with extra spaces', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const resistInput = container.querySelector('input[placeholder="fire, cold, poison"]');
      fireEvent.change(resistInput, { target: { value: '  fire  ,  cold  ,  lightning  ' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.damageResistances).toEqual(['fire', 'cold', 'lightning']);
    });

    it('clears condition immunities on empty string', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const condInput = container.querySelector('input[placeholder="charmed, frightened"]');
      fireEvent.change(condInput, { target: { value: '' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.conditionImmunities).toEqual([]);
    });

    it('parses damage immunities', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const immInput = container.querySelector('input[placeholder="necrotic, psychic"]');
      fireEvent.change(immInput, { target: { value: 'fire, cold' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.damageImmunities).toEqual(['fire', 'cold']);
    });

    it('filters empty strings from comma-separated input', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const resistInput = container.querySelector('input[placeholder="fire, cold, poison"]');
      fireEvent.change(resistInput, { target: { value: 'fire,,poison,  ' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.damageResistances).toEqual(['fire', 'poison']);
    });
  });

  describe('Action mutations', () => {
    it('adds a new action via Add Action button', () => {
      const { setFormData, getUpdates } = getSetFormData();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Action/i }));
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions).toHaveLength(2);
      expect(result.actions[1]).toEqual({
        name: '', attack_bonus: '', damage_dice_primary: '', damage_type_primary: '',
        damage_dice_secondary: '', damage_type_secondary: '', description: '',
      });
    });

    it('removes an action via remove button', () => {
      const { setFormData, getUpdates } = getSetFormData();
      render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const removeBtn = screen.getByRole('button', { name: /Remove action/i });
      fireEvent.click(removeBtn);
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions).toHaveLength(0);
    });

    it('removes the correct action when multiple exist', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const data = {
        ...baseFormData,
        actions: [
          { name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8+3', damage_type_primary: 'slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
          { name: 'Shortbow', attack_bonus: '+4', damage_dice_primary: '1d6+2', damage_type_primary: 'piercing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
        ],
      };
      render(<NPCStatBlockForm formData={data} setFormData={setFormData} />);
      const removeButtons = screen.getAllByRole('button', { name: /Remove action/i });
      expect(removeButtons).toHaveLength(2);
      fireEvent.click(removeButtons[0]);
      const updates = getUpdates();
      const result = updates[0](data);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Shortbow');
    });

    it('adds action when actions is undefined', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const data = { ...baseFormData, actions: undefined };
      render(<NPCStatBlockForm formData={data} setFormData={setFormData} />);
      fireEvent.click(screen.getByRole('button', { name: /Add Action/i }));
      const updates = getUpdates();
      const result = updates[0](data);
      expect(result.actions).toHaveLength(1);
    });

    it('handles action change when prev.actions is undefined', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const nameInput = container.querySelector('.npcs-action-name');
      fireEvent.change(nameInput, { target: { value: 'Greatsword' } });
      const updates = getUpdates();
      const prev = { ...baseFormData, actions: undefined };
      const result = updates[0](prev);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Greatsword');
    });

    it('updates action name field', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const nameInput = container.querySelector('.npcs-action-name');
      fireEvent.change(nameInput, { target: { value: 'Mace' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions[0].name).toBe('Mace');
      expect(result.actions[0].attack_bonus).toBe('+5');
    });

    it('updates action attack bonus field', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const bonusInput = container.querySelector('.npcs-action-bonus');
      fireEvent.change(bonusInput, { target: { value: '+7' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions[0].attack_bonus).toBe('+7');
    });

    it('updates action primary damage dice', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const damageInput = container.querySelector('.npcs-action-damage');
      fireEvent.change(damageInput, { target: { value: '2d6+4' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions[0].damage_dice_primary).toBe('2d6+4');
    });

    it('updates action primary damage type', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const typeInput = container.querySelector('.npcs-action-damage-type');
      fireEvent.change(typeInput, { target: { value: 'bludgeoning' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions[0].damage_type_primary).toBe('bludgeoning');
    });

    it('updates action secondary damage dice', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const secDamageInput = container.querySelector('.npcs-action-damage-secondary');
      fireEvent.change(secDamageInput, { target: { value: '1d4' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions[0].damage_dice_secondary).toBe('1d4');
    });

    it('updates action secondary damage type', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const secTypeInput = container.querySelector('.npcs-action-damage-type-secondary');
      fireEvent.change(secTypeInput, { target: { value: 'acid' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions[0].damage_type_secondary).toBe('acid');
    });

    it('updates action description', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const textarea = container.querySelector('.npcs-action-desc');
      fireEvent.change(textarea, { target: { value: 'New description' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.actions[0].description).toBe('New description');
    });
  });

  describe('Traits and Reactions changes', () => {
    it('updates traits textarea', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const textareas = container.querySelectorAll('textarea');
      // textarea order: action description, traits, reactions
      fireEvent.change(textareas[1], { target: { value: 'New traits text' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.traits).toBe('New traits text');
    });

    it('updates reactions textarea', () => {
      const { setFormData, getUpdates } = getSetFormData();
      const { container } = render(<NPCStatBlockForm formData={baseFormData} setFormData={setFormData} />);
      const textareas = container.querySelectorAll('textarea');
      // reactions is the third textarea
      fireEvent.change(textareas[2], { target: { value: 'New reactions text' } });
      const updates = getUpdates();
      const result = updates[0](baseFormData);
      expect(result.reactions).toBe('New reactions text');
    });
  });
});
