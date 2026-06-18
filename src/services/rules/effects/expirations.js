import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../combat/automation/automationExpressions.js';
import utils from '../../ui/utils.js';
import storage from '../../ui/storage.js';
import { getCurrentCombatRound, getActiveCreatureName, getCombatSummary } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { processSlowRepeatSave } from '../../automation/handlers/spells/slowHandler.js';
import { processTashasLaughterRepeatSave } from '../../automation/handlers/spells/tashasLaughterHandler.js';

const ALL_DAMAGES_EXCEPT_FORCE = [
    'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
    'piercing', 'poison', 'slashing', 'thunder',
    'necrotic', 'psychic', 'radiant'
];

const KEY = 'pendingExpirations';

export function applyTurnStartEffects(activeName, playerStats, campaignName) {
    if (!activeName || !playerStats) return;

    const turnStartEffects = playerStats.turnStartEffects || [];
    for (const effect of turnStartEffects) {
        if (effect.type === 'heroic_inspiration') {
            const currentInspiration = getRuntimeValue(activeName, 'hasInspiration') || false;
            if (!currentInspiration) {
                setRuntimeValue(activeName, 'hasInspiration', true, campaignName);
            }
        }
        if (effect.type === 'condition_removal') {
            const storedConds = getRuntimeValue(activeName, 'activeConditions');
    if (storedConds == null) {
        console.error(`[expirations] activeConditions not tracked for ${activeName}`, { stack: new Error().stack });
    }
    const condsArr = storedConds || [];
            const removalConditions = new Set(effect.conditions.map(c => c.toLowerCase()));
            const filtered = condsArr.filter(c => {
                const condName = String(c).toLowerCase();
                return !removalConditions.has(condName);
            });
            if (filtered.length !== condsArr.length) {
                setRuntimeValue(activeName, 'activeConditions', filtered, campaignName);
            }
        }
        if (effect.type === 'superior_defense') {
            applySuperiorDefenseTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'flurry_healing_harm') {
            applyFlurryHealingHarmTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'holy_nimbus_radiant_damage') {
            applyHolyNimbusRadiantDamage(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'living_legend_turn_start') {
            setRuntimeValue(activeName, 'unerringStrikeUsed', false, campaignName);
        }
        if (effect.type === 'elder_champion_regeneration') {
            applyElderChampionRegeneration(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'radiant_soul_turn_start') {
            const key = `_radiantSoul_${activeName.replace(/\s+/g, '_')}_oncePerTurn`;
            setRuntimeValue(activeName, key, false, campaignName);
        }
        if (effect.type === 'inner_radiance_turn_start') {
            applyInnerRadianceDamage(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'dread_ambush_speed') {
            applyDreadAmbushSpeedTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'umbral_sight') {
            applyUmbralSightTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'steady_aim_clear') {
            applySteadyAimClearTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'supreme_sneak') {
            applySupremeSneakTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'use_magic_device') {
            applyUseMagicDeviceTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'grapple_damage') {
            applyGrappleDamageTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'heroism_temp_hp') {
            applyHeroismTempHp(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'regenerate_turn_start_heal') {
            applyRegenerateTurnStartHeal(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'resistance_clear_turn') {
            setRuntimeValue(activeName, 'resistanceUsedThisTurn', false, campaignName);
        }
    }

    // Check for regenerate buff (not tied to turnStartEffects - it's a spell buff)
    if (activeName && playerStats) {
        const regenerateActive = getRuntimeValue(activeName, 'regenerateActive', campaignName);
        if (regenerateActive) {
            applyRegenerateBuffHeal(activeName, playerStats, campaignName);
        }
    }

    // Clear Resistance once-per-turn flag at start of each creature's turn
    if (activeName) {
        const resistanceUsed = getRuntimeValue(activeName, 'resistanceUsedThisTurn', campaignName);
        if (resistanceUsed) {
            setRuntimeValue(activeName, 'resistanceUsedThisTurn', false, campaignName);
        }
    }

    // Clean up Multiattack Defense effects at start of each creature's turn
    const allTargetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    if (allTargetEffects.length > 0) {
        const cleaned = allTargetEffects.filter(te => te.effect !== 'multiattack_defense');
        if (cleaned.length !== allTargetEffects.length) {
            setRuntimeValue(campaignName, 'targetEffects', cleaned, campaignName);
        }
    }

    // Process Slow repeat saves for affected creatures at start of their turn
    if (activeName && playerStats) {
        const slowTracking = getRuntimeValue(activeName, `_slow_${activeName.replace(/\s+/g, '_')}`, campaignName);
        if (slowTracking) {
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
            const slowEffect = Array.isArray(targetEffects) ? targetEffects.find(
                te => te.target === activeName && te.effect === 'slow_repeat_save'
            ) : null;
            if (slowEffect) {
                processSlowRepeatSave(slowEffect.source, activeName, slowEffect.dc, campaignName).catch(e => {
                    console.error('[expirations] Slow repeat save failed:', e);
                });
            }
        }

        // Process Tasha's Hideous Laughter repeat saves for affected creatures at start of their turn
        const tashasTracking = getRuntimeValue(activeName, `_tashas_laughter_${activeName.replace(/\s+/g, '_')}`, campaignName);
        if (tashasTracking) {
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
            const tashasEffect = Array.isArray(targetEffects) ? targetEffects.find(
                te => te.target === activeName && te.effect === 'tashas_laughter_repeat_save'
            ) : null;
            if (tashasEffect) {
                processTashasLaughterRepeatSave(tashasEffect.source, activeName, tashasEffect.dc, campaignName).catch(e => {
                    console.error('[expirations] Tasha\'s Hideous Laughter repeat save failed:', e);
                });
            }
        }
    }
}

async function applySuperiorDefenseTurnStart(activeName, playerStats, effect, campaignName) {
    const storedConds = getRuntimeValue(activeName, 'activeConditions');
    if (storedConds == null) {
        console.error(`[expirations] activeConditions not tracked for ${activeName}`, { stack: new Error().stack });
    }
    const condsArr = storedConds || [];
    const isIncapacitated = condsArr.some(c => String(c).toLowerCase() === 'incapacitated');
    if (isIncapacitated) {
        return;
    }

    const stored = getRuntimeValue(activeName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    if (activeBuffs.some(b => b.name === 'Superior Defense')) {
        return;
    }

    const cost = effect.cost ?? 3;
    const maxFocus = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
    const currentFocus = Number(getRuntimeValue(activeName, 'focusPoints', campaignName) ?? maxFocus);

    if (currentFocus < cost) {
        return;
    }

    await setRuntimeValue(activeName, 'focusPoints', currentFocus - cost, campaignName);

    const buff = {
        name: 'Superior Defense',
        effect: 'damage_resistance',
        duration: '1_minute',
        resistanceTypes: ALL_DAMAGES_EXCEPT_FORCE,
    };

    const newBuffs = [...activeBuffs, buff];
    setRuntimeValue(activeName, 'activeBuffs', newBuffs, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: activeName,
        abilityName: 'Superior Defense',
        description: `${activeName} activated Superior Defense at start of turn. Resistance to all damage except Force.`,
    }).catch(() => {});
}

async function applyFlurryHealingHarmTurnStart(activeName, playerStats, effect, campaignName) {
    const expressions = {
        'WIS modifier minimum 1': 'Math.max(1, WIS modifier)',
    };
    const expr = expressions[effect.usesExpression] || effect.usesExpression;
    const storedBonus = playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus;
    if (storedBonus == null) {
        console.error(`[expirations] Wisdom ability bonus missing for ${playerStats?.name || 'unknown'}`, { playerStats: JSON.stringify(playerStats), stack: new Error().stack });
    }
    const wisBonus = storedBonus || 0;
    const resolvedExpr = expr.replace(/WIS modifier/gi, wisBonus);

    let uses;
    try {
        uses = new Function(`"use strict"; return (${resolvedExpr})`)();
    } catch {
        uses = 1;
    }
    if (typeof uses !== 'number' || isNaN(uses) || uses < 1) {
        uses = 1;
    }

    await setRuntimeValue(activeName, 'flurryHealingHarmUses', uses, campaignName);
}

async function applyHolyNimbusRadiantDamage(activeName, playerStats, effect, campaignName) {
    const holyNimbusActive = getRuntimeValue(activeName, 'holyNimbusActive', campaignName);
    if (!holyNimbusActive) return;

    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) return;

    const creatures = combatSummary?.creatures;
    if (creatures == null) {
        console.error(`[expirations] combatSummary.creatures is null/undefined`, { combatSummary: JSON.stringify(combatSummary), stack: new Error().stack });
    }
    const creaturesArr = creatures || [];

    const storedDamageExpression = effect.damageExpression;
    if (storedDamageExpression == null) {
        console.error(`[expirations] effect.damageExpression is missing for effect ${effect?.name || 'unknown'}`, { effect: JSON.stringify(effect), stack: new Error().stack });
    }
    const damageExpression = storedDamageExpression || 'CHA modifier + proficiency_bonus';

    const storedProficiency = playerStats.proficiency;
    if (storedProficiency == null) {
        console.error(`[expirations] proficiency is missing for ${playerStats?.name || 'unknown'}`, { playerStats: JSON.stringify(playerStats), stack: new Error().stack });
    }
    const proficiency = storedProficiency || 0;
    const storedChaBonus = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus;
    if (storedChaBonus == null) {
        console.error(`[expirations] Charisma ability bonus missing for ${playerStats?.name || 'unknown'}`, { playerStats: JSON.stringify(playerStats), stack: new Error().stack });
    }
    const chaBonus = storedChaBonus || 0;
    const chaMod = chaBonus;

    let expr = damageExpression
        .replace(/proficiency_bonus/gi, proficiency)
        .replace(/CHA modifier/gi, chaMod);

    let damage;
    try {
        damage = new Function(`"use strict"; return (${expr})`)();
    } catch {
        damage = proficiency + chaMod;
    }

    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0) return;

    for (const creature of creaturesArr) {
        const creatureName = utils.getName(creature.name);
        if (creatureName === utils.getName(activeName)) continue;

        const creatureType = creature.type || '';
        if (creatureType !== 'fiend' && creatureType !== 'undead') continue;

        try {
            const storedCurrentHp = creature.hit_points?.current ?? creature.currentHp;
            if (storedCurrentHp == null) {
                console.error(`[expirations] Creature HP missing for ${creatureName} in turn-start effect`, { creature: JSON.stringify(creature), stack: new Error().stack });
            }
            const maxHp = storedCurrentHp ?? 0;
            const newHp = Math.max(0, maxHp - damage);
            const hitPoints = creature.hit_points;
            if (hitPoints == null) {
                console.error(`[expirations] hit_points missing for creature ${creature?.name}`, { creature: JSON.stringify(creature), stack: new Error().stack });
            }
            const hitPointsObj = hitPoints || {};
            hitPointsObj.current = newHp;
            creature.hit_points = hitPointsObj;
            if (creature.currentHp != null) {
                creature.currentHp = newHp;
            }

            await addEntry(campaignName, {
                type: 'damage',
                characterName: activeName,
                targetName: creatureName,
                damageType: 'radiant',
                damageAmount: damage,
                description: `Holy Nimbus radiant damage: ${damage} radiant to ${creatureName}`,
                timestamp: Date.now(),
            }).catch(() => {});
        } catch { /* ignore per-creature errors */ }
    }

    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

async function applyInnerRadianceDamage(activeName, playerStats, effect, campaignName) {
    const innerRadianceActive = getRuntimeValue(activeName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(innerRadianceActive) ? innerRadianceActive : [];
    if (!activeBuffs.some(b => b.name === 'Inner Radiance')) return;

    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) return;

    const creatures = combatSummary?.creatures;
    if (creatures == null) {
        console.error(`[expirations] combatSummary.creatures is null/undefined`, { combatSummary: JSON.stringify(combatSummary), stack: new Error().stack });
    }
    const creaturesArr = creatures || [];

    const storedDamageExpression = effect.damageExpression;
    if (storedDamageExpression == null) {
        console.error(`[expirations] effect.damageExpression is missing for effect ${effect?.name || 'unknown'}`, { effect: JSON.stringify(effect), stack: new Error().stack });
    }
    const damageExpression = storedDamageExpression || 'proficiency_bonus';

    const storedDamageType = effect.damageType;
    if (storedDamageType == null) {
        console.error(`[expirations] effect.damageType is missing for effect ${effect?.name || 'unknown'}`, { effect: JSON.stringify(effect), stack: new Error().stack });
    }
    const damageType = storedDamageType || 'Radiant';

    const storedRange = effect.range;
    if (storedRange == null) {
        console.error(`[expirations] effect.range is missing`, { effect: JSON.stringify(effect), stack: new Error().stack });
    }
    const range = storedRange || '10_ft';

    const parsedRange = parseInt(range, 10);
    if (isNaN(parsedRange)) {
        console.error(`[expirations] effect.range could not be parsed as number: ${range}`, { effect: JSON.stringify(effect), stack: new Error().stack });
    }
    const rangeNum = parsedRange || 10;

    const storedProficiency = playerStats.proficiency;
    if (storedProficiency == null) {
        console.error(`[expirations] proficiency is missing for ${playerStats?.name || 'unknown'}`, { playerStats: JSON.stringify(playerStats), stack: new Error().stack });
    }
    const proficiency = storedProficiency || 0;

    let expr = damageExpression
        .replace(/proficiency_bonus/gi, proficiency);

    let damage;
    try {
        damage = new Function(`"use strict"; return (${expr})`)();
    } catch {
        damage = proficiency;
    }

    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0) return;

    for (const creature of creaturesArr) {
        const creatureName = utils.getName(creature.name);
        if (creatureName === utils.getName(activeName)) continue;

        if (!creature.position) continue;

        const playerCreature = combatSummary.players?.find(p => p.name === activeName);
        if (!playerCreature?.position) continue;

        const dist = getDistanceFeet(playerCreature.position, creature.position);
        if (dist !== null && dist <= rangeNum) {
            try {
                const storedCurrentHp = creature.hit_points?.current ?? creature.currentHp;
                if (storedCurrentHp == null) {
                    console.error(`[expirations] Creature HP missing for ${creatureName}`, { creature: JSON.stringify(creature), stack: new Error().stack });
                }
                const maxHp = storedCurrentHp ?? 0;
                const newHp = Math.max(0, maxHp - damage);
                const hitPoints = creature.hit_points;
                if (hitPoints == null) {
                    console.error(`[expirations] hit_points missing for creature ${creature?.name}`, { creature: JSON.stringify(creature), stack: new Error().stack });
                }
                const hitPointsObj = hitPoints || {};
                hitPointsObj.current = newHp;
                creature.hit_points = hitPointsObj;
                if (creature.currentHp != null) {
                    creature.currentHp = newHp;
                }

                await addEntry(campaignName, {
                    type: 'damage',
                    characterName: activeName,
                    targetName: creatureName,
                    damageType: damageType.toLowerCase(),
                    damageAmount: damage,
                    description: `Inner Radiance aura: ${damage} ${damageType.toLowerCase()} to ${creatureName}`,
                    timestamp: Date.now(),
                }).catch(() => {});
            } catch { /* ignore per-creature errors */ }
        }
    }

    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

async function applyElderChampionRegeneration(activeName, playerStats, effect, campaignName) {
    const elderChampionActive = getRuntimeValue(activeName, 'elderChampionActive', campaignName);
    if (!elderChampionActive) return;

    const healAmount = effect.healExpression ? evaluateAutoExpression(effect.healExpression, playerStats) : 10;
    if (typeof healAmount !== 'number' || isNaN(healAmount) || healAmount <= 0) return;

    const storedMaxHp = getRuntimeValue(activeName, 'hitPoints', campaignName);
    const storedCurrentHp = getRuntimeValue(activeName, 'currentHitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[expirations] hitPoints not tracked for ${activeName} in Elder Champion Regeneration`, { playerStatsHitPoints: playerStats.hitPoints, stack: new Error().stack });
    }
    if (storedCurrentHp == null && storedMaxHp == null) {
        console.error(`[expirations] Neither hitPoints nor currentHitPoints tracked for ${activeName} in Elder Champion Regeneration`, { stack: new Error().stack });
    }
    const maxHp = storedMaxHp ?? playerStats.hitPoints;
    const currentHp = storedCurrentHp ?? storedMaxHp ?? maxHp;
    const newHp = Math.min(maxHp, currentHp + healAmount);

    await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
}

async function applyDreadAmbushSpeedTurnStart(activeName, playerStats, effect, campaignName) {
    const combatData = getCombatSummary(campaignName);
    if (!combatData) return;
    
    const currentRound = combatData.round || 1;
    if (currentRound !== 1) return;
    
    const isActive = getRuntimeValue(activeName, 'dreadAmbushSpeedActive', campaignName);
    if (isActive) return;
    
    await setRuntimeValue(activeName, 'dreadAmbushSpeedActive', true, campaignName);
    
    const parsedBonus = parseInt(effect.bonusExpression, 10);
    if (isNaN(parsedBonus)) {
        console.error(`[expirations] effect.bonusExpression could not be parsed: ${effect.bonusExpression}`, { effect: JSON.stringify(effect), stack: new Error().stack });
    }
    const bonus = parsedBonus || 10;
    
    const activeBuffs = getRuntimeValue(activeName, 'activeBuffs', campaignName) || [];
    const newBuffs = [...activeBuffs, {
        name: "Dread Ambush",
        effect: 'speed_boost',
        duration: 'until_end_of_turn',
        speedBonus: bonus,
    }];
    await setRuntimeValue(activeName, 'activeBuffs', newBuffs, campaignName);
}

async function applyHeroismTempHp(activeName, playerStats, effect, campaignName) {
    const storedBuffs = getRuntimeValue(activeName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${activeName}`, { stack: new Error().stack });
    }
    const buffsArr = storedBuffs || [];
    const heroismBuff = Array.isArray(buffsArr) ? buffsArr.find(b => b.name === 'Heroism') : null;
    if (!heroismBuff) return;

    const tempHpAmount = Number(heroismBuff.tempHpAmount) || 0;
    if (tempHpAmount <= 0) return;

    const existingTempHp = Number(getRuntimeValue(activeName, 'tempHp') ?? 0);
    const newTempHp = Math.max(existingTempHp, tempHpAmount);
    await setRuntimeValue(activeName, 'tempHp', newTempHp, campaignName);
}

async function applyUmbralSightTurnStart(activeName, playerStats, effect, campaignName) {
    const inDarkness = getRuntimeValue(activeName, 'umbralSightDarknessActive', campaignName);
    const storedConds = getRuntimeValue(activeName, 'activeConditions');
    if (storedConds == null) {
        console.error(`[expirations] activeConditions not tracked for ${activeName}`, { stack: new Error().stack });
    }
    const condsArr = storedConds || [];
    const hasInvisible = condsArr.some(c => String(c).toLowerCase() === 'invisible');

    if (inDarkness && !hasInvisible) {
        const newConditions = [...condsArr, 'invisible'];
        await setRuntimeValue(activeName, 'activeConditions', newConditions, campaignName);
    } else if (!inDarkness && hasInvisible) {
        const filtered = condsArr.filter(c => String(c).toLowerCase() !== 'invisible');
        await setRuntimeValue(activeName, 'activeConditions', filtered, campaignName);
    }
}

async function applySteadyAimClearTurnStart(activeName, playerStats, effect, campaignName) {
    // Clear speed_zero condition and movement flag at start of next turn
    const storedConds = getRuntimeValue(activeName, 'activeConditions');
    if (storedConds == null) {
        console.error(`[expirations] activeConditions not tracked for ${activeName}`, { stack: new Error().stack });
    }
    const condsArr = storedConds || [];
    const filtered = condsArr.filter(c => String(c).toLowerCase() !== 'speed_zero');
    if (filtered.length !== condsArr.length) {
        await setRuntimeValue(activeName, 'activeConditions', filtered, campaignName);
    }
    await setRuntimeValue(activeName, 'steadyAimMovedThisTurn', false, campaignName);
    await setRuntimeValue(activeName, 'steadyAimSpeedZero', false, campaignName);
}

async function applySupremeSneakTurnStart(activeName, playerStats, effect, campaignName) {
    // At the start of a new turn, check if the player had Stealth Attack active
    // and Invisible condition. If so, preserve the Invisible condition (assuming
    // they were behind 3/4 or Total Cover at end of their turn).
    const stealthAttackCost = getRuntimeValue(activeName, 'stealthAttackCost', campaignName);
    if (!stealthAttackCost || stealthAttackCost <= 0) return;

    const storedConds = getRuntimeValue(activeName, 'activeConditions');
    if (storedConds == null) {
        console.error(`[expirations] activeConditions not tracked for ${activeName}`, { stack: new Error().stack });
    }
    const condsArr = storedConds || [];
    const hasInvisible = condsArr.some(c => String(c).toLowerCase() === 'invisible');

    if (hasInvisible) {
        // Preserve Invisible condition — don't remove it
        // Clear the Stealth Attack cost flag
        await setRuntimeValue(activeName, 'stealthAttackCost', 0, campaignName);
    }
}

async function applyUseMagicDeviceTurnStart(_activeName, _playerStats, _effect, _campaignName) {
    // Use Magic Device: No per-turn state to manage.
    // The passive effects (attunement limit, charge reroll, scroll handling)
    // are applied continuously via saveModifiers and passive effects.
    // This turn start handler is a no-op placeholder for future state management.
}

async function applyRegenerateTurnStartHeal(activeName, playerStats, effect, campaignName) {
    const regenerateActive = getRuntimeValue(activeName, 'regenerateActive', campaignName);
    if (!regenerateActive) return;

    const healAmount = effect.healExpression ? evaluateAutoExpression(effect.healExpression, playerStats) : 1;
    if (typeof healAmount !== 'number' || isNaN(healAmount) || healAmount <= 0) return;

    const storedMaxHp = getRuntimeValue(activeName, 'hitPoints', campaignName);
    const storedCurrentHp = getRuntimeValue(activeName, 'currentHitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[expirations] hitPoints not tracked for ${activeName} in Regenerate Turn Start`, { playerStatsHitPoints: playerStats.hitPoints, stack: new Error().stack });
    }
    if (storedCurrentHp == null && storedMaxHp == null) {
        console.error(`[expirations] Neither hitPoints nor currentHitPoints tracked for ${activeName} in Regenerate Turn Start`, { stack: new Error().stack });
    }
    const maxHp = storedMaxHp ?? playerStats.hitPoints;
    const currentHp = storedCurrentHp ?? storedMaxHp ?? maxHp;
    const newHp = Math.min(maxHp, currentHp + healAmount);

    await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
}

async function applyRegenerateBuffHeal(activeName, playerStats, campaignName) {
    const healAmount = 1;
    const storedMaxHp = getRuntimeValue(activeName, 'hitPoints', campaignName);
    const storedCurrentHp = getRuntimeValue(activeName, 'currentHitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[expirations] hitPoints not tracked for ${activeName} in Regenerate Buff Heal`, { playerStatsHitPoints: playerStats.hitPoints, stack: new Error().stack });
    }
    if (storedCurrentHp == null && storedMaxHp == null) {
        console.error(`[expirations] Neither hitPoints nor currentHitPoints tracked for ${activeName} in Regenerate Buff Heal`, { stack: new Error().stack });
    }
    const maxHp = storedMaxHp ?? playerStats.hitPoints;
    const currentHp = storedCurrentHp ?? storedMaxHp ?? maxHp;
    const newHp = Math.min(maxHp, currentHp + healAmount);

    await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
}

async function applyGrappleDamageTurnStart(activeName, playerStats, effect, campaignName) {
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) return;

    const creatures = combatSummary.creatures || [];
    const storedDamageExpression = effect.damageExpression;
    if (storedDamageExpression == null) {
        console.error(`[expirations] effect.damageExpression is missing for effect ${effect?.name || 'unknown'}`, { effect: JSON.stringify(effect), stack: new Error().stack });
    }
    const damageExpression = storedDamageExpression || '1d4';

    const storedDamageType = effect.damageType;
    if (storedDamageType == null) {
        console.error(`[expirations] effect.damageType is missing for effect ${effect?.name || 'unknown'}`, { effect: JSON.stringify(effect), stack: new Error().stack });
    }
    const damageType = storedDamageType || 'Bludgeoning';

    const damage = evaluateAutoExpression(damageExpression, playerStats);

    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0) return;

    for (const creature of creatures) {
        const creatureName = utils.getName(creature.name);
        if (creatureName === utils.getName(activeName)) continue;

        const conditions = creature.conditions;
        if (conditions == null) {
            console.error(`[expirations] conditions missing for creature ${creature?.name}`, { creature: JSON.stringify(creature), stack: new Error().stack });
        }
        const conditionsArr = conditions || [];
        const isGrappled = conditionsArr.some(c => {
            const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
            return cStr.toLowerCase() === 'grappled';
        });
        if (!isGrappled) continue;

        try {
            const storedCurrentHp = creature.hit_points?.current ?? creature.currentHp;
            if (storedCurrentHp == null) {
                console.error(`[expirations] Creature HP missing for ${creatureName}`, { creature: JSON.stringify(creature), stack: new Error().stack });
            }
            const maxHp = storedCurrentHp ?? 0;
            const newHp = Math.max(0, maxHp - damage);
            const hitPoints = creature.hit_points;
            if (hitPoints == null) {
                console.error(`[expirations] hit_points missing for creature ${creature?.name}`, { creature: JSON.stringify(creature), stack: new Error().stack });
            }
            const hitPointsObj = hitPoints || {};
            hitPointsObj.current = newHp;
            creature.hit_points = hitPointsObj;
            if (creature.currentHp != null) {
                creature.currentHp = newHp;
            }

            await addEntry(campaignName, {
                type: 'damage',
                characterName: activeName,
                targetName: creatureName,
                damageType: damageType.toLowerCase(),
                damageAmount: damage,
                description: `Unarmed Fighting grapple damage: ${damage} ${damageType.toLowerCase()} to ${creatureName}`,
                timestamp: Date.now(),
            }).catch(() => {});
        } catch { /* ignore per-creature errors */ }
    }

    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

export function addExpiration(attackerName, targetName, effects, campaignName, rounds) {
    const list = getRuntimeValue(attackerName, KEY) || [];
    const currentRound = getCurrentCombatRound();
    setRuntimeValue(attackerName, KEY, [
         ...list,
         { target: targetName, effects, appliedRound: currentRound, expiryRounds: rounds || 1 }
     ], campaignName);
}

export function clearAllExpirationEffects(characterName, campaignName) {
    if (!characterName || !campaignName) return;

     // Clear all active buffs (Innate Sorcery, Reckless Attack, etc.)
    setRuntimeValue(characterName, 'activeBuffs', [], campaignName);
    setRuntimeValue(characterName, 'mantleOfMajestyActive', null, campaignName);

    const charLower = characterName.toLowerCase();

     // --- "From me": clear all effects I have on other targets ---
    const storedExpirations = getRuntimeValue(characterName, KEY);
    if (storedExpirations == null) {
        console.error(`[expirations] pendingExpirations not tracked for ${characterName}`, { stack: new Error().stack });
    }
    const myList = storedExpirations || [];
    for (const entry of myList) {
        clearExpirationEffects(entry.effects, entry.target, characterName, campaignName);
      }
    setRuntimeValue(characterName, KEY, [], campaignName);

     // --- Scan all runtime stores for "to me" entries ---
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
        if (!key || key === 'combatSummary' || key === 'activeCreatureName') continue;
        if (key.toLowerCase() === charLower) continue;

        const storedExpirations = getRuntimeValue(key, KEY);
        if (storedExpirations == null) {
            console.error(`[expirations] pendingExpirations not tracked for ${key}`, { stack: new Error().stack });
        }
        const list = storedExpirations || [];
        if (!list.length) continue;

        let kept = [];
      for (const entry of list) {
            const targetLower = utils.getName(entry.target).toLowerCase();

           // Clear if the effect targets me
            if (targetLower === charLower) {
                clearExpirationEffects(entry.effects, entry.target, key, campaignName);
                 continue;
              }

           kept.push(entry);
          }

        setRuntimeValue(key, KEY, kept, campaignName);
      }
}

export function expireStaleEffects(campaignName) {
    const currentRound = getCurrentCombatRound();
    const activeName = getActiveCreatureName();
    if (!activeName) return;

    try {
        const storedCombatData = getCombatSummary(campaignName);
        if (storedCombatData == null) {
            console.error(`[expirations] combatData is null for campaign ${campaignName}`, { stack: new Error().stack });
        }
        const combatData = storedCombatData || {};
        const creatures = combatData.creatures || [];

        for (const attacker of creatures) {
            if (utils.getName(attacker.name) !== utils.getName(activeName)) continue;

            const list = getRuntimeValue(attacker.name, KEY) || [];
            if (!list.length) continue;

            let newEntries = [];
            for (const item of list) {
                const rounds = item.expiryRounds || 1;
                if (currentRound >= item.appliedRound + rounds) {
                    clearExpirationEffects(item.effects, item.target, attacker.name, campaignName);
                    } else {
                      newEntries.push(item);
                     }
                 }

           setRuntimeValue(attacker.name, KEY, newEntries, campaignName);
            }
          } catch (_e) { /* ignore */ }
}

function clearExpirationEffects(effects, targetName, attackerName, campaignName) {
    if (!effects || !Array.isArray(effects)) return;

    for (const effect of effects) {
        switch (effect.type) {
             case 'stunned':
                 if (effect.condition === 'speed_halved') {
                     setRuntimeValue(targetName, `stunned_speedHalved`, null, campaignName);
                      } else if (effect.condition === 'stunned') {
                       removeActiveCondition(targetName, 'stunned', campaignName);
                         }
               break;

            case 'advantage_on_target': {
                const advKey = `_advantageOn_${targetName}`;
                const storedAdv = getRuntimeValue(attackerName, advKey) || [];
                 if (Array.isArray(storedAdv) && storedAdv.includes(targetName)) {
                     setRuntimeValue(
                         attackerName,
                         advKey,
                          storedAdv.filter(tn => tn !== targetName),
                          campaignName
                        );
                    }
               break;
                }

            case 'fly_speed_equals_walk_speed': {
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr = storedBuffs || [];
                const storedConds = getRuntimeValue(targetName, 'activeConditions');
    if (storedConds == null) {
        console.error(`[expirations] activeConditions not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const condsArr = storedConds || [];
                const conditionSet = new Set(Array.isArray(condsArr) ? condsArr : []);
                if (conditionSet.has('incapacitated')) {
                    addEntry(campaignName, {
                        type: 'ability_use',
                        characterName: targetName,
                        abilityName: 'Draconic Flight',
                        description: `${targetName}'s spectral wings dissolve due to the Incapacitated condition.`,
                        timestamp: Date.now(),
                    }).catch(() => {});
                }
                if (Array.isArray(buffsArr)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr.filter(b => b.effect !== 'fly_speed_equals_walk_speed'),
                        campaignName
                    );
                }
                break;
            }

            case 'fly_speed_20_hover': {
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr2 = storedBuffs || [];
                if (Array.isArray(buffsArr2)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr2.filter(b => b.effect !== 'fly_speed_20_hover'),
                        campaignName
                    );
                }
                break;
            }

            case 'dragon_wings': {
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr3 = storedBuffs || [];
                if (Array.isArray(buffsArr3)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr3.filter(b => b.effect !== 'dragon_wings'),
                        campaignName
                    );
                }
                break;
            }

            case 'ice_walk': {
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr4 = storedBuffs || [];
                if (Array.isArray(buffsArr4)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr4.filter(b => b.effect !== 'ice_walk'),
                        campaignName
                    );
                }
                break;
            }

            case 'speed_boost': {
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr5 = storedBuffs || [];
                if (Array.isArray(buffsArr5)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr5.filter(b => b.effect !== 'speed_boost'),
                        campaignName
                    );
                }
                break;
            }

            case 'remove_active_buff': {
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr6 = storedBuffs || [];
                const wasHaste = Array.isArray(buffsArr6) && buffsArr6.some(b => b.name === effect.buffName && b.effect === 'haste');
                if (Array.isArray(buffsArr6)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr6.filter(b => b.name !== effect.buffName),
                        campaignName
                    );
                }
                if (wasHaste) {
                    const storedConds = getRuntimeValue(targetName, 'activeConditions');
    if (storedConds == null) {
        console.error(`[expirations] activeConditions not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const condsArr2 = storedConds || [];
                    const conditions2 = Array.isArray(condsArr2) ? condsArr2 : [];
                    const hasSpeedZero = conditions2.some(c => String(c).toLowerCase() === 'speed_zero');
                    const hasIncapacitated = conditions2.some(c => String(c).toLowerCase() === 'incapacitated');
                    const newConditions = [
                        ...conditions2.filter(c => String(c).toLowerCase() !== 'speed_zero'),
                        'speed_zero',
                        ...(!hasIncapacitated ? ['incapacitated'] : []),
                    ];
                    if (newConditions.length !== conditions2.length || !hasSpeedZero) {
                        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
                    }
                    const lethargyKey = `_hasteLethargy_${targetName.replace(/\s+/g, '_')}`;
                    addExpiration(attackerName, targetName, [
                        { type: 'speed_zero' },
                        { type: 'condition', condition: 'incapacitated' }
                    ], campaignName, 2);
                    setRuntimeValue(targetName, lethargyKey, Date.now(), campaignName);
                }
                break;
            }

            case 'peerless_athlete_end': {
                setRuntimeValue(targetName, 'peerlessAthleteActive', false, campaignName);
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr7 = storedBuffs || [];
                if (Array.isArray(buffsArr7)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr7.filter(b => b.effect !== 'peerless_athlete'),
                        campaignName
                    );
                }
                break;
            }

            case 'large_form_end': {
                setRuntimeValue(targetName, 'largeFormActive', false, campaignName);
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr8 = storedBuffs || [];
                if (Array.isArray(buffsArr8)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr8.filter(b => b.effect !== 'large_form'),
                        campaignName
                    );
                }
                break;
            }

            case 'remove_bardic_inspiration': {
                setRuntimeValue(targetName, 'bardicInspirationDie', null, campaignName);
                setRuntimeValue(targetName, 'bardicInspirationGrantedBy', null, campaignName);
                setRuntimeValue(targetName, 'bardicInspirationCombatOptions', null, campaignName);
                break;
            }

            case 'inspiring_movement_no_oa':
                setRuntimeValue(targetName, 'inspiringMovementNoOA', null, campaignName);
                break;

            case 'inspiring_movement_granted':
                setRuntimeValue(targetName, 'inspiringMovementGranted', null, campaignName);
                break;

            case 'remove_natures_sanctuary':
                setRuntimeValue(targetName, 'naturesSanctuaryActive', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryMoves', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryCubeX', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryCubeY', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryRange', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryResistance', null, campaignName);
                break;

            case 'remove_bulwark_of_force':
                setRuntimeValue(targetName, 'bulwarkOfForceActive', null, campaignName);
                setRuntimeValue(targetName, 'bulwarkOfForceTargets', null, campaignName);
                break;

            case 'unbreakable_majesty':
                setRuntimeValue(targetName, 'unbreakableMajestyActive', null, campaignName);
                setRuntimeValue(targetName, 'unbreakableMajestySaveDc', null, campaignName);
                break;

            case 'remove_cosmic_omen':
                setRuntimeValue(targetName, 'cosmicOmenEffect', null, campaignName);
                break;

            case 'condition':
                removeActiveCondition(targetName, effect.condition, campaignName);
                removeNpcCondition(targetName, effect.condition, campaignName);
                break;

            case 'tashas_laughter_expiration':
                setRuntimeValue(targetName, `tashas_laughter_${targetName.replace(/\s+/g, '_')}_damageTrigger`, false, campaignName);
                break;

            case 'speed_zero': {
                removeActiveCondition(targetName, 'speed_zero', campaignName);
                removeNpcCondition(targetName, 'speed_zero', campaignName);
                break;
            }

            case 'remove_feign_death_buff': {
                // Custom cleanup for Feign Death: remove the buff and all associated conditions
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr9 = storedBuffs || [];
                if (Array.isArray(buffsArr9)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr9.filter(b => b.name !== effect.buffName),
                        campaignName
                    );
                }
                // Remove conditions applied by Feign Death
                for (const cond of ['blinded', 'incapacitated', 'speed_zero']) {
                    removeActiveCondition(targetName, cond, campaignName);
                    removeNpcCondition(targetName, cond, campaignName);
                }
                break;
            }

            case 'avenging_angel_aura': {
                const auraTargets = getRuntimeValue(attackerName, 'avengingAngelAuraTargets', campaignName) || [];
                setRuntimeValue(
                    attackerName,
                    'avengingAngelAuraTargets',
                    auraTargets.filter(t => t !== targetName),
                    campaignName
                );
                break;
            }

            case 'remove_heroes_feast_buff': {
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr10 = storedBuffs || [];
                if (Array.isArray(buffsArr10)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr10.filter(b => b.name !== effect.buffName),
                        campaignName
                    );
                }
                const currentIncrease = Number(getRuntimeValue(targetName, effect.hpKey || 'heroesFeastHpMaxIncrease', campaignName)) || 0;
                if (currentIncrease > 0) {
                    let baseHp = getRuntimeValue(targetName, 'hitPoints', campaignName);
                    if (typeof baseHp === 'number' && baseHp > 0) {
                        baseHp = Math.max(0, baseHp - currentIncrease);
                        setRuntimeValue(targetName, 'hitPoints', baseHp, campaignName);
                    }
                    const storedCurrentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
                    if (storedCurrentHp != null) {
                        const currentHp = Number(storedCurrentHp);
                        const newCurrentHp = Math.max(0, Math.min(baseHp, currentHp - currentIncrease));
                        setRuntimeValue(targetName, 'currentHitPoints', newCurrentHp, campaignName);
                    }
                    setRuntimeValue(targetName, effect.hpKey || 'heroesFeastHpMaxIncrease', 0, campaignName);
                }
                break;
            }

            case 'remove_aid_buff': {
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr11 = storedBuffs || [];
                if (Array.isArray(buffsArr11)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr11.filter(b => b.name !== effect.buffName),
                        campaignName
                    );
                }
                const currentIncrease = Number(getRuntimeValue(targetName, effect.hpKey || 'aidHpMaxIncrease', campaignName)) || 0;
                if (currentIncrease > 0) {
                    const storedCurrentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
                    const baseHp = getRuntimeValue(targetName, 'hitPoints', campaignName);
                    if (storedCurrentHp != null) {
                        const currentHp = Number(storedCurrentHp);
                        const newCurrentHp = Math.max(0, Math.min(baseHp, currentHp - currentIncrease));
                        setRuntimeValue(targetName, 'currentHitPoints', newCurrentHp, campaignName);
                    }
                    setRuntimeValue(targetName, effect.hpKey || 'aidHpMaxIncrease', 0, campaignName);
                }
                break;
            }

            case 'remove_heroism_buff': {
                const storedBuffs = getRuntimeValue(targetName, 'activeBuffs');
    if (storedBuffs == null) {
        console.error(`[expirations] activeBuffs not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const buffsArr12 = storedBuffs || [];
                if (Array.isArray(buffsArr12)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffsArr12.filter(b => b.name !== effect.buffName),
                        campaignName
                    );
                }
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                if (Array.isArray(storedEffects)) {
                    setRuntimeValue(
                        campaignName,
                        'targetEffects',
                        storedEffects.filter(te => !(te.effect === 'heroism' && te.source === effect.buffName)),
                        campaignName
                    );
                }
                break;
            }

            case 'remove_regenerate_buff': {
                setRuntimeValue(targetName, 'regenerateActive', null, campaignName);
                setRuntimeValue(targetName, 'regenerateSource', null, campaignName);
                setRuntimeValue(targetName, 'regenerateBodyPartRegrowTime', null, campaignName);
                setRuntimeValue(targetName, 'regenerateBodyPartsTracked', null, campaignName);
                break;
            }

            default:
                break;
             }
          }
}

function removeNpcCondition(targetName, conditionName, campaignName) {
    try {
        const storedCombatData = getCombatSummary(campaignName);
        if (storedCombatData == null) {
            console.error(`[expirations] combatData is null for campaign ${campaignName}`, { stack: new Error().stack });
        }
        const combatData = storedCombatData || {};
        const creatures = combatData.creatures || [];
        const creature = creatures.find(c => utils.getName(c.name) === utils.getName(targetName));
        if (creature && creature.conditions) {
            creature.conditions = creature.conditions.filter(c => c.key !== conditionName);
            storage.set('combatSummary', combatData, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }
    } catch (_e) { /* ignore */ }
}

function removeActiveCondition(targetName, conditionName, campaignName) {
    const storedConds = getRuntimeValue(targetName, 'activeConditions');
    if (storedConds == null) {
        console.error(`[expirations] activeConditions not tracked for ${targetName}`, { stack: new Error().stack });
    }
    const condsArr = storedConds || [];
    if (!Array.isArray(condsArr)) return;
    const filtered = condsArr.filter(c => utils.getName(c) !== utils.getName(conditionName));
    setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
}
