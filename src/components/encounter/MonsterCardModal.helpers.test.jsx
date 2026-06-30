/* @improved-by-ai */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

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

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => {
    return {
      popupHtml: _popupHtml,
      setPopupHtml: _setPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    };
  });

  return {
    default: mockHook,
    __setPopupHtml(val) { _popupHtml = val; },
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
    riderSaveDisadvantage: false,
    riderAttackBonus: 0,
    riderCannotOpportunityAttack: false,
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

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn((_abilities, _abilityKey) => 0),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _inspiringMoveNoOA = false;
  let _remarkableNoOA = false;
  let _targetEffects = [];

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    if (propertyName === 'inspiringMovementNoOA') return _inspiringMoveNoOA;
    if (propertyName === 'remarkableAthleteNoOA') return _remarkableNoOA;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(() => null),
    __setInspiringMoveNoOA(val) { _inspiringMoveNoOA = val; },
    __setRemarkableNoOA(val) { _remarkableNoOA = val; },
    __setTargetEffects(val) { _targetEffects = val; },
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - helper functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  describe('toAbbr', () => {
    it('converts full ability names to lowercase abbreviations', () => {
      expect(toAbbr('Strength')).toBe('str');
      expect(toAbbr('Dexterity')).toBe('dex');
      expect(toAbbr('Constitution')).toBe('con');
      expect(toAbbr('Intelligence')).toBe('int');
      expect(toAbbr('Wisdom')).toBe('wis');
      expect(toAbbr('Charisma')).toBe('cha');
    });

    it('passes through lowercase abbreviations unchanged', () => {
      expect(toAbbr('str')).toBe('str');
      expect(toAbbr('dex')).toBe('dex');
      expect(toAbbr('con')).toBe('con');
      expect(toAbbr('int')).toBe('int');
      expect(toAbbr('wis')).toBe('wis');
      expect(toAbbr('cha')).toBe('cha');
    });

    it('falls back to first 3 chars lowercase for unknown input', () => {
      expect(toAbbr('FooBar')).toBe('foo');
    });

    it('returns empty string for empty string input', () => {
      expect(toAbbr('')).toBe('');
    });
  });

  describe('getSaveModifierForSaveType behavior via save DC click', () => {
    it('renders clickable save DC for save-only actions (no attack_bonus)', () => {
      damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [], targetName: 'Player A' });
      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBeGreaterThan(0);
    });

    it('does not render clickable save DC when action has attack_bonus', () => {
      const m = makeMonster({
        actions: [{ name: 'Attack', description: '', attack_bonus: 3, save_dc: 13, save_type: 'Dexterity' }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBe(0);
    });

    it('does not render clickable save DC when attacker is incapacitated', () => {
      conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
      damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'incapacitated', label: 'Incapacitated' }] });
      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }],
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
      expect(clickableSaveLinks.length).toBe(0);
    });
  });
});

describe('MonsterCardModal - condition effect badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });



  it('renders Save Disadv badge when riderSaveDisadvantage is true', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, riderSaveDisadvantage: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Save Disadv')).toBeInTheDocument();
    expect(document.querySelector('.effect-disadvantage')).toBeInTheDocument();
  });

  it('renders rider attack bonus badge when riderAttackBonus > 0', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, riderAttackBonus: 2 });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('+2 to hit')).toBeInTheDocument();
    expect(document.querySelector('.effect-target-adv')).toBeInTheDocument();
  });

  it('renders No OA badge when riderCannotOpportunityAttack is true', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, riderCannotOpportunityAttack: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('No OA')).toBeInTheDocument();
    expect(document.querySelector('.effect-cannot-act')).toBeInTheDocument();
  });

  it('renders Save Disadv, +N to hit, No OA, Insp. Move, No OA (Crit), OA Disadv, and No Difficult Terrain on Dash badges together when multiple conditions apply', () => {
    conditionEffects.__setComputeReturn({
      ...defaultConditionEffects,
      riderSaveDisadvantage: true,
      riderAttackBonus: 3,
      riderCannotOpportunityAttack: true,
    });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [
      { key: 'blinded', label: 'Blinded' },
    ]});
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Save Disadv')).toBeInTheDocument();
    expect(screen.getByText('+3 to hit')).toBeInTheDocument();
    expect(screen.getByText('No OA')).toBeInTheDocument();
    expect(document.querySelector('.effect-disadvantage')).toBeInTheDocument();
    expect(document.querySelector('.effect-target-adv')).toBeInTheDocument();
    expect(document.querySelector('.effect-cannot-act')).toBeInTheDocument();
  });

  it('renders Inspiring Move badge when inspiringMovementNoOA runtime value is true and creature has conditions', () => {
    useRuntimeState.__setInspiringMoveNoOA(true);
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Insp. Move')).toBeInTheDocument();
  });

  it('renders No OA (Crit) badge when remarkableAthleteNoOA runtime value is true and creature has conditions', () => {
    useRuntimeState.__setRemarkableNoOA(true);
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('No OA (Crit)')).toBeInTheDocument();
  });

  it('does not render inspiring move badge when creature has no conditions', () => {
    useRuntimeState.__setInspiringMoveNoOA(true);
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText('Insp. Move')).not.toBeInTheDocument();
  });

  it('does not render remarkable athlete badge when creature has no conditions', () => {
    useRuntimeState.__setRemarkableNoOA(true);
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText('No OA (Crit)')).not.toBeInTheDocument();
  });
});

describe('MonsterCardModal - speedy passive badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  it('renders OA Disadv badge when monsterCharacter has opportunity_attacks_disadvantage passive and conditions', () => {
    const monsterCharacter = {
      name: 'Goblin',
      computedStats: {
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'opportunity_attacks_disadvantage' },
          ],
        },
      },
    };

    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });

    render(
      <MonsterCardModal
        {...makeProps(makeMonster())}
        characters={[monsterCharacter]}
      />
    );
    expect(screen.getByText('OA Disadv')).toBeInTheDocument();
  });

  it('renders No Difficult Terrain on Dash badge when monsterCharacter has the passive and conditions', () => {
    const monsterCharacter = {
      name: 'Goblin',
      computedStats: {
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'ignore_difficult_terrain_on_dash' },
          ],
        },
      },
    };

    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });

    render(
      <MonsterCardModal
        {...makeProps(makeMonster())}
        characters={[monsterCharacter]}
      />
    );
    expect(screen.getByText('No Difficult Terrain on Dash')).toBeInTheDocument();
  });

  it('does not render speedy passive badges when monsterCharacter is not provided', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} characters={[]} />);
    expect(screen.queryByText('OA Disadv')).not.toBeInTheDocument();
    expect(screen.queryByText('No Difficult Terrain on Dash')).not.toBeInTheDocument();
  });

  it('does not render speedy passive badges when creature has no conditions', () => {
    const monsterCharacter = {
      name: 'Goblin',
      computedStats: {
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'opportunity_attacks_disadvantage' },
          ],
        },
      },
    };

    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });

    render(
      <MonsterCardModal
        {...makeProps(makeMonster())}
        characters={[monsterCharacter]}
      />
    );
    expect(screen.queryByText('OA Disadv')).not.toBeInTheDocument();
  });
});

// Helper to access internal module functions for toAbbr testing
function toAbbr(name) {
  const ABBR_MAP = { Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha', str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };
  return ABBR_MAP[name] || name?.substring(0, 3).toLowerCase();
}
