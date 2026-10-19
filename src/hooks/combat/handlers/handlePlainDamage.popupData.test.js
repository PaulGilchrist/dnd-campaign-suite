// @maintained-by-ai
// Lane: handlePlainDamage — popup PAYLOAD BYTES owner (#744 write count, #789/#825 byte-exact census).
// Module under test: src/hooks/combat/handlers/handlePlainDamage.js (reached via createLogDamageAndShow,
// src/hooks/combat/useLoggedDiceRollDamage.js). NOT services/automation/handlers/combat/multiTargetHandler.js
// — the #880 note lives there, a different module (#941 module-identity).
// Owned here: every byte the plain popup carries — roll detail (formula/rolls/total/adjustedTotal),
// target + hp bytes, crit styling flag, dc/tavern/spell/bardic/empowered passthrough, piercer/savage
// availability + weaponType, applyResult-derived bytes (finalDamage overwrite on intercept, holyAura),
// twin/secondary popup bytes incl. the twinTarget* collision the multi handler reuses (:558-566) —
// pinned AS-AUTHORED, no new bug invented.
// Owned elsewhere (not re-driven): fan-out order, per-target apply payloads, write counts and log notes
// (.multiTarget #941); MA-0010 grants (.hitClause); base hp/lastAttack resolution (.test.js — its :154
// already pins the apply args, so the old args test here is cut); min-damage/zero-damage seams
// (.ma1400/.ma1402); secondary-damage feature bytes (.secondaryDamage); weakening/ray/seeding te bytes
// (.weakening-breath et al).
// Old -> new: 20 -> 17. core+gwf+elementalAdept+tavernNull+spellNameEmpty -> one byte-exact census (#1);
// elementalAdeptBonus was mis-titled ("exceeds total") but asserted 0 — honest now: the unmocked
// min-damage seam keeps adjustedTotal == total, so the byte is 0 as-authored. isCrit/dc/tavern/spell/
// bardic/empowered -> 5-row passthrough table; piercer(4)+savage(5)+weaponType(4) -> 5-row gate table
// (true gates co-assert on one rapier attack; each false-conjunct stays falsifiable);
// intercepted+holyAura -> applyResult-derived table (secondaryDamage:383 covers the same intercept byte
// via secondary context — the FINAL-damage-overwrite + hp bytes here are primary-payload, kept);
// twin/secondary popup bytes are NEW here — .multiTarget :9 cited them "queued NEXT"; its :181 fold
// keeps order, the full bytes land now.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, rolls, isCrit) => {
        if (!isCrit) return formula;
        const parsed = formula.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
        if (!parsed) return formula;
        const count = parsed[1] || 1;
        const sides = parsed[2];
        const modifierStr = parsed[3];
        let modifier = 0;
        if (modifierStr) {
            const segments = modifierStr.match(/([+-]\d+)/g);
            for (const seg of segments) { modifier += parseInt(seg, 10); }
        }
        const dicePart = count === 1 ? `d${sides}` : `${count}d${sides}`;
        const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
        let result = `${dicePart}*2${rollStr}`;
        if (modifier > 0) result += `+${modifier}`;
        else if (modifier < 0) result += `${modifier}`;
        return result;
    }),
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
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
    hasGreatWeaponFighting: vi.fn(() => false),
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
    readAoeContext: vi.fn(() => null),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
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
    hasBardicInspirationOffense: vi.fn(() => false),
    getBardicInspirationDieSize: vi.fn(() => 0),
    getBardicInspirationDieSizeFromClass: vi.fn(() => 0),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(() => false),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(() => 0),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('handlePlainDamage — popup payload bytes', () => {
    const roster = {
        creatures: [
            { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
            { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
            { name: 'Alistair', type: 'player', ac: 17, currentHp: 27, maxHp: 30 },
        ],
    };
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [
            {
                name: 'TestFighter',
                computedStats: {
                    armorClass: 16,
                    characterAdvancement: [{ name: 'Sentinel' }],
                },
            },
            { name: 'Goblin', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        // Campaign-scoped reads answer empty; creature-scoped runtime values default null (#872 explicit
        // consumer-exact defaults): no te reductions, feats unused, lastAttack absent.
        getRuntimeValue.mockReset().mockImplementation((key) => (key === 'campaign' ? [] : null));
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockReset().mockResolvedValue(roster);
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    const longsword = (context = {}) => ({
        name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3,
        context: { targetName: 'Goblin', damageType: 'slashing', ...context },
    });

    // Fold updater-style writes onto the primary popup (#941 robust fold — no index digging).
    const finalPopup = () => deps.setPopupHtml.mock.calls.reduce((acc, [arg]) => (typeof arg === 'function' ? arg(acc) : arg), {});
    const run = async (roll) => {
        await createLogDamageAndShow(deps)(roll);
        return finalPopup();
    };

    // Census of every byte buildPlainPopupData + hp fallbacks + applyPopupApplyResult +
    // attachPopupFeatureFlags leave on a plain hit (:428-471, :1127-1229, :334-375).
    // Note the authored defaults: bonus 0, elementalAdeptBonus 0 (applyMinDamageAdjustment is the
    // identity seam owned by .ma1400/.ma1402, so adjustedTotal stays == total), gwf untouched,
    // ray/weakening/resistance te bytes 0/null (te lanes owned elsewhere), 'no feat' flag bytes
    // false, spellName ''.
    it('writes the FULL plain popup byte-exactly, once', async () => {
        await run(longsword());

        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        expect(deps.setPopupHtml.mock.calls[0][0]).toEqual({
            type: 'damage',
            name: 'Longsword',
            formula: '1d8+3',
            rolls: [5, 3],
            bonus: 0,
            modifier: 3,
            damageType: 'slashing',
            targetName: 'Goblin',
            total: 8,
            adjustedTotal: 8,
            elementalAdeptBonus: 0,
            isCrit: false,
            gwfApplied: false,
            gwfOriginalRolls: null,
            gwfDisplayRolls: [5, 3],
            tavernBrawlerRerolls: null,
            rayOfEnfeebleReduction: 0,
            rayOfEnfeebleRoll: null,
            weakeningBreathReduction: 0,
            weakeningBreathRoll: null,
            resistanceReduction: 0,
            resistanceRoll: null,
            targetCurrentHp: 5,
            targetMaxHp: 13,
            damageApplied: true,
            finalDamage: 8,
            damageReduced: false,
            bardicInspirationOffense: false,
            bardicInspirationOffenseDieSize: null,
            empoweredSpell: false,
            empoweredSpellChaMod: 0,
            spellName: '',
            piercerPuncture: false,
            weaponType: 'melee',
            savageAttacker: false,
        });
    });

    const passthroughBytes = [
        {
            label: 'auto-crit flag (formula bytes stay unmultiplied — crit display lives on the log lane)',
            context: { isAutoCrit: true },
            bytes: { isCrit: true },
        },
        {
            label: 'save dc triple',
            context: { dc: 15, dcType: 'strength', dcSuccess: false },
            bytes: { dc: 15, dcType: 'strength', dcSuccess: false },
        },
        {
            label: 'tavern brawler rerolls',
            context: { tavernBrawlerRerolls: [1, 2] },
            bytes: { tavernBrawlerRerolls: [1, 2] },
        },
        {
            label: 'spellName',
            context: { spellName: 'Fire Bolt' },
            bytes: { spellName: 'Fire Bolt' },
        },
        {
            label: 'bardic inspiration and empowered spell pairs',
            context: { bardicInspirationOffense: true, bardicInspirationOffenseDieSize: 6, empoweredSpell: true, empoweredSpellChaMod: 2 },
            bytes: { bardicInspirationOffense: true, bardicInspirationOffenseDieSize: 6, empoweredSpell: true, empoweredSpellChaMod: 2 },
        },
    ];

    it.each(passthroughBytes)('surfaces context passthrough bytes verbatim — $label', async ({ context, bytes }) => {
        expect(await run(longsword(context))).toMatchObject(bytes);
    });

    const featGateBytes = [
        {
            label: 'rapier with Piercer + Savage Attacker unused grants both flag bytes',
            roll: { name: 'Rapier', damageType: 'piercing' },
            playerStats: {
                reactions: [{ automation: { type: 'piercer_puncture' } }],
                automation: { passives: [{ type: 'passive_rule', effect: 'reroll_damage_once_per_turn' }] },
            },
            used: { piercer: false, savage: false },
            bytes: { weaponType: 'melee', piercerPuncture: true, savageAttacker: true },
        },
        {
            label: 'same attack with both feats already used zeroes both flag bytes',
            roll: { name: 'Rapier', damageType: 'piercing' },
            playerStats: {
                reactions: [{ automation: { type: 'piercer_puncture' } }],
                automation: { passives: [{ type: 'passive_rule', effect: 'reroll_damage_once_per_turn' }] },
            },
            used: { piercer: true, savage: true },
            bytes: { weaponType: 'melee', piercerPuncture: false, savageAttacker: false },
        },
        {
            label: 'ranged fire bolt zeroes piercer (type gate) and savage (range gate) even with both feats',
            roll: { name: 'Fire Bolt', formula: '1d10', total: 8, rolls: [8], modifier: 0, damageType: 'fire', isMelee: false },
            playerStats: {
                reactions: [{ automation: { type: 'piercer_puncture' } }],
                automation: { passives: [{ type: 'passive_rule', effect: 'reroll_damage_once_per_turn' }] },
            },
            used: { piercer: false, savage: false },
            bytes: { weaponType: 'ranged', piercerPuncture: false, savageAttacker: false },
        },
        {
            label: 'unarmed strike classifies unarmed and keeps savage eligible',
            roll: { name: 'Unarmed Strike', formula: '1d4', total: 4, rolls: [4], modifier: 0, damageType: 'bludgeoning', isUnarmedStrike: true },
            playerStats: {
                automation: { passives: [{ type: 'passive_rule', effect: 'reroll_damage_once_per_turn' }] },
            },
            used: { piercer: false, savage: false },
            bytes: { weaponType: 'unarmed', savageAttacker: true },
        },
        {
            label: 'piercing without the Piercer feat zeroes piercerPuncture',
            roll: { name: 'Rapier', damageType: 'piercing' },
            playerStats: {},
            used: { piercer: false, savage: false },
            bytes: { weaponType: 'melee', piercerPuncture: false, savageAttacker: false },
        },
    ];

    it.each(featGateBytes)('feature availability + weaponType bytes — $label', async ({ roll, playerStats, used, bytes }) => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign') return [];
            if (prop === 'piercerPunctureUsedThisTurn') return used.piercer;
            if (prop === '_Savage_Attacker_usedRound') return used.savage;
            return null;
        });
        expect(await run(longsword({ ...roll, playerStats }))).toMatchObject(bytes);
    });

    const applyResultBytes = [
        {
            label: 'intercepted hit rewrites FINAL damage to damageDealt and names the feature (:465-467)',
            applyResult: { finalDamage: 5, newHp: 8, damageReduced: false, intercepted: true, interceptedFeature: 'Shield Boy', damageDealt: 3, oldHp: 11 },
            bytes: { interceptedFeature: 'Shield Boy', finalDamage: 3, targetCurrentHp: 8, damageApplied: true },
        },
        {
            label: 'holy aura save result object lands whole from applyResult (:468-470)',
            applyResult: { finalDamage: 8, newHp: 5, damageReduced: false, holyAuraSaveResult: { success: true, saveType: 'wisdom' } },
            bytes: { holyAuraSaveResult: { success: true, saveType: 'wisdom' } },
        },
    ];

    it.each(applyResultBytes)('applyResult-derived popup bytes — $label', async ({ applyResult, bytes }) => {
        applyDamageToTarget.mockReturnValue(applyResult);
        expect(await run(longsword())).toMatchObject(bytes);
    });

    // As-authored (:523-531/:558-566): BOTH secondary handlers publish into the SAME twinTarget*
    // namespace — the multi handler overwrites twin bytes when both are distinct. .multiTarget #941
    // owns the fan-out ORDER and order-dependent overwrite fold (:181); here the payload bytes for
    // each lane are pinned without re-driving order. The multi row asserts the field-name collision
    // honestly as-authored — no new bug needed.
    const secondaryPopupBytes = [
        {
            label: 'twin npc copies secondary apply bytes with maxHp from the roster',
            rosterCreature: { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
            context: { metamagicTwinTarget: 'Orc' },
            secondary: { finalDamage: 5, newHp: 10, damageReduced: false },
            runtime: {},
            bytes: { twinTargetName: 'Orc', twinFinalDamage: 5, twinTargetCurrentHp: 10, twinTargetMaxHp: 15 },
        },
        {
            label: 'twin player maxHp byte comes from runtime hitPoints, not the roster',
            rosterCreature: { name: 'Alistair', type: 'player', ac: 17, currentHp: 27, maxHp: 30 },
            context: { metamagicTwinTarget: 'Alistair' },
            secondary: { finalDamage: 4, newHp: 26, damageReduced: false },
            runtime: { hitPoints: 22 },
            bytes: { twinTargetName: 'Alistair', twinFinalDamage: 4, twinTargetCurrentHp: 26, twinTargetMaxHp: 22 },
        },
        {
            label: 'twin player with no runtime hitPoints collapses maxHp byte to 0 (:528-530 ?? 0)',
            rosterCreature: { name: 'Alistair', type: 'player', ac: 17, currentHp: 27, maxHp: 30 },
            context: { metamagicTwinTarget: 'Alistair' },
            secondary: { finalDamage: 4, newHp: 26, damageReduced: false },
            runtime: { hitPoints: null },
            bytes: { twinTargetName: 'Alistair', twinTargetMaxHp: 0 },
        },
        {
            label: 'quirk as-authored — multi target publishes into the twinTarget* namespace (:558-566)',
            rosterCreature: { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
            context: { multiTarget: 'Orc' },
            secondary: { finalDamage: 6, newHp: 8, damageReduced: false },
            runtime: {},
            bytes: { twinTargetName: 'Orc', twinFinalDamage: 6, twinTargetCurrentHp: 8, twinTargetMaxHp: 15 },
        },
    ];

    it.each(secondaryPopupBytes)('secondary (twin/multi) popup bytes — $label', async ({ rosterCreature, context, secondary, runtime, bytes }) => {
        loadCombatSummary.mockResolvedValue({
            creatures: [roster.creatures[0], rosterCreature],
        });
        applyDamageToTarget.mockImplementation((_summary, targetName) =>
            targetName === 'Goblin'
                ? { finalDamage: 8, newHp: 5, damageReduced: false }
                : secondary);
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign') return [];
            return prop in runtime ? runtime[prop] : null;
        });

        const popup = await run(longsword(context));
        expect(popup).toMatchObject(bytes);
        expect(popup.targetName).toBe('Goblin');
        expect(popup.finalDamage).toBe(8);
    });
});
