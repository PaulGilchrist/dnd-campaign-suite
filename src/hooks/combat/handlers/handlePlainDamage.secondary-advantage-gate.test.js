// @maintained-by-ai: 2026-10-14
// MA-0889: advantage-gated secondary rider consumer — Goblin Boss
// Scimitar/Shortbow "plus 1d4 … if the attack roll had Advantage" and the
// MA-1444/1445 Scout Captain Shortsword/Longbow "plus 3d6 … with Advantage"
// family. The gate is context-driven (handlePlainDamage
// secondaryRiderBlockedByAdvantageGate): with context.secondaryCondition ===
// 'advantage' the rider fires ONLY when the resolved campaign
// lastAttack.forcedMode === 'advantage' (same post-hit channel the
// advantage-rig te stamps); a non-advantage hit pays primary-only with an
// honest `secondary_damage_skipped` log. Legacy always-roll rows (condition
// null/absent) stay byte-identical — rider rolls on every hit.
//
// Lane: PLAIN damage only. The SAVE-handler twin (twin/multi secondary
// patches) lives in handleNpcSaveDamage.metamagic.test.js; the row→context
// transport (secondaryCondition forwarding) lives in
// MonsterCardModal.ma0889-goblin-boss-advantage-rider.test.js. Weapons are
// parameterized here — the gate itself is weapon-agnostic.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    parseConstant: vi.fn((formula) => /^[+-]?\d+$/.test(String(formula ?? '').replace(/\s*\[.*?\]\s*/g, '').trim()) ? parseInt(String(formula).trim(), 10) : null),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget, clearReTriggeredSequence } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import monstersData from '../../../../public/data/monsters.json';

// Row shapes mirror monsters.json (guarded below): Goblin Boss
// Scimitar/Shortbow 1d4, Scout Captain Shortsword/Longbow 3d6, all
// secondary_condition:"advantage".
const WEAPONS = {
    scimitar: { name: 'Scimitar', formula: '1d6 + 2', total: 5, modifier: 2, damageType: 'Slashing', secondaryFormula: '1d4', secondaryDamageType: 'Slashing' },
    shortsword: { name: 'Shortsword', formula: '1d6 + 3', total: 6, modifier: 3, damageType: 'Piercing', secondaryFormula: '3d6', secondaryDamageType: 'Piercing' },
    longbow: { name: 'Longbow', formula: '1d8 + 3', total: 6, modifier: 3, damageType: 'Piercing', secondaryFormula: '3d6', secondaryDamageType: 'Piercing' },
};

describe('MA-0889 advantage-gated secondary rider (plain damage)', () => {
    const deps = {
        characterName: 'Goblin Boss',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Goblin Boss', computedStats: { armorClass: 17 } },
            { name: 'Bandit', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    function resetRollState() {
        rollExpression.mockReset().mockReturnValue({ total: 2, rolls: [2], modifier: 0 });
        applyDamageToTarget.mockReset();
        clearReTriggeredSequence.mockClear();
        addEntry.mockClear().mockReturnValue(Promise.resolve());
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    }

    beforeEach(() => {
        getRuntimeValue.mockReset();
        resetRollState();
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit', type: 'npc', ac: 12, currentHp: 12, maxHp: 12 }],
        });
    });

    function stampForcedMode(mode) {
        getRuntimeValue.mockImplementation((char, key) => {
            if (char === 'campaign' && key === 'lastAttack') {
                return { attackerName: 'Goblin Boss', targetName: 'Bandit', forcedMode: mode };
            }
            if (char === 'campaign') return [];
            return null;
        });
    }

    // secondaryCondition === 'absent' omits the key entirely (legacy rows).
    function rollWeapon(weapon, mode, secondaryCondition = 'advantage') {
        stampForcedMode(mode);
        applyDamageToTarget
            .mockReturnValueOnce({ finalDamage: 2, newHp: 5, damageReduced: false })
            .mockReturnValueOnce({ finalDamage: 5, newHp: 7, damageReduced: false });
        const fn = createLogDamageAndShow(deps);
        return fn({
            name: weapon.name,
            formula: weapon.formula,
            total: weapon.total,
            rolls: [3],
            modifier: weapon.modifier,
            context: {
                targetName: 'Bandit',
                damageType: weapon.damageType,
                attackerName: 'Goblin Boss',
                autoDamageSecondaryFormula: weapon.secondaryFormula,
                autoDamageSecondaryName: weapon.name,
                autoDamageSecondaryDamageType: weapon.secondaryDamageType,
                ...(secondaryCondition === 'absent' ? {} : { secondaryCondition }),
            },
        });
    }

    const skipEntry = () => addEntry.mock.calls.map(c => c[1]).find(e => e?.automationType === 'secondary_damage_skipped');
    const damageLog = () => deps.logEntry.mock.calls[0][0];
    const popupData = () => deps.setPopupHtml.mock.calls[0][0];

    it('advantage hit — rider rolls, secondary applied first + primary, combined log, no skip log', async () => {
        await rollWeapon(WEAPONS.scimitar, 'advantage');
        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(2);
        expect(applyDamageToTarget.mock.calls[0][3]).toEqual(['Slashing']);
        expect(applyDamageToTarget.mock.calls[1][2]).toBe(5);
        expect(clearReTriggeredSequence).toHaveBeenCalled();
        expect(damageLog().secondaryFormula).toBe('1d4');
        expect(damageLog().secondaryTotal).toBe(2);
        expect(damageLog().secondaryFinalDamage).toBe(2);
        expect(popupData().secondaryFormula).toBe('1d4');
        expect(addEntry.mock.calls.map(c => c[1]?.automationType)).not.toContain('secondary_damage_skipped');
    });

    it('normal hit — rider gated: never rolls, primary-only applied, honest skip log, no secondary fields', async () => {
        await rollWeapon(WEAPONS.scimitar, null);
        expect(rollExpression).not.toHaveBeenCalledWith('1d4');
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(5);
        expect(applyDamageToTarget.mock.calls[0][3]).toEqual(['Slashing']);
        const skip = skipEntry();
        expect(skip).toBeTruthy();
        expect(skip.reason).toBe('no advantage');
        expect(skip.characterName).toBe('Goblin Boss');
        expect(skip.abilityName).toBe('Scimitar');
        expect(damageLog().secondaryFormula).toBeUndefined();
        expect(damageLog().secondaryTotal).toBeUndefined();
        expect(damageLog().secondaryFinalDamage).toBeUndefined();
        expect(popupData().secondaryFormula).toBeUndefined();
    });

    it('disadvantage hit — forcedMode "disadvantage" gates the rider off too', async () => {
        await rollWeapon(WEAPONS.scimitar, 'disadvantage');
        expect(rollExpression).not.toHaveBeenCalledWith('1d4');
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(skipEntry()?.reason).toBe('no advantage');
    });

    describe('MA-1444/1445 Scout Captain — same gate on the 3d6 riders', () => {
        for (const key of ['shortsword', 'longbow']) {
            const weapon = WEAPONS[key];
            it(`${weapon.name} — advantage pays primary + secondary, normal hit gates with skip log`, async () => {
                await rollWeapon(weapon, 'advantage');
                expect(rollExpression).toHaveBeenCalledWith(weapon.secondaryFormula);
                expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
                expect(addEntry.mock.calls.map(c => c[1]?.automationType)).not.toContain('secondary_damage_skipped');

                resetRollState();
                await rollWeapon(weapon, null);
                expect(rollExpression).not.toHaveBeenCalledWith(weapon.secondaryFormula);
                expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
                expect(applyDamageToTarget.mock.calls[0][2]).toBe(weapon.total);
                expect(applyDamageToTarget.mock.calls[0][3]).toEqual(['Piercing']);
                const skip = skipEntry();
                expect(skip?.reason).toBe('no advantage');
                expect(skip?.abilityName).toBe(weapon.name);
            });
        }
    });

    it('legacy always-roll rows unchanged (MA-0426/0531) — condition null or absent, rider always rolls', async () => {
        await rollWeapon(WEAPONS.scimitar, null, null);
        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        expect(addEntry.mock.calls.map(c => c[1]?.automationType)).not.toContain('secondary_damage_skipped');

        resetRollState();
        await rollWeapon(WEAPONS.scimitar, null, 'absent');
        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
    });

    it('monsters.json rows still carry the advantage gate this lane consumes', () => {
        const rowsFor = (creature) => monstersData.find(m => m.name === creature).actions.reduce((acc, a) => ({ ...acc, [a.name]: a }), {});
        const goblinBoss = rowsFor('Goblin Boss');
        expect(goblinBoss.Scimitar).toMatchObject({ damage_dice_primary: '1d6 + 2', damage_dice_secondary: '1d4', damage_type_secondary: 'Slashing', secondary_condition: 'advantage' });
        expect(goblinBoss.Shortbow).toMatchObject({ damage_dice_primary: '1d6 + 2', damage_dice_secondary: '1d4', damage_type_secondary: 'Piercing', secondary_condition: 'advantage' });
        const scoutCaptain = rowsFor('Scout Captain');
        expect(scoutCaptain.Shortsword).toMatchObject({ damage_dice_primary: '1d6 + 3', damage_dice_secondary: '3d6', damage_type_secondary: 'Piercing', secondary_condition: 'advantage' });
        expect(scoutCaptain.Longbow).toMatchObject({ damage_dice_primary: '1d8 + 3', damage_dice_secondary: '3d6', damage_type_secondary: 'Piercing', secondary_condition: 'advantage' });
    });
});
