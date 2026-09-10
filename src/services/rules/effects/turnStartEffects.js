import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { setTempHp } from '../../automation/handlers/buffs/tempHpService.js';
import { evaluateAutoExpression } from '../../combat/automation/automationExpressions.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';
import { handleConfusionTurnStart } from '../../automation/handlers/spells/confusionTurnStartHandler.js';
import { applyAuraDamage, applyHolyNimbusDamage } from './auraDamageService.js';
import { cleanUpToppleConditions } from './toppleCleanup.js';
import utils from '../../ui/utils.js';
import storage from '../../ui/storage.js';

const KEY = 'pendingExpirations';

function ensureArray(value, name) {
    if (!Array.isArray(value)) {
        console.error(`[expirations] Expected array for ${name}, got ${value === null ? 'null' : typeof value}`);
        throw new Error(`Expected array for ${name}, got ${value === null ? 'null' : typeof value}`);
    }
    return value;
}

export async function applyTurnStartEffects(activeName, playerStats, campaignName, characters = []) {
    // Holy Nimbus: radiant damage to enemies in aura when they start their turn
    // Must run before the playerStats check since active creature may be an NPC
    await applyHolyNimbusDamage(activeName, characters, campaignName);

    // BUG SP-099: Resistance is "once per TURN" — the benefit re-arms for EVERY
    // protected creature at EVERY creature's turn start, not only the active
    // creature's own turn (which degraded it to once-per-round). Clear the
    // resistanceUsedThisTurn flag for all resistance_damage_reduction te holders
    // at every turn boundary. Runs before the playerStats guard since EB monster
    // turns never carry playerStats (Holy Nimbus precedent). Sequential awaits —
    // each setRuntimeValue POSTs the full store snapshot (pitfall 21).
    if (activeName) {
        const resistanceEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        for (const te of resistanceEffects) {
            if (!te || te.effect !== 'resistance_damage_reduction' || !te.target) continue;
            if (getRuntimeValue(te.target, 'resistanceUsedThisTurn', campaignName)) {
                await setRuntimeValue(te.target, 'resistanceUsedThisTurn', false, campaignName);
            }
        }
    }

    if (!activeName || !playerStats) {
        return;
    }

    const computedTurnStartEffects = ensureArray(playerStats.turnStartEffects, 'turnStartEffects');

    // Merge runtime store turnStartEffects (spell-added effects like Aura of Life, Heroism)
    const runtimeTurnStartEffects = getRuntimeValue(activeName, 'turnStartEffects', campaignName);
    const runtimeEffectsArray = Array.isArray(runtimeTurnStartEffects) ? runtimeTurnStartEffects : [];
    const turnStartEffects = [...computedTurnStartEffects];
    for (const re of runtimeEffectsArray) {
        if (!turnStartEffects.some(e => e.type === re.type)) {
            turnStartEffects.push(re);
        }
    }

    // Clear Survivor once-per-turn flag at start of the active creature's turn (before processing effects)
    if (activeName) {
        const survivorUsed = getRuntimeValue(activeName, 'survivorUsedThisTurn', campaignName);
        if (survivorUsed) {
            setRuntimeValue(activeName, 'survivorUsedThisTurn', false, campaignName);
        }
    }

    // Wild Magic Surge: expire effects with "start of your next turn" duration
    if (activeName) {
        const surgeEffects = getRuntimeValue(activeName, 'wildMagicSurgeEffects', campaignName);
        if (Array.isArray(surgeEffects) && surgeEffects.length > 0) {
            const filtered = surgeEffects.filter(e => {
                if (!e || !e.duration) return true;
                return e.duration.trim().toLowerCase() !== 'start of your next turn';
            });
            if (filtered.length !== surgeEffects.length) {
                await setRuntimeValue(activeName, 'wildMagicSurgeEffects', filtered, campaignName, true);
                console.error(`[expirations] Removed ${surgeEffects.length - filtered.length} "start of next turn" surge effects for ${activeName}`);
            }
        }
    }

    for (const effect of turnStartEffects) {
        if (effect.type === 'heroic_inspiration') {
            const currentInspiration = getRuntimeValue(activeName, 'hasInspiration') || false;
            if (!currentInspiration) {
                setRuntimeValue(activeName, 'hasInspiration', true, campaignName);
            }
        }
        // BUG CLA-307: the `condition_removal` branch (Self-Restoration) was consumed
        // HERE, i.e. at the owner's NEXT turn START — a full round late vs RAW "end of
        // each turn" — and silently. It now runs at the owner's turn END via
        // applyTurnEndConditionRemoval (turnEndConditionRemoval.js), invoked from
        // navigationHandlers.handleNextCreature and the sseHandlers activeCreatureName
        // echo for the OUTGOING active creature.
        if (effect.type === 'flurry_healing_harm') {
            await applyFlurryHealingHarmTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'living_legend_turn_start') {
            setRuntimeValue(activeName, 'unerringStrikeUsed', false, campaignName);
        }
        if (effect.type === 'elder_champion_regeneration') {
            await applyElderChampionRegeneration(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'radiant_soul_turn_start') {
            const key = `_radiantSoul_${activeName.replace(/\s+/g, '_')}_oncePerTurn`;
            setRuntimeValue(activeName, key, false, campaignName);
        }
        if (effect.type === 'inner_radiance_turn_start') {
            // BUG CLA-198: gated on the effect type so it ticks exactly ONCE per
            // invocation (previously it sat unconditionally in the loop and damaged
            // every creature once per turnStartEffects entry). Modelled at the
            // owner's turn boundary (the app has no turn-END consumer — same
            // verified pattern as Holy Nimbus), gated by lastAppliedTurnStartCreature.
            await applyAuraDamage(activeName, playerStats, campaignName, characters, {
                activeKey: 'innerRadianceActive',
                damageValue: playerStats.proficiency || 0,
                range: 10,
                damageType: 'Radiant',
            });
        }
        if (effect.type === 'dread_ambush_speed') {
            await applyDreadAmbushSpeedTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'umbral_sight') {
            await applyUmbralSightTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'steady_aim_clear') {
            await applySteadyAimClearTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'bait_and_switch_clear') {
            setRuntimeValue(activeName, 'baitAndSwitchActive', null, campaignName);
            setRuntimeValue(activeName, 'baitAndSwitchBonus', null, campaignName);
            setRuntimeValue(activeName, 'baitAndSwitchSource', null, campaignName);
        }
        if (effect.type === 'mage_hand_legerdemain') {
            // CLA-218: Mage Hand Legerdemain — the collector (automation/
            // turnStartEffects.js) pushed this with no consumer. Spectral-hand
            // control lasts until the start of your next turn, so clear the
            // mageHandControlled flag (set by mageHandControlHandler) which
            // arms the Dexterity (Sleight of Hand) check advantage.
            const controlled = getRuntimeValue(activeName, 'mageHandControlled', campaignName);
            if (controlled) {
                setRuntimeValue(activeName, 'mageHandControlled', false, campaignName);
            }
        }
        if (effect.type === 'supreme_sneak') {
            await applySupremeSneakTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'use_magic_device') {
            applyUseMagicDeviceTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'grapple_damage') {
            await applyGrappleDamageTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'heroism_temp_hp') {
            await applyHeroismTempHp(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'regenerate_turn_start_heal') {
            await applyRegenerateTurnStartHeal(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'survivor_turn_start_heal') {
            await applySurvivorTurnStartHeal(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'resistance_clear_turn') {
            setRuntimeValue(activeName, 'resistanceUsedThisTurn', false, campaignName);
        }
        if (effect.type === 'vitalityOfTheTree_turn_start') {
            await applyVitalityOfTheTreeTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'aura_of_life_turn_start_heal') {
            await applyAuraOfLifeTurnStartHeal(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'confusion_turn_start') {
            await applyConfusionTurnStart(activeName, campaignName);
        }
    }

    // Check for regenerate buff (not tied to turnStartEffects - it's a spell buff)
    if (activeName && playerStats) {
        const regenerateActive = getRuntimeValue(activeName, 'regenerateActive', campaignName);
        if (regenerateActive) {
            await applyRegenerateBuffHeal(activeName, playerStats, campaignName);
        }
    }

    // Clear Portent once-per-turn flag at start of each creature's turn
    if (activeName) {
        const portentUsed = getRuntimeValue(activeName, 'portentUsedThisTurn', campaignName);
        if (portentUsed) {
            setRuntimeValue(activeName, 'portentUsedThisTurn', false, campaignName);
        }
    }

    // Clear Reckless Attack offered flag at start of each creature's turn
    if (activeName) {
        const recklessOffered = getRuntimeValue(activeName, '_recklessAttack_offeredThisTurn', campaignName);
        if (recklessOffered) {
            setRuntimeValue(activeName, '_recklessAttack_offeredThisTurn', null, campaignName);
        }
    }

    // Clear Piercer - Puncture at start of each creature's turn
    if (activeName) {
        const punctureUsed = getRuntimeValue(activeName, 'piercerPunctureUsedThisTurn', campaignName);
        if (punctureUsed) {
            setRuntimeValue(activeName, 'piercerPunctureUsedThisTurn', null, campaignName);
        }
    }

    // Clear Savage Attacker at start of each creature's turn
    if (activeName) {
        const saUsed = getRuntimeValue(activeName, '_Savage_Attacker_usedRound', campaignName);
        if (saUsed) {
            setRuntimeValue(activeName, '_Savage_Attacker_usedRound', null, campaignName);
        }
    }

    // CLA-393: Wrath of the Sea Emanation ends early if the holder has the
    // Incapacitated condition (Cloak of Shadows precedent).
    if (activeName && getRuntimeValue(activeName, 'wrathOfTheSeaActive', campaignName)) {
        const wrathConds = getRuntimeValue(activeName, 'activeConditions', campaignName);
        if (Array.isArray(wrathConds) && wrathConds.some(c => String(c).toLowerCase() === 'incapacitated')) {
            setRuntimeValue(activeName, 'wrathOfTheSeaActive', false, campaignName);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: activeName,
                abilityName: 'Wrath of the Sea',
                description: `${activeName}'s Wrath of the Sea Emanation ended early — Incapacitated.`,
            }).catch((e) => { console.error('[turnStartEffects:wrath-of-the-sea-incapacitated-log-error]', e); });
        }
    }

    // Cloak of Shadows: end when incapacitated
    if (activeName) {
        const cloakBuffs = getRuntimeValue(activeName, 'activeBuffs', campaignName);
        if (Array.isArray(cloakBuffs) && cloakBuffs.some(b => b.effect === 'cloak_of_shadows')) {
            const conds = getRuntimeValue(activeName, 'activeConditions', campaignName);
            if (Array.isArray(conds) && conds.some(c => String(c).toLowerCase() === 'incapacitated')) {
                const filteredBuffs = cloakBuffs.filter(b => b.effect !== 'cloak_of_shadows');
                setRuntimeValue(activeName, 'activeBuffs', filteredBuffs, campaignName);
                const filteredConds = conds.filter(c => String(c).toLowerCase() !== 'invisible');
                if (filteredConds.length !== conds.length) {
                    setRuntimeValue(activeName, 'activeConditions', filteredConds, campaignName);
                }
                setRuntimeValue('campaign', `_activeInvisibility_${activeName}`, null, campaignName);
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: activeName,
                    abilityName: 'Cloak of Shadows',
                    description: `${activeName}'s Cloak of Shadows ended due to the Incapacitated condition.`,
                }).catch((e) => { console.error("[turnStartEffects:log-error]", e); });
            }
        }
    }

    // Clean up Topple weapon mastery Prone condition at start of target's next turn
    cleanUpToppleConditions(activeName, campaignName);

    // Wild Magic Surge: expire effects with "end of next turn" duration at the START of the next turn
    if (activeName) {
        const surgeEffects = getRuntimeValue(activeName, 'wildMagicSurgeEffects', campaignName);
        if (Array.isArray(surgeEffects) && surgeEffects.length > 0) {
            const filtered = surgeEffects.filter(e => {
                if (!e || !e.duration) return true;
                return e.duration.trim().toLowerCase() !== 'end of your next turn';
            });
            if (filtered.length !== surgeEffects.length) {
                await setRuntimeValue(activeName, 'wildMagicSurgeEffects', filtered, campaignName, true);
                console.error(`[expirations] Removed ${surgeEffects.length - filtered.length} "end of next turn" surge effects for ${activeName}`);
            }
        }
    }
}

// --- Turn start effect handlers ---

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

    setTempHp(activeName, tempHpAmount, campaignName);
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

async function applySurvivorTurnStartHeal(activeName, playerStats, effect, campaignName) {
    const survivorUsedThisTurn = getRuntimeValue(activeName, 'survivorUsedThisTurn', campaignName);
    if (survivorUsedThisTurn) {
        return;
    }

    const storedMaxHp = getRuntimeValue(activeName, 'hitPoints', campaignName);
    const storedCurrentHp = getRuntimeValue(activeName, 'currentHitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[expirations] Survivor: hitPoints not found for ${activeName} in ${campaignName}`);
        throw new Error(`Survivor: hitPoints not found for ${activeName}`);
    }
    const maxHp = storedMaxHp;
    const currentHp = storedCurrentHp ?? storedMaxHp;
    if (currentHp <= 0) {
        return;
    }
    const isBloodied = currentHp <= Math.floor(maxHp / 2);
    if (!isBloodied) {
        return;
    }

    const healAmount = effect.healExpression ? evaluateAutoExpression(effect.healExpression, playerStats) : 5;
    if (typeof healAmount !== 'number' || isNaN(healAmount) || healAmount <= 0) return;

    const newHp = Math.min(maxHp, currentHp + healAmount);
    await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
    await setRuntimeValue(activeName, 'survivorUsedThisTurn', true, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: activeName,
        abilityName: 'Survivor',
        description: `${activeName} uses Survivor to heal ${healAmount} HP (bloodied)`,
    }).catch((e) => { console.error("[turnStartEffects:log-error]", e); });
}

async function applyVitalityOfTheTreeTurnStart(activeName, playerStats, effect, campaignName) {
    const activeBuffs = Array.isArray(getRuntimeValue(activeName, 'activeBuffs', campaignName))
        ? getRuntimeValue(activeName, 'activeBuffs', campaignName)
        : [];
    const rageActive = activeBuffs.some(b => b.name === 'Rage');
    if (!rageActive) {
        setRuntimeValue(activeName, 'vitalityOfTheTreeAvailable', false, campaignName);
        return;
    }
    setRuntimeValue(activeName, 'vitalityOfTheTreeAvailable', true, campaignName);
}

async function applyAuraOfLifeTurnStartHeal(activeName, playerStats, effect, campaignName) {
    const auraOfLifeActive = getRuntimeValue(activeName, 'auraOfLifeHpMaxProtected', campaignName);
    if (!auraOfLifeActive) return;

    const storedCurrentHp = getRuntimeValue(activeName, 'currentHitPoints', campaignName);
    const storedMaxHp = getRuntimeValue(activeName, 'hitPoints', campaignName);
    if (storedMaxHp == null) return;

    const currentHp = storedCurrentHp ?? 0;
    if (currentHp > 0) return;

    const newHp = Math.min(storedMaxHp, currentHp + 1);
    await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);

    await addEntry(campaignName, {
        type: 'hp_change',
        targetName: activeName,
        delta: 1,
        isHealing: true,
        sourceName: null,
        note: 'Aura of Life (1 HP at start of turn)',
    }).catch((e) => { console.error('[auraOfLife] Error:', e); });
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
                type: 'ability_use',
                characterName: activeName,
                abilityName: 'Unarmed Fighting',
                description: `Unarmed Fighting grapple damage: ${damage} ${damageType.toLowerCase()} to ${creatureName}`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[expirations] Error:", e); });
        } catch (error) { console.error(`[expirations] Unarmed Fighting grapple damage failed for ${creatureName}:`, error); }
    }

    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

async function applyConfusionTurnStart(activeName, campaignName) {
    const result = await handleConfusionTurnStart(activeName, campaignName);
    if (!result) return;

    // After processing turn-start behavior, set up end-of-turn save
    // The save prompt will be triggered when the creature ends its turn
    try {
        await addEntry(campaignName, {
            type: 'condition',
            action: 'turn_start_behavior',
            characterName: activeName,
            condition: 'Confused',
            reason: 'Confusion spell turn-start effect',
            note: result.behaviorText,
            timestamp: Date.now(),
        });
    } catch (e) {
        console.error('[expirations] Error logging confusion turn-start:', e);
    }
}

export { KEY };
