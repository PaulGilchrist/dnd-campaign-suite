import { rollExpression } from '../../services/dice/diceRoller.js'

// Pure: first-ability-based Cleave attack bonus.
function computeCleaveAttackBonus(playerStats) {
    const abilityName = playerStats?.abilities?.[0]?.name || 'STR';
    const ability = playerStats?.abilities?.find(a => a.name === abilityName);
    const abilityMod = ability?.bonus || 0;
    return abilityMod + (playerStats.proficiency || 0);
}

// Pure: weapon damage without ability modifier to damage; fall back to raw formula.
function resolveCleaveDamageFormula(lastAttack) {
    const stripped = lastAttack.damageFormula
        .replace(/\+\s*\d+/g, '')
        .trim();
    if (!stripped || !/d\d/.test(stripped)) {
        return lastAttack.damageFormula;
    }
    return stripped;
}

export default function useCharActionsCleave({
    setShowCleaveTargetSelection,
    setTacticalMasterModal,
    campaignName,
    playerStats,
    rollDamage,
    getRuntimeValue,
    setRuntimeValue,
    addEntry,
    getCombatContext,
    createSaveListener,
    applyMasteryEffect,
}) {
    async function handleCleaveAttack(cleaveTargetName) {
        if (!cleaveTargetName) {
            setShowCleaveTargetSelection(false);
            return;
        }
        setShowCleaveTargetSelection(false);

        const combatSummary = await getCombatContext(campaignName);
        const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
        if (!lastAttack) return;

        const attackBonus = computeCleaveAttackBonus(playerStats);

        const target = combatSummary?.creatures?.find(c => c.name === cleaveTargetName);
        const targetAc = target?.ac || 0;

        const d20Roll = Math.floor(Math.random() * 20) + 1;
        const totalRoll = d20Roll + attackBonus;
        const hit = totalRoll >= targetAc;

        // Cleave deals weapon damage without ability modifier to damage
        const cleaveDamageFormula = resolveCleaveDamageFormula(lastAttack);

        let damageResult = null;
        if (hit) {
            damageResult = rollExpression(cleaveDamageFormula);
        }

        if (hit && damageResult) {
            const context = {
                targetName: cleaveTargetName,
                damageType: lastAttack.damageType || 'same_as_weapon',
                attackerName: playerStats.name,
            };
            rollDamage(`${lastAttack.attackName} (Cleave)`, cleaveDamageFormula, damageResult.total, damageResult.rolls, 0, context);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Cleave',
                description: `${playerStats.name} used Cleave on ${lastAttack.attackName} against ${cleaveTargetName}`,
                targetName: cleaveTargetName,
            }).catch((e) => { console.error("[useCharActionsCleave:log-error]", e); });
        } else {
            const context = {
                targetName: cleaveTargetName,
                damageType: lastAttack.damageType || 'same_as_weapon',
                attackerName: playerStats.name,
                isAutoMiss: true,
            };
            rollDamage(`${lastAttack.attackName} (Cleave)`, cleaveDamageFormula || '0', 0, [], 0, context);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Cleave',
                description: `${playerStats.name} used Cleave on ${lastAttack.attackName} against ${cleaveTargetName} — Miss`,
                targetName: cleaveTargetName,
            }).catch((e) => { console.error("[useCharActionsCleave:log-error]", e); });
        }
    }

    async function handleTacticalMasterConfirm(chosenMastery) {
        const oldMastery = getRuntimeValue('campaign', 'tacticalMasterPending', campaignName)?.baseMastery;
        const attackName = getRuntimeValue('campaign', 'tacticalMasterPending', campaignName)?.attackName;
        const targetName = getRuntimeValue('campaign', 'tacticalMasterPending', campaignName)?.targetName;
        setTacticalMasterModal(null);
        if (!chosenMastery) return;
        if (targetName) {
            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Tactical Master',
                description: `${playerStats.name} used Tactical Master on ${attackName} against ${targetName} — changed mastery from ${oldMastery} to ${chosenMastery}`,
                targetName: targetName,
            }).catch((e) => { console.error("[useCharActionsCleave:log-error]", e); });
        }
        const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
        const actualTargetName = lastAttack?.targetName;
        if (!actualTargetName) return;
        if (chosenMastery === 'Topple') {
            const weaponAttack = playerStats.attacks?.find(a => a.name === attackName);
            const abilityName = weaponAttack?.abilityName || 'Strength';
            const ability = playerStats.abilities?.find(a => a.name === abilityName);
            const abilityMod = ability?.bonus || 0;
            const prof = playerStats.proficiency || 0;
            const saveDc = 8 + abilityMod + prof;
            const { promise } = createSaveListener(campaignName, {
                targetName: actualTargetName,
                saveType: 'CON',
                saveDc,
            });
            await addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                targetName: actualTargetName,
                saveType: 'CON',
                saveDc,
                description: `Topple: ${actualTargetName} must make a DC ${saveDc} CON save (weapon ${abilityName}) or fall Prone.`,
                success: null,
            }).catch((e) => { console.error("[useCharActionsCleave:log-error]", e); });
            const result = await promise;
            if (result && !result.success) {
                const storedConditions = getRuntimeValue(actualTargetName, 'activeConditions') || [];
                const conditions = Array.isArray(storedConditions) ? storedConditions : [];
                if (!conditions.includes('prone')) {
                    await setRuntimeValue(actualTargetName, 'activeConditions', [...conditions, 'prone'], campaignName);
                }
                await addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerStats.name,
                    rollType: 'save-topple',
                    targetName: actualTargetName,
                    saveDc,
                    saveType: 'CON',
                    success: false,
                    description: `${actualTargetName} failed CON save vs Topple. Gains Prone condition.`,
                }).catch((e) => { console.error("[useCharActionsCleave:log-error]", e); });
                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerStats.name,
                    abilityName: 'Topple',
                    description: `${playerStats.name} used Topple on ${actualTargetName} — target failed CON save (DC ${saveDc}, weapon ${abilityName}), fell Prone.`,
                    targetName: actualTargetName,
                }).catch((e) => { console.error("[useCharActionsCleave:log-error]", e); });
            }
        } else {
            await applyMasteryEffect(chosenMastery, playerStats, campaignName, actualTargetName);
        }
    }

    function handleTacticalMasterDismiss() {
        setTacticalMasterModal(null);
    }

    return {
        handleCleaveAttack,
        handleTacticalMasterConfirm,
        handleTacticalMasterDismiss,
    };
}
