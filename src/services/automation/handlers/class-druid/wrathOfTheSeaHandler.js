import { rollExpression, rollD20 } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { registerPendingSavePrompt } from '../../../combat/auras/pendingSaveRegistry.js';
import { addEntry } from '../../../ui/logService.js';
import { loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { sendSavePrompt } from '../../../combat/conditions/savePromptService.js';
import storage from '../../../../services/ui/storage.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

// CLA-393: once-per-turn attack latch (CLA-371/FT-094 family) — stamped at the
// attack trigger before save/damage writes, cleared at round-wrap beside
// _Slow_Fall_usedRound in initiative.jsx + navigationHandlers.js.
const USED_ROUND_KEY = '_Wrath_of_the_Sea_usedRound';
// CLA-334 recipe: minutes × 10 rounds. Canonical Wrath of the Sea lasts 10 minutes.
const WRATH_ROUNDS_PER_MINUTE = 10;
const DEFAULT_WRATH_MINUTES = 10;
const DEFAULT_EMANATION_RANGE_FT = 5;
const DEFAULT_PUSH_DISTANCE_FT = 15;
const NO_PUSH_SIZES = ['huge', 'gargantuan'];

function wrathRounds(auto) {
    const match = String(auto?.duration || '').match(/(\d+)_minutes?/);
    const minutes = match ? parseInt(match[1], 10) : DEFAULT_WRATH_MINUTES;
    return minutes * WRATH_ROUNDS_PER_MINUTE;
}

function refusal(action, playerName, campaignName, reason) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'wrath_of_the_sea_refused',
        name: action.name,
        description: `${action.name}: ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[wrathOfTheSeaHandler:refusal-log-error]', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: `${action.name} — ${reason}`,
            automation: action.automation,
        },
    };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const isAllyAttack = auto?.allyAttack === true;
    const playerName = playerStats.name;

    // CLA-393: fresh combat context for the turn gate + round latch (CLA-371:
    // never a stale combatSummary mirror).
    const csFresh = await getCombatContext(campaignName);
    const currentRound = csFresh?.round || 1;

    if (!isAllyAttack) {
        const wrathActive = getRuntimeValue(playerName, 'wrathOfTheSeaActive', campaignName);

        if (!wrathActive) {
            const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
            const currentWS = Number(getRuntimeValue(playerName, 'wildShapeUses', campaignName) ?? maxWS);

            if (currentWS <= 0) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `${action.name}: No Wild Shape uses remaining.`,
                        automation: auto,
                    },
                };
            }

            await setRuntimeValue(playerName, 'wildShapeUses', currentWS - 1, campaignName);
            await setRuntimeValue(playerName, 'wrathOfTheSeaActive', true, campaignName);

            // CLA-393: register the 10-minute emanation clock (CLA-334 minutes×10).
            addExpiration(playerName, playerName, [{ type: 'wrath_of_the_sea_end' }], campaignName, wrathRounds(auto));

            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: action.name,
                description: `${playerName} activated Wrath of the Sea. Ocean spray emanation active for 10 minutes.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[wrathOfTheSeaHandler:log-error]", e); });

            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} activated — ocean spray emanation surrounds you for 10 minutes. Once per turn on your turns, use it again as a Bonus Action to force a creature within 5 feet of the Emanation to make a Constitution save or take Cold damage and be pushed up to 15 feet away from you.`,
                    automation: auto,
                },
            };
        }
    }

    // CLA-393 gate 1 — once-per-turn latch: the attack choice happens only once
    // per turn as a Bonus Action (CLA-371 read from fresh combat context).
    const usedRound = Number(getRuntimeValue(playerName, USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return refusal(action, playerName, campaignName, 'Once per turn — the Wrath of the Sea attack has already been used this round.');
    }

    // CLA-393 gate 2 — turn gate: this Bonus Action fires only on the holder's turn.
    const activeName = csFresh?.activeCreatureName;
    if (activeName && activeName !== playerName) {
        return refusal(action, playerName, campaignName, `It is ${activeName}'s turn — Wrath of the Sea is a Bonus Action on your own turn.`);
    }

    const wisMod = isAllyAttack
        ? (Number(getRuntimeValue(playerName, 'wrathOfTheSeaWisMod', campaignName)) || 1)
        : (playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 1);

    const diceCount = Math.max(1, wisMod);
    const damageFormula = `${diceCount}d6`;
    const damageResult = rollExpression(damageFormula);

    if (!damageResult) return null;

    const saveDc = isAllyAttack
        ? (Number(getRuntimeValue(playerName, 'wrathOfTheSeaDc', campaignName)) || 0)
        : (8 + (playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0) + (playerStats.proficiency || 0));

    const combatSummary = await loadCombatSummary(campaignName);
    const target = getTargetFromAttacker(combatSummary, playerName);

    if (!target) {
        return refusal(action, playerName, campaignName, 'No current target selected — set the Target dropdown on your initiative card first.');
    }

    // CLA-393 gate 3 — emanation containment: the target must be within the
    // Emanation radius of you (gridless combat resolves lenient, CLA-317).
    const emanationRangeFt = rangeToFeet(auto?.range) ?? DEFAULT_EMANATION_RANGE_FT;
    const inRange = await isWithinRange(playerName, target.name, emanationRangeFt);
    if (!inRange) {
        return refusal(action, playerName, campaignName, `${target.name} is outside the ${emanationRangeFt}-foot Emanation.`);
    }

    // CLA-371 lesson: serialize the latch — awaited stamp at the trigger, before
    // any save/damage writes, so a second same-round click reads the stamped round.
    await setRuntimeValue(playerName, USED_ROUND_KEY, currentRound, campaignName);

    const pushDistanceFt = rangeToFeet(auto?.effectValue) ?? DEFAULT_PUSH_DISTANCE_FT;

    const isNpc = target.type === 'npc';
    const results = [];
    const playerPrompts = [];

    if (isNpc) {
        const saveBonus = target?.saveBonuses?.['con'] ?? 0;
        const saveRoll = rollD20();
        const saveTotal = saveRoll + saveBonus;
        const saveSuccess = saveTotal >= saveDc;

        const finalDamage = saveSuccess ? 0 : damageResult.total;
        const applyResult = applyDamageToTarget(
            combatSummary, target.name, finalDamage, ['cold'], campaignName,
            [playerStats], false, playerName, false
        );

        const actualDamage = applyResult?.finalDamage ?? finalDamage;
        const newHp = applyResult?.newHp ?? target.currentHp;

        if (actualDamage > 0) {
            endInvisibilityOnHostileAction(playerName, campaignName);
        }

        // CLA-393: push record — the failed-save creature is pushed up to 15 feet
        // away from you if Large or smaller (no grid-position consumer exists;
        // instant te marker + log per WM-006/CLA-357 precedent).
        const size = String(target?.size || '').toLowerCase();
        const canBePushed = !NO_PUSH_SIZES.includes(size);
        if (!saveSuccess && canBePushed) {
            registerTargetEffect(campaignName, target.name, 'push', action.name, {
                value: pushDistanceFt,
                movedDistanceFt: pushDistanceFt,
                duration: 'instant',
            });
        }

        results.push({
            targetName: target.name,
            saveSuccess,
            saveRoll,
            saveTotal,
            saveBonus,
            damage: actualDamage,
            newHp,
            pushed: !saveSuccess && canBePushed,
        });

        await addEntry(campaignName, {
            type: 'roll',
            characterName: playerName,
            rollType: 'save-damage',
            name: action.name,
            formula: damageFormula,
            rolls: damageResult.rolls,
            total: damageResult.total,
            modifier: damageResult.modifier,
            damageType: 'cold',
            targetName: target.name,
            saveType: 'CON',
            saveDc,
            dcSuccess: 'none',
            saveResult: saveSuccess ? 'success' : 'failure',
            saveRoll,
            saveBonus,
            saveRawRolls: [saveRoll, saveRoll],
            finalDamage: actualDamage,
            pushedDistanceFt: (!saveSuccess && canBePushed) ? pushDistanceFt : 0,
            note: 'combined_save_damage_roll',
            timestamp: Date.now(),
        }).catch((e) => { console.error('[wrathOfTheSea] Log error:', e); });
    } else {
        const promptId = `${action.name.replace(/\s+/g, '_')}_${target.name}_${Date.now()}`;

        registerPendingSavePrompt(promptId, {
            targetName: target.name,
            rawDamage: damageResult.total,
            saveDc,
            saveType: 'CON',
            dcSuccess: 'none',
            damageType: 'cold',
            attackerName: playerName,
            name: action.name,
            formula: damageFormula,
            modifier: damageResult.modifier,
            rolls: damageResult.rolls,
            campaignName,
            setPopupHtml: () => { },
            isAoe: true,
        });

        sendSavePrompt(campaignName, {
            promptId,
            targetName: target.name,
            saveType: 'CON',
            saveDc,
            sourceName: playerName,
        });

        playerPrompts.push({ promptId, targetName: target.name });
    }

    if (combatSummary) {
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    let resultsHtml = `<b>${action.name} used!</b><br/><br/>`;
    resultsHtml += `<b>Save DC: ${saveDc}</b> (CON)<br/><br/>`;
    resultsHtml += `<b>Rolls:</b> ${damageFormula} = ${damageResult.total} Cold damage<br/><br/>`;

    for (const r of results) {
        const saveResult = r.saveSuccess ? '<span style="color: #4caf50;">Passed</span>' : '<span style="color: #f44336;">Failed</span>';
        const damageWord = r.saveSuccess ? 'none' : 'full';
        resultsHtml += `<b>${r.targetName}</b>: ${saveResult} (${r.saveRoll}+${r.saveBonus}=${r.saveTotal} vs DC ${saveDc}) — ${damageWord} damage: ${r.damage}${r.pushed ? ` — pushed up to ${pushDistanceFt} feet away from you` : ''}<br/>`;
    }

    if (playerPrompts.length > 0) {
        resultsHtml += `<br/><b>${playerPrompts.length} player${playerPrompts.length !== 1 ? 's' : ''} rolling saves...</b> — on a failed save, Cold damage and pushed up to ${pushDistanceFt} feet away from you (Large or smaller).`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: resultsHtml,
            automation: auto,
            results,
        },
    };
}
