import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { registerPendingSavePrompt } from '../../../combat/auras/pendingSaveRegistry.js';
import { addEntry } from '../../../ui/logService.js';
import { loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { sendSavePrompt } from '../../../combat/conditions/savePromptService.js';
import storage from '../../../../services/ui/storage.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { rollD20 } from '../../../dice/diceRoller.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const isAllyAttack = auto?.allyAttack === true;
    const playerName = playerStats.name;

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

            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: action.name,
                description: `${playerName} activated Wrath of the Sea. Ocean spray emanation active.`,
                timestamp: Date.now(),
            }).catch(() => {});

            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} activated — ocean spray emanation surrounds you. Subsequent uses as a Bonus Action deal Cold damage.`,
                    automation: auto,
                },
            };
        }
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
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No current target selected.`,
                automation: auto,
            },
        };
    }

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
            [playerStats], false, playerName, true
        );

        const actualDamage = applyResult?.finalDamage ?? finalDamage;
        const newHp = applyResult?.newHp ?? target.currentHp;

        if (actualDamage > 0) {
            endInvisibilityOnHostileAction(playerName, campaignName);
        }

        results.push({
            targetName: target.name,
            saveSuccess,
            saveRoll,
            saveTotal,
            saveBonus,
            damage: actualDamage,
            newHp,
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
        resultsHtml += `<b>${r.targetName}</b>: ${saveResult} (${r.saveRoll}+${r.saveBonus}=${r.saveTotal} vs DC ${saveDc}) — ${damageWord} damage: ${r.damage}<br/>`;
    }

    if (playerPrompts.length > 0) {
        resultsHtml += `<br/><b>${playerPrompts.length} player${playerPrompts.length !== 1 ? 's' : ''} rolling saves...</b>`;
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
