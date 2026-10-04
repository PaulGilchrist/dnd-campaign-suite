// MN-003: Commander's Strike was inert end-to-end — no clickable row, the
// "Combat Superiority:" row was pinned to Select-View (selectionMode stayed
// true because known(9) < all(20)), and the grant executor had no once-per-
// turn latch nor 30-ft range gate (die even spent before the no-allies check).
// These tests pin the fixed lanes: use-mode reachable, gated spend, refusal
// zero-spend, stamp on confirm, turn-end lapse.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    handle,
    handleCombatSuperiorityGrantAttack,
    executeManeuver,
    executeCommanderStrikeChoice,
    applyCommanderStrikeTurnEnd,
} from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const ALL_MANEUVERS = [
    { name: 'Trip Attack', effect: 'prone', trigger: 'weapon_attack_hit', saveType: 'STR', damageBonus: true, actionType: 'attack_rider' },
    { name: 'Pushing Attack', effect: 'push', trigger: 'weapon_attack_hit', saveType: 'STR', value: 15, damageBonus: true, actionType: 'attack_rider' },
    { name: 'Goading Attack', effect: 'goad', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, actionType: 'attack_rider' },
    { name: 'Disarming Attack', effect: 'disarm', trigger: 'weapon_attack_hit', saveType: 'STR', damageBonus: true, actionType: 'attack_rider' },
    { name: 'Menacing Attack', effect: 'frightened', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, actionType: 'attack_rider' },
    { name: 'Distracting Strike', effect: 'distracting_strike_advantage', trigger: 'weapon_attack_hit', damageBonus: true, actionType: 'attack_rider' },
    { name: 'Maneuvering Attack', effect: 'ally_movement', trigger: 'weapon_attack_hit', damageBonus: true, actionType: 'attack_rider' },
    { name: 'Precision Attack', effect: 'attack_roll_bonus', trigger: 'attack_roll_miss', actionType: 'attack_rider' },
    { name: 'Sweeping Attack', effect: 'secondary_damage', trigger: 'melee_weapon_attack_hit', actionType: 'attack_rider' },
    { name: 'Evasive Footwork', effect: 'ac_bonus_disengage', actionType: 'bonus_action' },
    { name: 'Feinting Attack', effect: 'advantage_and_damage', actionType: 'bonus_action' },
    { name: 'Lunging Attack', effect: 'dash_and_damage', actionType: 'bonus_action' },
    { name: 'Rally', effect: 'temp_hp', actionType: 'bonus_action', extraHpExpression: '1d4' },
    { name: "Commander's Strike", effect: null, actionType: 'grant_attack', trigger: 'replace_attack', dieExpression: 'superiority_die', range: '30_ft' },
    { name: 'Bait and Switch', effect: 'ac_bonus_and_swap', actionType: 'movement' },
    { name: 'Ambush', actionType: 'skill_check', skills: ['Stealth'], initiativeBonus: true, dieExpression: 'superiority_die' },
    { name: 'Tactical Assessment', actionType: 'skill_check', skills: ['Insight'], ability: 'Wisdom', dieExpression: 'superiority_die' },
    { name: 'Commanding Presence', actionType: 'skill_check', reactionSaveType: 'WIS', reactionEffect: 'disadvantage_next_attack', reactionDuration: 'until_end_of_next_turn' },
    { name: 'Parry', effect: 'damage_reduction', actionType: 'reaction' },
    { name: 'Riposte', effect: 'melee_attack_reaction', actionType: 'reaction' },
];

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => ALL_MANEUVERS),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({
        creatures: [{ name: 'EvasiveFighter' }, { name: 'Bandit' }, { name: 'Goblin' }],
    }),
}));

const inRangeAllies = ['Bandit', 'Goblin'];

vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async (_source, target) => inRangeAllies.includes(target)),
    isDistanceInRange: vi.fn(() => true),
    isWithinRangeOf: vi.fn(async () => true),
}));

vi.mock('../../../../services/automation/common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 7, rolls: [7] })),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => (expr === 'superiority_die' ? 12 : 0)),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 18),
    createSaveListener: vi.fn(() => ({ promise: Promise.resolve({ success: false }) })),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 7 })),
}));

vi.mock('../../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(async () => null),
}));

import { rollExpression } from '../../../../services/dice/diceRoller.js';
import { addEntry } from '../../../../services/ui/logService.js';

const store = {};
const LATCH_KEY = '_Commanders_Strike_usedRound';

function seedStore(overrides = {}) {
    Object.keys(store).forEach(k => delete store[k]);
    store['EvasiveFighter.superiorityDice'] = 6;
    Object.entries(overrides).forEach(([k, v]) => { store[k] = v; });
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation((name, key) => store[`${name}.${key}`]);
    setRuntimeValue.mockImplementation(async (name, key, value) => { store[`${name}.${key}`] = value; });
    seedStore();
    inRangeAllies.length = 0;
    inRangeAllies.push('Bandit', 'Goblin');
});

const makePlayerStats = (overrides = {}) => ({
    name: 'EvasiveFighter',
    proficiency: 6,
    abilities: [
        { name: 'STR', bonus: 4 },
        { name: 'DEX', bonus: 5 },
        { name: 'CON', bonus: 2 },
        { name: 'INT', bonus: 0 },
        { name: 'WIS', bonus: 1 },
        { name: 'CHA', bonus: 0 },
    ],
    level: 18,
    rules: '2024',
    attacks: [{ name: 'Scimitar', weaponType: 'melee', damage: '1d6+4', damageType: 'slashing' }],
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

const CS_ROW_ACTION = {
    name: "Commander's Strike",
    automation: {
        type: 'combat_superiority_grant_attack',
        maneuverName: "Commander's Strike",
        actionType: 'grant_attack',
        dieExpression: 'superiority_die',
        range: '30_ft',
    },
};

// ── Use-mode reachability (selectionMode gating, dispatchers.js) ─────────

describe('MN-003 Combat Superiority row opens the USE flow for known maneuvers', () => {
    it('selectionMode is FALSE when maneuvers are known (known < all no longer pins Select-View)', async () => {
        seedStore({
            'EvasiveFighter.BattleMasterManeuvers_selection': ["Commander's Strike", 'Rally', 'Riposte'],
        });
        const result = await handle(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatSuperiority');
        expect(result.payload.selectionMode).toBe(false);
        expect(result.payload.knownManeuvers).toContain("Commander's Strike");
    });

    it('selectionMode is TRUE when nothing is known yet (selection still required first)', async () => {
        seedStore({ 'EvasiveFighter.BattleMasterManeuvers_selection': [] });
        const result = await handle(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );
        expect(result.payload.selectionMode).toBe(true);
    });

    it('forceSelectionMode still opens Select-View (Manage Maneuvers)', async () => {
        seedStore({
            'EvasiveFighter.BattleMasterManeuvers_selection': ["Commander's Strike"],
        });
        const result = await handle(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority', forceSelectionMode: true } },
            makePlayerStats(),
            'test-campaign',
            null
        );
        expect(result.payload.selectionMode).toBe(true);
    });
});

// ── Row-click use lane: gated spend + chooser ─────────────────────────────

describe('MN-003 handleCombatSuperiorityGrantAttack row lane', () => {
    it('rolls + spends one die, stamps the once-per-turn latch, opens the commanderStrikeChoice chooser', async () => {
        const result = await handleCombatSuperiorityGrantAttack(CS_ROW_ACTION, makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('commanderStrikeChoice');
        expect(result.payload.dieValue).toBe(7);
        expect(result.payload.options.map(o => o.value)).toEqual(['Bandit', 'Goblin']);
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', 5, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', LATCH_KEY, 1, 'test-campaign');
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].description).toContain('30 feet');
    });

    it('range-gates the chooser to 30 ft companions (out-of-range ally excluded)', async () => {
        inRangeAllies.length = 0;
        inRangeAllies.push('Bandit');
        const result = await handleCombatSuperiorityGrantAttack(CS_ROW_ACTION, makePlayerStats(), 'test-campaign', null);
        expect(result.payload.options.map(o => o.value)).toEqual(['Bandit']);
    });

    it('refuses with zero spend when nobody is within 30 feet — die never rolled', async () => {
        inRangeAllies.length = 0;
        const result = await handleCombatSuperiorityGrantAttack(CS_ROW_ACTION, makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('within 30 feet');
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', expect.anything(), 'test-campaign');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', LATCH_KEY, expect.anything(), 'test-campaign');
        expect(result.logEntries[0].automationType).toBe('commanders_strike_refused');
        expect(result.logEntries[0].reason).toBe('no_ally_in_range');
    });

    it('refuses with zero spend when no Superiority Dice remain', async () => {
        seedStore({ 'EvasiveFighter.superiorityDice': 0 });
        const result = await handleCombatSuperiorityGrantAttack(CS_ROW_ACTION, makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No Superiority Dice remaining');
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', expect.anything(), 'test-campaign');
    });

    it('second attempt in the same turn is refused zero-spend (once-per-Attack-action latch)', async () => {
        const first = await handleCombatSuperiorityGrantAttack(CS_ROW_ACTION, makePlayerStats(), 'test-campaign', null);
        expect(first.type).toBe('modal');
        expect(store['EvasiveFighter.superiorityDice']).toBe(5);
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key) => store[`${name}.${key}`]);
        setRuntimeValue.mockImplementation(async (name, key, value) => { store[`${name}.${key}`] = value; });

        const second = await handleCombatSuperiorityGrantAttack(CS_ROW_ACTION, makePlayerStats(), 'test-campaign', null);

        expect(second.type).toBe('popup');
        expect(second.payload.description).toContain('already directed a companion this turn');
        expect(second.logEntries[0].automationType).toBe('commanders_strike_refused');
        expect(second.logEntries[0].reason).toBe('already_used_this_turn');
        expect(rollExpression).not.toHaveBeenCalled();
        expect(store['EvasiveFighter.superiorityDice']).toBe(5);
        expect(setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', expect.anything(), 'test-campaign');
    });

    it('re-arms next round (latch round < current round)', async () => {
        seedStore({ [`EvasiveFighter.${LATCH_KEY}`]: 1 });
        // fresh round
        const combatData = await import('../../../../services/encounters/combatData.js');
        combatData.getCurrentCombatRound.mockReturnValue(2);

        const result = await handleCombatSuperiorityGrantAttack(CS_ROW_ACTION, makePlayerStats(), 'test-campaign', null);
        expect(result.type).toBe('modal');
        expect(store['EvasiveFighter.superiorityDice']).toBe(5);
        combatData.getCurrentCombatRound.mockReturnValue(1);
    });
});

// ── executeManeuver delegation (CS-modal single-use lane rides the gates) ─

describe('MN-003 executeManeuver funnels grant_attack through the gated executor', () => {
    it('commander-choice modal + latch stamp via executeManeuver', async () => {
        seedStore({ 'EvasiveFighter.superiorityDice': 4 });
        const result = await executeManeuver(
            { name: "Commander's Strike", automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            "Commander's Strike"
        );
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('commanderStrikeChoice');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', 3, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', LATCH_KEY, 1, 'test-campaign');
    });
});

// ── Chooser confirm → stamp on ally → turn-end lapse ─────────────────────

describe('MN-003 chooser confirm + turn-end hygiene', () => {
    it('executeCommanderStrikeChoice arms commanderStrikeBonus on the chosen ally', async () => {
        const result = await executeCommanderStrikeChoice(
            { dieValue: 7, maneuverName: "Commander's Strike" },
            makePlayerStats(),
            'test-campaign',
            'Bandit'
        );
        expect(result.type).toBe('popup');
        expect(store['Bandit.commanderStrikeActive']).toBe(true);
        expect(store['Bandit.commanderStrikeBonus']).toBe(7);
        expect(store['Bandit.commanderStrikeSource']).toBe("Commander's Strike");
        expect(result.logEntries[0].description).toContain('Bandit');
    });

    it('applyCommanderStrikeTurnEnd lapses an unconsumed bonus at the ally turn end + logs', async () => {
        store['Bandit.commanderStrikeBonus'] = 7;
        store['Bandit.commanderStrikeActive'] = true;
        store['Bandit.commanderStrikeSource'] = "Commander's Strike";

        await applyCommanderStrikeTurnEnd('test-campaign', 'Bandit');

        expect(store['Bandit.commanderStrikeBonus']).toBeNull();
        expect(store['Bandit.commanderStrikeActive']).toBeNull();
        expect(store['Bandit.commanderStrikeSource']).toBeNull();
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            automationType: 'commanders_strike_lapsed',
            characterName: 'Bandit',
        }));
    });

    it('applyCommanderStrikeTurnEnd is a no-op when no bonus is armed', async () => {
        await applyCommanderStrikeTurnEnd('test-campaign', 'Goblin');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
