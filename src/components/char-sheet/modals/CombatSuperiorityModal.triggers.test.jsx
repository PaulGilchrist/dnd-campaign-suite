// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';
import * as runtimeModule from '../../../hooks/runtime/useRuntimeState.js';

// ── Shared fixtures ──

const BASE_MANEUVERS = [
  { name: 'Trip Attack', actionType: 'attack_rider' },
  { name: 'Pushing Attack', actionType: 'movement' },
  { name: 'Disarming Attack', actionType: 'attack_rider' },
  { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
  { name: 'Evasive Footwork', actionType: 'reaction' },
  { name: 'Kicking Attack', actionType: 'skill_check' },
  { name: 'Rally', actionType: 'movement' },
  { name: 'Grasping Vine', actionType: 'grant_attack' },
];

const PLAYER_STATS = { name: 'TestChar' };
const ATTACKER_CTX = { hit: true, weaponType: 'melee', attackerName: 'TestChar' };

function renderModal({ payload, ...rest } = {}) {
  const defaultProps = {
    payload: { allManeuvers: BASE_MANEUVERS, maxOptions: 3, knownManeuvers: [], ...payload },
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...rest,
  };
  return render(<CombatSuperiorityModal {...defaultProps} />);
}

function renderModalDirect(props) {
  return render(<CombatSuperiorityModal {...props} />);
}

// ── Test helpers ──

beforeEach(() => {
  vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(1);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function maneuverInList(name) {
  return screen.queryByText(name) !== null;
}

function maneuverNotInList(name) {
  return screen.queryByText(name) === null;
}

// ── availableManeuvers override ──

describe('CombatSuperiorityModal - availableManeuvers override', () => {
  it('uses availableManeuvers directly when provided and non-empty', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Trip Attack', actionType: 'attack_rider' }],
        knownManeuvers: ['Available Only', 'Also Available'],
        availableManeuvers: [
          { name: 'Available Only', actionType: 'bonus_action' },
          { name: 'Also Available', actionType: 'reaction' },
        ],
        maxOptions: 3,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Available Only')).toBeInTheDocument();
    expect(screen.getByText('Also Available')).toBeInTheDocument();
    expect(maneuverNotInList('Ki-Fueled Attack')).toBe(true);
  });

  it('filters availableManeuvers by knownManeuvers in use mode but shows all in selection mode', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [],
        knownManeuvers: ['Ki-Fueled Attack'],
        availableManeuvers: [
          { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
          { name: 'Unknown Maneuver', actionType: 'reaction' },
        ],
        maxOptions: 3,
        selectionMode: false,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Ki-Fueled Attack')).toBe(true);
    expect(maneuverNotInList('Unknown Maneuver')).toBe(true);

    renderModalDirect({
      payload: {
        allManeuvers: [],
        knownManeuvers: ['Ki-Fueled Attack'],
        availableManeuvers: [
          { name: 'Available A', actionType: 'bonus_action' },
          { name: 'Available B', actionType: 'reaction' },
        ],
        maxOptions: 3,
        selectionMode: true,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Available A')).toBeInTheDocument();
    expect(screen.getByText('Available B')).toBeInTheDocument();
  });

  it.each([
    ['an empty array', []],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to allManeuvers when availableManeuvers is %s', (_label, val) => {
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack'],
        availableManeuvers: val,
      },
    });
    expect(maneuverInList('Ki-Fueled Attack')).toBe(true);
  });
});

// ── MN-014: trigger-contextual labels ──

describe('CombatSuperiorityModal - MN-014 trigger-contextual labels', () => {
  it('labels a miss-triggered offer group "Attack Riders (on miss)" with an "on miss" hint', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [],
        knownManeuvers: ['Precision Attack'],
        availableManeuvers: [
          { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss' },
        ],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: false, weaponType: 'melee', attackerName: 'TestChar' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Attack Riders (on miss)')).toBeInTheDocument();
    expect(screen.queryByText('Attack Riders (on hit)')).not.toBeInTheDocument();
    expect(screen.getByText('— on miss')).toBeInTheDocument();
  });

  it('labels a hit-triggered offer group "Attack Riders (on hit)" with an "on hit" hint', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [],
        knownManeuvers: ['Menacing Attack'],
        availableManeuvers: [
          { name: 'Menacing Attack', actionType: 'attack_rider', trigger: 'weapon_attack_hit' },
        ],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Attack Riders (on hit)')).toBeInTheDocument();
    expect(screen.getByText('— on hit')).toBeInTheDocument();
  });

  it('labels a mixed trigger group plain "Attack Riders"', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        knownManeuvers: ['Precision Attack', 'Trip Attack'],
        maxOptions: 3,
        selectionMode: true,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    const headings = Array.from(document.querySelectorAll('h4')).map(h => h.textContent);
    expect(headings).toContain('Attack Riders');
    expect(headings).not.toContain('Attack Riders (on hit)');
    expect(headings).not.toContain('Attack Riders (on miss)');
  });

  it('hints miss-triggered maneuvers with "on miss" and hit-triggered with "on hit" in the same list', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [],
        knownManeuvers: ['Precision Attack', 'Trip Attack'],
        availableManeuvers: [
          { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: false, weaponType: 'melee', attackerName: 'TestChar' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('— on miss')).toBeInTheDocument();
    expect(screen.getByText('— on hit')).toBeInTheDocument();
  });
});

// ── Prompt mode with attackContext / skillContext ──

describe('CombatSuperiorityModal - prompt mode', () => {
  // @cleaned-by-ai REMOVE: First two renders assert header text ("Choose Maneuver"/"Use Maneuver") which is cosmetic UI text already covered by edge-cases.test.jsx "prompt mode headers" describe block (lines 241-283). Header text assertions are brittle — they break on wording changes but don't verify behavioral filtering logic. The third render (skillContext filtering, lines 420-431) has value and is kept in the skillContext test below.
  it('renders correct header in selection vs use mode with attackContext', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'A', actionType: 'bonus_action' }],
        knownManeuvers: [],
        maxOptions: 3,
        selectionMode: true,
        attackContext: { hit: true, weaponType: 'melee' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(/Combat Superiority — Choose Maneuver/)).toBeInTheDocument();

    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: true, weaponType: 'melee' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(/Combat Superiority — Use Maneuver/)).toBeInTheDocument();
  });

  it('filters by melee_weapon_attack_hit trigger for melee weapons', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          { name: 'Ki-Fueled Attack', actionType: 'bonus_action', trigger: 'any' },
          { name: 'Ranged Strike', actionType: 'attack_rider', trigger: 'weapon_attack_hit' },
        ],
        knownManeuvers: ['Trip Attack', 'Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { ...ATTACKER_CTX },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Trip Attack')).toBe(true);
    expect(maneuverInList('Ki-Fueled Attack')).toBe(true);
    expect(maneuverNotInList('Ranged Strike')).toBe(true);
  });

  // @cleaned-by-ai REMOVE: Redundant with the melee_weapon_attack_hit melee test above (lines 160-180). Both verify the same trigger-filtering logic — melee_weapon_attack_hit includes melee/unarmed but excludes ranged. The melee test already covers the melee path; adding a separate ranged test only verifies the same filter function with a different weaponType parameter, providing no additional behavioral confidence. Consolidate into a single parameterized test if needed.
  it('filters by melee_weapon_attack_hit trigger for ranged weapons', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Ranged Strike', actionType: 'attack_rider', trigger: 'weapon_attack_hit' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        knownManeuvers: ['Ranged Strike', 'Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: true, weaponType: 'ranged', attackerName: 'TestChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Ranged Strike')).toBe(true);
    expect(maneuverNotInList('Trip Attack')).toBe(true);
  });

  it('includes unarmed strike for melee_weapon_attack_hit trigger', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Unarmed Maneuver', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          { name: 'Ki-Fueled Attack', actionType: 'bonus_action', trigger: 'any' },
        ],
        knownManeuvers: ['Unarmed Maneuver', 'Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: true, isUnarmedStrike: true, attackerName: 'TestChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Unarmed Maneuver')).toBe(true);
    expect(maneuverInList('Ki-Fueled Attack')).toBe(true);
  });

  it('filters by attack_roll_miss trigger', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        knownManeuvers: ['Precision Attack', 'Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: false, attackerName: 'TestChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Precision Attack')).toBe(true);
    expect(maneuverNotInList('Trip Attack')).toBe(true);
  });

  it.each([
    ['melee weapon', { hit: false, weaponType: 'melee', targetName: 'TestChar' }, 'Defensive Maneuver'],
    ['unarmed strike', { hit: false, weaponType: null, isUnarmedStrike: true, targetName: 'TestChar' }, 'Unarmed Deflection'],
  ])('filters by melee_attack_miss trigger (%s)', (_label, attackCtx, expectedName) => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: expectedName, actionType: 'reaction', trigger: 'melee_attack_miss' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        knownManeuvers: [expectedName, 'Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: attackCtx,
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList(expectedName)).toBe(true);
    expect(maneuverNotInList('Trip Attack')).toBe(true);
  });

  // @cleaned-by-ai REMOVE: Structural duplicate of melee_attack_miss (lines 242-263). Both use identical it.each pattern with ['melee weapon', ...] and ['unarmed strike', ...] variants, asserting the same two-expect structure. The melee_attack_miss test already validates the melee+unarmed parameterization pattern. Keeping all three (melee_attack_miss, melee_damage_taken, melee_attack_straight_line) adds little value — they test the same filter function shape with different trigger strings. Consolidate into a single parameterized test over trigger types.
  it.each([
    ['melee weapon', { weaponType: 'melee', targetName: 'TestChar' }, 'Dodge Maneuver'],
    ['unarmed strike', { weaponType: null, isUnarmedStrike: true, targetName: 'TestChar' }, 'Unarmed Dodge'],
  ])('filters by melee_damage_taken trigger (%s)', (_label, attackCtx, expectedName) => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: expectedName, actionType: 'reaction', trigger: 'melee_damage_taken' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        knownManeuvers: [expectedName, 'Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: attackCtx,
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList(expectedName)).toBe(true);
    expect(maneuverNotInList('Trip Attack')).toBe(true);
  });

  // @cleaned-by-ai REMOVE: Structural duplicate of melee_attack_miss and melee_damage_taken tests above. Same it.each pattern, same two-expect structure, same melee+unarmed parameterization. All three tests (melee_attack_miss, melee_damage_taken, melee_attack_straight_line) verify the same filter-function shape. Consolidate into a single parameterized test over trigger types.
  it.each([
    ['melee weapon', { weaponType: 'melee', attackerName: 'TestChar' }, 'Flank Maneuver'],
    ['unarmed strike', { weaponType: null, isUnarmedStrike: true, attackerName: 'TestChar' }, 'Unarmed Flank'],
  ])('filters by melee_attack_straight_line trigger (%s)', (_label, attackCtx, expectedName) => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: expectedName, actionType: 'bonus_action', trigger: 'melee_attack_straight_line' },
          { name: 'Trip Attack', actionType: 'bonus_action', trigger: 'attack_roll_miss' },
        ],
        knownManeuvers: [expectedName, 'Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: attackCtx,
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList(expectedName)).toBe(true);
    expect(maneuverNotInList('Trip Attack')).toBe(true);
  });

  it('filters by replace_attack trigger', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Replace Strike', actionType: 'attack_rider', trigger: 'replace_attack' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        knownManeuvers: ['Replace Strike', 'Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { replacingAttack: true, attackerName: 'TestChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Replace Strike')).toBe(true);
    expect(maneuverNotInList('Trip Attack')).toBe(true);
  });

  it('includes maneuvers with no trigger or trigger "any" in prompt mode', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Free Maneuver', actionType: 'bonus_action', trigger: null },
          { name: 'Universal Maneuver', actionType: 'bonus_action', trigger: 'any' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        knownManeuvers: ['Free Maneuver', 'Universal Maneuver', 'Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { ...ATTACKER_CTX },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Free Maneuver')).toBe(true);
    expect(maneuverInList('Universal Maneuver')).toBe(true);
    expect(maneuverInList('Trip Attack')).toBe(true);
  });

  it('excludes maneuver when attackerName does not match playerStats.name', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Other Character Maneuver', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        knownManeuvers: ['Other Character Maneuver', 'Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { ...ATTACKER_CTX, attackerName: 'OtherChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverNotInList('Other Character Maneuver')).toBe(true);
    expect(maneuverNotInList('Trip Attack')).toBe(true);
  });

  it('excludes maneuver when targetName does not match playerStats.name', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Other Target Maneuver', actionType: 'reaction', trigger: 'melee_damage_taken' },
          { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
        ],
        knownManeuvers: ['Other Target Maneuver', 'Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { weaponType: 'melee', targetName: 'OtherChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverNotInList('Other Target Maneuver')).toBe(true);
    expect(maneuverNotInList('Trip Attack')).toBe(true);
  });

  // @cleaned-by-ai KEEP (but consolidate): The first two renders (header checks with skillContext) duplicate the header assertions from the attackContext test above (line 132) — both check "Choose Maneuver" and "Use Maneuver" headers. The third render (skillContext with no-trigger maneuver filtering, lines 420-431) provides unique behavioral coverage. Consider rewriting as: one render asserting skillContext triggers promptMode, one render asserting maneuver filtering with skillContext.
  it('treats skillContext same as attackContext for isPromptMode', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'A', actionType: 'bonus_action' }],
        knownManeuvers: [],
        maxOptions: 3,
        selectionMode: true,
        skillContext: { skill: 'Athletics' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(/Combat Superiority — Choose Maneuver/)).toBeInTheDocument();

    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
        skillContext: { skill: 'Athletics' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(/Combat Superiority — Use Maneuver/)).toBeInTheDocument();

    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Free Maneuver', actionType: 'bonus_action', trigger: null }],
        knownManeuvers: ['Free Maneuver'],
        maxOptions: 3,
        selectionMode: false,
        skillContext: { skill: 'Athletics' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Free Maneuver')).toBe(true);
  });

  it('shows empty state when no maneuvers match the prompt filter', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' }],
        knownManeuvers: ['Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: true, weaponType: 'ranged', attackerName: 'TestChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(/No maneuvers selected/)).toBeInTheDocument();
  });
});

// ── lastAttack fallback ──

describe('CombatSuperiorityModal - lastAttack fallback', () => {
  it('constructs effectiveAttack from lastAttack when attackContext is null', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Trip Attack', actionType: 'bonus_action', trigger: 'melee_weapon_attack_hit' }],
        knownManeuvers: ['Trip Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: null,
        lastAttack: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Trip Attack')).toBe(true);
  });

  it('defaults missing lastAttack fields to safe values', () => {
    // defaults weaponType to null, isCrit to false, isUnarmedStrike to false
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Any Trigger Maneuver', actionType: 'bonus_action', trigger: 'any' }],
        knownManeuvers: ['Any Trigger Maneuver'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: null,
        lastAttack: { hit: true, attackerName: 'TestChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Any Trigger Maneuver')).toBe(true);

    // defaults replacingAttack to false
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Replace Attack Maneuver', actionType: 'attack_rider', trigger: 'replace_attack' }],
        knownManeuvers: ['Replace Attack Maneuver'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: null,
        lastAttack: { hit: true, attackerName: 'TestChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverNotInList('Replace Attack Maneuver')).toBe(true);
  });

  it('prefers attackContext over lastAttack when both are present', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Melee Maneuver', actionType: 'bonus_action', trigger: 'melee_weapon_attack_hit' },
          { name: 'Ranged Maneuver', actionType: 'bonus_action', trigger: 'attack_roll_miss' },
        ],
        knownManeuvers: ['Melee Maneuver', 'Ranged Maneuver'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
        lastAttack: { hit: true, weaponType: 'ranged', attackerName: 'TestChar' },
        playerStats: PLAYER_STATS,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(maneuverInList('Melee Maneuver')).toBe(true);
    expect(maneuverNotInList('Ranged Maneuver')).toBe(true);
  });

  it.each([
    ['null', null, ['Ki-Fueled Attack'], ['Unknown'], undefined],
    ['empty object', {}, ['Ki-Fueled Attack'], ['Unknown'], undefined],
    ['partial object', { attackerName: 'TestChar' }, ['Ki-Fueled Attack'], ['Melee Hit Maneuver'], PLAYER_STATS],
  ])('falls back to knownManeuvers filtering when lastAttack is %s', (_label, lastAttack, shown, excluded, pStats) => {
    const maneuvers = excluded.includes('Melee Hit Maneuver')
      ? [
          { name: 'Melee Hit Maneuver', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
        ]
      : [
          { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
          { name: 'Unknown', actionType: 'reaction' },
        ];
    renderModalDirect({
      payload: {
        allManeuvers: maneuvers,
        knownManeuvers: shown,
        maxOptions: 3,
        selectionMode: false,
        attackContext: null,
        lastAttack,
        playerStats: pStats,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    shown.forEach(name => expect(maneuverInList(name)).toBe(true));
    excluded.forEach(name => expect(maneuverNotInList(name)).toBe(true));
  });
});

// ── onReopenSelection callback ──

describe('CombatSuperiorityModal - onReopenSelection', () => {
  it('calls onReopenSelection when Manage Maneuvers is clicked and onReopenSelection exists', async () => {
    const onReopenSelection = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
      },
      onReopenSelection: onReopenSelection,
      onClose,
      onConfirm: vi.fn(),
    });
    fireEvent.click(screen.getByRole('button', { name: /Manage Maneuvers/ }));
    await vi.waitFor(() => {
      expect(onReopenSelection).toHaveBeenCalledTimes(1);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to onConfirm when Manage Maneuvers is clicked and onReopenSelection does not exist', () => {
    const onConfirm = vi.fn();
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
          { name: 'Pushing Attack', actionType: 'movement' },
        ],
        knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        maxOptions: 3,
        selectionMode: false,
      },
      onConfirm,
      onClose: vi.fn(),
    });
    fireEvent.click(screen.getByRole('button', { name: /Manage Maneuvers/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Ki-Fueled Attack', 'Pushing Attack'], null);
  });

  it('does not call onConfirm when onReopenSelection exists but returns nothing', async () => {
    const onReopenSelection = vi.fn().mockResolvedValue(undefined);
    const onConfirm = vi.fn();
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
      },
      onReopenSelection: onReopenSelection,
      onConfirm,
    });
    fireEvent.click(screen.getByRole('button', { name: /Manage Maneuvers/ }));
    await vi.waitFor(() => {
      expect(onReopenSelection).toHaveBeenCalledTimes(1);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // @cleaned-by-ai REMOVE: Duplicate of edge-cases.test.jsx "onReopenSelection error handling" describe block (lines 528-551). Both test that console.error is called with the same error message format when onReopenSelection rejects. The edge-cases test has the same setup and assertion. Keep the edge-cases version; remove this one.
  it('logs error and does not throw when onReopenSelection rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
    const onReopenSelection = vi.fn().mockRejectedValue(new Error('fail'));
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
      },
      onReopenSelection: onReopenSelection,
      onConfirm: vi.fn(),
    });
    const btn = screen.getByRole('button', { name: /Manage Maneuvers/ });
    fireEvent.click(btn);
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[CombatSuperiorityModal] Reopen selection failed:',
        expect.objectContaining({ message: 'fail' })
      );
    });
    consoleSpy.mockRestore();
  });
});

// ── handleUseManeuver error path ──

// @cleaned-by-ai REMOVE: Duplicate of edge-cases.test.jsx "use maneuver error path" describe block (lines 498-523). Both test that console.error is called with '[CombatSuperiorityModal] Use maneuver failed:' and that the "Done" button is not shown when onConfirm rejects. The edge-cases test covers the same behavior with identical assertions. Keep the edge-cases version; remove this entire describe block.
describe('CombatSuperiorityModal - handleUseManeuver error', () => {
  it('logs error, does not set applied state, and does not show result when onConfirm rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
    const onConfirm = vi.fn().mockRejectedValue(new Error('use failed'));
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
      },
      onConfirm,
      onClose: vi.fn(),
    });
    const radio = screen.getByRole('radio', { name: /Ki-Fueled Attack/ });
    fireEvent.click(radio);
    fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[CombatSuperiorityModal] Use maneuver failed:',
        expect.objectContaining({ message: 'use failed' })
      );
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });
});

// @cleaned-by-ai REMOVE: Duplicate of edge-cases.test.jsx. Selection mode description rendering is covered by edge-cases.test.jsx "selection mode descriptions" (lines 556-570). Use mode description rendering is covered by edge-cases.test.jsx "maneuver descriptions in use mode" (lines 204-235). This test provides no unique behavioral coverage — it only asserts that description text appears in the DOM, which is already tested in the edge-cases file.
// ── Maneuver description rendering ──

describe('CombatSuperiorityModal - maneuver descriptions', () => {
  it('renders maneuver description in selection mode and use mode', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Trip Attack', actionType: 'attack_rider', description: 'Prone the target.' }],
        knownManeuvers: [],
        maxOptions: 3,
        selectionMode: true,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Trip Attack')).toBeInTheDocument();
    expect(screen.getByText('Prone the target.')).toBeInTheDocument();

    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action', description: 'Add die to attack roll.' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
    expect(screen.getByText('Add die to attack roll.')).toBeInTheDocument();
  });
});
