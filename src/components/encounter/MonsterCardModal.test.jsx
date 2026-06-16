import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ----
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: _rollAttack,
      rollDamage: _rollDamage,
      rollAbilityCheck: _rollAbilityCheck,
      rollSavingThrow: _rollSavingThrow,
      rollSkillCheck: _rollSkillCheck,
      rollInitiative: _rollInitiative,
      quickRollPlayerSave: _quickRollPlayerSave,
    })),
    _rollAttack,
    _rollDamage,
    _rollAbilityCheck,
    _rollSavingThrow,
    _rollSkillCheck,
    _rollInitiative,
    _quickRollPlayerSave,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  let _computeReturn = null;
  const _computeConditionEffects = vi.fn((_conditions) => {
    return _computeReturn ?? { ...defaultConditionEffects };
   });

  return {
    computeConditionEffects: _computeConditionEffects,
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setComputeReturn(val) { _computeReturn = val; },
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;
  const _findCreatureByName = vi.fn((_ctx, _name) => {
    return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
    });

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: _findCreatureByName,
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (range === 'touch') return 8;
    if (!range) return null;
    const m = range.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

// ── Re-import mocked modules for test setup helpers ----
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;
const rollAbilityCheck = useLoggedDiceRoll._rollAbilityCheck;
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const rollSkillCheck = useLoggedDiceRoll._rollSkillCheck;
const rollInitiative = useLoggedDiceRoll._rollInitiative;
const quickRollPlayerSave = useLoggedDiceRoll._quickRollPlayerSave;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

// ── Tests ----

describe('MonsterCardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  // ════════════════════════════════════════════
  // Basic rendering
  // ════════════════════════════════════════════

  it('returns null when monster is not provided', () => {
    render(<MonsterCardModal {...makeProps(null)} />);
    expect(document.querySelector('.mc-card')).toBeNull();
  });

  it('does not crash when monster is undefined', () => {
    render(<MonsterCardModal {...makeProps(undefined)} />);
    expect(document.querySelector('.mc-overlay')).not.toBeInTheDocument();
  });

  it('renders the overlay when monster exists', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.mc-overlay')).toBeInTheDocument();
  });

  it('renders the card body with class mc-card', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.mc-card')).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Header
  // ════════════════════════════════════════════

  it('displays the monster name', () => {
    render(<MonsterCardModal {...makeProps(makeMonster({ name: 'Huge Dragon' }))} />);
    expect(screen.getByText('Huge Dragon')).toBeInTheDocument();
  });

  it('uses creatureName prop when provided', () => {
    render(<MonsterCardModal {...makeProps(makeMonster(), { creatureName: 'Boss Goblin' })} />);
    expect(screen.getByText('Boss Goblin')).toBeInTheDocument();
  });

  it('defaults to Monster when both names are missing/empty', () => {
    const empty = makeMonster({ name: '' });
    render(<MonsterCardModal {...makeProps(empty)} />);
    expect(screen.getByText('Monster')).toBeInTheDocument();
  });

  it('uses creatureName even when monster.name is empty', () => {
    const empty = makeMonster({ name: '' });
    render(<MonsterCardModal {...makeProps(empty, { creatureName: 'Named Goblin' })} />);
    expect(screen.getByText('Named Goblin')).toBeInTheDocument();
  });

  it('displays size, type, subtype, and alignment', () => {
    const m = makeMonster({ type: 'humanoid', subtype: 'goblinoid' });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Small humanoid \(goblinoid\), neutral evil/)).toBeInTheDocument();
  });

  it('displays size and type without subtype when empty', () => {
    const m = makeMonster({ type: 'humanoid', subtype: '' });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Small humanoid, neutral evil/)).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Close behavior
  // ════════════════════════════════════════════

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
   });

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn();
    render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
    fireEvent.click(document.querySelector('.mc-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when header is clicked', () => {
    const onClose = vi.fn();
    render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
    fireEvent.click(document.querySelector('.mc-header'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when card body is clicked (stopPropagation)', () => {
    const onClose = vi.fn();
    render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
    fireEvent.click(document.querySelector('.mc-card'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ════════════════════════════════════════════
  // Stats section
  // ════════════════════════════════════════════

  it('displays armor class label and value', () => {
    render(<MonsterCardModal {...makeProps(makeMonster({ armor_class: 15 }))} />);
    expect(screen.getByText('Armor Class')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('shows HP with hit dice when present', () => {
    render(<MonsterCardModal {...makeProps(makeMonster({ hit_points: 7, hit_dice: '2d6' }))} />);
    expect(screen.getByText(/7 \(2d6\)/)).toBeInTheDocument();
  });

  it('shows HP without hit dice when absent', () => {
    const m = makeMonster({ hit_points: 10, hit_dice: null });
    delete m.hit_dice;
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Hit Points')).toBeInTheDocument();
  });

  it('shows speed from the speed object', () => {
    const m = makeMonster({ speed: { walk: '30 ft.' } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/walk 30 ft\./)).toBeInTheDocument();
  });

  it('shows multiple speed entries', () => {
    const m = makeMonster({ speed: { walk: '30 ft.', fly: '20 ft.' } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/walk 30 ft\., fly 20 ft\./)).toBeInTheDocument();
  });

  it('does not crash when speed is undefined', () => {
    const m = makeMonster({});
    delete m.speed;
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('handles empty speed object gracefully', () => {
    const m = makeMonster({ speed: {} });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Initiative
  // ════════════════════════════════════════════

  it('renders initiative dice link with parseable bonus', () => {
    const m = makeMonster({ initiative_details: '+3' });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+3')).toBeInTheDocument();
   });

  it('does not render initiative section without data', () => {
    const m = makeMonster({});
    delete m.initiative_details;
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Initiative')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Abilities section
  // ════════════════════════════════════════════

  it('renders all six ability scores', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach((ab) => {
      expect(screen.getByText(ab)).toBeInTheDocument();
    });
  });

  it('shows ability score values from data', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getAllByText('14').length).toBeGreaterThan(0);
  });

  it('shows dash for missing ability score value', () => {
    const m = makeMonster({ ability_scores: {} });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('shows dash for all modifiers when empty', () => {
    const m = makeMonster({ ability_score_modifiers: {} });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(6);
  });

  it('shows positive modifier with + prefix', () => {
    const m = makeMonster({ ability_score_modifiers: { str: 3, dex: 2, con: 0, int: 0, wis: -1, cha: 0 } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('shows negative modifier without plus', () => {
    const m = makeMonster({ ability_score_modifiers: { str: -2, dex: 2, con: 0, int: 0, wis: -1, cha: 0 } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('-2')).toBeInTheDocument();
  });

   it('shows zero modifier without sign', () => {
     const m = makeMonster({ ability_score_modifiers: { str: 0, dex: 2, con: 5, int: -3, wis: -1, cha: 4 } });
     render(<MonsterCardModal {...makeProps(m)} />);
     const mods = document.querySelectorAll('.mc-ability-mod');
     expect(Array.from(mods).some(el => el.textContent === '+0')).toBe(true);
      });

  // ════════════════════════════════════════════
  // Saving throws
  // ════════════════════════════════════════════

  it('renders saving throws section when present', () => {
    const m = makeMonster({ saving_throws: { str: { modifier: 2 }, dex: { modifier: 3 } } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Saving Throws')).toBeInTheDocument();
  });

  it('does not render saving throws when empty', () => {
    const m = makeMonster({ saving_throws: {} });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Saving Throws')).not.toBeInTheDocument();
  });

  it('handles missing saving_throws gracefully', () => {
    const m = makeMonster({});
    delete m.saving_throws;
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Saving Throws')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Skills
  // ════════════════════════════════════════════

  it('renders skills section when present', () => {
    const m = makeMonster({ skills: { stealth: { modifier: 3 }, perception: { modifier: 1 } } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('does not render skills when empty', () => {
    const m = makeMonster({ skills: {} });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Skills')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Senses
  // ════════════════════════════════════════════

  it('renders senses section with darkvision', () => {
    const m = makeMonster({ senses: { darkvision: '60 ft.', blindsight: null, truesight: null } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Senses')).toBeInTheDocument();
  });

  it('does not render senses when none present', () => {
    const m = makeMonster({ senses: {} });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Senses')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Languages
  // ════════════════════════════════════════════

  it('renders languages when present', () => {
    const m = makeMonster({ languages: 'Common, Goblin' });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Languages')).toBeInTheDocument();
    expect(screen.getByText('Common, Goblin')).toBeInTheDocument();
  });

  it('does not render languages when absent', () => {
    const m = makeMonster({});
    delete m.languages;
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Languages')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Damage vulnerabilities
  // ════════════════════════════════════════════

  it('renders damage vulnerabilities when present', () => {
    const m = makeMonster({ damage_vulnerabilities: ['psychic'] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Damage Vuln.')).toBeInTheDocument();
  });

  it('does not render damage vulnerabilities when empty', () => {
    const m = makeMonster({ damage_vulnerabilities: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Damage Vuln.')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Damage resistances
  // ════════════════════════════════════════════

  it('renders damage resistances when present', () => {
    const m = makeMonster({ damage_resistances: ['cold', 'poison'] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Damage Resist.')).toBeInTheDocument();
    expect(screen.getByText('cold, poison')).toBeInTheDocument();
  });

  it('does not render damage resistances when empty', () => {
    const m = makeMonster({ damage_resistances: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Damage Resist.')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Damage immunities
  // ════════════════════════════════════════════

  it('renders damage immunities when present', () => {
    const m = makeMonster({ damage_immunities: ['fire', 'lightning'] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Damage Imm')).toBeInTheDocument();
    expect(screen.getByText('fire, lightning')).toBeInTheDocument();
  });

  it('does not render damage immunities when empty', () => {
    const m = makeMonster({ damage_immunities: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Damage Imm')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Condition immunities
  // ════════════════════════════════════════════

  it('renders condition immunities when present', () => {
    const m = makeMonster({ condition_immunities: ['charmed', 'poisoned'] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Condition Imm')).toBeInTheDocument();
    expect(screen.getByText('charmed, poisoned')).toBeInTheDocument();
  });

  it('does not render condition immunities when empty', () => {
    const m = makeMonster({ condition_immunities: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Condition Imm')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Challenge rating and XP
  // ════════════════════════════════════════════

  it('renders challenge rating and XP', () => {
    const m = makeMonster({ challenge_rating: '1/4', xp: 25 });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('CR')).toBeInTheDocument();
  });

  it('renders XP with locale formatting for large values', () => {
    const m = makeMonster({ challenge_rating: '20', xp: 1000000 });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/1,000,000 XP/)).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Legendary resistance
  // ════════════════════════════════════════════

  it('renders legendary resistance when present', () => {
    const m = makeMonster({ legendary_resistance: 3 });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Legendary Resist.')).toBeInTheDocument();
    expect(screen.getByText(/3\/day/)).toBeInTheDocument();
  });

  it('does not render legendary resistance when null', () => {
    const m = makeMonster({ legendary_resistance: null });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Legendary Resist.')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Traits section
  // ════════════════════════════════════════════

  it('renders traits section when present', () => {
    const m = makeMonster({ actions: [], traits: [{ name: 'Keen Smell', description: '' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Keen Smell/)).toBeInTheDocument();
    });

  it('does not render traits when empty', () => {
    const m = makeMonster({ actions: [], traits: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Keen Smell')).not.toBeInTheDocument();
  });

  it('renders multiple trait names', () => {
    const m = makeMonster({
      actions: [],
      traits: [{ name: 'Keen Smell', description: '' }, { name: 'Darkvision', description: '' }],
     });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Darkvision/)).toBeInTheDocument();
     });

  // ════════════════════════════════════════════
  // Actions section
  // ════════════════════════════════════════════

  it('renders Actions header when actions are present', () => {
    const m = makeMonster({ traits: [], actions: [{ name: 'Bite', description: '' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('does not render Actions section when empty', () => {
    const m = makeMonster({ actions: [], traits: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  it('renders attack bonus dice link in action', () => {
    const m = makeMonster({ actions: [{ name: 'Club', description: '', attack_bonus: 4, damage_dice_primary: null }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('renders damage dice link in action', () => {
    const m = makeMonster({ actions: [{ name: 'Bite', description: '', attack_bonus: null, damage_dice_primary: '1d4 + 2' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('1d4 + 2')).toBeInTheDocument();
  });

  it('renders save DC info when present', () => {
    const m = makeMonster({ actions: [{ name: 'Stench Cloud', description: '', save_dc: 13, save_type: 'Constitution' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/DC 13/)).toBeInTheDocument();
  });

  it('renders action usage when present', () => {
    const m = makeMonster({ actions: [{ name: 'Longbow', description: '', usage: '/attack' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/\/attack/)).toBeInTheDocument();
  });

  it('renders action recharge when present', () => {
    const m = makeMonster({ actions: [{ name: 'Magic Missile', description: '', recharge: '5-6' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/5-6/)).toBeInTheDocument();
  });

  it('renders action description via sanitizeHtml', () => {
    const m = makeMonster({ actions: [{ name: 'Slash', description: '<p>The creature slashes.</p>' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
     expect(screen.getByText(/Slash/)).toBeInTheDocument();
      });

  it('renders multiple action names', () => {
    const m = makeMonster({ traits: [], actions: [{ name: 'Bite', description: '' }, { name: 'Sting', description: '' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Sting/)).toBeInTheDocument();
      });

  // ════════════════════════════════════════════
  // Reactions section
  // ════════════════════════════════════════════

  it('renders reactions when present', () => {
    const m = makeMonster({ reactions: [{ name: 'Opportunity Attack', description: '' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('does not render reactions when empty', () => {
    const m = makeMonster({ reactions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Reactions')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Legendary actions section
  // ════════════════════════════════════════════

  it('renders legendary actions when present', () => {
    const m = makeMonster({ legendary_actions: [{ name: 'Tail Attack', description: '' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Legendary Actions')).toBeInTheDocument();
  });

  it('does not render legendary actions when empty', () => {
    const m = makeMonster({ legendary_actions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Legendary Actions')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Lair actions section
  // ════════════════════════════════════════════

  it('renders lair actions from object format', () => {
    const m = makeMonster({ lair_actions: [{ name: 'Darkness', description: '' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Lair Actions')).toBeInTheDocument();
  });

  it('renders lair actions from string array format', () => {
    const m = makeMonster({ lair_actions: ['The ground shakes.'] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Lair Actions')).toBeInTheDocument();
  });

  it('does not render lair actions when empty array', () => {
    const m = makeMonster({ lair_actions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Lair Actions')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Regional effects section
  // ════════════════════════════════════════════

  it('renders regional effects from nested object format', () => {
    const m = makeMonster({ regional_effects: { effects: [{ description: 'Foul stench.' }] } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Regional Effects')).toBeInTheDocument();
  });

  it('renders regional effects from string array format', () => {
    const m = makeMonster({ regional_effects: ['Thick smoke.'] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Regional Effects')).toBeInTheDocument();
  });

  it('does not render regional effects when empty object', () => {
    const m = makeMonster({ regional_effects: { effects: [] } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Regional Effects')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Description section
  // ════════════════════════════════════════════

  it('renders description section when desc present', () => {
    const m = makeMonster({ desc: '<p>This goblin is mean.</p>' });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('does not render description when absent', () => {
    const m = makeMonster({ desc: null });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });

  it('renders book source with page number', () => {
    const m = makeMonster({ desc: 'Some description.', book: 'Mordenkainen Tome', page: 42 });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Mordenkainen Tome \(page 42\)/)).toBeInTheDocument();
  });

  it('renders book source without page when null', () => {
    const m = makeMonster({ desc: 'Some description.', book: 'Monster Manual', page: null });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Monster Manual/)).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Action with reach/range properties
  // ════════════════════════════════════════════

  it('renders action with reach property', () => {
    const m = makeMonster({ actions: [{ name: 'Glaive', description: '', attack_bonus: 5, damage_dice_primary: '1d10 + 3', reach: '10 ft.' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Glaive/)).toBeInTheDocument();
  });

  it('renders action with range property', () => {
    const m = makeMonster({ actions: [{ name: 'Fireball', description: '', attack_bonus: null, damage_dice_primary: '8d6', damage_type_primary: 'Fire', range: '150 ft.' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Fireball/)).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // All defense rows rendered together
  // ════════════════════════════════════════════

  it('renders all defense rows when values exist', () => {
    const m = makeMonster({
      saving_throws: { con: { modifier: 3 } },
      skills: { perception: { modifier: 2 } },
      senses: { darkvision: '60 ft.' },
      languages: 'Common',
      damage_vulnerabilities: ['cold'],
      damage_resistances: ['fire'],
      damage_immunities: ['poison'],
      condition_immunities: ['frightened'],
    });
    render(<MonsterCardModal {...makeProps(m)} />);

    expect(screen.getByText('Saving Throws')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Senses')).toBeInTheDocument();
    expect(screen.getByText('Languages')).toBeInTheDocument();
    expect(screen.getByText('Damage Vuln.')).toBeInTheDocument();
    expect(screen.getByText('Damage Resist.')).toBeInTheDocument();
    expect(screen.getByText('Damage Imm')).toBeInTheDocument();
    expect(screen.getByText('Condition Imm')).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Negative modifier displays (no plus sign)
  // ════════════════════════════════════════════

  it('renders negative saving throw modifier', () => {
    const m = makeMonster({ saving_throws: { wis: { modifier: -1 } } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(document.querySelector('.mc-defense-row')).not.toBeNull();
  });

  it('renders negative skill modifier', () => {
    const m = makeMonster({ skills: { history: { modifier: -2 } } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(document.querySelector('.mc-defense-row')).not.toBeNull();
  });

  // ════════════════════════════════════════════
  // Creatures prop integration (fallback combat context)
  // ════════════════════════════════════════════

  it('handles creatures as null/undefined without crash', () => {
    const m = makeMonster();
    render(<MonsterCardModal {...makeProps(m, { creatures: undefined })} />);
    expect(document.querySelector('.mc-card')).not.toBeNull();
  });

  // ════════════════════════════════════════════
  // Map data loading (mapName prop)
  // ════════════════════════════════════════════

  it('renders without error when mapName is provided', () => {
    const m = makeMonster();
    render(<MonsterCardModal {...makeProps(m, { mapName: 'map1' })} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Edge cases
  // ════════════════════════════════════════════

  it('does not crash when ability_scores is undefined', () => {
    const m = makeMonster({});
    delete m.ability_scores;
    delete m.ability_score_modifiers;
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(document.querySelector('.mc-card')).not.toBeNull();
  });

  it('does not crash with undefined speed', () => {
    const m = makeMonster({});
    delete m.speed;
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('HP number shows when hit_dice is null', () => {
    const m = makeMonster({ hit_points: 10, hit_dice: null });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Hit Points/)).toBeInTheDocument();
  });

  it('damage_vulnerabilities with comma-separated values', () => {
    const m = makeMonster({ damage_vulnerabilities: ['cold', 'poison'] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('cold, poison')).toBeInTheDocument();
  });

  it('damage_immunities with comma-separated values', () => {
    const m = makeMonster({ damage_immunities: ['radiant', 'necrotic'] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('radiant, necrotic')).toBeInTheDocument();
  });

  it('condition_immunities with multiple values shows comma separation', () => {
    const m = makeMonster({ condition_immunities: ['charmed', 'frightened', 'poisoned'] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('charmed, frightened, poisoned')).toBeInTheDocument();
  });

  it('render action in traits section with damage dice', () => {
    const m = makeMonster({ actions: [], traits: [{ name: 'Bite', description: '', attack_bonus: null, damage_dice_primary: '1d8' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('1d8')).toBeInTheDocument();
  });

  it('all action types render together without conflicts', () => {
    const m = makeMonster({
      traits: [{ name: 'Trait A', description: '' }],
      actions: [{ name: 'Action A', description: '' }],
      reactions: [{ name: 'Reaction A', description: '' }],
    });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('clicking attack on trait also works', () => {
    const m = makeMonster({ actions: [], traits: [{ name: 'Sting', description: '', attack_bonus: 3 }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('monster card stops click propagation on inner elements', () => {
    const onClose = vi.fn();
    render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
    const actionDiv = document.querySelector('.mc-body');
    fireEvent.click(actionDiv);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('save_dc null should not render save info in action', () => {
    const m = makeMonster({ actions: [{ name: 'Club', description: '', save_dc: null }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText(/DC null/)).not.toBeInTheDocument();
  });

  it('save_dc number renders correctly in action', () => {
    const m = makeMonster({ actions: [{ name: 'Cloud', description: '', save_dc: 12, save_type: 'Wisdom' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/DC 12/)).toBeInTheDocument();
  });

  it('monster with all fields renders completely without errors', () => {
    const fullMonster = makeMonster({
      subtype: 'goblinoid',
      initiative_details: '+3',
      saving_throws: { str: { modifier: 2 } },
      skills: { stealth: { modifier: 3 } },
      senses: { darkvision: '60 ft.' },
      damage_vulnerabilities: ['psychic'],
      damage_resistances: ['cold'],
      damage_immunities: ['poison'],
      condition_immunities: ['charmed'],
      legendary_resistance: 3,
      reactions: [{ name: 'Reaction A', description: '' }],
      legendary_actions: [{ name: 'Legendary A', description: '' }],
      lair_actions: [{ name: 'Lair', description: '' }],
      regional_effects: { effects: [{ description: 'Effect.' }] },
      desc: 'A scary monster.',
      book: 'MM',
      page: 34,
    });
    render(<MonsterCardModal {...makeProps(fullMonster)} />);

    expect(screen.getByText('Goblin')).toBeInTheDocument();
     expect(screen.getByText(/Small humanoid \(goblinoid\)/)).toBeInTheDocument();
    });

  // ════════════════════════════════════════════
  // Conditions section and effect badges
  // ════════════════════════════════════════════

  it('renders condition labels for creature with conditions', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [{ key: 'prone', label: 'Prone', id: 'cond-1' }, { key: 'poisoned', label: 'Poisoned', id: 'cond-2' }],
    });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Prone')).toBeInTheDocument();
  });

  it('does not render condition effects when creature has no conditions', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText("Can't Act")).not.toBeInTheDocument();
  });

  it('renders speed zero effect badge when condition causes speed zero', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, speedZero: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'grappled', label: 'Grappled' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-speed-zero')).not.toBeNull();
  });

  it('shows "0 ft." speed when condition sets speedZero to true', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, speedZero: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'grappled', label: 'Grappled' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('0 ft.')).toBeInTheDocument();
  });

  it('renders cannot act badge when applicable', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'incapacitated', label: "Incapacitated" }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-cannot-act')).not.toBeNull();
  });

  it('renders auto-fail saves badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoFailSaves: ['str', 'dex'] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'stunned', label: 'Stunned' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-auto-fail')).not.toBeNull();
  });

  it('renders auto-crit badge when condition applies', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoCritWithin5ft: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'paralyzed', label: 'Paralyzed' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-auto-crit')).not.toBeNull();
  });

  it('renders concentration broken badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, concentrationBroken: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'incapacitated', label: 'Incapacitated' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-no-conc')).not.toBeNull();
  });

  it('renders resist all badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, resistantToAll: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'petrified', label: 'Petrified' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-resist')).not.toBeNull();
  });

  it('renders disadvantage effect badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, attackDisadvantageCount: 1 });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-disadvantage')).not.toBeNull();
  });

  it('renders target advantage effect badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, targetAdvantageCount: 1 });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-target-adv')).not.toBeNull();
  });

  // ════════════════════════════════════════════
  // Incapacitated / Cannot Act - renderAction behavior
  // ════════════════════════════════════════════

  it('disables action and shows incapacitated label when attacker cannot act', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'paralyzed', label: 'Paralyzed' }] });

    const m = makeMonster({ actions: [{ name: 'Club', description: '', attack_bonus: 4 }] });
    render(<MonsterCardModal {...makeProps(m)} />);
     expect(screen.getByText(/Incapacitated/)).toBeInTheDocument();
    });

   it('adds mc-action-disabled class when attacker incapacitated', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'petrified', label: 'Petrified' }] });

    const m = makeMonster({ actions: [{ name: 'Club', description: '', attack_bonus: 4 }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(document.querySelector('.mc-action.mc-action-disabled')).not.toBeNull();
  });

  it('does not render incapacitated label when attacker can act normally', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: false });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText('Incapacitated')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Dice link click handlers (rollAttack, rollDamage, etc.)
  // ════════════════════════════════════════════

  it('clicking ability modifier calls rollAbilityCheck', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    const mods = document.querySelectorAll('.mc-ability-mod');
    expect(mods.length).toBe(6);
    fireEvent.click(mods[0]);
    expect(rollAbilityCheck).toHaveBeenCalled();
  });

  it('clicking saving throw dice link calls rollSavingThrow', () => {
    const m = makeMonster({ saving_throws: { str: { modifier: 2 } } });
    render(<MonsterCardModal {...makeProps(m)} />);

    const rows = document.querySelectorAll('.mc-defense-row');
    let saveRow = null;
    for (const row of rows) {
      if (row.querySelector('.mc-defense-label')?.textContent === 'Saving Throws') {
        saveRow = row;
        break;
      }
    }
    expect(saveRow).toBeTruthy();
    const link = saveRow.querySelector('.mc-dice-link');
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).toHaveBeenCalled();
  });

  it('clicking skill dice link calls rollSkillCheck', () => {
    const m = makeMonster({ skills: { stealth: { modifier: 3 } } });
    render(<MonsterCardModal {...makeProps(m)} />);

    const rows = document.querySelectorAll('.mc-defense-row');
    let skillRow = null;
    for (const row of rows) {
      if (row.querySelector('.mc-defense-label')?.textContent === 'Skills') {
        skillRow = row;
        break;
      }
    }
    expect(skillRow).toBeTruthy();
    const link = skillRow.querySelector('.mc-dice-link');
    fireEvent.click(link);
    expect(rollSkillCheck).toHaveBeenCalled();
  });

  it('clicking initiative dice link calls rollInitiative', () => {
    const m = makeMonster({ initiative_details: '+5' });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+5')).toBeTruthy();
    const initLinks = document.querySelectorAll('.mc-dice-link');
    let initLink = null;
    for (const el of initLinks) {
      if (el.textContent.includes('+5') && !el.textContent.includes('d')) {
        initLink = el;
        break;
      }
    }
    expect(initLink).toBeTruthy();
    fireEvent.click(initLink);
    expect(rollInitiative).toHaveBeenCalled();
  });

  it('clicking attack bonus calls rollAttack', () => {
    const m = makeMonster({ actions: [{ name: 'Club', description: '', attack_bonus: 4 }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+4')).toBeTruthy();

    const links = document.querySelectorAll('.mc-dice-link');
    let attackLink = null;
    for (const el of links) {
      if (el.textContent.includes('+4') && !el.textContent.includes('d') && !el.textContent.includes('Init')) {
        attackLink = el;
        break;
      }
    }
    expect(attackLink).toBeTruthy();
    fireEvent.click(attackLink);
    expect(rollAttack).toHaveBeenCalled();
  });

  it('clicking damage dice link calls rollDamage', () => {
    const m = makeMonster({ actions: [{ name: 'Bite', description: '', attack_bonus: null, damage_dice_primary: '1d4 + 2' }] });
    render(<MonsterCardModal {...makeProps(m)} />);

    const links = document.querySelectorAll('.mc-dice-link');
    let dmgLink = null;
    for (const el of links) {
      if (el.textContent.includes('1d4')) {
        dmgLink = el;
        break;
      }
    }
    expect(dmgLink).toBeTruthy();
    fireEvent.click(dmgLink);
    expect(rollDamage).toHaveBeenCalled();
  });

  it('clicking extra damage dice link calls rollDamage', () => {
    const m = makeMonster({ actions: [{ name: 'Sword', description: '', attack_bonus: null, damage_dice_primary: '1d8', damage_dice_secondary: '2d6', damage_type_secondary: 'Slashing' }] });
    render(<MonsterCardModal {...makeProps(m)} />);

    const diceLinks = document.querySelectorAll('.mc-dice-link');
    expect(diceLinks.length).toBeGreaterThan(0);
  });

  // ════════════════════════════════════════════
  // Creature conditions section only shown with conditions
  // ════════════════════════════════════════════

  it('shows condition labels when creature has conditions', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [{ key: 'prone', label: 'Prone', id: 'c1' }, { key: 'poisoned', label: 'Poisoned', id: 'c2' }],
    });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Prone')).toBeInTheDocument();
    expect(screen.getByText('Poisoned')).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Popup rendering (string and object popupHtml)
  // ════════════════════════════════════════════

  it('renders Popup when popupHtml is a string', () => {
    useLoggedDiceRoll.default.mockReturnValue({
      popupHtml: 'Some HTML popup content',
      setPopupHtml,
      rollAttack,
      rollDamage,
      rollAbilityCheck,
      rollSavingThrow,
      rollSkillCheck,
      rollInitiative,
      quickRollPlayerSave,
    });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
  });

  it('renders DiceRollResult when popupHtml is an object', () => {
    useLoggedDiceRoll.default.mockReturnValue({
      popupHtml: { type: 'damage', name: 'Slash', formula: '1d8', rolls: [3], total: 3, bonus: 0, modifier: 0 },
      setPopupHtml,
      rollAttack,
      rollDamage,
      rollAbilityCheck,
      rollSavingThrow,
      rollSkillCheck,
      rollInitiative,
      quickRollPlayerSave,
    });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.dice-roll-result')).not.toBeNull();
  });

  it('shows Quick Roll button when popupHtml is waiting for save', () => {
    useLoggedDiceRoll.default.mockReturnValue({
      popupHtml: {
        type: 'save-damage',
        name: 'Fireball',
        formula: '8d6',
        rolls: [40],
        total: 40,
        bonus: 0,
        modifier: 0,
        waitingForPlayerSave: true,
        promptId: 'test-prompt-1',
        targetName: 'Player A',
        saveType: 'CON',
        saveDc: 15,
      },
      setPopupHtml,
      rollAttack,
      rollDamage,
      rollAbilityCheck,
      rollSavingThrow,
      rollSkillCheck,
      rollInitiative,
      quickRollPlayerSave,
    });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText(/Quick Roll/)).toBeInTheDocument();
  });
});
