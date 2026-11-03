// @maintained-by-e2e
// Regression lock for bug-monster-attack-lane-never-consults-rage-auras:
// monster-card attack rolls (handleAttack → rollAttack) must consult the Lion
// rage aura (getLionDisadvantageAgainst) and fold its Disadvantage into the
// rolled mode. Before the fix, forcedMode came solely from combineAttackModes
// and the aura utils were only wired into the PC sheet-roller lanes
// (contextBuilder-map/sync), so an adjacent hostile monster attacking a
// non-bearer target rolled mode:"normal" — the aura's principal RAW audience
// (2024 Power of the Wilds — Lion) was structurally unaffected.
// Sibling setup mirrors MonsterCardModal.logic.test.jsx.

import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { resolveMonsterLionAura, foldAuraDisadvantage } from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/combat/auras/lionAuraUtils.js', () => ({
  getLionDisadvantageAgainst: vi.fn().mockResolvedValue({ disadvantage: false }),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return {
    default: mockHook,
    _rollAttack,
    _setPopupHtml,
    __setPopupHtml(val) { _popupHtml = val; },
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  let _combineReturn = 'normal';
  return {
    computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
    combineAttackModes: vi.fn(() => _combineReturn),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setCombineReturn(val) { _combineReturn = val; },
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;
  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn(() => _findCreatureReturn ?? { name: 'Goblin', conditions: [], targetName: 'Player A' }),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
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
  getAbilitySaveModifier: vi.fn(() => 0),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn((_key, propertyName) => {
    if (propertyName === 'targetEffects') return [];
    return null;
  }),
  getRuntimeValue: vi.fn((name, propertyName) => {
    if (name === 'ElderPaladin' && propertyName === 'activeBuffs') {
      return [{ name: 'Power of the Wilds', effect: 'power_of_wilds_option', optionName: 'Lion', range: '5 ft' }];
    }
    return null;
  }),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin', type: 'npc' },
      { name: 'ElderPaladin', type: 'player' },
    ],
  })),
}));

// ── Re-imports for assertions ──────────────────────────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getLionDisadvantageAgainst } from '../../services/combat/auras/lionAuraUtils.js';
import { addEntry } from '../../services/ui/logService.js';

const rollAttack = useLoggedDiceRoll._rollAttack;

// ── Helpers ─────────────────────────────────────────────────────────────────

function clickScimitarChip() {
  const links = [...document.querySelectorAll('.mc-dice-link')];
  const link = links.find(el => el.textContent.trim() === '+4');
  expect(link, 'Expected the Scimitar +4 dice link').toBeTruthy();
  fireEvent.click(link);
}

function goblinProps(overrides = {}) {
  const monster = makeMonster({
    actions: [{
      name: 'Scimitar',
      attack_bonus: 4,
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1d6 + 2 slashing damage.',
    }],
  });
  return makeProps(monster, {
    creatures: [
      { name: 'Goblin', type: 'npc', targetName: 'Player A' },
      { name: 'Player A', type: 'player' },
    ],
    ...overrides,
  });
}

function lionAuraLogCalls() {
  return addEntry.mock.calls.filter(([, entry]) => entry.automationType === 'lion_aura_disadvantage');
}

beforeEach(() => {
  vi.clearAllMocks();
  useLoggedDiceRoll.__setPopupHtml(null);
  conditionEffects.__setCombineReturn('normal');
  getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: false });
  addEntry.mockResolvedValue({});
  getCombatSummary.mockImplementation(() => ({
    creatures: [
      { name: 'Goblin', type: 'npc' },
      { name: 'ElderPaladin', type: 'player' },
    ],
  }));
});

// ── Render seam: chip press consults the aura before rolling ───────────────

describe('MonsterCardModal — handleAttack consults the Lion rage aura', () => {
  it('folds aura Disadvantage into a normal condition mode and logs the grant', async () => {
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });

    render(<MonsterCardModal {...goblinProps()} />);
    clickScimitarChip();

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    // Gridless lane mirrors contextBuilder-sync.resolveLionAura: no mapData,
    // skipRangeCheck true (all in range), monster name as attacker, armed
    // target threaded for the self-target exclusion axis.
    expect(getLionDisadvantageAgainst).toHaveBeenCalledWith({
      attackerName: 'Goblin',
      targetName: 'Player A',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    const [, , options] = rollAttack.mock.calls[0];
    expect(options.forcedMode).toBe('disadvantage');
    const [campaign, entry] = lionAuraLogCalls()[0];
    expect(campaign).toBe('test-campaign');
    expect(entry.type).toBe('automation');
    expect(entry.characterName).toBe('Goblin');
    expect(entry.abilityName).toBe('Scimitar');
    expect(entry.description).toContain('ElderPaladin');
  });

  it('cancels advantage forward to normal when the aura applies (getNetAttackMode convention)', async () => {
    conditionEffects.__setCombineReturn('advantage');
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });

    render(<MonsterCardModal {...goblinProps()} />);
    clickScimitarChip();

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    // adv + dis cancel to 'normal' → resolveForcedMode passes undefined.
    expect(rollAttack.mock.calls[0][2].forcedMode).toBeUndefined();
  });

  it('is byte-inert when no Lion aura applies: no fold, no aura log', async () => {
    conditionEffects.__setCombineReturn('advantage');
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: false });

    render(<MonsterCardModal {...goblinProps()} />);
    clickScimitarChip();

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    expect(getLionDisadvantageAgainst).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][2].forcedMode).toBe('advantage');
    expect(lionAuraLogCalls()).toHaveLength(0);
  });

  it('skips the awaited aura call entirely when no Lion bearer is in the census (sibling sync-timing contract)', () => {
    getCombatSummary.mockImplementation(() => ({ creatures: [{ name: 'Goblin', type: 'npc' }, { name: 'Player A', type: 'player' }] }));

    render(<MonsterCardModal {...goblinProps()} />);
    clickScimitarChip();

    // No await needed: the roll fires synchronously, byte-identical to the
    // pre-fix monster lane (what ~40 sibling click→assert suites pin).
    expect(getLionDisadvantageAgainst).not.toHaveBeenCalled();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].forcedMode).toBeUndefined();
  });
});

// ── Lane selection + fold units (pure seams) ───────────────────────────────

describe('resolveMonsterLionAura — lane census (mapData vs lenient skip)', () => {
  const bearer = { name: 'ElderPaladin', gridX: 2, gridY: 8 };

  it('places-monster map lane: passes mapData and MEASURES (no skipRangeCheck)', async () => {
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: false });
    const mapData = {
      players: [bearer],
      placedItems: [{ name: 'Goblin', type: 'npc', gridX: 2, gridY: 7 }],
    };

    await resolveMonsterLionAura({ mapData, monsterName: 'Goblin', target: { name: 'Player A' }, campaignName: 'test-campaign' });

    expect(getLionDisadvantageAgainst).toHaveBeenCalledWith({
      attackerName: 'Goblin',
      targetName: 'Player A',
      campaignName: 'test-campaign',
      mapData,
    });
  });

  it('tokenless monster on a positioned map: mapData census + cannot-gate leniency', async () => {
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });
    const mapData = { players: [bearer], placedItems: [] };

    const aura = await resolveMonsterLionAura({ mapData, monsterName: 'Goblin', target: { name: 'Player A' }, campaignName: 'test-campaign' });

    expect(getLionDisadvantageAgainst).toHaveBeenCalledWith({
      attackerName: 'Goblin',
      targetName: 'Player A',
      campaignName: 'test-campaign',
      mapData,
      skipRangeCheck: true,
    });
    expect(aura).toEqual({ disadvantage: true, source: 'ElderPaladin' });
  });

  it('returns null when the aura does not apply', async () => {
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: false });
    const aura = await resolveMonsterLionAura({ mapData: null, monsterName: 'Goblin', target: null, campaignName: 'test-campaign' });
    expect(aura).toBeNull();
    expect(getLionDisadvantageAgainst).toHaveBeenCalledWith({
      attackerName: 'Goblin',
      targetName: null,
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
  });
});

describe('foldAuraDisadvantage — merge precedence', () => {
  const aura = { disadvantage: true, source: 'ElderPaladin' };

  it('passes non-aura rolls through byte-unchanged', () => {
    expect(foldAuraDisadvantage('advantage', null)).toBe('advantage');
    expect(foldAuraDisadvantage('normal', null)).toBe('normal');
    expect(foldAuraDisadvantage('disadvantage', null)).toBe('disadvantage');
  });

  it('advantage + aura dis cancel to normal; normal/dis worsen to disadvantage', () => {
    expect(foldAuraDisadvantage('advantage', aura)).toBe('normal');
    expect(foldAuraDisadvantage('normal', aura)).toBe('disadvantage');
    expect(foldAuraDisadvantage('disadvantage', aura)).toBe('disadvantage');
  });
});
