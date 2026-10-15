// @maintained-by-ai: 2026-10-14
// MA-1847: Apep "Devour the Boat" save-lane no-heal rider — failed DC 26
// CON save grants the registered 'no_healing' te on the victim sourced from
// the attacker (MA-0016 byte-shape: duration until_start_of_next_turn) with
// ONE anchored clock (§38 — expireOnCreatureName fires at the attacker's NEXT
// turn-start = RAW exact; rounds:undefined → expiryRounds:null). The te is
// consumed LIVE at the canonical heal choke points (healingBlock.js via
// applyHealingToTarget/healingRoll, MA-0556) — only the save-lane GRANT was
// missing. Armed ONLY by the structured save_target_effect key parsed onto
// the save context (§233 save-rider grammar twin of MA-1547/MA-1639):
// success face grants NOTHING; rows without the key never reach the consumer.
// Contexts are derived from the disk rows in monsters.json. Apep Constrict's
// ongoing-damage clause is owned by the constrict-grapple lane — not here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2), getName: (n) => String(n || '') },
}));

const rollExpression = vi.fn(() => ({ total: 40, rolls: [6, 6, 6, 6, 6, 10], modifier: 0 }));
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

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Apep 1' }),
    getCurrentCombatRound: () => 3,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 146 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : 0),
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

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';
import { parseSaveTargetEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { isHealingBlocked } from '../../services/rules/combat/healingBlock.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const APEP = 'Apep 1';
const TARGET = 'ElderPaladin';

const APEP_ROW = monstersData.find((m) => m.index === 'apep');
const BOAT = APEP_ROW.legendary_actions.find((a) => a.name === 'Devour the Boat (Costs 2 Actions)');
const DARKNESS = APEP_ROW.actions.find((a) => a.name === 'Venomous Darkness (Recharge 5-6)');

// Disk-row derived save context — every field pulled from the monsters.json
// row exactly as the chip-click transport does, so the rider grammar
// (save_target_effect) and the damage/dc fields cannot drift from the disk.
function saveContextFor(action) {
    return {
        saveDc: action.save_dc,
        saveType: action.save_type,
        attackerName: APEP,
        actionName: action.name,
        dcSuccess: action.dc_success || 'half',
        autoDamageFormula: action.damage_dice_primary,
        autoDamageDamageType: action.damage_type_primary,
        saveConditions: [],
        saveTargetEffect: parseSaveTargetEffect(action),
    };
}

async function resolveSave(context, success, roll) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'player' },
        characterName: TARGET,
        campaignName,
        context,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success, roll, total: roll, saveBonus: 0, rawRolls: [], mode: 'normal' });
    await promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

describe('MA-1847 save-lane no_healing grant', () => {
    it('FAIL face: no_healing te sourced from Apep + ONE anchored clock + grant log; damage FULL Piercing', async () => {
        await resolveSave(saveContextFor(BOAT), false, 8);

        // te registered MA-0016 byte-shape on the campaign root
        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: TARGET,
            effect: 'no_healing',
            source: APEP,
            duration: 'until_start_of_next_turn',
        });

        // ONE anchored clock (§38 — fires at Apep's NEXT turn-start, no rounds count)
        expect(addExpiration).toHaveBeenCalledTimes(1);
        const arg = addExpiration.mock.calls[0][0];
        expect(arg).toMatchObject({
            attackerName: APEP,
            targetName: TARGET,
            campaignName,
            expireOnCreatureName: APEP,
            effects: [{ type: 'remove_target_effect', effectKey: 'no_healing', source: APEP, target: TARGET }],
        });
        expect(arg.rounds).toBeUndefined();

        // grant log names the te key and the RAW anchor
        const grant = addEntryLogs.find((e) => e.type === 'condition' && e.action === 'applied');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(TARGET);
        expect(grant.sourceName).toBe(APEP);
        expect(grant.condition).toBe("Can't Regain Hit Points");
        expect(grant.reason).toBe("Devour the Boat (Costs 2 Actions) — until the start of Apep 1's next turn");
        expect(grant.note).toContain('no_healing');
        expect(grant.note).toContain('healing_blocked');

        // damage pays FULL on the fail face (6d10 roll = 40, dc_success half never halves)
        expect(applyDamageToTarget).toHaveBeenCalled();
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(40);
    });

    it('FAIL face: heal choke point LIVE — isHealingBlocked refuses while the te stands', async () => {
        await resolveSave(saveContextFor(BOAT), false, 8);
        addEntryLogs.length = 0;

        expect(isHealingBlocked(TARGET, campaignName, 10)).toBeTruthy();
        expect(addEntryLogs.some((e) => e.automationType === 'healing_blocked')).toBe(true);
    });

    it('SUCCESS face: zero te, zero clock, zero grant log — half damage still resolves', async () => {
        await resolveSave(saveContextFor(BOAT), true, 20);

        expect(runtimeStore['campaign.targetEffects'] || []).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some((e) => e.type === 'condition' && e.action === 'applied')).toBe(false);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(20);
    });

    it('byte-inert: rows without the structured key grant nothing (Venomous Darkness twin)', async () => {
        const darknessCtx = saveContextFor(DARKNESS);
        expect(darknessCtx.saveTargetEffect).toBeNull();

        await resolveSave(darknessCtx, false, 5);

        expect(runtimeStore['campaign.targetEffects'] || []).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some((e) => e.type === 'condition' && e.action === 'applied' && String(e.condition).includes('Regain'))).toBe(false);
    });
});
