// @maintained-by-ai: 2026-10-14
// Base event-handlers lane for useLoggedDiceRollEventHandlers.setupEventListeners:
// listener registration/install-guard lifecycle, generic save-result event dispatch
// (pending-prompt resolution, evasion/damage plumbing, HP sync, logging, popup),
// death-save-result and concentration-result events. Feature lanes live beside this
// file: useLoggedDiceRollEventHandlers.ma0298-soul-tome.test.js (Soul Tome trap +
// crit secondary doubling) and useLoggedDiceRollEventHandlers.infernal-wound.test.js
// (MA-0367 Infernal Glaive 'full' arm) — their pending-row arms stay there.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const flush = () => new Promise(r => setTimeout(r, 0));

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../services/dice/diceRoller.js', () => ({ rollExpression: vi.fn(), rollExpressionDoubled: vi.fn() }));
vi.mock('../../services/encounters/combatData.js', () => ({ getCombatSummary: vi.fn() }));
vi.mock('../runtime/useRuntimeState.js', () => ({ getRuntimeValue: vi.fn(), setRuntimeValue: vi.fn() }));
// byte mirror of the REAL computeDamageAfterEvasion/save semantics.
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(raw / 2);
        if (!success) return raw;
        return dcSuccess === 'half' ? Math.floor(raw / 2) : 0;
    }),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: vi.fn((saveType) => saveType ? String(saveType).toUpperCase() : ''),
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({ hasIgnoreResistance: vi.fn(() => false), playerIsImmuneToCondition: vi.fn(() => false) }));
vi.mock('../../services/combat/automation/automationPassives.js', () => ({ isResilientSphereActive: vi.fn(() => false) }));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({ endInvisibilityOnHostileAction: vi.fn() }));
vi.mock('../../services/rules/features/soulTomeTrapService.js', () => ({ grantSoulTomeTrap: vi.fn(async () => {}) }));
vi.mock('../../services/rules/features/infernalWoundService.js', () => ({ grantInfernalWound: vi.fn(async () => {}) }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: vi.fn((n) => n), guid: vi.fn(() => 'test-guid-1234') } }));
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn() } }));
vi.mock('./loggedDiceRollUtils.js', () => ({ hasSoulstitchProtection: vi.fn(() => false) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({ isCircleOfPowerActive: vi.fn(() => false) }));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({ cleanupConcentrationEffects: vi.fn() }));

let _registry = {};
let _pendingSavesRegistry = {};
vi.mock('../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn((id, fn) => { _registry[id] = fn; }),
    getPendingPopupSetter: vi.fn((id) => { const fn = _registry[id]; if (fn) { delete _registry[id]; return fn; } return null; }),
}));
vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn((id, data) => { _pendingSavesRegistry[id] = data; }),
    getPendingSavePrompt: vi.fn((id) => { const prompt = _pendingSavesRegistry[id]; if (prompt) { delete _pendingSavesRegistry[id]; return prompt; } return null; }),
}));

import { registerPendingPopupSetter } from '../../services/combat/auras/pendingPopupRegistry.js';
import { addExpiration } from '../../services/rules/effects/expirations.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { computeDamageAfterEvasion, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { grantSoulTomeTrap } from '../../services/rules/features/soulTomeTrapService.js';
import { hasSoulstitchProtection } from './loggedDiceRollUtils.js';
import { addEntry } from '../../services/ui/logService.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import storage from '../../services/ui/storage.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';
import { cleanupConcentrationEffects } from '../../services/combat/concentration/concentrationService.js';

const CAMPAIGN = 'test-campaign';
const deps = { characterName: 'TestWizard', campaignName: CAMPAIGN, logEntry: vi.fn(), charactersRef: { current: [] } };

// Install the window listeners ONCE per file — window persists across tests, and
// the install guard means re-calls are no-ops (asserted in the lifecycle spec).
window.__pendingResultHandlersInstalled = false;
setupEventListeners(deps);

beforeEach(() => {
    vi.clearAllMocks();
    _registry = {};
    _pendingSavesRegistry = {};
    deps.charactersRef.current = [];
    deps.logEntry.mockClear();
    getCombatSummary.mockReturnValue(null);
    getRuntimeValue.mockReset().mockReturnValue(null);
    hasSoulstitchProtection.mockReturnValue(false);
    playerIsImmuneToCondition.mockReturnValue(false);
    applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
    rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
});

// Authored Fireball-style prompt (8d6, DC 15 DEX, half on save) — the canonical
// generic save row this lane dispatches. Seeded straight into the registry mock.
function createSavePrompt(promptId, overrides = {}) {
    const prompt = {
        promptId, targetName: 'Goblin', rawDamage: 15, saveDc: 15, saveType: 'DEX', dcSuccess: 'half',
        damageType: 'fire', attackerName: 'TestWizard', name: 'Fireball', formula: '8d6',
        rolls: [3, 4, 5, 2, 3, 3], modifier: 0, campaignName: CAMPAIGN, setPopupHtml: vi.fn(), ...overrides,
    };
    _pendingSavesRegistry[promptId] = prompt;
    return prompt;
}

async function fire(detail) {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: detail.promptId, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3, dcSuccess: 'half', ...detail } }));
    await flush();
    await flush();
}

function findLogEntry(predicate) {
    return deps.logEntry.mock.calls.map(c => c[0]).find(predicate);
}

describe('setupEventListeners — lifecycle', () => {
    it('install guard: a second setupEventListeners call never double-processes an event', () => {
        setupEventListeners(deps);
        window.dispatchEvent(new CustomEvent('death-save-result', { detail: { targetName: 'Ally', roll: 10, success: true } }));
        const deathEntries = deps.logEntry.mock.calls.map(c => c[0]).filter(e => e.type === 'death_save');
        expect(deathEntries).toHaveLength(1);
    });
});

describe('save-result event', () => {
    it('applies damage and logs a combined save-damage roll on a failed save (feature lanes inert)', async () => {
        createSavePrompt('p1');
        await fire({ promptId: 'p1', targetName: 'Goblin' });

        expect(applyDamageToTarget).toHaveBeenCalledWith(null, 'Goblin', 15, ['fire'],
            expect.objectContaining({ campaignName: CAMPAIGN, attackerName: 'TestWizard', suppressHpLog: true, isSpellDamage: false }));
        const combined = findLogEntry(e => e.note === 'combined_save_damage_roll');
        expect(combined).toEqual(expect.objectContaining({
            type: 'roll', rollType: 'save-damage', name: 'Fireball', targetName: 'Goblin',
            saveResult: 'failure', soulstitchProtected: false, isAoe: false, aoeAffectedCount: null,
        }));
        // generic rows never touch the feature-lane grant services
        expect(grantSoulTomeTrap).not.toHaveBeenCalled();
    });

    it('carries aoe metadata on the combined roll entry when isAoe', async () => {
        createSavePrompt('p2', { isAoe: true });
        await fire({ promptId: 'p2', aoeAffectedCount: 3 });
        expect(findLogEntry(e => e.note === 'combined_save_damage_roll')).toEqual(expect.objectContaining({ isAoe: true, aoeAffectedCount: 3 }));
    });

    it('does nothing when no pending save prompt exists for the promptId', async () => {
        await fire({ promptId: 'nonexistent' });
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalled();
    });

    it('prunes a createSaveListener id from pendingSaveListenerPrompts without processing damage', async () => {
        // createSaveListener registers into the runtime store only — never the pendingSaveRegistry.
        const pid = 'listener-p1';
        getRuntimeValue.mockImplementation((name, prop) => {
            if (name === 'campaign' && prop === 'pendingSaveListenerPrompts') return [pid];
            if (name === 'campaign' && prop === 'pendingSavePrompts') return { [pid]: { promptId: pid, campaignName: CAMPAIGN } };
            return null;
        });
        await fire({ promptId: pid, targetName: 'Goblin' });
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'pendingSaveListenerPrompts', [], CAMPAIGN);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('soulstitch protection forces zero damage and an auto-success log', async () => {
        hasSoulstitchProtection.mockReturnValue(true);
        createSavePrompt('p4', { targetName: 'Ally' });
        await fire({ promptId: 'p4', targetName: 'Ally', success: true, roll: 18, total: 21 });

        expect(computeDamageAfterEvasion).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledWith(null, 'Ally', 0, ['fire'], expect.any(Object));
        expect(findLogEntry(e => e.note === 'combined_save_damage_roll')).toEqual(expect.objectContaining({ saveResult: 'soulstitch_auto_success', soulstitchProtected: true }));
    });

    it('delivers save-damage popup data to the registered prompt setter', async () => {
        const setPopupHtml = vi.fn();
        createSavePrompt('p5');
        registerPendingPopupSetter('p5', setPopupHtml);
        await fire({ promptId: 'p5' });
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ type: 'save-damage', name: 'Fireball', damageApplied: true }));
    });

    // --- evasion (CLA-211 chooser-gated; pure math owned by computeDamageAfterEvasion lane) ---
    it("target's own matching evasion flags evasionActive", async () => {
        deps.charactersRef.current = [{ name: 'Goblin', computedStats: { evasionEffects: [{ saveType: 'DEX' }] } }];
        createSavePrompt('p6');
        await fire({ promptId: 'p6' });
        expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, false, 'half', true);
    });

    it('incapacitated target cannot use its own evasion', async () => {
        getRuntimeValue.mockImplementation((name, prop) =>
            (name === 'Ally' && prop === 'activeConditions') ? ['incapacitated'] : null);
        deps.charactersRef.current = [{ name: 'Ally', computedStats: { evasionEffects: [{ saveType: 'DEX' }] } }];
        createSavePrompt('p7', { targetName: 'Ally' });
        await fire({ promptId: 'p7', targetName: 'Ally' });
        expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, false, 'half', false);
    });

    it('CLA-211: shareable-holder presence alone does NOT fold without the GM chooser stamp', async () => {
        deps.charactersRef.current = [
            { name: 'Bard', computedStats: { evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 5 }] } },
            { name: 'Ally', computedStats: {} },
        ];
        createSavePrompt('p8', { targetName: 'Ally' });
        await fire({ promptId: 'p8', targetName: 'Ally' });
        expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, false, 'half', false);
    });

    it('CLA-211: GM-stamped leadingEvasionSelections folds shared evasion for the ticked target', async () => {
        getRuntimeValue.mockImplementation((name, prop) =>
            (name === 'campaign' && prop === 'leadingEvasionSelections') ? { 'p9': ['Ally'] } : null);
        deps.charactersRef.current = [
            { name: 'Bard', computedStats: { evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 5 }] } },
            { name: 'Ally', computedStats: {} },
        ];
        createSavePrompt('p9', { targetName: 'Ally' });
        await fire({ promptId: 'p9', targetName: 'Ally' });
        expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, false, 'half', true);
    });

    it('shield absorbs Magic Missile at zero but never gates other spells', async () => {
        getRuntimeValue.mockImplementation((name, prop) =>
            prop === 'activeBuffs' ? [{ effect: 'shield' }] : null);
        createSavePrompt('p10', { targetName: 'ShieldedAlly', name: 'Magic Missile', damageType: 'force' });
        await fire({ promptId: 'p10', targetName: 'ShieldedAlly', success: true, roll: 18, total: 21 });
        expect(computeDamageAfterEvasion).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledWith(null, 'ShieldedAlly', 0, ['force'], expect.any(Object));

        applyDamageToTarget.mockClear();
        createSavePrompt('p11', { targetName: 'ShieldedAlly', name: 'Fireball' });
        await fire({ promptId: 'p11', targetName: 'ShieldedAlly', success: true, roll: 18, total: 21, dcSuccess: 'half' });
        expect(applyDamageToTarget).toHaveBeenCalledWith(null, 'ShieldedAlly', 7, ['fire'], expect.any(Object));
    });

    // --- HP bookkeeping ---
    it('logs hp_change thresholds for kill and bloodied crossings', async () => {
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', currentHp: 15, maxHp: 15 }] });
        applyDamageToTarget.mockReturnValue({ finalDamage: 15, newHp: 0, damageReduced: false });
        createSavePrompt('p12', { rawDamage: 15 });
        await fire({ promptId: 'p12' });
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ type: 'hp_change', targetName: 'Goblin', isUnconscious: true }));

        addEntry.mockClear();
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', currentHp: 30, maxHp: 30 }] });
        applyDamageToTarget.mockReturnValue({ finalDamage: 18, newHp: 12, damageReduced: false });
        createSavePrompt('p13', { rawDamage: 18 });
        await fire({ promptId: 'p13' });
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ type: 'hp_change', targetName: 'Goblin', threshold: 'bloodied' }));
    });

    it('syncs player currentHitPoints and resets death tracking only on the drop to 0', async () => {
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'player-Ally', type: 'player', currentHp: 10, maxHp: 20 }] });
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 0, damageReduced: false });
        createSavePrompt('p14', { rawDamage: 10, targetName: 'player-Ally' });
        await fire({ promptId: 'p14', targetName: 'player-Ally' });
        expect(setRuntimeValue).toHaveBeenCalledWith('player-Ally', 'currentHitPoints', 0, CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledWith('player-Ally', 'deathSaves', [false, false, false], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledWith('player-Ally', 'deathFailures', [false, false, false], CAMPAIGN);

        setRuntimeValue.mockClear();
        applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 5, damageReduced: false });
        createSavePrompt('p15', { rawDamage: 5, targetName: 'player-Ally' });
        await fire({ promptId: 'p15', targetName: 'player-Ally' });
        expect(setRuntimeValue).toHaveBeenCalledWith('player-Ally', 'currentHitPoints', 5, CAMPAIGN);
        expect(setRuntimeValue).not.toHaveBeenCalledWith('player-Ally', 'deathSaves', expect.anything(), CAMPAIGN);
    });

    it('ends invisibility on the attacker only when damage is dealt', async () => {
        createSavePrompt('p16');
        await fire({ promptId: 'p16' });
        expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', CAMPAIGN);

        endInvisibilityOnHostileAction.mockClear();
        applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 15, damageReduced: true });
        createSavePrompt('p17');
        await fire({ promptId: 'p17' });
        expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    });

    // --- secondary damage (crit doubling lives in the ma0298 sibling) ---
    it('rolls, applies, and logs a non-crit auto secondary damage leg', async () => {
        createSavePrompt('p18', {
            autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Secondary',
            autoDamageSecondaryDamageType: 'necrotic',
        });
        await fire({ promptId: 'p18' });
        expect(rollExpression).toHaveBeenCalledWith('1d10');
        expect(applyDamageToTarget).toHaveBeenCalledTimes(2); // primary + secondary
        const combined = findLogEntry(e => e.note === 'combined_save_damage_roll');
        expect(combined).toEqual(expect.objectContaining({ secondaryName: 'Secondary', secondaryFormula: '1d10', secondaryDamageType: 'necrotic' }));
    });

    // --- overchannel self-damage: CLA-244 dicePerLevel = max(2, useCount) x spellLevel ---
    it('rolls overchannel backlash as max(2,useCount)x spellLevel d12, silent below useCount 2', async () => {
        createSavePrompt('p19', { overchannelActive: true, overchannelUseCount: 3, overchannelSpellLevel: 2 });
        await fire({ promptId: 'p19' });
        expect(rollExpression).toHaveBeenLastCalledWith('6d12');

        createSavePrompt('p20', { overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 2 });
        await fire({ promptId: 'p20' });
        expect(rollExpression).toHaveBeenLastCalledWith('4d12');

        rollExpression.mockClear();
        createSavePrompt('p21', { overchannelActive: true, overchannelUseCount: 1, overchannelSpellLevel: 2 });
        await fire({ promptId: 'p21' });
        expect(rollExpression).not.toHaveBeenCalled();
    });

    // --- status effects on failed save ---
    it('applies statusEffects with a rounds:2 expiry on fail, grants none on success', async () => {
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }] });
        createSavePrompt('p22', { statusEffects: ['poisoned', 'frightened'], saveType: 'CON' });
        await fire({ promptId: 'p22', saveType: 'CON' });
        expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestWizard', targetName: 'Goblin', effects: [{ type: 'condition', condition: 'poisoned' }, { type: 'condition', condition: 'frightened' }], campaignName: CAMPAIGN, rounds: 2 });
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['poisoned'], CAMPAIGN);

        addExpiration.mockClear();
        createSavePrompt('p23', { statusEffects: ['poisoned'], saveType: 'CON' });
        await fire({ promptId: 'p23', saveType: 'CON', success: true, roll: 18, total: 21 });
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('skips status effects when the target is immune to the condition', async () => {
        playerIsImmuneToCondition.mockReturnValue(true);
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }] });
        deps.charactersRef.current = [{ name: 'Goblin', computedStats: { characterAdvancement: [] } }];
        createSavePrompt('p24', { statusEffects: ['poisoned'], saveType: 'CON' });
        await fire({ promptId: 'p24', saveType: 'CON' });
        expect(addExpiration).not.toHaveBeenCalled();
    });
});

describe('death-save-result event', () => {
    it('logs death_save entries mapping nat flags and success/failure tallies', () => {
        window.dispatchEvent(new CustomEvent('death-save-result', { detail: { targetName: 'InjuredAlly', roll: 15, isNat20: false, isNat1: false, success: true, newSaves: [true, false], newFailures: [false] } }));
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ type: 'death_save', characterName: 'InjuredAlly', roll: 15, success: true, totalSuccesses: 1, totalFailures: 0 }));

        deps.logEntry.mockClear();
        window.dispatchEvent(new CustomEvent('death-save-result', { detail: { targetName: 'InjuredAlly', roll: 20, isNat20: true, isNat1: false, success: true } }));
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ isNatural20: true }));

        deps.logEntry.mockClear();
        window.dispatchEvent(new CustomEvent('death-save-result', { detail: { targetName: 'InjuredAlly', roll: 1, isNat20: false, isNat1: true, success: false } }));
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ isNatural1: true }));
    });
});

describe('concentration-result event', () => {
    const failDetail = (overrides = {}) => ({ targetName: 'TestWizard', roll: 5, total: 8, saveBonus: 3, bonusDetail: '+3', spellName: 'Fireball', dc: 15, success: false, ...overrides });

    it('logs the concentration-save roll, mode defaulting to normal', () => {
        window.dispatchEvent(new CustomEvent('concentration-result', { detail: failDetail({ success: true, roll: 18, total: 21 }) }));
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'roll', rollType: 'concentration-save', name: 'Constitution', condition: 'Concentration: Fireball', mode: 'normal',
        }));

        deps.logEntry.mockClear();
        window.dispatchEvent(new CustomEvent('concentration-result', { detail: failDetail({ success: true, roll: 18, total: 21, mode: 'disadvantage' }) }));
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ mode: 'disadvantage' }));
    });

    it('failed save clears concentration, strips mantle, persists summary, dispatches refresh, runs cleanup', () => {
        const creature = { name: 'TestWizard', concentration: { spell: 'Fireball' } };
        getCombatSummary.mockReturnValue({ creatures: [creature] });        let refreshed = false;
        const onRefresh = () => { refreshed = true; };
        window.addEventListener('combat-summary-updated', onRefresh);

        window.dispatchEvent(new CustomEvent('concentration-result', { detail: failDetail() }));

        expect(creature.concentration).toBeNull();
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'mantleOfMajestyActive', null, CAMPAIGN);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), CAMPAIGN);
        expect(cleanupConcentrationEffects).toHaveBeenCalledWith('TestWizard', 'Fireball', CAMPAIGN);
        expect(refreshed).toBe(true);
        window.removeEventListener('combat-summary-updated', onRefresh);
    });

    it('successful save leaves concentration, storage, and cleanup untouched', () => {
        const creature = { name: 'TestWizard', concentration: { spell: 'Fireball' } };
        getCombatSummary.mockReturnValue({ creatures: [creature] });
        let refreshed = false;
        const onRefresh = () => { refreshed = true; };
        window.addEventListener('combat-summary-updated', onRefresh);

        window.dispatchEvent(new CustomEvent('concentration-result', { detail: failDetail({ success: true, roll: 18, total: 21 }) }));

        expect(creature.concentration).toEqual({ spell: 'Fireball' });
        window.removeEventListener('combat-summary-updated', onRefresh);
        expect(storage.set).not.toHaveBeenCalled();
        expect(refreshed).toBe(false);
        expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
    });

    it('matches creatures by name prefix and skips unknown targets', () => {
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestWizard Level 5', concentration: 'Fireball' }] });
        window.dispatchEvent(new CustomEvent('concentration-result', { detail: failDetail({ targetName: 'TestWizard Level 5' }) }));
        expect(storage.set).toHaveBeenCalledTimes(1);

        getCombatSummary.mockReturnValue({ creatures: [] });
        window.dispatchEvent(new CustomEvent('concentration-result', { detail: failDetail({ targetName: 'Unknown' }) }));
        expect(storage.set).toHaveBeenCalledTimes(1);
    });
});
