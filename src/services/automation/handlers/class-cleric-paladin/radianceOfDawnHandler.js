import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { hasIgnoreResistance } from '../../../combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import storage from '../../../../services/ui/storage.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check Channel Divinity charges
    const storedCharges = getRuntimeValue(playerName, 'channelDivinityCharges');
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

    if (currentCharges <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Channel Divinity charges remaining.',
                automation: auto,
            },
        };
    }

    // Consume charge
    await setRuntimeValue(playerName, 'channelDivinityCharges', currentCharges - 1, campaignName);

    // Get combat summary for target selection
    const combatSummary = await loadCombatSummary(campaignName);
    const creatures = combatSummary?.creatures || [];

    // Calculate range
    const rangeFeet = auto.shape?.includes('emanation_30ft') ? 30 : 10;

    // Build creature targets list (exclude self)
    const creatureTargets = creatures.filter(c => c.name !== playerName);

    // Return modal request
    return {
        type: 'modal',
        modalName: 'radianceOfDawn',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            saveDc: auto.saveDc || Math.floor(8 + playerStats.proficiency_bonus + playerStats.ability_scores.WIS?.bonus || 0),
            featureName: action.name,
            saveType: auto.saveType || 'CON',
            rangeFeet,
            damageExpression: auto.damage || '',
            damageType: auto.damageType || 'Radiant',
        },
    };
}

export async function confirmRadianceOfDawn(action, playerStats, campaignName, selectedTargets) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name;
    const saveType = auto.saveType || 'CON';
    const damageExpression = auto.damage || '';
    const damageType = auto.damageType || 'Radiant';

    // Resolve variable damage expressions (e.g. "2d10 + cleric level" -> "2d10+8")
    const clericLevel = playerStats.level || 1;
    let resolvedExpression = damageExpression
        .replace(/\bcleric level\b/gi, String(clericLevel))
        .replace(/\s+/g, '');

    // Roll damage once for all targets
    const damageResult = rollExpression(resolvedExpression);
    if (!damageResult) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: Failed to roll damage.`,
                automation: auto,
            },
        };
    }

    const totalDamage = damageResult.total;
    const rolls = damageResult.rolls;
    const modifier = damageResult.modifier;

    // Get combat summary and process targets
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No active combat.`,
                automation: auto,
            },
        };
    }

    const saveDc = buildSaveDc(auto, playerStats);
    const dcSuccess = 'half';
    const ignoreResistance = hasIgnoreResistance(playerStats, damageType);

    const results = [];
    const playerPrompts = [];

    for (const targetName of selectedTargets) {
        const target = combatSummary.creatures.find(c => c.name === targetName);
        if (!target) continue;

        const isNpc = !targetName.startsWith('player-') || target.type === 'npc';

        if (isNpc) {
            // Roll save for NPC
            const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;
            const saveRoll = Math.floor(Math.random() * 20) + 1;
            const saveTotal = saveRoll + saveBonus;
            const success = saveTotal >= saveDc;

            // Calculate damage
            let finalDamage = success ? Math.floor(totalDamage / 2) : totalDamage;
            const applyResult = applyDamageToTarget(
                combatSummary, targetName, finalDamage, [damageType], campaignName,
                playerStats ? [playerStats] : null, ignoreResistance, playerName, true
            );

            const actualDamage = applyResult?.finalDamage ?? finalDamage;
            const newHp = applyResult?.newHp ?? target.currentHp;

            if (actualDamage > 0) {
                endInvisibilityOnHostileAction(playerName, campaignName);
            }

            results.push({
                targetName,
                success,
                roll: saveRoll,
                total: saveTotal,
                saveBonus,
                damage: actualDamage,
                newHp,
            });

            // Log the save
            await addEntry(campaignName, {
                type: 'roll',
                characterName: playerName,
                rollType: 'save-damage',
                name: featureName,
                formula: damageExpression,
                rolls,
                total: totalDamage,
                modifier,
                damageType,
                targetName,
                saveType,
                saveDc,
                dcSuccess,
                saveResult: success ? 'success' : 'failure',
                saveRoll,
                saveBonus,
                saveRawRolls: [saveRoll],
                finalDamage: actualDamage,
                note: 'combined_save_damage_roll',
                timestamp: Date.now(),
            }).catch((e) => { console.error('[radianceOfDawn] Log error:', e); });
        } else {
            // Send save prompt for player targets
            const promptId = `${featureName.replace(/\s+/g, '_')}_${targetName}_${Date.now()}`;

            // Store pending save for damage application
            if (!window.__pendingSaves) window.__pendingSaves = {};
            window.__pendingSaves[promptId] = {
                targetName,
                rawDamage: totalDamage,
                saveDc,
                saveType,
                dcSuccess,
                damageType,
                attackerName: playerName,
                name: featureName,
                formula: damageExpression,
                modifier,
                rolls,
                campaignName,
                setPopupHtml: () => { },
            };

            // Send save prompt via SSE
            const key = `savePrompt-${targetName}`;
            fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    value: {
                        promptId,
                        targetName,
                        saveType,
                        saveDc,
                        dcSuccess,
                        damageFormula: damageExpression,
                        damageType,
                        sourceName: featureName,
                        rawDamage: totalDamage,
                    },
                }),
            }).catch((e) => { console.error('[radianceOfDawn] Save prompt error:', e); });

            playerPrompts.push({ promptId, targetName });

            // Log the pending save
            await addEntry(campaignName, {
                type: 'roll',
                characterName: playerName,
                rollType: 'save-prompt',
                name: featureName,
                formula: damageExpression,
                rolls,
                total: totalDamage,
                modifier,
                damageType,
                targetName,
                saveType,
                saveDc,
                dcSuccess,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[radianceOfDawn] Log error:', e); });
        }
    }

    // Save combat summary and notify
    if (combatSummary) {
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    const playerCount = playerPrompts.length;

    // Build detailed results HTML for popup
    let resultsHtml = `<b>${featureName} used!</b><br/><br/>`;
    resultsHtml += `<b>Save DC: ${saveDc}</b> (CON)<br/><br/>`;
    resultsHtml += `<b>Rolls:</b> ${damageExpression} = ${totalDamage} ${damageType} damage<br/><br/>`;

    for (const r of results) {
        const saveResult = r.success ? '<span style="color: #4caf50;">Passed</span>' : '<span style="color: #f44336;">Failed</span>';
        const damageWord = r.success ? 'half' : 'full';
        resultsHtml += `<b>${r.targetName}</b>: ${saveResult} (${r.roll}+${r.saveBonus}=${r.total} vs DC ${saveDc}) — ${damageWord} damage: ${r.damage}<br/>`;
    }

    if (playerCount > 0) {
        resultsHtml += `<br/><b>${playerCount} player${playerCount !== 1 ? 's' : ''} rolling saves...</b>`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: resultsHtml,
            automation: auto,
            results,
        },
    };
}
