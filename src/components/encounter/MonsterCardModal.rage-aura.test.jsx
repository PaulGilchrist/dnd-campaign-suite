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

import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { resolveMonsterLionAura, foldAuraDisadvantage, buildLionAuraReason, buildDisadvantageReasons, lionProximityWasMeasured } from './MonsterCardModal.jsx';
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _activeMapName = null;
  return {
    useRuntimeValue: vi.fn((_key, propertyName) => {
      if (propertyName === 'targetEffects') return [];
      return null;
    }),
    getRuntimeValue: vi.fn((name, propertyName) => {
      if (name === '__map__' && propertyName === 'activeMapName') return _activeMapName;
      if (name === 'ElderPaladin' && propertyName === 'activeBuffs') {
        return [{ name: 'Power of the Wilds', effect: 'power_of_wilds_option', optionName: 'Lion', range: '5 ft' }];
      }
      return null;
    }),
    __setActiveMapName(val) { _activeMapName = val; },
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
  };
});

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
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as rangeValidation from '../../services/rules/combat/rangeValidation.js';
import * as mapsService from '../../services/maps/mapsService.js';
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

// 2026-11-03 QA backlog (honest lenient-face copy): the two pinned description
// faces — measured adjacency keeps the proven "within 5 feet" prose
// byte-identical; the cannot-gate face admits the proximity was never measured.
const MEASURED_COPY = 'Goblin has Disadvantage on Scimitar: within 5 feet of raging ElderPaladin (Power of the Wilds — Lion).';
const LENIENT_COPY = 'Goblin has Disadvantage on Scimitar: rage aura of ElderPaladin applied — proximity unmeasured (no token) — GM-enforced (Power of the Wilds — Lion).';

beforeEach(() => {
  vi.clearAllMocks();
  runtimeState.__setActiveMapName(null);
  useLoggedDiceRoll.__setPopupHtml(null);
  conditionEffects.__setCombineReturn('normal');
  getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: false });
  addEntry.mockResolvedValue({});
  // vi.clearAllMocks keeps implementations — re-stub the range/map seams per
  // test so the stacked multi-source face cannot leak into siblings.
  rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal', reason: '' });
  rangeValidation.getDistanceFeet.mockReturnValue(null);
  mapsService.loadMapData.mockResolvedValue(null);
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
    // 2026-11-03 QA backlog: gridless face never measured proximity — the log
    // must carry the honest GM-enforced tail, never the "within 5 feet" claim.
    expect(entry.description).toBe(LENIENT_COPY);
  });

  // Measured face (2026-11-03 QA backlog): active map + both attacker and
  // bearer tokens positioned → the util's isWithinRange compared real
  // coordinates, so the accurate "within 5 feet" copy stays byte-identical.
  it('logs the byte-identical "within 5 feet" copy when proximity WAS measured', async () => {
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });
    runtimeState.__setActiveMapName('battle-arena');
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'ElderPaladin', gridX: 2, gridY: 8 }, { name: 'Player A', gridX: 8, gridY: 8 }],
      placedItems: [{ name: 'Goblin', type: 'npc', gridX: 2, gridY: 7 }],
    });

    render(<MonsterCardModal {...goblinProps({ mapName: 'battle-arena' })} />);
    await act(async () => {});
    clickScimitarChip();

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    expect(rollAttack.mock.calls[0][2].forcedMode).toBe('disadvantage');
    const [, entry] = lionAuraLogCalls()[0];
    expect(entry.description).toBe(MEASURED_COPY);
  });

  // Post-delete face (CN re-demonstration): the active map was deleted
  // (__map__ pointer → null) while the card still holds a stale positioned
  // mapData snapshot — isWithinRange would return true without measuring, so
  // the honest lenient tail must print despite positioned tokens in hand.
  it('logs the lenient tail on the post-delete face (stale positioned mapData, no active map)', async () => {
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'ElderPaladin', gridX: 2, gridY: 8 }, { name: 'Player A', gridX: 8, gridY: 8 }],
      placedItems: [{ name: 'Goblin', type: 'npc', gridX: 2, gridY: 7 }],
    });

    render(<MonsterCardModal {...goblinProps({ mapName: 'battle-arena' })} />);
    await act(async () => {});
    clickScimitarChip();

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    expect(lionAuraLogCalls()[0][1].description).toBe(LENIENT_COPY);
  });

  // 2026-11-03 QA backlog (multi-source disadvantage attribution): the aura
  // must ride the roll options as a REASON (not just a mode), so the popup can
  // name it alongside the range-band reason instead of silently dropping it.
  it('threads the single aura reason into the roll options (no range source)', async () => {
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });

    render(<MonsterCardModal {...goblinProps()} />);
    clickScimitarChip();

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    expect(rollAttack.mock.calls[0][2].disadvantageReasons).toEqual([
      'Lion rage aura — within 5 ft of raging ElderPaladin',
    ]);
    // Exactly ONE aura log row per press (acceptance: machine log unchanged).
    expect(lionAuraLogCalls()).toHaveLength(1);
  });

  it('stacks BOTH the range-band and aura reasons when two sources apply', async () => {
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });
    // Positioned-map lane: goblin token placed, target 25 ft away → melee
    // range-band auto-miss reason, on top of the aura disadvantage.
    rangeValidation.getDistanceFeet.mockReturnValue(25);
    rangeValidation.computeRangeEffect.mockReturnValue({
      mode: 'miss',
      reason: 'Target out of melee range (25 ft > 8 ft)',
    });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'ElderPaladin', gridX: 2, gridY: 8 }, { name: 'Player A', gridX: 8, gridY: 8 }],
      placedItems: [{ name: 'Goblin', type: 'npc', gridX: 3, gridY: 8 }],
    });

    render(<MonsterCardModal {...goblinProps({ mapName: 'battle-arena' })} />);
    // Flush the async map-load effect so mapData is live before the press —
    // gridless (null mapData) would skip the measured range band.
    await act(async () => {});
    clickScimitarChip();

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const [, , options] = rollAttack.mock.calls[0];
    expect(options.forcedMode).toBe('disadvantage');
    expect(options.rangeReason).toBe('Target out of melee range (25 ft > 8 ft)');
    expect(options.disadvantageReasons).toEqual([
      'Target out of melee range (25 ft > 8 ft)',
      'Lion rage aura — within 5 ft of raging ElderPaladin',
    ]);
    expect(lionAuraLogCalls()).toHaveLength(1);
  });

  it('carries no reason list when no disadvantage source applies', async () => {
    render(<MonsterCardModal {...goblinProps()} />);
    clickScimitarChip();

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    expect(rollAttack.mock.calls[0][2].disadvantageReasons).toEqual([]);
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

// Unit pins for the honest-copy flag (2026-11-03 QA backlog): the branches
// mirror rangeCheck.isWithinRange's own leniency fast-paths one-for-one.
describe('lionProximityWasMeasured — measured-vs-lenient flag', () => {
  const bearer = { name: 'ElderPaladin', gridX: 2, gridY: 8 };
  const attacker = { name: 'Goblin', type: 'npc', gridX: 2, gridY: 7 };
  const positionedMap = { players: [bearer], placedItems: [attacker] };

  it('measured only when a map is active AND both tokens carry positions', () => {
    runtimeState.__setActiveMapName('battle-arena');
    expect(lionProximityWasMeasured({ mapData: positionedMap, monsterName: 'Goblin', bearerName: 'ElderPaladin' })).toBe(true);
  });

  it('lenient with no active map (post-delete/deactivated face, stale mapData)', () => {
    runtimeState.__setActiveMapName(null);
    expect(lionProximityWasMeasured({ mapData: positionedMap, monsterName: 'Goblin', bearerName: 'ElderPaladin' })).toBe(false);
  });

  it('lenient for a tokenless attacker (the skipRangeCheck cannot-gate face)', () => {
    runtimeState.__setActiveMapName('battle-arena');
    expect(lionProximityWasMeasured({ mapData: { players: [bearer], placedItems: [] }, monsterName: 'Goblin', bearerName: 'ElderPaladin' })).toBe(false);
  });

  it('lenient for a tokenless bearer (unplaced bearer cannot be measured)', () => {
    runtimeState.__setActiveMapName('battle-arena');
    expect(lionProximityWasMeasured({
      mapData: { players: [{ name: 'ElderPaladin' }], placedItems: [attacker] },
      monsterName: 'Goblin',
      bearerName: 'ElderPaladin',
    })).toBe(false);
  });

  it('lenient when the card holds no map snapshot at all', () => {
    runtimeState.__setActiveMapName('battle-arena');
    expect(lionProximityWasMeasured({ mapData: null, monsterName: 'Goblin', bearerName: 'ElderPaladin' })).toBe(false);
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

describe('buildLionAuraReason / buildDisadvantageReasons — multi-source attribution', () => {
  const aura = { disadvantage: true, source: 'ElderPaladin' };
  const auraReason = 'Lion rage aura — within 5 ft of raging ElderPaladin';
  const bandReason = 'Target out of melee range (25 ft > 8 ft)';

  it('names the bearer in the aura reason; null aura stays null', () => {
    expect(buildLionAuraReason(aura)).toBe(auraReason);
    expect(buildLionAuraReason(null)).toBeNull();
  });

  it('stacks the range band FIRST, then the aura, when both apply (miss face)', () => {
    expect(buildDisadvantageReasons({
      foldedMode: 'disadvantage', rangeReason: bandReason, isAutoMiss: true, rangeForcedMode: null, lionAura: aura,
    })).toEqual([bandReason, auraReason]);
  });

  it('stacks both when the range band itself forces disadvantage', () => {
    expect(buildDisadvantageReasons({
      foldedMode: 'disadvantage', rangeReason: 'Beyond normal range (15 ft > 8 ft)', isAutoMiss: false, rangeForcedMode: 'disadvantage', lionAura: aura,
    })).toEqual(['Beyond normal range (15 ft > 8 ft)', auraReason]);
  });

  it('single-source faces carry exactly one reason (no phantom second)', () => {
    expect(buildDisadvantageReasons({
      foldedMode: 'normal', rangeReason: bandReason, isAutoMiss: true, rangeForcedMode: null, lionAura: null,
    })).toEqual([bandReason]);
    expect(buildDisadvantageReasons({
      foldedMode: 'disadvantage', rangeReason: null, isAutoMiss: false, rangeForcedMode: null, lionAura: aura,
    })).toEqual([auraReason]);
  });

  it('carries nothing when no disadvantage source applied (or the aura cancelled out)', () => {
    expect(buildDisadvantageReasons({
      foldedMode: 'normal', rangeReason: null, isAutoMiss: false, rangeForcedMode: null, lionAura: null,
    })).toEqual([]);
    // adv + aura cancel to normal (foldAuraDisadvantage) → the aura is not a
    // reason for this press; a lingering gridless advisory never stacks.
    expect(buildDisadvantageReasons({
      foldedMode: 'normal', rangeReason: 'Range band advisory (GM-enforced)', isAutoMiss: false, rangeForcedMode: null, lionAura: aura,
    })).toEqual([]);
  });
});
