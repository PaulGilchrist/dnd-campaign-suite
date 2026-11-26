// @maintained-by-ai 2026-11-18: 2026-11-18
// Sheet-attack no-target refusal at the createLogAndShow seam (monster-chip
// TA-1116 parity): an in-combat attack press whose attacker initiative row
// carries NO targetName refuses LOUD — one `.mc-no-target-refusal` popup
// string + one `<weapon>_refused` automation row, and NOTHING else: no d20,
// no roll row, no dice popup, no blocker/sanctuary pre-phase, no runtime
// writes. The armed press, the explicit-targetName presses (chips, OA
// marked-movers, automation), the board-less presses and every non-attack
// roll (check/skill/save/damage) must stay byte-unchanged. Mock family is
// the base lane harness (useLoggedDiceRollAttack.test.js) verbatim.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
    DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    clearHuntersMarkConcentration: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(() => false),
    markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getBaitAndSwitchAcBonus: vi.fn(() => 0),
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    getSlowAcPenalty: vi.fn(() => 0),
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(() => 0),
    getShieldOfFaithAcBonus: vi.fn(() => 0),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./attackBlockers.js', () => ({
    checkAttackBlockers: vi.fn(() => false),
}));

vi.mock('./handlers/sanctuarySave.js', () => ({
    handleSanctuarySave: vi.fn(() => true),
}));

vi.mock('./battleMaster.js', () => ({
    getKnownManeuvers: vi.fn(() => []),
    getSuperiorityDice: vi.fn(() => 0),
}));

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/compelledDuelHandler.js', () => ({
    checkCompelledDuelAttackExpiry: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getManeuversForRules: vi.fn(),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(),
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { rollD20 } from '../../services/dice/diceRoller.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { checkAttackBlockers } from './attackBlockers.js';
import { handleSanctuarySave } from './handlers/sanctuarySave.js';
import { endSanctuary } from '../../services/automation/handlers/spells/sanctuaryHandler.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

const CAMPAIGN = 'test-campaign';
const CHARACTER = 'TestFighter';

describe('no-target attack refusal at the createLogAndShow seam (sheet-lane TA-1116 parity)', () => {
    let deps;
    let fn;

    const entries = () => deps.logEntry.mock.calls.map(c => c[0]);
    const rollRow = () => entries().find(e => e.type === 'roll');
    // Refusal detector covering both faces: the legacy string lane and the
    // sheet's { html, armTargetName } deep-link popup value.
    const refusalPopupShown = () => deps.setPopupHtml.mock.calls.some(
        ([p]) => (typeof p === 'string' ? p : p?.html || '').includes('mc-no-target-refusal'));

    /** Attacker + Goblin on the board; `armed` arms TestFighter's row. */
    function mockBoard({ armed }) {
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: CHARACTER, type: 'player', ...(armed ? { targetName: 'Goblin' } : {}) },
                { name: 'Goblin', type: 'npc', ac: 12 },
            ],
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        deps = {
            characterName: CHARACTER,
            campaignName: CAMPAIGN,
            characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
            setPopupHtml: vi.fn(),
            logEntry: vi.fn(),
        };
        fn = createLogAndShow(deps);
        rollD20.mockReturnValue(15);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        getRuntimeValue.mockReturnValue(null);
        mockBoard({ armed: false });
    });

    it('unarmed in-combat attack press → loud refusal, zero roll, zero spend', async () => {
        await fn('Glaive', 5, 'attack', {});

        // ONE popup: the shared `.mc-no-target-refusal` lane carried as
        // { html, armTargetName } — same copy, plus the sheet host's
        // "Arm a target" deep-link affordance.
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        const popup = deps.setPopupHtml.mock.calls[0][0];
        const html = popup.html;
        expect(html).toContain('mc-no-target-refusal');
        expect(html).toContain('TestFighter cannot use Glaive');
        expect(html).toContain('no target is armed');
        expect(html).toContain('Arm a target with the Target select on the initiative card.');
        expect(html).toContain('No attack rolled, nothing spent.');
        expect(html).not.toContain('AoE rows');
        expect(popup.armTargetName).toBe(CHARACTER);

        // ONE log row: the <weapon-slug>_refused zero-spend truth…
        expect(entries()).toHaveLength(1);
        expect(entries()[0]).toEqual(expect.objectContaining({
            type: 'automation',
            automationType: 'glaive_refused',
            characterName: CHARACTER,
            abilityName: 'Glaive',
            description: 'TestFighter Glaive refused (no target) — no armed target on the initiative card, no self-resolve. Zero spend, no attack rolled.',
        }));
        // …and NO roll row ever appears.
        expect(rollRow()).toBeUndefined();

        // Zero dice, zero pre-phase, zero runtime writes — nothing spent.
        expect(rollD20).not.toHaveBeenCalled();
        expect(checkAttackBlockers).not.toHaveBeenCalled();
        expect(handleSanctuarySave).not.toHaveBeenCalled();
        expect(endSanctuary).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('armed row (targetName set) → the normal roll → popup chain, byte-unchanged', async () => {
        mockBoard({ armed: true });
        await fn('Glaive', 5, 'attack', {});

        expect(rollD20).toHaveBeenCalled();
        expect(rollRow()).toEqual(expect.objectContaining({
            type: 'roll',
            rollType: 'attack',
            name: 'Glaive',
            targetName: 'Goblin',
        }));
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            type: 'd20',
            rollType: 'attack',
            name: 'Glaive',
        }));
        expect(refusalPopupShown()).toBe(false);
        expect(entries().some(e => e.automationType === 'glaive_refused')).toBe(false);
    });

    it('press carries an explicit targetName on an unarmed row → inert (chip/OA/automation lanes unchanged)', async () => {
        await fn('Scimitar', 4, 'attack', { targetName: 'Goblin' });

        expect(rollD20).toHaveBeenCalled();
        expect(deps.setPopupHtml.mock.calls.every(c => typeof c[0] !== 'string')).toBe(true);
        expect(entries().some(e => e.automationType === 'scimitar_refused')).toBe(false);
    });

    it('attacker has no initiative row → the gate is inert (pre-board roll lane unchanged)', async () => {
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        await fn('Glaive', 5, 'attack', {});

        expect(rollD20).toHaveBeenCalled();
        expect(entries().some(e => e.automationType === 'glaive_refused')).toBe(false);
    });

    it('no board at all → the gate is inert (out-of-combat rolls unchanged)', async () => {
        loadCombatSummary.mockResolvedValue(null);
        await fn('Glaive', 5, 'attack', {});

        expect(rollD20).toHaveBeenCalled();
        expect(entries().some(e => e.automationType === 'glaive_refused')).toBe(false);
    });

    it.each(['check', 'skill', 'save', 'initiative'])(
        'non-attack roll type "%s" on an unarmed row never refuses (gate scoped to the attack lane)',
        async (rollType) => {
            await fn('Athletics', 3, rollType, {});

            expect(rollD20).toHaveBeenCalled();
            expect(refusalPopupShown()).toBe(false);
            expect(entries().some(e => e.automationType === 'athletics_refused')).toBe(false);
        }
    );
});
