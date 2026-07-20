import { getCombatSummary } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression, rollExpressionDoubled } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const numAttacks = auto.attacks || 3;

    const cs = getCombatSummary(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot use ${action.name}.`,
                automation: auto,
            },
        };
    }

    const creatureTargets = cs.creatures
        .filter(c => c.name !== playerName)
        .map(c => c.name);

    if (creatureTargets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No valid targets found. Cannot use ${action.name}.`,
                automation: auto,
            },
        };
    }

    const currentTarget = getTargetFromAttacker(cs, playerName);
    const currentTargetName = currentTarget?.name || null;

    const attackBonus = playerStats.attacks?.[0]?.hitBonus ?? 0;
    const damageFormula = playerStats.attacks?.[0]?.damage ?? '1d4+0';
    const damageType = playerStats.attacks?.[0]?.damageType || 'Bludgeoning';

    return {
        type: 'modal',
        modalName: 'flurryOfBlows',
        payload: {
            action,
            playerStats,
            campaignName,
            mapName,
            attackBonus,
            damageFormula,
            damageType,
            creatureTargets,
            numAttacks,
            currentTargetName,
        },
    };
}

export async function applyFlurryOfBlows(action, playerStats, campaignName, mapName, distribution, numAttacks) {
    const playerName = playerStats.name;
    const featureName = action.name;

    if (!distribution) {
        return null;
    }

    const cs = getCombatSummary(campaignName);
    if (!cs) return null;

    const attackBonus = playerStats.attacks?.[0]?.hitBonus ?? 0;
    const damageFormula = playerStats.attacks?.[0]?.damage ?? '1d4+0';
    const damageType = playerStats.attacks?.[0]?.damageType || 'Bludgeoning';

    const targetSnapshots = {};
    for (const creature of cs.creatures) {
        if (creature.name !== playerName) {
            targetSnapshots[creature.name] = {
                ac: creature.ac || 10,
                currentHp: creature.currentHp,
                maxHp: creature.maxHp,
            };
        }
    }

    const attackResults = [];
    let totalDamage = 0;
    const pendingOpenHandTargets = new Map();

    const openHandFeature = playerStats.automation?.actions?.find(a => a.type === 'open_hand_technique');

    for (const [targetName, attackCount] of Object.entries(distribution)) {
        if (!attackCount || attackCount <= 0) continue;

        const snapshot = targetSnapshots[targetName];
        if (!snapshot) continue;

        for (let i = 0; i < attackCount; i++) {
            const d20Roll = rollD20();
            const totalAttack = d20Roll + attackBonus;
            const ac = snapshot.ac;
            const isCrit = d20Roll === 20;
            const isAutoMiss = d20Roll === 1;
            const hit = isAutoMiss ? false : (totalAttack >= ac);

            let damageResult = null;
            let finalDamage = 0;

            if (hit) {
                const rollFn = isCrit ? rollExpressionDoubled : rollExpression;
                const rollResult = rollFn(damageFormula);
                const rawDamage = rollResult?.total || 0;

                const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
                const applyResult = applyDamageToTarget(
                    cs,
                    targetName,
                    rawDamage,
                    [damageType],
                    campaignName,
                    characters,
                    false,
                    playerName
                );

                finalDamage = applyResult?.finalDamage || 0;
                totalDamage += finalDamage;
                damageResult = {
                    rollResult,
                    rawDamage,
                    finalDamage,
                    isCrit,
                };

                if (finalDamage > 0) {
                    endInvisibilityOnHostileAction(playerName, campaignName);
                }

                if (openHandFeature && !pendingOpenHandTargets.has(targetName)) {
                    pendingOpenHandTargets.set(targetName, {
                        targetName,
                        action: openHandFeature,
                        playerStats,
                        campaignName,
                        mapName,
                    });
                }
            }

            attackResults.push({
                targetName,
                attackNumber: i + 1,
                d20Roll,
                totalAttack,
                ac,
                hit,
                isCrit,
                damageResult,
                _damageType: damageType,
            });

            addEntry(campaignName, {
                type: 'roll',
                characterName: playerName,
                rollType: 'attack',
                name: featureName,
                rolls: [d20Roll],
                total: d20Roll,
                bonus: attackBonus,
                isNatural20: d20Roll === 20,
                isNatural1: d20Roll === 1,
                targetName,
                targetAc: ac,
                damageType,
                hit,
                isCrit,
                timestamp: Date.now(),
            }).catch(() => {});

            if (hit && damageResult) {
                const displayFormula = damageFormula;
                addEntry(campaignName, {
                    type: 'roll',
                    characterName: playerName,
                    rollType: 'damage',
                    name: featureName,
                    formula: displayFormula,
                    rolls: damageResult.rollResult?.rolls || [],
                    total: damageResult.rawDamage,
                    modifier: damageResult.rollResult?.modifier || 0,
                    damageType,
                    targetName,
                    finalDamage: damageResult.finalDamage,
                    isCrit: damageResult.isCrit,
                    timestamp: Date.now(),
                }).catch(() => {});

                addEntry(campaignName, {
                    type: 'hp_change',
                    targetName,
                    delta: -(damageResult.finalDamage),
                    currentHp: snapshot.currentHp - damageResult.finalDamage,
                    maxHp: snapshot.maxHp,
                    isHealing: false,
                    sourceName: playerName,
                    note: `${featureName} attack`,
                }).catch(() => {});
            }
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName}, making ${numAttacks} unarmed strikes. Total damage dealt: ${totalDamage}.`,
        timestamp: Date.now(),
    }).catch(() => {});

    const hitCount = attackResults.filter(r => r.hit).length;
    const critCount = attackResults.filter(r => r.isCrit).length;

    let description = `${hitCount}/${numAttacks} hits (${critCount} critical${critCount !== 1 ? 's' : ''}), ${totalDamage} damage<br/><br/>`;

    for (const r of attackResults) {
        const hitText = r.isCrit ? 'CRIT!' : r.hit ? 'Hit' : 'Miss';
        const hitStyle = r.isCrit ? ' style="color: var(--color-crit, #ff4444)"' : r.hit ? ' style="color: var(--color-hit, #44bb44)"' : ' style="color: var(--color-miss, #bb4444)"';
        description += `<div class="attack-result-line"><span${hitStyle}><b>${hitText}</b></span> — ${r.targetName} (AC ${r.ac})<br/>`;
        description += `d20: ${r.d20Roll} + ${r.totalAttack - r.d20Roll} = ${r.totalAttack} | `;
        if (r.hit && r.damageResult) {
            const dr = r.damageResult;
            const diceStr = dr.rollResult?.rolls?.join(' + ') || '0';
            const mod = dr.rollResult?.modifier || 0;
            const part = mod !== 0 ? ` [${diceStr} + ${mod} = ${dr.rawDamage}]` : ` [${diceStr} = ${dr.rawDamage}]`;
            description += `Damage: ${part}${dr.isCrit ? ' (doubled dice)' : ''} → ${dr.finalDamage} ${r._damageType} damage`;
        } else {
            description += 'No damage';
        }
        description += `</div>`;
    }

    const result = {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
        },
    };

    if (pendingOpenHandTargets.size > 0) {
        const openHandTargets = Array.from(pendingOpenHandTargets.values()).map(target => ({
            targetName: target.targetName,
            action: target.action,
            playerStats: target.playerStats,
            campaignName: target.campaignName,
            mapName: target.mapName,
        }));
        result.openHandTargets = openHandTargets;
    }

    return result;
}
