// @maintained-by-ai
// Monster-lane opportunity-attack resolution (bug-monster-oa-resolution-
// auto-missed-by-melee-range-gate). The card's ONLY pre-fix resolution lane
// was a generic melee chip gated on the mover's POST-move position — always
// outside reach by the trigger's own precondition — so the reaction the
// trigger charged was spent on a guaranteed auto-miss. These legs pin:
//   • the Reactions-area affordance renders ONLY while the marker is live and
//     names the mover — and its raw textContent is byte-exact
//     'Opportunity Attack on <mover>' (GC 2026-11-10: no leading space from
//     the icon-adjacent JSX text node, both chip and advisory branches);
//   • pressing it resolves vs the MARKED MOVER (explicit target regardless of
//     armed target-select) with NO isAutoMiss/range denial even though
//     computeRangeEffect says 'miss' for the click-time distance;
//   • REGRESSION PIN: a NORMAL chip press in the same out-of-range scene
//     still auto-misses byte-identical (rangeReason passes, no
//     isOpportunityAttack key, marker untouched);
//   • consumption clears the marker; stale (mover left) markers evict and
//     never render; no-melee-row blocks degrade to the advisory note.
// Pure marker math → services/combat/pendingOpportunityAttacks.test.js;
// trigger-seam arm write → opportunityTrigger.test.js; PC sheet lane →
// CharReactions.opportunityAttackTriggered.test.jsx.
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks (mirrors MonsterCardModal.attack-advanced.test.jsx harness) ──────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _attackerReturn = { name: 'Goblin', conditions: [] };
  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn(() => _attackerReturn),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setAttackerReturn(val) { _attackerReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (!range) return null;
    const m = String(range).match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => {
  let _loadMapDataReturn = null;
  const loadMapData = vi.fn((_campaignName, _mapName) => Promise.resolve(_loadMapDataReturn));
  return {
    loadMapData,
    __setLoadMapDataReturn(val) { _loadMapDataReturn = val; },
  };
});

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn((_abilities, _abilityKey) => 0),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn(() => false),
  handle: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _pendingOas = null;
  const mockUseRuntimeValue = vi.fn((characterKey, propertyName) => {
    if (propertyName === 'pendingOAs') return _pendingOas;
    return null;
  });
  const mockGetRuntimeValue = vi.fn(() => null);
  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: mockGetRuntimeValue,
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
    deleteRuntimeKey: vi.fn(),
    __setPendingOas(val) { _pendingOas = val; },
  };
});

// Real pure ladders (findMeleeAttackRow/isPendingOaLive/buildOaResolutionLog);
// the bucket WRITE (clearPendingOa) is spied, bucket reads flow through the
// mocked useRuntimeValue mirror above.
vi.mock('../../services/combat/pendingOpportunityAttacks.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, clearPendingOa: vi.fn(() => true) };
});

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import * as rangeValidation from '../../services/rules/combat/rangeValidation.js';
import * as mapsService from '../../services/maps/mapsService.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { addEntry } from '../../services/ui/logService.js';
import * as pendingOas from '../../services/combat/pendingOpportunityAttacks.js';
const rollAttack = useLoggedDiceRoll._rollAttack;

const CAMPAIGN = 'test-campaign';

const SCIMITAR = {
  name: 'Scimitar',
  attack_bonus: 4,
  reach: '5 ft.',
  description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
  damage_dice_primary: '1d6 + 2',
  damage_type_primary: 'Slashing',
};

/** The trigger precondition as a MEASURED scene: the mover now stands 2 cells
 *  (10 ft) away and the click-time range effect says 'miss'. Every press in
 *  these tests runs against this hostile geometry. */
function primeOutOfReachScene(mover = 'Player A') {
  mapsService.__setLoadMapDataReturn({
    players: [{ name: mover, gridX: 7, gridY: 4 }],
    placedItems: [{ name: 'Goblin', gridX: 4, gridY: 4 }],
  });
  vi.mocked(rangeValidation.getDistanceFeet).mockReturnValue(10);
  vi.mocked(rangeValidation.computeRangeEffect).mockReturnValue({
    mode: 'miss',
    reason: 'Target out of melee range (10 ft > 5 ft)',
  });
}

function armMarker(mover = 'Player A', over = {}) {
  useRuntimeState.__setPendingOas({
    Goblin: { defender: 'Goblin', mover, promptId: 'p-1', ...over },
  });
}

function renderCard(over = {}) {
  const m = makeMonster({ actions: [SCIMITAR] });
  const props = makeProps(m, {
    creatures: [
      { name: 'Goblin', conditions: [], targetName: null },
      { name: 'Player A', type: 'player', currentHp: 9 },
    ],
    characters: [{ name: 'Player A' }],
    mapName: 'test-map',
    ...over,
  });
  const view = render(<MonsterCardModal {...props} />);
  return view;
}

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

function clickByDataKind(kind) {
  const el = document.querySelector(`.mc-dice-link[data-kind="${kind}"]`);
  expect(el, `expected a clickable chip with data-kind="${kind}"`).toBeTruthy();
  fireEvent.click(el);
}

beforeEach(() => {
  vi.clearAllMocks();
  useRuntimeState.__setPendingOas(null);
  mapsService.__setLoadMapDataReturn(null);
  damageUtils.__setAttackerReturn({ name: 'Goblin', conditions: [] });
  primeOutOfReachScene();
});

describe('Pending-OA affordance in the Reactions area (criterion: visible only while live)', () => {
  it('renders a named row inside a Reactions section on a block WITHOUT authored reactions', async () => {
    armMarker();
    renderCard();
    await flush(); // map load
    const chip = document.querySelector('[data-kind="oa"]');
    expect(chip).toBeTruthy();
    // GC 2026-11-10 byte-shape pin: the label is ONE expression child, so the
    // raw textContent carries NO leading space (a JSX text node after the icon
    // reintroduced would fail this exact-match — §67 leading-space family).
    expect(chip.textContent).toBe('Opportunity Attack on Player A');
    // Icon still renders before the text (visual parity — the gap is CSS-owned).
    const icon = chip.querySelector('i.fa-solid.fa-bolt');
    expect(icon).toBeTruthy();
    expect(chip.firstChild).toBe(icon);
    // The monster has reactions:[] — the section exists SOLELY because the
    // marker is live, i.e. this is the dedicated trigger affordance, not a
    // bestiary row.
    const titles = [...document.querySelectorAll('.mc-section-title')].map(el => el.textContent);
    expect(titles).toContain('Reactions');
  });

  it('no marker ⇒ no affordance anywhere on the card', async () => {
    renderCard();
    await flush();
    expect(document.querySelector('[data-kind="oa"]')).toBeNull();
    expect([...document.querySelectorAll('.mc-section-title')].map(el => el.textContent)).not.toContain('Reactions');
  });

  it('mover left the encounter (row gone) ⇒ affordance hidden AND the stale marker evicts', async () => {
    armMarker();
    renderCard({ creatures: [{ name: 'Goblin', conditions: [] }] }); // Player A off-board
    await flush();
    expect(document.querySelector('[data-kind="oa"]')).toBeNull();
    expect(pendingOas.clearPendingOa).toHaveBeenCalledWith(CAMPAIGN, 'Goblin');
  });

  it('mover away ⇒ affordance hidden and marker evicted (dead rows read the same law)', async () => {
    armMarker();
    renderCard({
      creatures: [
        { name: 'Goblin', conditions: [] },
        { name: 'Player A', type: 'player', currentHp: 9, away: true },
      ],
    });
    await flush();
    expect(document.querySelector('[data-kind="oa"]')).toBeNull();
    expect(pendingOas.clearPendingOa).toHaveBeenCalledWith(CAMPAIGN, 'Goblin');
  });

  it('no melee attack row authored ⇒ honest advisory note, no pressable chip', async () => {
    armMarker();
    const m = makeMonster({
      actions: [{ name: 'Shortbow', attack_bonus: 4, description: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft.' }],
    });
    render(<MonsterCardModal {...makeProps(m, {
      creatures: [{ name: 'Goblin', conditions: [] }, { name: 'Player A', type: 'player', currentHp: 9 }],
    })} />);
    await flush();
    const note = document.querySelector('[data-kind="oa"]');
    expect(note).toBeTruthy();
    // Advisory branch carries the same byte-exact law (no leading/trailing
    // whitespace round the label).
    expect(note.textContent).toBe('Opportunity Attack on Player A');
    expect(note.parentElement.textContent).toContain('no melee attack row');
    expect(note.className).not.toContain('mc-dice-link');
  });
});

describe('OA press vs the marked mover (out-of-reach scene)', () => {
  it('resolves vs the MARKED MOVER with no range denial — despite the armed select being empty and the mover standing 10 ft away', async () => {
    armMarker();
    renderCard();
    await flush();

    clickByDataKind('oa');
    await flush();

    expect(rollAttack).toHaveBeenCalledTimes(1);
    const [attackName, attackBonus, options] = rollAttack.mock.calls[0];
    expect(attackName).toBe('Scimitar');
    expect(attackBonus).toBe(4);
    // The gate WOULD deny (computeRangeEffect is mocked to 'miss' at 10 ft):
    expect(options.isAutoMiss).toBe(false);
    expect(options.rangeReason).toBeNull();
    expect(options.forcedMode).toBeUndefined(); // resolveForcedMode maps 'normal' → absent
    // Explicit target = marked mover, not the (unarmed) card target-select.
    expect(options.targetName).toBe('Player A');
    // Reaction-lane marker rides the roll (PC-lane parity, FT-103 channel).
    expect(options.isOpportunityAttack).toBe(true);
    // Honest provenance naming the trigger, and the marker is consumed.
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'automation',
      automationType: 'opportunity_attack',
      creatureName: 'Goblin',
      targetName: 'Player A',
      description: "Goblin makes an opportunity attack against Player A, who left Goblin's reach.",
    }));
    expect(pendingOas.clearPendingOa).toHaveBeenCalledWith(CAMPAIGN, 'Goblin');
  });

  it('pins the MARKED MOVER even when the card is armed on a DIFFERENT target', async () => {
    armMarker();
    const damageUtils = await import('../../services/rules/combat/damageUtils.js');
    // Card target-select armed on ElderPaladin — the marker must win: the OA
    // is the mover's provocation, not whatever the GM last armed.
    damageUtils.__setAttackerReturn({ name: 'Goblin', conditions: [], targetName: 'ElderPaladin' });
    renderCard({
      creatures: [
        { name: 'Goblin', conditions: [], targetName: 'ElderPaladin' },
        { name: 'Player A', type: 'player', currentHp: 9 },
        { name: 'ElderPaladin', type: 'player', currentHp: 12 },
      ],
      characters: [{ name: 'Player A' }, { name: 'ElderPaladin' }],
    });
    await flush();

    clickByDataKind('oa');
    await flush();

    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][2].targetName).toBe('Player A');
    expect(rollAttack.mock.calls[0][2].isAutoMiss).toBe(false);
  });

  it('same-tab double-click resolves the one charged reaction EXACTLY once', async () => {
    armMarker();
    renderCard();
    await flush();
    clickByDataKind('oa');
    clickByDataKind('oa'); // second press before the consume echo lands
    await flush();
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(pendingOas.clearPendingOa).toHaveBeenCalledTimes(1);
  });

  it('the affordance disappears once the store marker is gone (consume echo adopted)', async () => {
    armMarker();
    const { rerender } = render(<MonsterCardModal {...makeProps(makeMonster({ actions: [SCIMITAR] }), {
      creatures: [{ name: 'Goblin', conditions: [] }, { name: 'Player A', type: 'player', currentHp: 9 }],
      characters: [{ name: 'Player A' }],
    })} />);
    await flush();
    expect(document.querySelector('[data-kind="oa"]')).toBeTruthy();
    // Consume/SSE echo empties the bucket → the marker-only Reactions section
    // drops out entirely.
    useRuntimeState.__setPendingOas({});
    rerender(<MonsterCardModal {...makeProps(makeMonster({ actions: [SCIMITAR] }), {
      creatures: [{ name: 'Goblin', conditions: [] }, { name: 'Player A', type: 'player', currentHp: 9 }],
      characters: [{ name: 'Player A' }],
    })} />);
    await flush();
    expect(document.querySelector('[data-kind="oa"]')).toBeNull();
  });
});

describe('REGRESSION PIN — normal chips keep the resolution-time range gate byte-identical', () => {
  it('the same out-of-reach scene auto-misses a NORMAL melee press with the exact range reason', async () => {
    armMarker(); // even WITH a live marker, the generic lane is untouched…
    // GM-armed target-select on the card: armed to the mover (the repro's
    // step 4) — the generic lane must still measure click-time distance.
    damageUtils.__setAttackerReturn({ name: 'Goblin', conditions: [], targetName: 'Player A' });
    renderCard({
      creatures: [
        { name: 'Goblin', conditions: [], targetName: 'Player A' },
        { name: 'Player A', type: 'player', currentHp: 9 },
      ],
    });
    await flush();

    // Find the Scimitar chip's attack roll link (+4) — the pre-bug press path.
    const links = [...document.querySelectorAll('.mc-dice-link')];
    const scimitarChip = links.find(el => el.textContent.trim() === '+4' && el.dataset.kind === 'attack');
    expect(scimitarChip, 'expected the Scimitar +4 attack chip').toBeTruthy();
    fireEvent.click(scimitarChip);
    await flush();

    expect(rollAttack).toHaveBeenCalledTimes(1);
    const options = rollAttack.mock.calls[0][2];
    expect(options.isAutoMiss).toBe(true);
    expect(options.rangeReason).toBe('Target out of melee range (10 ft > 5 ft)');
    // Byte-identity of the normal press: no reaction-lane key enters the options.
    expect(options).not.toHaveProperty('isOpportunityAttack');
    // And the press consumed NOTHING from the trigger marker.
    expect(pendingOas.clearPendingOa).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('with NO marker, the armed normal press behaves exactly as before the fix (auto-miss, no affordance)', async () => {
    damageUtils.__setAttackerReturn({ name: 'Goblin', conditions: [], targetName: 'Player A' });
    renderCard({
      creatures: [
        { name: 'Goblin', conditions: [], targetName: 'Player A' },
        { name: 'Player A', type: 'player', currentHp: 9 },
      ],
    });
    await flush();
    expect(document.querySelector('[data-kind="oa"]')).toBeNull();
    const links = [...document.querySelectorAll('.mc-dice-link')];
    const scimitarChip = links.find(el => el.textContent.trim() === '+4' && el.dataset.kind === 'attack');
    expect(scimitarChip).toBeTruthy();
    fireEvent.click(scimitarChip);
    await flush();
    expect(rollAttack).toHaveBeenCalledTimes(1);
    const options = rollAttack.mock.calls[0][2];
    expect(options.isAutoMiss).toBe(true);
    expect(options.rangeReason).toBe('Target out of melee range (10 ft > 5 ft)');
    expect(options.targetName).toBe('Player A');
    expect(options).not.toHaveProperty('isOpportunityAttack');
  });
});
