import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { MELEE_REACH_FEET } from '../../../combat/baseCombatActions.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget, computeDamageAfterSave } from '../../../rules/combat/applyDamage.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { isPolearmWeapon } from '../../common/polearmUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

// CLA-361: Thought Shield ("Whenever a creature deals Psychic damage to you, that
// creature takes the same amount of damage that you take") — once-per-round reaction
// latch keyed on the holder's playerStats.name, round from a FRESH getCombatContext
// (CLA-335/CLA-315/CLA-297 family). Cleared at round wrap in initiative.jsx /
// navigationHandlers.js.
const THOUGHT_SHIELD_ROUND_KEY = '_Thought_Shield_usedRound';

// CLA-297: Retaliation ("when you take damage from a creature within 5 feet of you")
// once-per-round reaction latch, round-keyed like the CLA-274 Psychic Blade precedent
// (re-arms when the combat round advances; also cleared at round wrap in
// initiative.jsx / navigationHandlers.js).
const ADJACENT_DAMAGE_REACTION_ROUND_KEY = '_Retaliation_usedRound';

// FT-103: Reactive Strike ("While you're holding a Quarterstaff, a Spear, or a
// weapon that has the Heavy and Reach properties... one melee attack against a
// creature that enters the 5-foot reach") — once-per-round Reaction latch on the
// holder's name, round from a FRESH getCombatContext (CLA-361/CLA-297 family).
// Cleared at round wrap in Initiative.jsx clearPlayerRoundFlags +
// navigationHandlers.js PLAYER_ROUND_LATCH_KEYS.
const REACTIVE_STRIKE_ROUND_KEY = '_Reactive_Strike_usedRound';

// CLA-158: Hand of Harm ("When a creature you can see within 5 feet of you hits
// on an attack roll...") — holder-targeted round latch, CLA-361/CLA-383 family.
// Cleared at round wrap in Initiative.jsx clearPlayerRoundFlags +
// navigationHandlers.js PLAYER_ROUND_LATCH_KEYS.
function holderHitReactionLatchKey(featureName) {
    return `_${String(featureName).replace(/\s+/g, '_')}_usedRound`;
}

// CLA-158: level-scaled damage expression ({'11':'2d6','17':'3d6'}), same
// semantics as bonusAttacksHandler's resolveHandOfHarmExpression lane — the raw
// classes.json row carries the lv3 base and the scaling map, so the handler must
// resolve it at execution time (lv20 standalone HoH = 3d6, not 1d6).
function resolveReactionDamageExpression(auto, playerStats) {
    const scaling = auto.scaling || {};
    let expression = auto.damageExpression || '';
    const levels = Object.keys(scaling).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    for (const level of levels) {
        if (playerStats.level >= level) expression = String(scaling[level]);
    }
    return expression;
}

function holderHitRefuse(action, playerName, campaignName, description) {
    const slug = String(action.name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: `${slug}_refused`,
        name: action.name,
        description,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[reactionDamage] Error logging refusal:', e); });
    return refusalPopup(action, action.automation, description);
}

// CLA-158: gate for the holder-targeted trigger creature_within_5ft_hits_on_attack_roll.
// The holder is the DEFENDER — the target is taken from lastAttack (mirrors the
// CLA-150 Glorious Defense seam: findLastAttack + target-side trigger), never the
// holder's own armed-target slot, which is empty post-hit and made the reaction
// permanently refuse ("requires a target"). RAW wording is the attack ROLL hitting
// ("hits on an attack roll"), so a 0-damage hit (immunity) still triggers — unlike
// the CLA-150 damage-rollback rider which requires totalDamage>0. Adjacency is
// lenient per playbook §42 (isWithinRange passes gridless/unpositioned).
async function gateCreatureHitHolder(action, auto, playerStats, campaignName) {
    const playerName = playerStats.name;
    const refuse = (description) => holderHitRefuse(action, playerName, campaignName, description);

    const lastAttack = await findLastAttack(campaignName);
    const attackerName = lastAttack.attackerName;

    if (!lastAttack.attackEvent || !attackerName) {
        return { refusal: refuse(`No recent attack found. ${action.name} triggers when a creature within 5 feet of you hits you on an attack roll.`) };
    }
    if (attackerName === playerName) {
        return { refusal: refuse(`${action.name}: you cannot trigger this reaction on yourself.`) };
    }
    if (lastAttack.targetName !== playerName) {
        return { refusal: refuse(`You were not the target of the last attack (${lastAttack.targetName} was). ${action.name} only triggers when a creature within 5 feet of you hits you.`) };
    }
    if (lastAttack.attackEvent.hit !== true) {
        return { refusal: refuse(`The last attack by ${attackerName} missed — ${action.name} requires a hit on an attack roll.`) };
    }

    const rangeFt = rangeToFeet(auto.range) ?? 5;
    const withinRange = await isWithinRange(playerName, attackerName, rangeFt);
    if (!withinRange) {
        return { refusal: refuse(`${attackerName} is not within ${rangeFt} feet of you. ${action.name} requires the attacker to be within ${rangeFt} feet.`) };
    }

    const combatContext = await getCombatContext(campaignName);
    const currentRound = combatContext?.round || 1;
    const latchKey = holderHitReactionLatchKey(action.name);
    const usedRound = Number(getRuntimeValue(playerName, latchKey, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return { refusal: refuse(`You have already used ${action.name} this round — your Reaction is spent until your next turn.`) };
    }

    return { attackerName, latchKey, currentRound };
}

function refusalPopup(action, auto, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };
}

// Gates for the generic no-save reaction_damage consumers whose data declares
// trigger 'damage_from_adjacent_creature' (CLA-297 Retaliation). Other triggers
// (Guardian's ally-defense OA) are NOT gated here; Reactive Strike's
// creature_enters_reach_while_holding_polearm trigger rides its own dedicated
// FT-103 lane (gateReactiveStrike) and never reaches handleMeleeReactionAttack.
async function gateAdjacentDamageReaction(action, auto, playerStats, lastAttackResult, campaignName) {
    const playerName = playerStats.name;
    const lastAttack = lastAttackResult.attackEvent;
    const attackerName = lastAttackResult.attackerName;

    if (!lastAttack || !attackerName) {
        return refusalPopup(action, auto, `${action.name}: No recent attack found. ${action.name} triggers when a creature within 5 feet of you deals damage to you.`);
    }
    if (attackerName === playerName) {
        return refusalPopup(action, auto, `${action.name}: you cannot attack yourself — the triggering attack must come from another creature.`);
    }
    if (lastAttackResult.targetName !== playerName) {
        return refusalPopup(action, auto, `You were not the target of the last attack (${lastAttackResult.targetName} was). ${action.name} only triggers when you take damage.`);
    }
    if (!(lastAttackResult.totalDamage > 0)) {
        return refusalPopup(action, auto, `The last attack dealt you no damage. ${action.name} triggers only when you take damage.`);
    }
    if (lastAttack.weaponType === 'ranged') {
        return refusalPopup(action, auto, `The last attack was a Ranged attack. ${action.name} only triggers when a creature within 5 feet of you deals damage to you.`);
    }
    const within5ft = await isWithinRange(playerName, attackerName, 5);
    if (!within5ft) {
        return refusalPopup(action, auto, `${attackerName} is not within 5 feet of you. ${action.name} requires the attacker to be adjacent.`);
    }
    const combatContext = await getCombatContext(campaignName);
    const currentRound = combatContext?.round || 1;
    const usedRound = Number(getRuntimeValue(playerName, ADJACENT_DAMAGE_REACTION_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return refusalPopup(action, auto, `You have already used ${action.name} this round — your Reaction is spent until your next turn.`);
    }
    return null;
}

function getChosenResistanceTypes(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, '_Energy_Resistances_chosenTypes', campaignName);
    return Array.isArray(stored) ? stored : [];
}

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

async function consumeResourceCost(auto, playerStats, campaignName, actionName) {
    if (auto.resourceCost === 'focus_point') {
        // CLA-158: the old blanket skip (isHandOfHarm && hasFlurryHealingHarm)
        // charged 0 FP on EVERY standalone Hand of Harm press once the monk held
        // the lv11 passive. The Flurry lane's free harm legs route through
        // bonusAttacksHandler.handleBonusAttacks (they never reach this
        // handler) — standalone RAW cost is 1 Focus Point, so charge it here.
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        const maxFocus = classLevel?.focus_points || 0;
        const currentFocus = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? maxFocus);

        if (currentFocus <= 0) {
            return { ok: false, message: 'No Focus Points remaining.' };
        }

        await setRuntimeValue(playerStats.name, 'focusPoints', currentFocus - 1, campaignName);
        return { ok: true };
    }

    if (auto.uses_expression) {
        const usesKey = getRuntimeUsesKey(actionName);
        const maxUses = evaluateAutoExpression(auto.uses_expression, playerStats);
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);
        if (currentUses <= 0) {
            return { ok: false, message: `${actionName} has no uses remaining.` };
        }
        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
        return { ok: true };
    }

    return { ok: true };
}

// CLA-158: holder-targeted trigger — the holder was the one hit, so the
// reaction's target is the attacker from lastAttack (CLA-150 seam), gated
// on hit + adjacency + once-per-round latch BEFORE any resource spend.
// Non-holder triggers keep the existing armed-target resolution byte-identical.
async function resolveSaveBranchTarget({ action, auto, playerStats, campaignName }) {
    let holderGate = null;
    let targetName = null;

    if (auto.trigger === 'creature_within_5ft_hits_on_attack_roll') {
        holderGate = await gateCreatureHitHolder(action, auto, playerStats, campaignName);
        if (holderGate.refusal) return { refusal: holderGate.refusal };
        targetName = holderGate.attackerName;
    } else {
        const targetInfo = await resolveTarget(campaignName, playerStats.name);
        if (!targetInfo?.target) {
            return { refusal: refusalPopup(action, auto, `${action.name} requires a target. Select a creature in combat and try again.`) };
        }
        targetName = targetInfo.target.name;
    }

    const resourceResult = await consumeResourceCost(auto, playerStats, campaignName, action.name);
    if (!resourceResult.ok) {
        // CLA-158: refusals log (CLA-337 storms_thunder_refused shape) — popup-only
        // refusals were the §7 gap. This lane's only resourceCost consumer is the
        // focus_point Hand of Harm row.
        if (holderGate) {
            return { refusal: holderHitRefuse(action, playerStats.name, campaignName, `${action.name} refused — ${resourceResult.message} Nothing was spent.`) };
        }
        return { refusal: refusalPopup(action, auto, resourceResult.message) };
    }

    // Stamp the latch before the save prompt so a spent Reaction cannot refire
    // within the round (CLA-361 order; FP pre-modal spend = paid value, CLA-113).
    if (holderGate) {
        await setRuntimeValue(playerStats.name, holderGate.latchKey, holderGate.currentRound, campaignName);
    }

    return { targetName };
}

export async function handle(action, playerStats, campaignName, _mapName, characters = []) {
    const auto = action.automation;

    if (auto?.trigger === 'psychic_damage_received') {
        return await handleThoughtShield(action, playerStats, campaignName);
    }

    if (auto?.trigger === 'creature_enters_reach_while_holding_polearm') {
        return await handleReactiveStrike(action, auto, playerStats, campaignName);
    }

    if (auto?.trigger === 'damage_taken_of_chosen_resistance_type') {
        return await handleEnergyRedirection(action, playerStats, campaignName);
    }

    if (!auto.saveType) {
        return await handleMeleeReactionAttack(action, auto, playerStats, campaignName);
    }

    const resolved = await resolveSaveBranchTarget({ action, auto, playerStats, campaignName });
    if (resolved.refusal) return resolved.refusal;
    const targetName = resolved.targetName;

    // CLA-158: Monk spellcasting ability is Wisdom — buildSaveDc's 'ability'
    // path defaults to CON without this stamp (CLA-144 convention).
    const saveAbility = auto.saveAbility || (playerStats.class?.name === 'Monk' ? 'WIS' : 'CON');
    const saveDc = buildSaveDc({ ...auto, saveAbility }, playerStats);
    const saveType = auto.saveType || 'CON';
    const { promptId } = createSaveListener(campaignName, {
        targetName,
        attackerName: playerStats.name,
        saveType,
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} triggered — ${targetName} must make ${saveType} save (DC ${saveDc})`,
        promptId,
    }).catch((e) => { console.error("[reactionDamage] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        if (!event.detail.success) {
            await applySaveFailureEffects({ auto, action, playerStats, campaignName, targetName, characters });
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            targetName,
            description: `${targetName} must make a ${saveType} saving throw (DC ${saveDc}).`,
            automation: auto,
        },
    };
}

async function applyFailDamage({ auto, action, playerStats, campaignName, targetName, characters }) {
    const damageExpression = resolveReactionDamageExpression(auto, playerStats);
    if (!damageExpression) return;
    const damageResult = rollExpression(damageExpression);
    if (!damageResult) return;

    const damageType = auto.damageType || 'Necrotic';
    addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: action.name + ' Damage',
        targetName,
        damageType,
        total: damageResult.total,
        formula: damageExpression,
        rolls: damageResult.rolls,
        description: `${action.name} dealt ${damageResult.total} ${damageType} damage to ${targetName}.`,
    }).catch((e) => { console.error("[reactionDamage] Error:", e); });

    const cs = await getCombatContext(campaignName);
    if (cs) {
        await applyDamageToTarget(cs, targetName, damageResult.total, [damageType], { campaignName, characters: characters, ignoreResistance: false, attackerName: playerStats.name });
    } else {
        console.error('[reactionDamage] No combat context — damage not applied:', { actionName: action.name, targetName });
    }
}

async function applyFailInfliction({ auto, action, campaignName, targetName, playerName }) {
    if (!auto.alsoInflicts) return;
    // CLA-158: campaignName threaded (CLA-150 buildProtectedRefusal shape) — an
    // unthreaded read can miss the live campaign store. Registered te lane
    // (disadvantage_next_attack) consumed/cleared by attackPostProcessing.
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const newEffects = [...storedEffects, {
        target: targetName,
        source: action.name,
        option: auto.alsoInflicts,
        effect: auto.alsoInflicts,
        duration: 'until_used',
    }];
    await setRuntimeValue('campaign', 'targetEffects', newEffects, campaignName);

    addEntry(campaignName, {
        type: 'condition',
        characterName: targetName,
        action: 'applied',
        condition: 'Disadvantage on next attack roll',
        reason: `${playerName || action.name}'s ${action.name} (failed saving throw)`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[reactionDamage] Error logging inflicted condition:', e); });
}

function applyFailPhysiciansTouch({ playerStats, campaignName, targetName }) {
    const hasPhysiciansTouch = playerStats.specialActions?.some(f => f.name === "Physician's Touch");
    if (!hasPhysiciansTouch) return;
    const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const condArray = Array.isArray(conditions) ? conditions : [];
    if (!condArray.includes('poisoned')) {
        setRuntimeValue(targetName, 'activeConditions', [...condArray, 'poisoned'], campaignName);
    }
}

async function applySaveFailureEffects({ auto, action, playerStats, campaignName, targetName, characters }) {
    await applyFailDamage({ auto, action, playerStats, campaignName, targetName, characters });
    await applyFailInfliction({ auto, action, campaignName, targetName, playerName: playerStats.name });
    applyFailPhysiciansTouch({ playerStats, campaignName, targetName });
}

// FT-102 (FIXED, ea10fa115): refusals log `automation` + `<feature>_refused`
// with a reason token (playbook §5, CLA-337 shape) — popup-only refusals were
// the §7 gap. FT-103 Reactive Strike spends its Reaction as a round latch on
// the holder, so refusals are zero-spend: nothing stamped, nothing logged spent.
function reactiveStrikeRefuse(action, playerName, campaignName, description) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'reactive_strike_refused',
        name: action.name,
        description,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[reactiveStrike] Error logging refusal:', e); });
    return refusalPopup(action, action.automation, description);
}

// FT-103: resolve the Reactive Strike attack — the RAW says "one melee attack
// against a creature that enters the 5-foot reach you have WITH THAT WEAPON",
// so the equipped polearm's action row is the canonical dice source (Glaive =
// 1d10+Slashing+STR). Equipped state comes from playerStats.inventory.equipped,
// NEVER the campaign-global lastAttack weapon identity (FT-102 stale-gate family:
// ~12 rider/consume seams re-stamp lastAttack full-replacement — playbook §2523).
async function findEquippedPolearmAttack(playerStats) {
    const equipped = playerStats.inventory?.equipped || [];
    const polearmNames = [];
    for (const name of equipped) {
        const baseName = String(name).replace(/\s*\+\s*\d+\b.*$/, '').trim();
        if (await isPolearmWeapon(name) || await isPolearmWeapon(baseName)) {
            polearmNames.push(name);
        }
    }
    if (polearmNames.length === 0) return null;
    const attacks = playerStats.attacks || [];
    const polearmMelee = attacks.filter(a =>
        a.type === 'Action' && polearmNames.includes(a.weaponName || a.name));
    // RAW Reactive Strike is a MELEE attack with that weapon — prefer the
    // melee row over a thrown-Spear ranged row of the same name.
    return polearmMelee.find(a => a.range === MELEE_REACH_FEET)
        || polearmMelee[0]
        || attacks.find(a => a.type === 'Action' && a.range === MELEE_REACH_FEET)
        || attacks[0]
        || null;
}

// FT-103: target-identity refusals for the reach-entry gate (target rides the
// armed-target slot — the entering creature the GM selected on the initiative
// card, same seam the OA lane uses).
function reactiveStrikeTargetRefusal(action, cs, targetName, playerName, refuse) {
    if (!targetName) {
        return refuse(`${action.name} requires a target — select the entering creature as your target and try again. Nothing was spent.`);
    }
    if (targetName === playerName) {
        return refuse(`${action.name}: you cannot attack yourself — the triggering creature must be another creature.`);
    }
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);
    if (targetCreature && targetCreature.currentHp <= 0) {
        return refuse(`${targetName} is already defeated. Cannot make a Reactive Strike against a creature that's already down.`);
    }
    return null;
}

// FT-103: gridless GM-adjudicated reach-entry model — token movement is grep-zero
// app-wide (playbook §70) and EB-joined combatants arrive tokenless (CLA-046), so
// the GM clicks the row when a creature enters reach and the entering creature rides
// the armed-target slot (same verified seam the OA lane uses, CharReactions.jsx
// handleOpportunityAttack / resolveTarget). Gate order: round latch → equipped
// polearm → target identity → range. Refusals spend nothing.
async function gateReactiveStrike(action, auto, playerStats, campaignName) {
    const playerName = playerStats.name;
    const refuse = (description) => reactiveStrikeRefuse(action, playerName, campaignName, description);

    const cs = await getCombatContext(campaignName);
    const currentRound = Number(cs?.round ?? 1);
    const usedRound = Number(getRuntimeValue(playerName, REACTIVE_STRIKE_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return { refusal: refuse(`You have already used ${action.name} this round — your Reaction is spent until your next turn.`) };
    }

    const attack = await findEquippedPolearmAttack(playerStats);
    if (!attack) {
        return { refusal: refuse(`${action.name} requires you to be holding a Quarterstaff, Spear, or a weapon with the Heavy and Reach properties.`) };
    }

    const targetInfo = await resolveTarget(campaignName, playerName);
    const targetName = targetInfo?.target?.name || null;
    const targetRefusal = reactiveStrikeTargetRefusal(action, cs, targetName, playerName, refuse);
    if (targetRefusal) return { refusal: targetRefusal };

    const rangeFt = rangeToFeet(auto.range) ?? 5;
    const inRange = await isWithinRange(playerName, targetName, rangeFt);
    if (!inRange) {
        return { refusal: refuse(`${targetName} is not within ${rangeFt} feet of you. ${action.name} attacks a creature entering the ${rangeFt}-foot reach you have with your polearm.`) };
    }

    return { attack, targetName, currentRound, rangeFt };
}

async function handleReactiveStrike(action, auto, playerStats, campaignName) {
    const gate = await gateReactiveStrike(action, auto, playerStats, campaignName);
    if (gate.refusal) return gate.refusal;
    const { attack, targetName, currentRound, rangeFt } = gate;

    // Stamp the latch BEFORE the attack resolves (CLA-361 order) so a spent
    // Reaction cannot refire within the round even if the attack popup is
    // abandoned mid-flight.
    await setRuntimeValue(playerStats.name, REACTIVE_STRIKE_ROUND_KEY, currentRound, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} used ${action.name} (Reaction) — melee attack against ${targetName}, who entered the ${rangeFt}-foot reach of their ${attack.name}.`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[reactiveStrike] Error logging ability_use:', e); });

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName,
            sourceName: action.name,
        },
    };
}

async function handleMeleeReactionAttack(action, auto, playerStats, campaignName) {
    const lastAttackResult = await findLastAttack(campaignName);
    const targetName = lastAttackResult.attackerName || null;

    if (auto.trigger === 'damage_from_adjacent_creature') {
        const refusal = await gateAdjacentDamageReaction(action, auto, playerStats, lastAttackResult, campaignName);
        if (refusal) return refusal;
    }

    const meleeAttacks = (playerStats.attacks || []).filter(
        a => a.type === 'Action' && a.range === MELEE_REACH_FEET
    );
    const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

    if (!attack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No melee attack available.`,
                automation: auto,
            },
        };
    }

    if (auto.trigger === 'damage_from_adjacent_creature') {
        const combatContext = await getCombatContext(campaignName);
        const currentRound = combatContext?.round || 1;
        await setRuntimeValue(playerStats.name, ADJACENT_DAMAGE_REACTION_ROUND_KEY, currentRound, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${playerStats.name} used ${action.name} (Reaction) — melee attack against ${targetName} in response to the ${lastAttackResult.totalDamage} damage taken from them.`,
            targetName,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[reactionDamage] Error logging ability_use:', e); });
    }

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName,
            sourceName: action.name,
        },
    };
}

// CLA-361: every gate refusal now writes a thought_shield_refused log line
// (CLA-337 storms_thunder_refused shape) — popup-only refusals were the §7 gap.
function thoughtShieldRefuse(action, warlockName, campaignName, description) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: warlockName,
        automationType: 'thought_shield_refused',
        name: action.name,
        description,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[thoughtShield] Error logging refusal:', e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
        },
    };
}

// CLA-361: once-per-round reaction latch (CLA-335 recipe — round read from the
// FRESH cs, never a stale mirror). Checked BEFORE the lastAttack identity gates
// because the persisted reflect re-stamps lastAttack with the warlock as attacker
// (CLA-337 caveat), so the latch is the authoritative guard that a spent Reaction
// cannot refire — refuses spend nothing.
async function gateThoughtShieldRoundLatch(action, cs, warlockName, campaignName) {
    const refuse = (description) => thoughtShieldRefuse(action, warlockName, campaignName, description);

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack) {
        return { refusal: refuse('No recent attack found. Thought Shield requires a creature to have dealt psychic damage to you.') };
    }

    const currentRound = cs.round || 1;
    const usedRound = Number(getRuntimeValue(warlockName, THOUGHT_SHIELD_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return { refusal: refuse(`You have already used ${action.name} this round — your Reaction is spent until your next turn.`) };
    }

    return { lastAttack, currentRound };
}

function gateThoughtShieldPsychicIdentity(action, warlockName, campaignName, lastAttack) {
    const refuse = (description) => thoughtShieldRefuse(action, warlockName, campaignName, description);

    if (lastAttack.targetName !== warlockName) {
        return { refusal: refuse(`You were not the target of the last attack (${lastAttack.targetName} was). Thought Shield only works when you take psychic damage.`) };
    }

    if (!lastAttack.damageTypes?.some(d => d.toLowerCase() === 'psychic')) {
        return { refusal: refuse(`The last attack dealt ${lastAttack.damageTypes?.join(', ') || 'unknown'} damage, not psychic damage. Thought Shield only reflects psychic damage.`) };
    }

    const actualWarlockDamage = lastAttack.actualDamage || lastAttack.rawDamage || 0;
    if (actualWarlockDamage <= 0) {
        return { refusal: refuse('The attacker dealt no damage to you (immune/resistant). Thought Shield reflects the damage you took, which was 0.') };
    }

    return { actualWarlockDamage };
}

async function gateThoughtShieldTrigger(action, cs, warlockName, campaignName) {
    const roundGate = await gateThoughtShieldRoundLatch(action, cs, warlockName, campaignName);
    if (roundGate.refusal) return roundGate;
    const { lastAttack, currentRound } = roundGate;

    const identity = gateThoughtShieldPsychicIdentity(action, warlockName, campaignName, lastAttack);
    if (identity.refusal) return identity;

    const refuse = (description) => thoughtShieldRefuse(action, warlockName, campaignName, description);

    const attackerCreatureName = lastAttack.attackerName;
    if (!attackerCreatureName) {
        return { refusal: refuse('No attacker found to reflect damage to.') };
    }

    const attackerCreature = cs.creatures.find(c => c.name === attackerCreatureName);
    if (!attackerCreature) {
        return { refusal: refuse(`Attacker "${attackerCreatureName}" not found in combat.`) };
    }

    if (attackerCreature.currentHp <= 0) {
        return { refusal: refuse(`${attackerCreatureName} is already defeated. Cannot reflect damage to a creature that's already down.`) };
    }

    // CLA-361: range gate — the feature's data declares range 5_ft. Canonical
    // isWithinRange (CLA-337 recipe): strict token distances on a mapped rig,
    // lenient true when gridless/unpositioned.
    const rangeFt = rangeToFeet(action.automation?.range) ?? 5;
    const inRange = await isWithinRange(attackerCreatureName, warlockName, rangeFt);
    if (!inRange) {
        return { refusal: refuse(`${attackerCreatureName} is not within ${rangeFt} feet of you. Thought Shield requires the attacker to be within ${rangeFt} feet.`) };
    }

    return { currentRound, actualWarlockDamage: identity.actualWarlockDamage, attackerCreatureName };
}

async function handleThoughtShield(action, playerStats, campaignName) {
    const warlockName = playerStats.name;

    const allFeatures = [
        ...(playerStats.characterAdvancement || []),
        ...(playerStats.reactions || []),
    ];
    const hasThoughtShield = allFeatures.some(f => f.name === 'Thought Shield');
    if (!hasThoughtShield) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${warlockName} does not have Thought Shield.`,
            },
        };
    }

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat context available.',
            },
        };
    }

    const gate = await gateThoughtShieldTrigger(action, cs, warlockName, campaignName);
    if (gate.refusal) return gate.refusal;
    const { currentRound, actualWarlockDamage, attackerCreatureName } = gate;

    // Stamp the latch before applying so a thrown apply cannot leave the
    // Reaction refirable within the same round.
    await setRuntimeValue(warlockName, THOUGHT_SHIELD_ROUND_KEY, currentRound, campaignName);

    // CLA-361 FIX: persist through the verified applyDamageToTarget consumer
    // (CLA-337 Storm's Thunder pattern) — it writes combatSummary via storage.set
    // (monster currentHp), emits the hp_change log row, and handles the attacker's
    // concentration DC/save. The reflect amount is the post-resistance damage the
    // warlock actually took, so ignoreResistance=true ("same amount" — RAW).
    const reflectedDamage = actualWarlockDamage;
    const characters = cs.creatures.filter(c => c.type === 'player');
    const applyResult = await applyDamageToTarget(cs, attackerCreatureName, reflectedDamage, ['Psychic'], { campaignName, characters: characters, ignoreResistance: true, attackerName: warlockName });

    if (!applyResult) {
        console.error('[thoughtShield] applyDamageToTarget failed — reflected damage not applied:', { warlockName, attackerCreatureName, reflectedDamage });
        return thoughtShieldRefuse(action, warlockName, campaignName, `Reflected damage could not be applied to ${attackerCreatureName}.`);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: warlockName,
        abilityName: action.name,
        description: `${warlockName} reflects ${reflectedDamage} psychic damage back to ${attackerCreatureName} using Thought Shield (${attackerCreatureName} at ${applyResult.newHp} HP).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[thoughtShield] Error logging:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${warlockName} reflects ${reflectedDamage} psychic damage back to ${attackerCreatureName}!`,
        },
    };
}

async function handleEnergyRedirection(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const auto = action.automation;

    const chosenTypes = getChosenResistanceTypes(playerName, campaignName);
    if (!chosenTypes || chosenTypes.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires you to have chosen damage types for Energy Resistances.`,
                automation: auto,
            },
        };
    }

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat context available.',
            },
        };
    }

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent attack found. Energy Redirection requires you to have taken damage of a type you've chosen resistance against.`,
            },
        };
    }

    if (lastAttack.targetName !== playerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `You were not the target of the last attack (${lastAttack.targetName} was). Energy Redirection only works when you take damage.`,
            },
        };
    }

    const damageTypes = lastAttack.damageTypes || [];
    const matchingTypes = damageTypes.filter(dt =>
        chosenTypes.some(ct => ct.toLowerCase() === dt.toLowerCase())
    );
    if (matchingTypes.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `The last attack dealt ${damageTypes.join(', ') || 'unknown'} damage, not one of your chosen resistance types (${chosenTypes.join(', ')}).`,
            },
        };
    }

    const targets = cs.creatures
        .filter(c => c.name !== playerName)
        .map(c => {
            const hp = c.type === 'player'
                ? { currentHp: getRuntimeValue(c.name, 'currentHitPoints') ?? getRuntimeValue(c.name, 'hitPoints') ?? 0, maxHp: getRuntimeValue(c.name, 'hitPoints') ?? 0 }
                : { currentHp: c.currentHp ?? c.maxHp, maxHp: c.maxHp };
            return { ...c, ...hp };
        });

    if (targets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No other creatures available to redirect to.`,
                automation: auto,
            },
        };
    }

    const conBonus = getAbilityModifier(playerStats.abilities, 'CON');
    const prof = playerStats.proficiency || 0;
    const saveDc = 8 + conBonus + prof;

    return {
        type: 'modal',
        modalName: 'energyRedirection',
        payload: {
            title: `${action.name} — Redirect Energy`,
            targets,
            confirmLabel: 'Redirect',
            confirmIcon: 'fa-bolt',
            featureDescription: `Target must make a DEX saving throw (DC ${saveDc}) or take 2d12 + ${conBonus >= 0 ? '+' : ''}${conBonus} ${matchingTypes[0]} damage.`,
            description: `You redirect damage of the ${matchingTypes[0]} type toward another creature you can see within 60 feet.`,
            onTargetSelected: async (targetName) => {
                if (!targetName) return null;

                const evaluated = evaluateAutoExpression(auto.damageExpression, playerStats);
                const roll = rollExpression(evaluated);
                const redirectDamage = roll?.total ?? 0;

                const { promise } = createSaveListener(campaignName, {
                    targetName,
                    saveType: auto.saveType || 'DEX',
                    saveDc,
                });
                const saveResult = await promise;

                const damageOnSave = computeDamageAfterSave(redirectDamage, saveResult.success, null);
                if (damageOnSave > 0) {
                    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
                    await applyDamageToTarget(cs, targetName, damageOnSave, [matchingTypes[0]], { campaignName, characters: characters, ignoreResistance: false, attackerName: playerName });
                }

                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: action.name,
                    description: `${playerName} redirects ${matchingTypes[0]} energy to ${targetName}. ${targetName} ${saveResult.success ? 'succeeded' : 'failed'} their DEX save (DC ${saveDc}) and took ${damageOnSave} ${matchingTypes[0]} damage.`,
                    targetName,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[energyRedirection] Error:", e); });

                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        targetName,
                        description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} their DEX save (DC ${saveDc}) and took ${damageOnSave} ${matchingTypes[0]} damage.`,
                    },
                };
            },
            onSkip: async () => {
                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: action.name,
                    description: `${playerName} chose not to redirect energy.`,
                }).catch((e) => { console.error("[energyRedirection] Skip:", e); });
            },
        },
    };
}
