// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => String(html || '')),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  return {
    default: vi.fn(() => ({
      popupHtml: _popupHtml,
      setPopupHtml: _setPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  const defaultEffects = {
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    abilityCheckDisadvantage: false,
    autoFailSaves: [],
    saveDisadvantage: [],
    cannotAct: false,
    speedZero: false,
    concentrationBroken: false,
    targetAdvantageCount: 0,
    targetDisadvantageCount: 0,
    targetAdvantageIfWithin5ft: false,
    targetDisadvantageIfBeyond5ft: false,
    autoCritWithin5ft: false,
    resistantToAll: false,
    poisonImmune: false,
    saveAdvantage: [],
    saveAdvantageCount: 0,
    saveDisadvantageCount: 0,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    strSaveReplace: false,
    strCheckReplace: false,
    reliableTalent: false,
    tacticalMind: false,
    tacticalMindBonus: null,
  };

  let _computeReturn = null;
  const computeConditionEffects = vi.fn((_conditions) => {
    return _computeReturn ?? { ...defaultEffects };
  });

  return {
    computeConditionEffects,
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setComputeReturn(val) { _computeReturn = val; },
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  const DEFAULT_CREATURE = { name: 'Goblin', conditions: [] };
  let _findCreatureReturn = null;

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { ...DEFAULT_CREATURE };
    }),
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

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  // ════════════════════════════════════════════
  // Null/undefined monster handling
  // ════════════════════════════════════════════

  describe('null/undefined monster', () => {
    it('renders nothing when monster is falsy', () => {
      render(<MonsterCardModal {...makeProps(null)} />);
      expect(document.querySelector('.mc-overlay')).not.toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Overlay and card structure
  // ════════════════════════════════════════════

  describe('overlay and card structure', () => {
    it('renders the overlay and card when monster exists', () => {
      render(<MonsterCardModal {...makeProps(makeMonster())} />);
      expect(document.querySelector('.mc-overlay')).toBeInTheDocument();
      expect(document.querySelector('.mc-card')).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Close behavior
  // ════════════════════════════════════════════

  describe('close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when the overlay is clicked', () => {
      const onClose = vi.fn();
      render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
      fireEvent.click(document.querySelector('.mc-overlay'));
      expect(onClose).toHaveBeenCalled();
    });

    it('does not close when the card body is clicked', () => {
      const onClose = vi.fn();
      render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
      fireEvent.click(document.querySelector('.mc-card'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════
  // Header: name and type line
  // ════════════════════════════════════════════

  describe('header: name and type line', () => {
    it('displays the monster name from data', () => {
      render(<MonsterCardModal {...makeProps(makeMonster({ name: 'Huge Dragon' }))} />);
      expect(screen.getByText('Huge Dragon')).toBeInTheDocument();
    });

    it('uses creatureName prop when provided', () => {
      render(<MonsterCardModal {...makeProps(makeMonster(), { creatureName: 'Boss Goblin' })} />);
      expect(screen.getByText('Boss Goblin')).toBeInTheDocument();
    });

    it('uses creatureName even when monster.name is empty', () => {
      render(<MonsterCardModal {...makeProps(makeMonster({ name: '' }), { creatureName: 'Named Goblin' })} />);
      expect(screen.getByText('Named Goblin')).toBeInTheDocument();
    });

    it('displays size, type, subtype, and alignment', () => {
      const m = makeMonster({ type: 'humanoid', subtype: 'goblinoid' });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Small humanoid \(goblinoid\), neutral evil/)).toBeInTheDocument();
    });

    it('omits subtype parentheses when empty', () => {
      const m = makeMonster({ type: 'humanoid', subtype: '' });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Small humanoid, neutral evil/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Stats: AC, HP, speed, initiative
  // ════════════════════════════════════════════

  describe('stats: AC, HP, speed, initiative', () => {
    it('displays armor class label and value', () => {
      render(<MonsterCardModal {...makeProps(makeMonster({ armor_class: 15 }))} />);
      expect(screen.getByText('Armor Class')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('shows HP with hit dice', () => {
      render(<MonsterCardModal {...makeProps(makeMonster({ hit_points: 7, hit_dice: '2d6' }))} />);
      expect(screen.getByText(/7 \(2d6\)/)).toBeInTheDocument();
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

    it('shows "Speed" label when speed is undefined or empty', () => {
      const m = makeMonster({});
      delete m.speed;
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Speed')).toBeInTheDocument();
    });

    it('renders initiative dice link with parseable bonus', () => {
      const m = makeMonster({ initiative_details: '+3' });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('does not render initiative section when data is absent', () => {
      const m = makeMonster({});
      delete m.initiative_details;
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Initiative')).not.toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Ability scores and modifiers
  // ════════════════════════════════════════════

  describe('ability scores and modifiers', () => {
    it('renders all six ability score labels', () => {
      render(<MonsterCardModal {...makeProps(makeMonster())} />);
      ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach((ab) => {
        expect(screen.getByText(ab)).toBeInTheDocument();
      });
    });

    it('displays ability score values from data', () => {
      render(<MonsterCardModal {...makeProps(makeMonster())} />);
      expect(screen.getByText('14')).toBeInTheDocument();
    });

    it('shows dash for missing ability score value or modifier', () => {
      const m1 = makeMonster({ ability_scores: {}, ability_score_modifiers: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: 0 } });
      render(<MonsterCardModal {...makeProps(m1)} />);
      expect(screen.getAllByText('-').length).toBeGreaterThan(0);

      const m2 = makeMonster({ ability_scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 10 }, ability_score_modifiers: {} });
      render(<MonsterCardModal {...makeProps(m2)} />);
      expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('displays positive and negative modifiers with correct signs', () => {
      const m = makeMonster({ ability_score_modifiers: { str: 3, dex: -2, con: 0, int: 0, wis: -1, cha: 4 } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('+3')).toBeInTheDocument();
      expect(screen.getByText('-2')).toBeInTheDocument();
      expect(screen.getAllByText('+0').length).toBeGreaterThan(1);
    });

    it('handles missing ability_scores and ability_score_modifiers gracefully', () => {
      const m = makeMonster({});
      delete m.ability_scores;
      delete m.ability_score_modifiers;
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('STR')).toBeInTheDocument();
      expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });
  });

  // ════════════════════════════════════════════
  // Saving throws and skills
  // ════════════════════════════════════════════

  describe('saving throws and skills', () => {
    it('renders saving throws section when present', () => {
      const m = makeMonster({ saving_throws: { str: { modifier: 2 }, dex: { modifier: 3 } } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Saving Throws')).toBeInTheDocument();
    });

    it('does not render saving throws when empty or missing', () => {
      const m = makeMonster({ saving_throws: {} });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Saving Throws')).not.toBeInTheDocument();
    });

    it('renders skills section when present', () => {
      const m = makeMonster({ skills: { stealth: { modifier: 3 }, perception: { modifier: 1 } } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Skills')).toBeInTheDocument();
    });

    it('does not render skills when empty or missing', () => {
      const m = makeMonster({ skills: {} });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Skills')).not.toBeInTheDocument();
    });

    it('renders negative saving throw and skill modifiers', () => {
      const m = makeMonster({ saving_throws: { wis: { modifier: -1 } }, skills: { history: { modifier: -2 } } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/WIS -1/)).toBeInTheDocument();
      expect(screen.getByText(/history -2/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Senses, languages, defenses
  // ════════════════════════════════════════════

  describe('senses, languages, and defenses', () => {
    it('renders senses section when present', () => {
      const m = makeMonster({ senses: { darkvision: '60 ft.', blindsight: null, truesight: null } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Senses')).toBeInTheDocument();
    });

    it('does not render senses when none present', () => {
      const m = makeMonster({ senses: {} });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Senses')).not.toBeInTheDocument();
    });

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

    it('renders damage vulnerabilities, resistances, and immunities', () => {
      const m = makeMonster({
        damage_vulnerabilities: ['psychic'],
        damage_resistances: ['cold', 'poison'],
        damage_immunities: ['fire', 'lightning'],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Damage Vuln.')).toBeInTheDocument();
      expect(screen.getByText('cold, poison')).toBeInTheDocument();
      expect(screen.getByText('Damage Resist.')).toBeInTheDocument();
      expect(screen.getByText('fire, lightning')).toBeInTheDocument();
      expect(screen.getByText('Damage Imm')).toBeInTheDocument();
    });

    it('does not render damage sections when empty', () => {
      const m = makeMonster({
        damage_vulnerabilities: [],
        damage_resistances: [],
        damage_immunities: [],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Damage Vuln.')).not.toBeInTheDocument();
      expect(screen.queryByText('Damage Resist.')).not.toBeInTheDocument();
      expect(screen.queryByText('Damage Imm')).not.toBeInTheDocument();
    });

    it('renders condition immunities with comma separation', () => {
      const m = makeMonster({ condition_immunities: ['charmed', 'frightened', 'poisoned'] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Condition Imm')).toBeInTheDocument();
      expect(screen.getByText('charmed, frightened, poisoned')).toBeInTheDocument();
    });

    it('does not render condition immunities when empty', () => {
      const m = makeMonster({ condition_immunities: [] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Condition Imm')).not.toBeInTheDocument();
    });

    it('renders challenge rating and XP', () => {
      const m = makeMonster({ challenge_rating: '1/4', xp: 25 });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('CR')).toBeInTheDocument();
    });

    it('renders legendary resistance with per-day count', () => {
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
  });

  // ════════════════════════════════════════════
  // Traits
  // ════════════════════════════════════════════

  describe('traits', () => {
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

    it('renders trait with attack bonus, damage dice, and save DC', () => {
      const m = makeMonster({ actions: [], traits: [
        { name: 'Sting', description: '', attack_bonus: 3 },
        { name: 'Bite', description: '', attack_bonus: null, damage_dice_primary: '1d8' },
        { name: 'Petrification Gaze', description: '', save_dc: 14, save_type: 'Constitution' },
      ]});
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('+3')).toBeInTheDocument();
      expect(screen.getByText('1d8')).toBeInTheDocument();
      expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Actions
  // ════════════════════════════════════════════

  describe('actions', () => {
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

    it('renders attack bonus, damage dice, and save DC in actions', () => {
      const m = makeMonster({ actions: [
        { name: 'Club', description: '', attack_bonus: 4, damage_dice_primary: null },
        { name: 'Bite', description: '', attack_bonus: null, damage_dice_primary: '1d4 + 2' },
        { name: 'Stench Cloud', description: '', save_dc: 13, save_type: 'Constitution' },
      ]});
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('+4')).toBeInTheDocument();
      expect(screen.getByText('1d4 + 2')).toBeInTheDocument();
      expect(screen.getByText(/DC 13/)).toBeInTheDocument();
    });

    it('renders action usage and recharge', () => {
      const m = makeMonster({ actions: [
        { name: 'Longbow', description: '', usage: '/attack' },
        { name: 'Magic Missile', description: '', recharge: '5-6' },
      ]});
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/\/attack/)).toBeInTheDocument();
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
      expect(screen.getByText(/Bite/)).toBeInTheDocument();
      expect(screen.getByText(/Sting/)).toBeInTheDocument();
    });

    it('renders action with reach and range properties', () => {
      const m = makeMonster({ actions: [
        { name: 'Glaive', description: '', attack_bonus: 5, damage_dice_primary: '1d10 + 3', reach: '10 ft.' },
        { name: 'Fireball', description: '', attack_bonus: null, damage_dice_primary: '8d6', damage_type_primary: 'Fire', range: '150 ft.' },
      ]});
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Glaive/)).toBeInTheDocument();
      expect(screen.getByText(/Fireball/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Reactions, legendary actions, lair actions, regional effects
  // ════════════════════════════════════════════

  describe('reactions, legendary, lair, and regional', () => {
    it('renders reactions when present and not when empty', () => {
      const m = makeMonster({ reactions: [{ name: 'Opportunity Attack', description: '' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    it('does not render reactions when empty', () => {
      const m = makeMonster({ reactions: [] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Reactions')).not.toBeInTheDocument();
    });

    it('renders legendary actions when present and not when empty', () => {
      const m = makeMonster({ legendary_actions: [{ name: 'Tail Attack', description: '' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Legendary Actions')).toBeInTheDocument();
    });

    it('does not render legendary actions when empty', () => {
      const m = makeMonster({ legendary_actions: [] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Legendary Actions')).not.toBeInTheDocument();
    });

    it('renders lair actions from object and string formats', () => {
      const m = makeMonster({ lair_actions: [{ name: 'Darkness', description: '' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Lair Actions')).toBeInTheDocument();
    });

    it('does not render lair actions when empty', () => {
      const m = makeMonster({ lair_actions: [] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Lair Actions')).not.toBeInTheDocument();
    });

    it('renders regional effects from object and string formats', () => {
      const m = makeMonster({ regional_effects: { effects: [{ description: 'Foul stench.' }] } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Regional Effects')).toBeInTheDocument();
    });

    it('does not render regional effects when null or empty', () => {
      const m1 = makeMonster({ regional_effects: null });
      render(<MonsterCardModal {...makeProps(m1)} />);
      expect(screen.queryByText('Regional Effects')).not.toBeInTheDocument();

      const m2 = makeMonster({ regional_effects: { effects: [] } });
      render(<MonsterCardModal {...makeProps(m2)} />);
      expect(screen.queryByText('Regional Effects')).not.toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Description and source
  // ════════════════════════════════════════════

  describe('description and source', () => {
    it('renders description section when desc is present', () => {
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
  });

  // ════════════════════════════════════════════
  // Sections rendering together
  // ════════════════════════════════════════════

  describe('sections rendering together', () => {
    it('renders traits, actions, and reactions sections together', () => {
      const m = makeMonster({
        traits: [{ name: 'Trait A', description: '' }],
        actions: [{ name: 'Action A', description: '' }],
        reactions: [{ name: 'Reaction A', description: '' }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Trait A/)).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText(/Action A/)).toBeInTheDocument();
      expect(screen.getByText('Reactions')).toBeInTheDocument();
      expect(screen.getByText(/Reaction A/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Creatures prop and mapName integration
  // ════════════════════════════════════════════

  describe('creatures and mapName props', () => {
    it('renders when creatures is undefined', () => {
      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m, { creatures: undefined })} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });

    it('renders when mapName is provided', () => {
      const m = makeMonster();
      render(<MonsterCardModal {...makeProps(m, { mapName: 'map1' })} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });
  });
});
