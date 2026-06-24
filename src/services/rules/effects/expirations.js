import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
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

function ensureArray(value, name) {
    if (!Array.isArray(value)) {
        console.error(`[expirations] Expected array for ${name}, got ${value === null ? 'null' : typeof value}`);
        throw new Error(`Expected array for ${name}, got ${value === null ? 'null' : typeof value}`);
    }
    return value;
}

export function applyTurnStartEffects(activeName, playerStats, campaignName) {
    if (!activeName || !playerStats) return;

    // Clear Bait and Switch (Evasive Footwork) AC bonus at start of character's next turn
    const wasActive = getRuntimeValue(activeName, 'baitAndSwitchActive');
    if (wasActive) {
        setRuntimeValue(activeName, 'baitAndSwitchActive', null, campaignName);
        setRuntimeValue(activeName, 'baitAndSwitchBonus', null, campaignName);
        setRuntimeValue(activeName, 'baitAndSwitchSource', null, campaignName);
    }

    const turnStartEffects = ensureArray(playerStats.turnStartEffects, 'turnStartEffects');
    for (const effect of turnStartEffects) {
        if (effect.type === 'heroic_inspiration') {
            const currentInspiration = getRuntimeValue(activeName, 'hasInspiration') || false;
            if (!currentInspiration) {
                setRuntimeValue(activeName, 'hasInspiration', true, campaignName);
            }
        }
        if (effect.type === 'condition_removal') {
            const conditions = ensureArray(getRuntimeValue(activeName, 'activeConditions'), 'activeConditions');
            const removalConditions = new Set(effect.conditions.map(c => c.toLowerCase()));
            const filtered = conditions.filter(c => {
                const condName = String(c).toLowerCase();
                return !removalConditions.has(condName);
            });
            if (filtered.length !== conditions.length) {
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
        if (effect.type === 'bait_and_switch_clear') {
            setRuntimeValue(activeName, 'baitAndSwitchActive', null, campaignName);
            setRuntimeValue(activeName, 'baitAndSwitchBonus', null, campaignName);
            setRuntimeValue(activeName, 'baitAndSwitchSource', null, campaignName);
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

    // Clear Portent once-per-turn flag at start of each creature's turn
    if (activeName) {
        const portentUsed = getRuntimeValue(activeName, 'portentUsedThisTurn', campaignName);
        if (portentUsed) {
            setRuntimeValue(activeName, 'portentUsedThisTurn', false, campaignName);
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

    // Clean up Sap weapon mastery disadvantage at start of attacker's next turn
    const allTargetEffectsSap = getRuntimeValue(campaignName, 'targetEffects') || [];
    if (allTargetEffectsSap.length > 0) {
        const currentRound = getCurrentCombatRound(campaignName);
        const cleanedSap = allTargetEffectsSap.filter(te => {
            if (te.effect !== 'disadvantage_next_attack') return true;
            if (!te.target) return true;
            const isSapOnAttacker = te.target === activeName;
            if (!isSapOnAttacker) return true;
            const sapAppliedRound = te.appliedRound;
            if (sapAppliedRound != null && currentRound >= sapAppliedRound + 1) {
                return false;
            }
            return true;
        });
        if (cleanedSap.length !== allTargetEffectsSap.length) {
            setRuntimeValue(campaignName, 'targetEffects', cleanedSap, campaignName);
        }
    }

    // Clean up Slow weapon mastery speed reduction at start of each creature's turn
    const allTargetEffectsSlow = getRuntimeValue(campaignName, 'targetEffects') || [];
    if (allTargetEffectsSlow.length > 0) {
        const cleanedSlow = allTargetEffectsSlow.filter(te => te.effect !== 'speed_reduction' || te.source !== 'Slow');
        if (cleanedSlow.length !== allTargetEffectsSlow.length) {
            setRuntimeValue(campaignName, 'targetEffects', cleanedSlow, campaignName);
        }
    }

    // Clean up Vex weapon mastery advantage at start of each creature's turn (expires at end of attacker's next turn)
    const allTargetEffectsVex = getRuntimeValue(campaignName, 'targetEffects') || [];
    if (allTargetEffectsVex.length > 0) {
        const currentRound = getCurrentCombatRound(campaignName);
        const cleanedVex = allTargetEffectsVex.filter(te => {
            if (te.effect !== 'next_attack_advantage') return true;
            if (!te.vexTarget) return true;
            const isVexOnAttacker = te.target === activeName;
            if (!isVexOnAttacker) return true;
            const vexAppliedRound = te.appliedRound;
            if (vexAppliedRound != null && currentRound >= vexAppliedRound + 2) {
                return false;
            }
            return true;
        });
        if (cleanedVex.length !== allTargetEffectsVex.length) {
            setRuntimeValue(campaignName, 'targetEffects', cleanedVex, campaignName);
        }
    }

    // Clean up Topple weapon mastery Prone condition at start of target's next turn
    const allTargetEffectsTopple = getRuntimeValue(campaignName, 'targetEffects') || [];
    if (allTargetEffectsTopple.length > 0) {
        const currentRound = getCurrentCombatRound(campaignName);
        const toppleTargets = new Set();
        for (const te of allTargetEffectsTopple) {
            if (te.effect !== 'topple') continue;
            if (!te.target) continue;
            if (te.appliedRound == null) continue;
            if (currentRound >= te.appliedRound + 1) {
                toppleTargets.add(te.target);
            }
        }
        if (toppleTargets.size > 0) {
            for (const toppleTarget of toppleTargets) {
                const storedConditions = getRuntimeValue(toppleTarget, 'activeConditions') || [];
                const conditions = Array.isArray(storedConditions) ? storedConditions : [];
                const filtered = conditions.filter(c => String(c).toLowerCase() !== 'prone');
                if (filtered.length !== conditions.length) {
                    setRuntimeValue(toppleTarget, 'activeConditions', filtered, campaignName);
                }
            }
            const cleanedTopple = allTargetEffectsTopple.filter(te => {
                if (te.effect !== 'topple') return true;
                if (!te.appliedRound) return true;
                if (toppleTargets.has(te.target) && currentRound >= te.appliedRound + 1) {
                    return false;
                }
                return true;
            });
            if (cleanedTopple.length !== allTargetEffectsTopple.length) {
                setRuntimeValue(campaignName, 'targetEffects', cleanedTopple, campaignName);
            }
        }
    }

    // Process Slow repeat saves for affected creatures at start of their turn
    if (activeName && playerStats) {
        const slowTracking = getRuntimeValue(activeName, `_slow_${activeName.replace(/\s+/g, '_')}`, campaignName);
        if (slowTracking) {
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName);
            if (!Array.isArray(targetEffects)) {
                console.error('expirations: expected targetEffects to be an array in slow handler for', campaignName);
                throw new Error('Missing array: targetEffects in slow handler for ' + campaignName);
            }
            const slowEffect = targetEffects.find(
                te => te.target === activeName && te.effect === 'slow_repeat_save'
            );
            if (slowEffect) {
                processSlowRepeatSave(slowEffect.source, activeName, slowEffect.dc, campaignName).catch(e => {
                    console.error('[expirations] Slow repeat save failed:', e);
                });
            }
        }

        // Process Tasha's Hideous Laughter repeat saves for affected creatures at start of their turn
        const tashasTracking = getRuntimeValue(activeName, `_tashas_laughter_${activeName.replace(/\s+/g, '_')}`, campaignName);
        if (tashasTracking) {
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName);
            if (!Array.isArray(targetEffects)) {
                console.error('expirations: expected targetEffects to be an array in tashas handler for', campaignName);
                throw new Error('Missing array: targetEffects in tashas handler for ' + campaignName);
            }
            const tashasEffect = targetEffects.find(
                te => te.target === activeName && te.effect === 'tashas_laughter_repeat_save'
            );
            if (tashasEffect) {
                processTashasLaughterRepeatSave(tashasEffect.source, activeName, tashasEffect.dc, campaignName).catch(e => {
                    console.error('[expirations] Tasha\'s Hideous Laughter repeat save failed:', e);
                });
            }
        }
    }
}

async function applySuperiorDefenseTurnStart(activeName, playerStats, effect, campaignName) {
    const conditions = Array.isArray(getRuntimeValue(activeName, 'activeConditions')) ? getRuntimeValue(activeName, 'activeConditions') : [];
    const isIncapacitated = conditions.some(c => String(c).toLowerCase() === 'incapacitated');
    if (isIncapacitated) {
        return;
    }

    const stored = getRuntimeValue(activeName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    if (activeBuffs.some(b => b.name === 'Superior Defense')) {
        return;
    }

    if (effect.cost == null) {
        console.error('[expirations] applySuperiorDefenseTurnStart: effect.cost is missing')
        throw new Error('effect.cost is required for Superior Defense')
      }
      const cost = effect.cost
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
    const resolvedExpr = expr.replace(/WIS modifier/gi, playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0);

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

    const creatures = combatSummary.creatures;
    if (!Array.isArray(creatures)) {
        console.error('expirations: expected creatures to be an array in combatSummary');
        throw new Error('Missing array: creatures in combatSummary');
    }
    const damageExpression = effect.damageExpression || 'CHA modifier + proficiency_bonus';

    const prof = playerStats.proficiency || 0;
    const chaMod = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;

    let expr = damageExpression
        .replace(/proficiency_bonus/gi, prof)
        .replace(/CHA modifier/gi, chaMod);

    let damage;
    try {
        damage = new Function(`"use strict"; return (${expr})`)();
    } catch {
        damage = prof + chaMod;
    }

    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0) return;

    for (const creature of creatures) {
        const creatureName = utils.getName(creature.name);
        if (creatureName === utils.getName(activeName)) continue;

        const creatureType = creature.type || '';
        if (creatureType !== 'fiend' && creatureType !== 'undead') continue;

        try {
            const creatureCurrentHp = creature.hit_points?.current ?? creature.currentHp;
            if (creatureCurrentHp == null) {
                console.error(`[expirations] Holy Nimbus: hit_points.current not found for creature ${creature.name}`);
                throw new Error(`Holy Nimbus: hit_points.current not found for creature ${creature.name}`);
            }
            const currentHp = creatureCurrentHp;
            const newHp = Math.max(0, currentHp - damage);
            if (creature.hit_points == null || typeof creature.hit_points !== 'object') {
                console.error('expirations: expected hit_points to be an object, got', typeof creature.hit_points, 'for', creature.name);
                throw new Error('Missing object: hit_points for ' + creature.name);
            }
            creature.hit_points.current = newHp;
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
            }).catch((e) => { console.error("[expirations] Error:", e); throw e; });
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

    const creatures = combatSummary.creatures;
    if (!Array.isArray(creatures)) {
        console.error('expirations: expected creatures to be an array in combatSummary');
        throw new Error('Missing array: creatures in combatSummary');
    }
    const damageExpression = effect.damageExpression || 'proficiency_bonus';
    const damageType = effect.damageType || 'Radiant';
    const range = effect.range || '10_ft';
    const rangeNum = (() => {
        const parsed = parseInt(range, 10);
        if (Number.isNaN(parsed)) {
          console.error('[expirations] applyInnerRadianceDamage: effect.range is not a valid number:', range)
          throw new Error('effect.range must be a valid number for Inner Radiance')
        }
        return parsed
      })()

    const prof = playerStats.proficiency || 0;

    let expr = damageExpression
        .replace(/proficiency_bonus/gi, prof);

    let damage;
    try {
        damage = new Function(`"use strict"; return (${expr})`)();
    } catch {
        damage = prof;
    }

    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0) return;

    for (const creature of creatures) {
        const creatureName = utils.getName(creature.name);
        if (creatureName === utils.getName(activeName)) continue;

        if (!creature.position) continue;

        const playerCreature = combatSummary.players?.find(p => p.name === activeName);
        if (!playerCreature?.position) continue;

        const dist = getDistanceFeet(playerCreature.position, creature.position);
        if (dist !== null && dist <= rangeNum) {
            try {
                const creatureCurrentHp = creature.hit_points?.current ?? creature.currentHp;
                if (creatureCurrentHp == null) {
                    console.error(`[expirations] Inner Radiance: hit_points.current not found for creature ${creature.name}`);
                    throw new Error(`Inner Radiance: hit_points.current not found for creature ${creature.name}`);
                }
                const currentHp = creatureCurrentHp;
                const newHp = Math.max(0, currentHp - damage);
            if (creature.hit_points == null || typeof creature.hit_points !== 'object') {
                console.error('expirations: expected hit_points to be an object, got', typeof creature.hit_points, 'for', creature.name);
                throw new Error('Missing object: hit_points for ' + creature.name);
            }
            creature.hit_points.current = newHp;
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
                }).catch((e) => { console.error("[expirations] Error:", e); throw e; });
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
        console.error(`[expirations] Elder Champion: hitPoints not found for ${activeName} in ${campaignName}`);
        throw new Error(`Elder Champion: hitPoints not found for ${activeName}`);
    }
    const maxHp = storedMaxHp;
    const currentHp = storedCurrentHp ?? storedMaxHp;
    const newHp = Math.min(maxHp, currentHp + healAmount);

    await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
}

async function applyDreadAmbushSpeedTurnStart(activeName, playerStats, effect, campaignName) {
    const combatData = getCombatSummary(campaignName);
    if (!combatData) return;
    
    if (combatData.round == null) {
        console.error('[expirations] applyDreadAmbushSpeedTurnStart: combatData.round is missing')
        throw new Error('combatData.round is required for Dread Ambush')
      }
      const currentRound = combatData.round
    if (currentRound !== 1) return;
    
    const isActive = getRuntimeValue(activeName, 'dreadAmbushSpeedActive', campaignName);
    if (isActive) return;
    
    await setRuntimeValue(activeName, 'dreadAmbushSpeedActive', true, campaignName);
    
    const bonus = (() => {
        const parsed = parseInt(effect.bonusExpression, 10);
        if (Number.isNaN(parsed)) {
          console.error('[expirations] applyDreadAmbushSpeedTurnStart: effect.bonusExpression is not a valid number:', effect.bonusExpression)
          throw new Error('effect.bonusExpression must be a valid number for Dread Ambush')
        }
        return parsed
      })()
    
    const activeBuffs = Array.isArray(getRuntimeValue(activeName, 'activeBuffs', campaignName)) ? getRuntimeValue(activeName, 'activeBuffs', campaignName) : [];
    const newBuffs = [...activeBuffs, {
        name: "Dread Ambush",
        effect: 'speed_boost',
        duration: 'until_end_of_turn',
        speedBonus: bonus,
    }];
    await setRuntimeValue(activeName, 'activeBuffs', newBuffs, campaignName);
}

async function applyHeroismTempHp(activeName, playerStats, effect, campaignName) {
    const activeBuffs = Array.isArray(getRuntimeValue(activeName, 'activeBuffs')) ? getRuntimeValue(activeName, 'activeBuffs') : [];
    const heroismBuff = activeBuffs.find(b => b.name === 'Heroism');
    if (!heroismBuff) return;

    const tempHpAmount = Number(heroismBuff.tempHpAmount) || 0;
    if (tempHpAmount <= 0) return;

    const existingTempHp = Number(getRuntimeValue(activeName, 'tempHp') || 0);
    const newTempHp = Math.max(existingTempHp, tempHpAmount);
    await setRuntimeValue(activeName, 'tempHp', newTempHp, campaignName);
}

async function applyUmbralSightTurnStart(activeName, playerStats, effect, campaignName) {
    const inDarkness = getRuntimeValue(activeName, 'umbralSightDarknessActive', campaignName);
    const storedConditions = Array.isArray(getRuntimeValue(activeName, 'activeConditions')) ? getRuntimeValue(activeName, 'activeConditions') : [];
    const hasInvisible = storedConditions.some(c => String(c).toLowerCase() === 'invisible');

    if (inDarkness && !hasInvisible) {
        const newConditions = [...storedConditions, 'invisible'];
        await setRuntimeValue(activeName, 'activeConditions', newConditions, campaignName);
    } else if (!inDarkness && hasInvisible) {
        const filtered = storedConditions.filter(c => String(c).toLowerCase() !== 'invisible');
        await setRuntimeValue(activeName, 'activeConditions', filtered, campaignName);
    }
}

async function applySteadyAimClearTurnStart(activeName, playerStats, effect, campaignName) {
    // Clear speed_zero condition and movement flag at start of next turn
    const storedConds = getRuntimeValue(activeName, 'activeConditions');
    const conditions = Array.isArray(storedConds) ? storedConds : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'speed_zero');
    if (filtered.length !== conditions.length) {
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

    const storedConditions = Array.isArray(getRuntimeValue(activeName, 'activeConditions')) ? getRuntimeValue(activeName, 'activeConditions') : [];
    const hasInvisible = storedConditions.some(c => String(c).toLowerCase() === 'invisible');

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
        console.error(`[expirations] Regenerate: hitPoints not found for ${activeName} in ${campaignName}`);
        throw new Error(`Regenerate: hitPoints not found for ${activeName}`);
    }
    const maxHp = storedMaxHp;
    const currentHp = storedCurrentHp ?? storedMaxHp;
    const newHp = Math.min(maxHp, currentHp + healAmount);

    await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
}

async function applyRegenerateBuffHeal(activeName, playerStats, campaignName) {
    const healAmount = 1;
    const storedMaxHp = getRuntimeValue(activeName, 'hitPoints', campaignName);
    const storedCurrentHp = getRuntimeValue(activeName, 'currentHitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[expirations] Regenerate: hitPoints not found for ${activeName} in ${campaignName}`);
        throw new Error(`Regenerate: hitPoints not found for ${activeName}`);
    }
    const maxHp = storedMaxHp;
    const currentHp = storedCurrentHp ?? storedMaxHp;
    const newHp = Math.min(maxHp, currentHp + healAmount);

    await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
}

async function applyGrappleDamageTurnStart(activeName, playerStats, effect, campaignName) {
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) return;

    const creatures = combatSummary.creatures;
    if (!Array.isArray(creatures)) {
        console.error('expirations: expected creatures to be an array in combatSummary');
        throw new Error('Missing array: creatures in combatSummary');
    }
    const damageExpression = effect.damageExpression || '1d4';
    const damageType = effect.damageType || 'Bludgeoning';

    const damage = evaluateAutoExpression(damageExpression, playerStats);

    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0) return;

    for (const creature of creatures) {
        const creatureName = utils.getName(creature.name);
        if (creatureName === utils.getName(activeName)) continue;

        const conditions = creature.conditions;
        if (!Array.isArray(conditions)) {
            console.error('expirations: expected conditions to be an array for creature', creature.name);
            throw new Error('Missing array: conditions for creature ' + creature.name);
        }
        const isGrappled = conditions.some(c => {
            const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
            return cStr.toLowerCase() === 'grappled';
        });
        if (!isGrappled) continue;

        try {
            const creatureCurrentHp = creature.hit_points?.current ?? creature.currentHp;
            if (creatureCurrentHp == null) {
                console.error(`[expirations] Grapple: hit_points.current not found for creature ${creature.name}`);
                throw new Error(`Grapple: hit_points.current not found for creature ${creature.name}`);
            }
            const currentHp = creatureCurrentHp;
            const newHp = Math.max(0, currentHp - damage);
            if (creature.hit_points == null || typeof creature.hit_points !== 'object') {
                console.error('expirations: expected hit_points to be an object, got', typeof creature.hit_points, 'for', creature.name);
                throw new Error('Missing object: hit_points for ' + creature.name);
            }
            creature.hit_points.current = newHp;
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
            }).catch((e) => { console.error("[expirations] Error:", e); throw e; });
        } catch { /* ignore per-creature errors */ }
    }

    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

export function addExpiration(attackerName, targetName, effects, campaignName, rounds) {
    const list = getRuntimeValue(attackerName, KEY);
    if (!Array.isArray(list)) {
        console.error('expirations: expected pendingExpirations to be an array for', attackerName);
        throw new Error('Missing array: pendingExpirations for ' + attackerName);
    }
    const currentRound = getCurrentCombatRound(campaignName);
    setRuntimeValue(attackerName, KEY, [
         ...list,
          { target: targetName, effects, appliedRound: currentRound, expiryRounds: (() => {
            if (rounds == null) {
              console.error('[expirations] addExpiration: rounds is missing for target:', targetName)
              throw new Error('rounds is required for addExpiration')
            }
            return rounds
          })() }
     ], campaignName);
}

 export function clearAllExpirationEffects(characterName, campaignName) {
    if (!characterName || !campaignName) return;

     // Clear all active buffs (Innate Sorcery, Reckless Attack, etc.)
     setRuntimeValue(characterName, 'activeBuffs', [], campaignName);
     setRuntimeValue(characterName, 'mantleOfMajestyActive', null, campaignName);

      // Clear Bait and Switch (Evasive Footwork) AC bonus
      const wasActive = getRuntimeValue(characterName, 'baitAndSwitchActive');
      if (wasActive) {
          setRuntimeValue(characterName, 'baitAndSwitchActive', null, campaignName);
          setRuntimeValue(characterName, 'baitAndSwitchBonus', null, campaignName);
          setRuntimeValue(characterName, 'baitAndSwitchSource', null, campaignName);
      }

     const charLower = characterName.toLowerCase();

     // --- "From me": clear all effects I have on other targets ---
    const myList = getRuntimeValue(characterName, KEY);
    if (!Array.isArray(myList)) {
        setRuntimeValue(characterName, KEY, [], campaignName);
    } else {
        for (const entry of myList) {
            clearExpirationEffects(entry.effects, entry.target, characterName, campaignName);
          }
        setRuntimeValue(characterName, KEY, [], campaignName);
      }

     // --- Scan all runtime stores for "to me" entries ---
    const allKeys = getAllStoreKeys();
    for (const key of allKeys) {
        if (typeof key !== 'string') continue;
        if (key.toLowerCase() === charLower) continue;

        const list = getRuntimeValue(key, KEY);
        if (!Array.isArray(list)) continue;
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
    const currentRound = getCurrentCombatRound(campaignName);
    const activeName = getActiveCreatureName(campaignName);
    if (!activeName) return;

    try {
        const combatData = getCombatSummary(campaignName);
        if (!combatData || typeof combatData !== 'object') return;
        const creatures = combatData.creatures;
        if (!Array.isArray(creatures)) return;

        for (const attacker of creatures) {
            if (utils.getName(attacker.name) !== utils.getName(activeName)) continue;

            const list = getRuntimeValue(attacker.name, KEY);
            if (!Array.isArray(list)) {
                console.error('expirations: expected pendingExpirations to be an array for', attacker.name);
                throw new Error('Missing array: pendingExpirations for ' + attacker.name);
            }
            if (!list.length) continue;

            let newEntries = [];
            for (const item of list) {
                const rounds = (() => {
                    if (item.expiryRounds == null) {
                      console.error('[expirations] expireStaleEffects: expiryRounds is missing for item in', attacker.name)
                      throw new Error('expiryRounds is required for expireStaleEffects')
                    }
                    return item.expiryRounds
                  })()
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
                const storedAdv = getRuntimeValue(attackerName, advKey);
                if (!Array.isArray(storedAdv)) {
                    console.error('expirations: expected advantage array to be an array, got', typeof storedAdv, 'for', advKey);
                    throw new Error('Missing array: advantage array for ' + advKey);
                }
                if (storedAdv.includes(targetName)) {
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
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                const conditions = Array.isArray(getRuntimeValue(targetName, 'activeConditions')) ? getRuntimeValue(targetName, 'activeConditions') : [];
                const conditionSet = new Set(conditions);
                if (conditionSet.has('incapacitated')) {
                    addEntry(campaignName, {
                        type: 'ability_use',
                        characterName: targetName,
                        abilityName: 'Draconic Flight',
                        description: `${targetName}'s spectral wings dissolve due to the Incapacitated condition.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error("[expirations] Error:", e); throw e; });
                }
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'fly_speed_equals_walk_speed'),
                    campaignName
                );
                break;
            }

            case 'fly_speed_20_hover': {
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'fly_speed_20_hover'),
                    campaignName
                );
                break;
            }

            case 'dragon_wings': {
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'dragon_wings'),
                    campaignName
                );
                break;
            }

            case 'ice_walk': {
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'ice_walk'),
                    campaignName
                );
                break;
            }

            case 'speed_boost': {
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'speed_boost'),
                    campaignName
                );
                break;
            }

            case 'remove_active_buff': {
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                const wasHaste = allBuffs.some(b => b.name === effect.buffName && b.effect === 'haste');
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    allBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
                if (wasHaste) {
                    const conditions = Array.isArray(getRuntimeValue(targetName, 'activeConditions')) ? getRuntimeValue(targetName, 'activeConditions') : [];
                    const hasSpeedZero = conditions.some(c => String(c).toLowerCase() === 'speed_zero');
                    const hasIncapacitated = conditions.some(c => String(c).toLowerCase() === 'incapacitated');
                    const newConditions = [
                        ...conditions.filter(c => String(c).toLowerCase() !== 'speed_zero'),
                        'speed_zero',
                        ...(!hasIncapacitated ? ['incapacitated'] : []),
                    ];
                    if (newConditions.length !== conditions.length || !hasSpeedZero) {
                        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
                    }
                    addExpiration(attackerName, targetName, [
                        { type: 'speed_zero' },
                        { type: 'condition', condition: 'incapacitated' }
                    ], campaignName, 2);
                }
                break;
            }

            case 'peerless_athlete_end': {
                setRuntimeValue(targetName, 'peerlessAthleteActive', false, campaignName);
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'peerless_athlete'),
                    campaignName
                );
                break;
            }

            case 'large_form_end': {
                setRuntimeValue(targetName, 'largeFormActive', false, campaignName);
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'large_form'),
                    campaignName
                );
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
                const feignBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    feignBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
                // Remove conditions applied by Feign Death
                for (const cond of ['blinded', 'incapacitated', 'speed_zero']) {
                    removeActiveCondition(targetName, cond, campaignName);
                    removeNpcCondition(targetName, cond, campaignName);
                }
                break;
            }

            case 'avenging_angel_aura': {
                const auraTargets = getRuntimeValue(attackerName, 'avengingAngelAuraTargets', campaignName);
                if (!Array.isArray(auraTargets)) {
                    console.error('expirations: expected avengingAngelAuraTargets to be an array for', attackerName);
                    throw new Error('Missing array: avengingAngelAuraTargets for ' + attackerName);
                }
                setRuntimeValue(
                    attackerName,
                    'avengingAngelAuraTargets',
                    auraTargets.filter(t => t !== targetName),
                    campaignName
                );
                break;
            }

            case 'remove_heroes_feast_buff': {
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    allBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
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
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    allBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
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
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    allBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                setRuntimeValue(
                    campaignName,
                    'targetEffects',
                    storedEffects.filter(te => !(te.effect === 'heroism' && te.source === effect.buffName)),
                    campaignName
                );
                break;
            }

            case 'remove_target_effect': {
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                setRuntimeValue(
                    campaignName,
                    'targetEffects',
                    storedEffects.filter(te => !(te.effect === effect.effectKey && te.source === effect.source)),
                    campaignName
                );
                break;
            }

            case 'remove_regenerate_buff': {
                setRuntimeValue(targetName, 'regenerateActive', null, campaignName);
                setRuntimeValue(targetName, 'regenerateSource', null, campaignName);
                break;
            }

            case 'bait_and_switch_clear': {
                const wasActive = getRuntimeValue(targetName, 'baitAndSwitchActive');
                if (wasActive) {
                    setRuntimeValue(targetName, 'baitAndSwitchActive', null, campaignName);
                    setRuntimeValue(targetName, 'baitAndSwitchBonus', null, campaignName);
                    setRuntimeValue(targetName, 'baitAndSwitchSource', null, campaignName);
                }
                break;
            }

            default:
                break;
             }
          }
}

function removeNpcCondition(targetName, conditionName, campaignName) {
    try {
        const combatData = getCombatSummary(campaignName);
        if (!combatData || typeof combatData !== 'object') return;
        const creatures = combatData.creatures;
        if (!Array.isArray(creatures)) return;
        const creature = creatures.find(c => utils.getName(c.name) === utils.getName(targetName));
        if (creature && creature.conditions) {
            creature.conditions = creature.conditions.filter(c => c.key !== conditionName);
            storage.set('combatSummary', combatData, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }
    } catch (_e) { /* ignore */ }
}

function removeActiveCondition(targetName, conditionName, campaignName) {
    const condList = Array.isArray(getRuntimeValue(targetName, 'activeConditions')) ? getRuntimeValue(targetName, 'activeConditions') : [];
    const filtered = condList.filter(c => utils.getName(c) !== utils.getName(conditionName));
    setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
}
