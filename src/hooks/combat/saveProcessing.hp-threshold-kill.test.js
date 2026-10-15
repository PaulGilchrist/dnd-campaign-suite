// @maintained-by-ai: 2026-10-14
// MA-0352 HP-threshold-kill seam on the SAVE path (saveProcessing.js
// maybeApplyThresholdKillLeg → applyHpThresholdKill). Failed-save seam ONLY:
// victim currentHp ≤ threshold → lethal clamp to 0 via the canonical
// applyDamageToTarget choke point, clause logged, normal damage pools skipped;
// above threshold the row falls through to applySaveDamage unchanged; a
// successful save (dc_success:"none") never consults the threshold and takes
// ZERO. HP truth (§2): PC = runtime currentHitPoints, monster = cs currentHp.
// Byte-inert for rows without the authored numeric key.
// Row data locks for Banshee live in monsterAbilityUses.banshee-deathly-wail
// .test.js and for Solar in solar-slaying-bow-dc-success.test.js; generic
// MA-0427 dual-leg log/popup shape lives in
// saveProcessing.secondary-save-damage.test.js. Plain-lane HP writes
// (handlePlainDamage.hpEffects) and drain thresholds (MA-1489/1728) are
// separate lanes and intentionally not covered here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 10, rolls: [2, 2, 6], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

const combatSummary = { creatures: [], activeCreatureName: 'Banshee 1' };
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => combatSummary,
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, damage) => ({ finalDamage: damage, newHp: 0 }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) =>
        (evasionActive && dcSuccess === 'half') ? (saveSuccess ? 0 : Math.floor(total / 2))
            : (!saveSuccess ? total : dcSuccess === 'half' ? Math.floor(total / 2) : 0),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { processSaveRoll } from './saveProcessing.js';
import monsters from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const BANSHEE = 'Banshee 1';
const TARGET = 'LightfootHalfling';

// MA-0352 Banshee Deathly Wail (monsters.json row shape, fixed):
// DC 13 CON, dc_success "none", Failure: ≤25 HP drops to 0, else 3d6 Psychic.
const wailContext = {
    saveDc: 13,
    saveType: 'Constitution',
    attackerName: BANSHEE,
    actionName: 'Deathly Wail (1/Day)',
    dcSuccess: 'none',
    autoDamageFormula: '3d6',
    autoDamageDamageType: 'Psychic',
    saveConditions: [],
    hpThresholdKill: 25,
};

const killLog = () => addEntryLogs.find(e => e.automationType === 'hp_threshold_kill');

// Player lane: save resolves through the (mocked) prompt; popup captured.
async function runPlayerSave(context, success, roll) {
    let popup = null;
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'player' },
        characterName: TARGET,
        campaignName,
        context,
        logEntry: vi.fn(),
        setPopupHtml: (data) => { popup = data; },
    });
    pendingSaveResolve({ success, roll, total: roll, saveBonus: 0, rawRolls: [], mode: 'normal' });
    await promise;
    return popup;
}

// NPC/monster lane: adjudicated inline via context.effectiveD20 vs saveDc.
async function runNpcSave(name, context, effectiveD20, currentHp, maxHp = 999) {
    combatSummary.creatures = [{ name, type: 'npc', currentHp, maxHp }];
    let popup = null;
    await processSaveRoll({
        rollType: 'save',
        target: { name, type: 'npc' },
        characterName: name,
        campaignName,
        context: { ...context, effectiveD20 },
        bonus: 0,
        r1: effectiveD20,
        r2: effectiveD20,
        logEntry: vi.fn(),
        setPopupHtml: (data) => { popup = data; },
    });
    return popup;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    combatSummary.creatures = [{ name: TARGET, type: 'player', currentHp: 20, maxHp: 20 }];
});

describe('MA-0352 Deathly Wail HP-threshold kill seam', () => {
    it('failed save, victim 20 HP (≤25): lethal clamp to 0, clause logged, pools skipped, threshold popup', async () => {
        runtimeStore[`${TARGET}.currentHitPoints`] = 20;
        const popup = await runPlayerSave({ ...wailContext }, false, 4);

        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(20);
        expect(applyDamageToTarget.mock.calls[0][3]).toEqual(['Psychic']);
        expect(applyDamageToTarget.mock.calls[0][4]).toMatchObject({ ignoreResistance: true, attackerName: BANSHEE });

        const kill = killLog();
        expect(kill).toBeTruthy();
        expect(kill.characterName).toBe(TARGET);
        expect(kill.sourceName).toBe(BANSHEE);
        expect(kill.abilityName).toBe('Deathly Wail (1/Day)');
        expect(kill.description).toMatch(/20 Hit Points \(20 ≤ 25\).*drops to 0 Hit Points/s);

        expect(popup.thresholdKill).toBe(true);
        expect(popup.finalDamage).toBe(0);
        expect(popup.targetCurrentHp).toBe(0);
        expect(popup.thresholdNote).toMatch(/Drops to 0 Hit Points/);
    });

    it('failed save, victim 30 HP (>25): full 3d6 through the normal damage leg, no threshold clause', async () => {
        runtimeStore[`${TARGET}.currentHitPoints`] = 30;
        await runPlayerSave({ ...wailContext }, false, 4);

        expect(rollExpression).toHaveBeenCalledWith('3d6');
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);
        expect(killLog()).toBeUndefined();
    });

    it('successful save at 20 HP: ZERO damage, no threshold kill (dc_success none, success never kills)', async () => {
        runtimeStore[`${TARGET}.currentHitPoints`] = 20;
        const popup = await runPlayerSave({ ...wailContext }, true, 17);

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);
        expect(killLog()).toBeUndefined();
        expect(popup?.dcSuccess).toBe('none');
    });

    it('already-dead victim (0 HP): threshold branch no-ops, normal damage leg proceeds', async () => {
        runtimeStore[`${TARGET}.currentHitPoints`] = 0;
        await runPlayerSave({ ...wailContext }, false, 2);

        expect(killLog()).toBeUndefined();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith('3d6');
    });

    it('monster victim via cs.currentHp: failed save at 10 HP ≤25 → lethal clamp + clause log', async () => {
        await runNpcSave('Thug 1', wailContext, 3, 10, 32);

        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);
        const kill = killLog();
        expect(kill).toBeTruthy();
        expect(kill.characterName).toBe('Thug 1');
        expect(kill.description).toMatch(/10 Hit Points \(10 ≤ 25\)/);
    });

    it('rows without the authored key are byte-inert: failed save takes normal 3d6, no clause log', async () => {
        runtimeStore[`${TARGET}.currentHitPoints`] = 20;
        await runPlayerSave({ ...wailContext, hpThresholdKill: null }, false, 4);

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);
        expect(killLog()).toBeUndefined();
    });
});

// MA-1448: Sea Hag Death Glare — two-field DATA fix (hp_threshold_kill:20 +
// dc_success:"none", MA-0352 Banshee byte-shape family) rides the same seam.
const glare = monsters.find(m => m.index === 'sea-hag').actions[1];

const glareContext = {
    saveDc: glare.save_dc,
    saveType: glare.save_type,
    attackerName: 'Sea Hag 1',
    actionName: glare.name,
    dcSuccess: glare.dc_success,
    autoDamageFormula: glare.damage_dice_primary,
    autoDamageDamageType: glare.damage_type_primary,
    saveConditions: [],
    hpThresholdKill: glare.hp_threshold_kill,
};

describe('MA-1448 Sea Hag Death Glare data lock + threshold seam', () => {
    it('monsters.json row: hp_threshold_kill:20 + dc_success:"none", DC/damage/recharge untouched', () => {
        expect(glare.name).toBe('Death Glare');
        expect(glare.hp_threshold_kill).toBe(20);
        expect(glare.dc_success).toBe('none');
        expect(glare.save_dc).toBe(11);
        expect(glare.save_type).toBe('Wisdom');
        expect(glare.recharge).toBe('5-6');
        expect(glare.damage_dice_primary).toBe('3d8');
        expect(glare.damage_type_primary).toBe('Psychic');
        expect(glare.description).toMatch(/If the target has 20 Hit Points or fewer, it drops to 0 Hit Points\./);
    });

    it('failed save, NPC victim 11 HP (≤20) from live data shape: drops to 0, clause logged, NO 3d8 rolled', async () => {
        await runNpcSave('Bandit 1', glareContext, 3, 11, 11);

        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(11);
        expect(applyDamageToTarget.mock.calls[0][3]).toEqual(['Psychic']);
        const kill = killLog();
        expect(kill).toBeTruthy();
        expect(kill.characterName).toBe('Bandit 1');
        expect(kill.sourceName).toBe('Sea Hag 1');
        expect(kill.abilityName).toBe('Death Glare');
        expect(kill.description).toMatch(/11 Hit Points \(11 ≤ 20\).*drops to 0 Hit Points/s);
    });
});

// MA-1477: Solar "Slaying Bow" (solar|actions|2) — three-field (+dc_success)
// DATA fix riding the threshold seam alongside the MA-0427 dual-pool legs:
// fail → ≤100 HP dies with NO pools rolled; otherwise BOTH pools (4d8+6
// Piercing + 8d8 Radiant) roll full. Row numeric byte-lock + parse +
// success-zero arithmetic live in solar-slaying-bow-dc-success.test.js.
const solarRow = monsters.find(m => m.index === 'solar').actions[2];

const bowContext = {
    saveDc: solarRow.save_dc,
    saveType: solarRow.save_type,
    attackerName: 'Solar 1',
    actionName: solarRow.name,
    dcSuccess: solarRow.dc_success,
    autoDamageFormula: solarRow.damage_dice_primary,
    autoDamageDamageType: solarRow.damage_type_primary,
    autoDamageSecondaryFormula: solarRow.damage_dice_secondary,
    autoDamageSecondaryDamageType: solarRow.damage_type_secondary,
    saveConditions: [],
    hpThresholdKill: solarRow.hp_threshold_kill,
};

describe('MA-1477 Solar Slaying Bow threshold + dual-pool seam', () => {
    it('failed save, NPC victim 50 HP (≤100): drops to 0 BEFORE either pool rolls, clause logged', async () => {
        await runNpcSave('Bandit 1', bowContext, 11, 50);

        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(50);
        expect(applyDamageToTarget.mock.calls[0][3]).toEqual(['Piercing']);
        const kill = killLog();
        expect(kill).toBeTruthy();
        expect(kill.characterName).toBe('Bandit 1');
        expect(kill.sourceName).toBe('Solar 1');
        expect(kill.abilityName).toBe('Slaying Bow');
        expect(kill.description).toMatch(/50 Hit Points \(50 ≤ 100\).*drops to 0 Hit Points/s);
    });

    it('failed save, victim 999 HP (>100): threshold falls through, BOTH pools roll full, no clause', async () => {
        await runNpcSave('Bandit 1', bowContext, 20, 999);

        expect(rollExpression).toHaveBeenCalledWith('4d8 + 6');
        expect(rollExpression).toHaveBeenCalledWith('8d8');
        expect(killLog()).toBeUndefined();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);
        expect(applyDamageToTarget.mock.calls[1][2]).toBe(10);
    });
});
