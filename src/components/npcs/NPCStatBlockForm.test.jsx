import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCStatBlockForm from './NPCStatBlockForm.jsx';

describe('NPCStatBlockForm', () => {
  const mockSetFormData = vi.fn();

  const defaultFormData = {
    armorClass: 10,
    hitPoints: '45',
    hitDice: '6d8',
    speed: { walk: '30 ft.' },
    initiativeBonus: '',
    abilityScores: { str: 10, dex: 12, con: 14, int: 16, wis: 8, cha: 10 },
    savingThrowBonuses: {},
    skillBonuses: {},
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    actions: [],
    traits: '',
    reactions: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderForm = (formData) => {
    return render(
      <NPCStatBlockForm formData={formData} setFormData={mockSetFormData} />
    );
  };

  // ── Rendering ─────────────────────────────────────────────────────

  it('should render all section titles', () => {
    renderForm(defaultFormData);
    expect(screen.getByText('Combat Stats')).toBeInTheDocument();
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
    expect(screen.getByText('Skill Bonuses')).toBeInTheDocument();
    expect(screen.getByText('Defenses')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Traits')).toBeInTheDocument();
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('should render AC input with correct value', () => {
    renderForm(defaultFormData);
    const acInput = screen.getByPlaceholderText('10');
    expect(acInput).toBeInTheDocument();
    expect(acInput.value).toBe('10');
  });

  it('should render HP input with correct value', () => {
    renderForm(defaultFormData);
    const hpInput = screen.getByPlaceholderText('e.g., 45');
    expect(hpInput).toBeInTheDocument();
    expect(hpInput.value).toBe('45');
  });

  it('should render Hit Dice input with correct value', () => {
    renderForm(defaultFormData);
    const hdInput = screen.getByPlaceholderText('e.g., 6d8');
    expect(hdInput).toBeInTheDocument();
    expect(hdInput.value).toBe('6d8');
  });

  it('should render Speed input with correct value', () => {
    renderForm(defaultFormData);
    const speedInput = screen.getByPlaceholderText('30 ft.');
    expect(speedInput).toBeInTheDocument();
    expect(speedInput.value).toBe('30 ft.');
  });

  it('should render Initiative Bonus input', () => {
    renderForm(defaultFormData);
    const initInput = screen.getByPlaceholderText('+0');
    expect(initInput).toBeInTheDocument();
  });

  it('should render ability score inputs for all six abilities', () => {
    renderForm(defaultFormData);
    expect(screen.getByText('STR')).toBeInTheDocument();
    expect(screen.getByText('DEX')).toBeInTheDocument();
    expect(screen.getByText('CON')).toBeInTheDocument();
    expect(screen.getByText('INT')).toBeInTheDocument();
    expect(screen.getByText('WIS')).toBeInTheDocument();
    expect(screen.getByText('CHA')).toBeInTheDocument();
  });

  it('should render ability modifiers correctly', () => {
    renderForm(defaultFormData);
    // STR 10 = +0, DEX 12 = +1, CON 14 = +2, INT 16 = +3, WIS 8 = -1, CHA 10 = +0
    const mods = document.querySelectorAll('.npcs-ability-mod');
    expect(mods.length).toBe(6);
    expect(mods[0].textContent).toBe('+0'); // STR 10
    expect(mods[1].textContent).toBe('+1'); // DEX 12
    expect(mods[2].textContent).toBe('+2'); // CON 14
    expect(mods[3].textContent).toBe('+3'); // INT 16
    expect(mods[4].textContent).toBe('-1'); // WIS 8
    expect(mods[5].textContent).toBe('+0'); // CHA 10
  });

  it('should render saving throw bonus inputs for all abilities', () => {
    renderForm(defaultFormData);
    const saveInputs = screen.getAllByPlaceholderText('Save');
    expect(saveInputs.length).toBe(6);
  });

  it('should render Add Skill button', () => {
    renderForm(defaultFormData);
    expect(screen.getByText('Add Skill')).toBeInTheDocument();
  });

  it('should render Add Action button', () => {
    renderForm(defaultFormData);
    expect(screen.getByText('Add Action')).toBeInTheDocument();
  });

  it('should render damage resistances input', () => {
    renderForm(defaultFormData);
    expect(screen.getByPlaceholderText('fire, cold, poison')).toBeInTheDocument();
  });

  it('should render damage immunities input', () => {
    renderForm(defaultFormData);
    expect(screen.getByPlaceholderText('necrotic, psychic')).toBeInTheDocument();
  });

  it('should render condition immunities input', () => {
    renderForm(defaultFormData);
    expect(screen.getByPlaceholderText('charmed, frightened')).toBeInTheDocument();
  });

  it('should render traits textarea', () => {
    renderForm(defaultFormData);
    expect(screen.getByPlaceholderText('Special traits (one per line or markdown)')).toBeInTheDocument();
  });

  it('should render reactions textarea', () => {
    renderForm(defaultFormData);
    expect(screen.getByPlaceholderText('Reactions (one per line or markdown)')).toBeInTheDocument();
  });

  // ── Combat Stats field changes ────────────────────────────────────

  it('should handle AC field change', () => {
    renderForm(defaultFormData);
    const acInput = screen.getByPlaceholderText('10');
    fireEvent.change(acInput, { target: { value: '15' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle AC field change to empty string (sets null)', () => {
    renderForm(defaultFormData);
    const acInput = screen.getByPlaceholderText('10');
    fireEvent.change(acInput, { target: { value: '' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle HP field change', () => {
    renderForm(defaultFormData);
    const hpInput = screen.getByPlaceholderText('e.g., 45');
    fireEvent.change(hpInput, { target: { value: '100' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle Hit Dice field change', () => {
    renderForm(defaultFormData);
    const hdInput = screen.getByPlaceholderText('e.g., 6d8');
    fireEvent.change(hdInput, { target: { value: '10d10' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle Speed field change', () => {
    renderForm(defaultFormData);
    const speedInput = screen.getByPlaceholderText('30 ft.');
    fireEvent.change(speedInput, { target: { value: '40 ft.' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle Initiative Bonus field change', () => {
    renderForm(defaultFormData);
    const initInput = screen.getByPlaceholderText('+0');
    fireEvent.change(initInput, { target: { value: '5' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  // ── Ability Scores ────────────────────────────────────────────────

  it('should handle ability score change', () => {
    renderForm(defaultFormData);
    const strInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(strInput, { target: { value: '16' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle ability score change with empty value (defaults to 0)', () => {
    renderForm(defaultFormData);
    const strInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(strInput, { target: { value: '' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle saving throw bonus change', () => {
    renderForm(defaultFormData);
    const saveInput = screen.getAllByPlaceholderText('Save')[0];
    fireEvent.change(saveInput, { target: { value: '+4' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  // ── Skill Bonuses ─────────────────────────────────────────────────

  it('should not render skill rows when no skills', () => {
    renderForm(defaultFormData);
    expect(screen.queryByPlaceholderText('Skill name')).not.toBeInTheDocument();
  });

  it('should render skill rows when skills are present', () => {
    const formData = {
      ...defaultFormData,
      skillBonuses: { 'Perception': '+5', 'Stealth': '+3' },
    };
    renderForm(formData);
    expect(screen.getAllByPlaceholderText('Skill name').length).toBeGreaterThanOrEqual(2);
  });

  it('should handle skill bonus change', () => {
    const formData = {
      ...defaultFormData,
      skillBonuses: { 'Perception': '+5' },
    };
    renderForm(formData);
    const bonusInputs = document.querySelectorAll('.npcs-skill-bonus');
    expect(bonusInputs.length).toBeGreaterThanOrEqual(1);
    fireEvent.change(bonusInputs[0], { target: { value: '+7' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle skill name change (rename)', () => {
    const formData = {
      ...defaultFormData,
      skillBonuses: { 'Perception': '+5' },
    };
    renderForm(formData);
    const nameInput = screen.getAllByPlaceholderText('Skill name')[0];
    fireEvent.change(nameInput, { target: { value: 'Insight' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should not call setFormData when skill name is unchanged', () => {
    const formData = {
      ...defaultFormData,
      skillBonuses: { 'Perception': '+5' },
    };
    renderForm(formData);
    const nameInput = screen.getAllByPlaceholderText('Skill name')[0];
    fireEvent.change(nameInput, { target: { value: 'Perception' } });
    expect(mockSetFormData).not.toHaveBeenCalled();
  });

  it('should remove skill when remove button clicked', () => {
    const formData = {
      ...defaultFormData,
      skillBonuses: { 'Perception': '+5' },
    };
    renderForm(formData);
    const removeBtn = screen.getAllByTitle('Remove skill')[0];
    fireEvent.click(removeBtn);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should add empty skill when Add Skill button clicked', () => {
    renderForm(defaultFormData);
    const addSkillBtn = screen.getByText('Add Skill');
    fireEvent.click(addSkillBtn);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  // ── Defenses (Array Fields) ───────────────────────────────────────

  it('should handle damage resistances change', () => {
    renderForm(defaultFormData);
    const input = screen.getByPlaceholderText('fire, cold, poison');
    fireEvent.change(input, { target: { value: 'fire, cold' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle damage immunities change', () => {
    renderForm(defaultFormData);
    const input = screen.getByPlaceholderText('necrotic, psychic');
    fireEvent.change(input, { target: { value: 'poison' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle condition immunities change', () => {
    renderForm(defaultFormData);
    const input = screen.getByPlaceholderText('charmed, frightened');
    fireEvent.change(input, { target: { value: 'stunned' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should display pre-populated damage resistances', () => {
    const formData = {
      ...defaultFormData,
      damageResistances: ['fire', 'cold'],
    };
    renderForm(formData);
    const input = screen.getByPlaceholderText('fire, cold, poison');
    expect(input.value).toBe('fire, cold');
  });

  it('should display pre-populated damage immunities', () => {
    const formData = {
      ...defaultFormData,
      damageImmunities: ['necrotic'],
    };
    renderForm(formData);
    const input = screen.getByPlaceholderText('necrotic, psychic');
    expect(input.value).toBe('necrotic');
  });

  it('should display pre-populated condition immunities', () => {
    const formData = {
      ...defaultFormData,
      conditionImmunities: ['charmed'],
    };
    renderForm(formData);
    const input = screen.getByPlaceholderText('charmed, frightened');
    expect(input.value).toBe('charmed');
  });

  // ── Actions ───────────────────────────────────────────────────────

  it('should not render action rows when no actions', () => {
    renderForm(defaultFormData);
    expect(screen.queryByPlaceholderText('Action name')).not.toBeInTheDocument();
  });

  it('should render action rows when actions are present', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite', attack_bonus: '+4', damage_dice_primary: '1d6 + 2', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
      ],
    };
    renderForm(formData);
    expect(screen.getByPlaceholderText('Action name')).toBeInTheDocument();
  });

  it('should handle action name change', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite', attack_bonus: '+4', damage_dice_primary: '1d6 + 2', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
      ],
    };
    renderForm(formData);
    const nameInput = screen.getByPlaceholderText('Action name');
    fireEvent.change(nameInput, { target: { value: 'Claw' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle action attack bonus change', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite', attack_bonus: '+4', damage_dice_primary: '1d6 + 2', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
      ],
    };
    renderForm(formData);
    const bonusInput = screen.getByPlaceholderText('Atk bonus');
    fireEvent.change(bonusInput, { target: { value: '+6' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle action damage dice change', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite', attack_bonus: '+4', damage_dice_primary: '1d6 + 2', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
      ],
    };
    renderForm(formData);
    const damageInput = screen.getByPlaceholderText('Primary Damage Dice');
    fireEvent.change(damageInput, { target: { value: '2d6 + 3' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle action description change', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite', attack_bonus: '+4', damage_dice_primary: '1d6 + 2', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
      ],
    };
    renderForm(formData);
    const descInput = screen.getByPlaceholderText('Description');
    fireEvent.change(descInput, { target: { value: 'The creature bites.' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should remove action when remove button clicked', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite', attack_bonus: '+4', damage_dice_primary: '1d6 + 2', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
      ],
    };
    renderForm(formData);
    const removeBtn = screen.getAllByTitle('Remove action')[0];
    fireEvent.click(removeBtn);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should add new action when Add Action button clicked', () => {
    renderForm(defaultFormData);
    const addActionBtn = screen.getByText('Add Action');
    fireEvent.click(addActionBtn);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should render multiple actions', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite', attack_bonus: '+4', damage_dice_primary: '1d6 + 2', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
        { name: 'Claw', attack_bonus: '+6', damage_dice_primary: '2d4 + 3', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
      ],
    };
    renderForm(formData);
    expect(screen.getAllByPlaceholderText('Action name').length).toBe(2);
  });

  // ── Traits and Reactions ──────────────────────────────────────────

  it('should handle traits change', () => {
    renderForm(defaultFormData);
    const traitsInput = screen.getByPlaceholderText('Special traits (one per line or markdown)');
    fireEvent.change(traitsInput, { target: { value: 'Keen Sight' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle reactions change', () => {
    renderForm(defaultFormData);
    const reactionsInput = screen.getByPlaceholderText('Reactions (one per line or markdown)');
    fireEvent.change(reactionsInput, { target: { value: 'Opportunity Attack' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should display pre-populated traits', () => {
    const formData = {
      ...defaultFormData,
      traits: 'Keen Sight\nPack Tactics',
    };
    renderForm(formData);
    const traitsInput = screen.getByPlaceholderText('Special traits (one per line or markdown)');
    expect(traitsInput.value).toBe('Keen Sight\nPack Tactics');
  });

  it('should display pre-populated reactions', () => {
    const formData = {
      ...defaultFormData,
      reactions: 'Opportunity Attack',
    };
    renderForm(formData);
    const reactionsInput = screen.getByPlaceholderText('Reactions (one per line or markdown)');
    expect(reactionsInput.value).toBe('Opportunity Attack');
  });

  // ── Edge Cases ────────────────────────────────────────────────────

  it('should handle null armorClass (displays empty)', () => {
    const formData = { ...defaultFormData, armorClass: null };
    renderForm(formData);
    const acInput = screen.getByPlaceholderText('10');
    expect(acInput.value).toBe('');
  });

  it('should handle undefined abilityScores (defaults to 10)', () => {
    const formData = { ...defaultFormData, abilityScores: undefined };
    renderForm(formData);
    const mods = document.querySelectorAll('.npcs-ability-mod');
    expect(mods[0].textContent).toBe('+0'); // STR defaults to 10
  });

  it('should handle negative ability modifier display', () => {
    const formData = {
      ...defaultFormData,
      abilityScores: { str: 8, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    };
    renderForm(formData);
    const mods = document.querySelectorAll('.npcs-ability-mod');
    expect(mods[0].textContent).toBe('-1'); // STR 8 = -1
  });

  it('should handle positive ability modifier with plus sign', () => {
    const formData = {
      ...defaultFormData,
      abilityScores: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    };
    renderForm(formData);
    const mods = document.querySelectorAll('.npcs-ability-mod');
    expect(mods[0].textContent).toBe('+2'); // STR 14 = +2
  });

  it('should handle empty speed object', () => {
    const formData = { ...defaultFormData, speed: {} };
    renderForm(formData);
    const speedInput = screen.getByPlaceholderText('30 ft.');
    expect(speedInput.value).toBe('');
  });

  it('should handle missing speed property', () => {
    const formData = { ...defaultFormData };
    delete formData.speed;
    renderForm(formData);
    const speedInput = screen.getByPlaceholderText('30 ft.');
    expect(speedInput.value).toBe('');
  });

  it('should handle empty skillBonuses', () => {
    const formData = { ...defaultFormData, skillBonuses: {} };
    renderForm(formData);
    expect(screen.queryByPlaceholderText('Skill name')).not.toBeInTheDocument();
  });

  it('should handle undefined skillBonuses', () => {
    const formData = { ...defaultFormData };
    delete formData.skillBonuses;
    renderForm(formData);
    expect(screen.queryByPlaceholderText('Skill name')).not.toBeInTheDocument();
  });

  it('should handle empty actions array', () => {
    const formData = { ...defaultFormData, actions: [] };
    renderForm(formData);
    expect(screen.queryByPlaceholderText('Action name')).not.toBeInTheDocument();
  });

  it('should handle undefined actions', () => {
    const formData = { ...defaultFormData };
    delete formData.actions;
    renderForm(formData);
    expect(screen.queryByPlaceholderText('Action name')).not.toBeInTheDocument();
  });

  it('should handle empty damageResistances', () => {
    const formData = { ...defaultFormData, damageResistances: [] };
    renderForm(formData);
    const input = screen.getByPlaceholderText('fire, cold, poison');
    expect(input.value).toBe('');
  });

  it('should handle empty damageImmunities', () => {
    const formData = { ...defaultFormData, damageImmunities: [] };
    renderForm(formData);
    const input = screen.getByPlaceholderText('necrotic, psychic');
    expect(input.value).toBe('');
  });

  it('should handle empty conditionImmunities', () => {
    const formData = { ...defaultFormData, conditionImmunities: [] };
    renderForm(formData);
    const input = screen.getByPlaceholderText('charmed, frightened');
    expect(input.value).toBe('');
  });

  it('should handle savingThrowBonuses with pre-populated values', () => {
    const formData = {
      ...defaultFormData,
      savingThrowBonuses: { str: '+5', dex: '+3' },
    };
    renderForm(formData);
    const saveInputs = screen.getAllByPlaceholderText('Save');
    expect(saveInputs[0].value).toBe('+5'); // STR
    expect(saveInputs[1].value).toBe('+3'); // DEX
  });

  it('should handle skillBonuses with pre-populated values', () => {
    const formData = {
      ...defaultFormData,
      skillBonuses: { 'Perception': '+5' },
    };
    renderForm(formData);
    expect(screen.getByPlaceholderText('Skill name')).toBeInTheDocument();
  });

  it('should handle actions with pre-populated values', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite', attack_bonus: '+4', damage_dice_primary: '1d6 + 2', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: 'The creature bites.' },
      ],
    };
    renderForm(formData);
    const nameInput = screen.getByPlaceholderText('Action name');
    expect(nameInput.value).toBe('Bite');
  });

  it('should handle action with missing fields', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite' },
      ],
    };
    renderForm(formData);
    const nameInput = screen.getByPlaceholderText('Action name');
    expect(nameInput.value).toBe('Bite');
  });

  it('should handle traits as empty string', () => {
    const formData = { ...defaultFormData, traits: '' };
    renderForm(formData);
    const traitsInput = screen.getByPlaceholderText('Special traits (one per line or markdown)');
    expect(traitsInput.value).toBe('');
  });

  it('should handle reactions as empty string', () => {
    const formData = { ...defaultFormData, reactions: '' };
    renderForm(formData);
    const reactionsInput = screen.getByPlaceholderText('Reactions (one per line or markdown)');
    expect(reactionsInput.value).toBe('');
  });

  it('should handle traits as undefined', () => {
    const formData = { ...defaultFormData };
    delete formData.traits;
    renderForm(formData);
    const traitsInput = screen.getByPlaceholderText('Special traits (one per line or markdown)');
    expect(traitsInput.value).toBe('');
  });

  it('should handle reactions as undefined', () => {
    const formData = { ...defaultFormData };
    delete formData.reactions;
    renderForm(formData);
    const reactionsInput = screen.getByPlaceholderText('Reactions (one per line or markdown)');
    expect(reactionsInput.value).toBe('');
  });

  it('should handle hitPoints as empty string', () => {
    const formData = { ...defaultFormData, hitPoints: '' };
    renderForm(formData);
    const hpInput = screen.getByPlaceholderText('e.g., 45');
    expect(hpInput.value).toBe('');
  });

  it('should handle hitDice as empty string', () => {
    const formData = { ...defaultFormData, hitDice: '' };
    renderForm(formData);
    const hdInput = screen.getByPlaceholderText('e.g., 6d8');
    expect(hdInput.value).toBe('');
  });

  it('should handle initiativeBonus as empty string', () => {
    const formData = { ...defaultFormData, initiativeBonus: '' };
    renderForm(formData);
    const initInput = screen.getByPlaceholderText('+0');
    expect(initInput.value).toBe('');
  });

  it('should handle initiativeBonus with a value', () => {
    const formData = { ...defaultFormData, initiativeBonus: '5' };
    renderForm(formData);
    const initInput = screen.getByPlaceholderText('+0');
    expect(initInput.value).toBe('5');
  });

  it('should handle abilityScores with custom values', () => {
    const formData = {
      ...defaultFormData,
      abilityScores: { str: 16, dex: 14, con: 12, int: 10, wis: 8, cha: 18 },
    };
    renderForm(formData);
    const mods = document.querySelectorAll('.npcs-ability-mod');
    expect(mods[0].textContent).toBe('+3'); // STR 16
    expect(mods[1].textContent).toBe('+2'); // DEX 14
    expect(mods[2].textContent).toBe('+1'); // CON 12
    expect(mods[3].textContent).toBe('+0'); // INT 10
    expect(mods[4].textContent).toBe('-1'); // WIS 8
    expect(mods[5].textContent).toBe('+4'); // CHA 18
  });

  it('should handle abilityScores with score of 0', () => {
    const formData = {
      ...defaultFormData,
      abilityScores: { str: 0, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    };
    renderForm(formData);
    const mods = document.querySelectorAll('.npcs-ability-mod');
    expect(mods[0].textContent).toBe('-5'); // STR 0 = -5
  });

  it('should handle abilityScores with score of 20', () => {
    const formData = {
      ...defaultFormData,
      abilityScores: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    };
    renderForm(formData);
    const mods = document.querySelectorAll('.npcs-ability-mod');
    expect(mods[0].textContent).toBe('+5'); // STR 20 = +5
  });

  it('should handle array field with whitespace trimming', () => {
    renderForm(defaultFormData);
    const input = screen.getByPlaceholderText('fire, cold, poison');
    fireEvent.change(input, { target: { value: 'fire , cold , poison' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle array field with empty entries filtered out', () => {
    renderForm(defaultFormData);
    const input = screen.getByPlaceholderText('fire, cold, poison');
    fireEvent.change(input, { target: { value: 'fire,,cold' } });
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle removing the last action', () => {
    const formData = {
      ...defaultFormData,
      actions: [
        { name: 'Bite', attack_bonus: '+4', damage_dice_primary: '1d6 + 2', damage_type_primary: 'Slashing', damage_dice_secondary: '', damage_type_secondary: '', description: '' },
      ],
    };
    renderForm(formData);
    const removeBtn = screen.getAllByTitle('Remove action')[0];
    fireEvent.click(removeBtn);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle removing the last skill', () => {
    const formData = {
      ...defaultFormData,
      skillBonuses: { 'Perception': '+5' },
    };
    renderForm(formData);
    const removeBtn = screen.getAllByTitle('Remove skill')[0];
    fireEvent.click(removeBtn);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should handle adding action when actions is undefined', () => {
    const formData = { ...defaultFormData };
    delete formData.actions;
    renderForm(formData);
    const addActionBtn = screen.getByText('Add Action');
    fireEvent.click(addActionBtn);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('should render with minimal formData', () => {
    const formData = {};
    renderForm(formData);
    expect(screen.getByText('Combat Stats')).toBeInTheDocument();
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
  });

  it('should render all six ability groups', () => {
    renderForm(defaultFormData);
    const abilityGroups = document.querySelectorAll('.npcs-ability-group');
    expect(abilityGroups.length).toBe(6);
  });
});
