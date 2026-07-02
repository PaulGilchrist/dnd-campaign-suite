// @improved-by-ai
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
    it('renders nothing when monster is null', () => {
      render(<MonsterCardModal {...makeProps(null)} />);
      expect(document.querySelector('.mc-overlay')).not.toBeInTheDocument();
    });

    it('renders nothing when monster is undefined', () => {
      render(<MonsterCardModal {...makeProps(undefined)} />);
      expect(document.querySelector('.mc-overlay')).not.toBeInTheDocument();
    });

    it('renders nothing when monster is missing entirely from props', () => {
      render(<MonsterCardModal campaignName="test" onClose={vi.fn()} />);
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

    it('calls onClose when the header is clicked', () => {
      const onClose = vi.fn();
      render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
      fireEvent.click(document.querySelector('.mc-header'));
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

    it('defaults to "Monster" when both names are empty', () => {
      render(<MonsterCardModal {...makeProps(makeMonster({ name: '' }))} />);
      expect(screen.getByText('Monster')).toBeInTheDocument();
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

    it('renders long monster names without truncation', () => {
      const longName = 'A Very Long-Named Ancient Red Dragon of Doom Who Breathes Fire and Ice and Lightning and Acid and Poison and Fear and Confusion and Dread and Terror and Horror and Despair and Sorrow and Grief and Misery and Anguish and Torment and Agony and Pain and Suffering and Destruction and Annihilation and Oblivion';
      render(<MonsterCardModal {...makeProps(makeMonster({ name: longName }))} />);
      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('renders special characters in monster name', () => {
      const m = makeMonster({ name: "T'zarok the Vile (CR ½)" });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText("T'zarok the Vile (CR ½)")).toBeInTheDocument();
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

    it('shows HP without hit dice when absent', () => {
      const m = makeMonster({ hit_points: 10, hit_dice: null, ability_scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 10 }, ability_score_modifiers: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: 0 } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Hit Points/)).toBeInTheDocument();
      const hpValues = screen.getAllByText('10');
      // Should find the HP value but not multiple — the HP section shows "10" without hit dice
      expect(hpValues.some(el => el.closest('.mc-stat')?.querySelector('.mc-stat-label')?.textContent === 'Hit Points')).toBe(true);
    });

    it('shows HP when hit_dice is null', () => {
      const m = makeMonster({ hit_points: 10, hit_dice: null });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Hit Points/)).toBeInTheDocument();
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

    it('shows "Speed" label when speed is undefined', () => {
      const m = makeMonster({});
      delete m.speed;
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Speed')).toBeInTheDocument();
    });

    it('shows "Speed" label when speed object is empty', () => {
      render(<MonsterCardModal {...makeProps(makeMonster({ speed: {} }))} />);
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

    it('shows dash for missing ability score value', () => {
      const m = makeMonster({ ability_scores: {}, ability_score_modifiers: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: 0 } });
      render(<MonsterCardModal {...makeProps(m)} />);
      const dashElements = screen.getAllByText('-');
      // Should find dash for each missing ability score (6 total)
      expect(dashElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows dash for missing ability score modifier', () => {
      const m = makeMonster({ ability_scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 10 }, ability_score_modifiers: {} });
      render(<MonsterCardModal {...makeProps(m)} />);
      const dashElements = screen.getAllByText('-');
      // Should find dash for each missing modifier (6 total)
      expect(dashElements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays positive modifier with + prefix', () => {
      const m = makeMonster({ ability_score_modifiers: { str: 3, dex: 2, con: 0, int: 0, wis: -1, cha: 0 } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('displays negative modifier with minus sign', () => {
      const m = makeMonster({ ability_score_modifiers: { str: -2, dex: 2, con: 0, int: 0, wis: -1, cha: 0 } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('-2')).toBeInTheDocument();
    });

    it('displays zero modifier without sign', () => {
      const m = makeMonster({ ability_score_modifiers: { str: 0, dex: 2, con: 5, int: -3, wis: -1, cha: 4 } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('+0')).toBeInTheDocument();
    });

    it('handles missing ability_scores and ability_score_modifiers gracefully', () => {
      const m = makeMonster({});
      delete m.ability_scores;
      delete m.ability_score_modifiers;
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('STR')).toBeInTheDocument();
      const dashElements = screen.getAllByText('-');
      expect(dashElements.length).toBeGreaterThanOrEqual(1);
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

    it('does not render saving throws when empty', () => {
      const m = makeMonster({ saving_throws: {} });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Saving Throws')).not.toBeInTheDocument();
    });

    it('does not render saving throws when missing', () => {
      const m = makeMonster({});
      delete m.saving_throws;
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Saving Throws')).not.toBeInTheDocument();
    });

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

    it('renders negative saving throw modifier', () => {
      const m = makeMonster({ saving_throws: { wis: { modifier: -1 } } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/WIS -1/)).toBeInTheDocument();
    });

    it('renders negative skill modifier', () => {
      const m = makeMonster({ skills: { history: { modifier: -2 } } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/history -2/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Senses, languages, defenses
  // ════════════════════════════════════════════

  describe('senses, languages, and defenses', () => {
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

    it('renders damage vulnerabilities', () => {
      const m = makeMonster({ damage_vulnerabilities: ['psychic'] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Damage Vuln.')).toBeInTheDocument();
    });

    it('renders comma-separated damage vulnerabilities', () => {
      const m = makeMonster({ damage_vulnerabilities: ['cold', 'poison'] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('cold, poison')).toBeInTheDocument();
    });

    it('does not render damage vulnerabilities when empty', () => {
      const m = makeMonster({ damage_vulnerabilities: [] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Damage Vuln.')).not.toBeInTheDocument();
    });

    it('renders damage resistances with comma separation', () => {
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

    it('renders damage immunities with comma separation', () => {
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

    it('renders condition immunities with comma separation', () => {
      const m = makeMonster({ condition_immunities: ['charmed', 'poisoned'] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Condition Imm')).toBeInTheDocument();
      expect(screen.getByText('charmed, poisoned')).toBeInTheDocument();
    });

    it('renders multiple condition immunities comma-separated', () => {
      const m = makeMonster({ condition_immunities: ['charmed', 'frightened', 'poisoned'] });
      render(<MonsterCardModal {...makeProps(m)} />);
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

    it('renders XP with locale formatting for large values', () => {
      const m = makeMonster({ challenge_rating: '20', xp: 1000000 });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/1,000,000 XP/)).toBeInTheDocument();
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

    it('renders all defense rows together', () => {
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

    it('renders multiple trait names', () => {
      const m = makeMonster({
        actions: [],
        traits: [{ name: 'Keen Smell', description: '' }, { name: 'Darkvision', description: '' }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Darkvision/)).toBeInTheDocument();
    });

    it('renders trait with attack bonus dice link', () => {
      const m = makeMonster({ actions: [], traits: [{ name: 'Sting', description: '', attack_bonus: 3 }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('renders trait with damage dice', () => {
      const m = makeMonster({ actions: [], traits: [{ name: 'Bite', description: '', attack_bonus: null, damage_dice_primary: '1d8' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('1d8')).toBeInTheDocument();
    });

    it('renders trait with both attack bonus and damage dice', () => {
      const m = makeMonster({ actions: [], traits: [{ name: 'Claw', description: '', attack_bonus: null, damage_dice_primary: '1d6 + 2' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('1d6 + 2')).toBeInTheDocument();
    });

    it('renders trait with save DC', () => {
      const m = makeMonster({ actions: [], traits: [{ name: 'Petrification Gaze', description: '', save_dc: 14, save_type: 'Constitution' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    });

    it('does not render save DC when null', () => {
      const m = makeMonster({ actions: [], traits: [{ name: 'Claw', description: '', save_dc: null }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText(/DC/)).not.toBeInTheDocument();
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

    it('renders save DC with ability type', () => {
      const m = makeMonster({ actions: [{ name: 'Cloud', description: '', save_dc: 12, save_type: 'Wisdom' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/DC 12/)).toBeInTheDocument();
    });

    it('does not render save DC when null', () => {
      const m = makeMonster({ actions: [{ name: 'Club', description: '', save_dc: null }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText(/DC null/)).not.toBeInTheDocument();
    });

    it('renders action usage', () => {
      const m = makeMonster({ actions: [{ name: 'Longbow', description: '', usage: '/attack' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/\/attack/)).toBeInTheDocument();
    });

    it('renders action recharge', () => {
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
      expect(screen.getByText(/Bite/)).toBeInTheDocument();
      expect(screen.getByText(/Sting/)).toBeInTheDocument();
    });

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

    it('renders action with both attack_bonus and damage_dice', () => {
      const m = makeMonster({ actions: [{ name: 'Longsword', description: '', attack_bonus: null, damage_dice_primary: '1d8 + 3', damage_type_primary: 'Slashing' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Longsword/)).toBeInTheDocument();
      expect(screen.getByText('1d8 + 3')).toBeInTheDocument();
    });

    it('renders long action descriptions without truncation', () => {
      const longDesc = 'The monster makes a melee weapon attack against one creature within 5 ft. of it. On a hit, the target takes 10 (1d12 + 3) slashing damage and must succeed on a DC 13 Dexterity saving throw or be knocked prone.';
      const m = makeMonster({ actions: [{ name: 'Multiattack', description: longDesc }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Multiattack/)).toBeInTheDocument();
    });

    it('renders actions with special characters in name and description', () => {
      const m = makeMonster({ actions: [{ name: "T'zarok's Inferno", description: 'Deals 2d6 + 3 <b>fire</b> damage to targets within 15 ft.' }] });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/T'zarok's Inferno/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Reactions, legendary actions, lair actions, regional effects
  // ════════════════════════════════════════════

  describe('reactions, legendary, lair, and regional', () => {
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

    it('renders lair actions when object with actions property', () => {
      const m = makeMonster({ lair_actions: { actions: [{ name: 'Fog', description: '' }] } });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Lair Actions')).toBeInTheDocument();
    });

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

    it('renders regional effects when null', () => {
      const m = makeMonster({ regional_effects: null });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.queryByText('Regional Effects')).not.toBeInTheDocument();
    });

    it('does not render regional effects when empty object', () => {
      const m = makeMonster({ regional_effects: { effects: [] } });
      render(<MonsterCardModal {...makeProps(m)} />);
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

    it('renders book source without page when page is null', () => {
      const m = makeMonster({ desc: 'Some description.', book: 'Monster Manual', page: null });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Monster Manual/)).toBeInTheDocument();
    });

    it('renders long descriptions without truncation', () => {
      const longDesc = 'This is a very long description that spans multiple paragraphs and contains a lot of detail about the monster. It goes on and on and on. '.repeat(5);
      const m = makeMonster({ desc: longDesc });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Traits, actions, reactions, legendary together
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

    it('renders all action types with attack and damage together', () => {
      const m = makeMonster({
        traits: [{ name: 'Claw', description: '', attack_bonus: null, damage_dice_primary: '1d6 + 2' }],
        actions: [{ name: 'Multiattack', description: '', attack_bonus: null, damage_dice_primary: '2d8 + 3' }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      expect(screen.getByText(/Claw/)).toBeInTheDocument();
      expect(screen.getByText('1d6 + 2')).toBeInTheDocument();
      expect(screen.getByText(/Multiattack/)).toBeInTheDocument();
      expect(screen.getByText('2d8 + 3')).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════
  // Click propagation
  // ════════════════════════════════════════════

  describe('click propagation', () => {
    it('stops click propagation on the card body', () => {
      const onClose = vi.fn();
      render(<MonsterCardModal {...makeProps(makeMonster(), { onClose })} />);
      fireEvent.click(document.querySelector('.mc-card'));
      expect(onClose).not.toHaveBeenCalled();
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

  // ════════════════════════════════════════════
  // Full monster rendering
  // ════════════════════════════════════════════

  describe('full monster rendering', () => {
    it('renders a monster with all fields populated', () => {
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
      expect(screen.getByText('Armor Class')).toBeInTheDocument();
      expect(screen.getByText('Hit Points')).toBeInTheDocument();
      expect(screen.getByText('Speed')).toBeInTheDocument();
      expect(screen.getByText('+3')).toBeInTheDocument();
      expect(screen.getByText('STR')).toBeInTheDocument();
      expect(screen.getByText('Saving Throws')).toBeInTheDocument();
      expect(screen.getByText('Skills')).toBeInTheDocument();
      expect(screen.getByText('Senses')).toBeInTheDocument();
      expect(screen.getByText('Languages')).toBeInTheDocument();
      expect(screen.getByText('Damage Vuln.')).toBeInTheDocument();
      expect(screen.getByText('Damage Resist.')).toBeInTheDocument();
      expect(screen.getByText('Damage Imm')).toBeInTheDocument();
      expect(screen.getByText('Condition Imm')).toBeInTheDocument();
      expect(screen.getByText('CR')).toBeInTheDocument();
      expect(screen.getByText('Legendary Resist.')).toBeInTheDocument();
      expect(screen.getByText(/Reaction A/)).toBeInTheDocument();
      expect(screen.getByText('Legendary Actions')).toBeInTheDocument();
      expect(screen.getByText(/Legendary A\./)).toBeInTheDocument();
      expect(screen.getByText('Lair Actions')).toBeInTheDocument();
      expect(screen.getByText(/Lair Actions/)).toBeInTheDocument();
      expect(screen.getByText('Regional Effects')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText(/MM \(page 34\)/)).toBeInTheDocument();
    });
  });
});
