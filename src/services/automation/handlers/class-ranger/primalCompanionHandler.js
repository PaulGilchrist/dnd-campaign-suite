import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import cloneDeep from 'lodash/cloneDeep.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { getMonsterSaveBonuses } from '../../../encounters/encounterToInitiative.js';
import { rollExpression } from '../../../dice/diceRoller.js';

export const BESTIAL_FURY_STRIKES_KEY = 'bestialFuryStrikes';
export const BESTIAL_FURY_MARK_LATCH_KEY = '_BestialFury_markBonusRound';

function getTargetEffects() {
    const stored = getRuntimeValue('campaign', 'targetEffects');
    return stored || [];
}

function getWisdomModifier(playerStats) {
    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    return wis?.bonus || 0;
}

function getSpellAttackModifier(playerStats) {
    return playerStats.spellAbilities?.toHit || 0;
}

const TYPE_TO_MONSTER_INDEX = {
    'Beast of the Land': 'primal-companion-beast-of-the-land',
    'Beast of the Sea': 'primal-companion-beast-of-the-sea',
    'Beast of the Sky': 'primal-companion-beast-of-the-sky',
};

function hasFeature(playerStats, featureName) {
    const classLevels = playerStats?.class?.class_levels || [];
    const subclassLevels = playerStats?.class?.subclass?.class_levels || [];
    const majorFeatures = playerStats?.class?.major?.features || [];
    const allFeatureNames = [
        ...classLevels.flatMap(cl => (cl.features || []).map(f => f.name)),
        ...subclassLevels.flatMap(cl => (cl.features || []).map(f => f.name)),
        ...majorFeatures.map(f => f.name),
    ];
    return allFeatureNames.includes(featureName);
}

function buildPrimalCompanionCreature({ monster, companionTypeConfig, displayName, initiativeValue, rangerLevel, wisModifier, spellAttackMod, proficiencyBonus, spellSaveDc, hasBestialFury, casterName = null, bestialFuryBonus = null }) {
    const hp = companionTypeConfig.hpBase + (companionTypeConfig.hpPerLevel * rangerLevel);

    const baseSaves = getMonsterSaveBonuses(monster);
    const adjustedSaves = {};
    for (const [key, value] of Object.entries(baseSaves)) {
        adjustedSaves[key] = value + proficiencyBonus;
    }

    const actions = resolveMonsterActions(monster, wisModifier, spellAttackMod, spellSaveDc, { hasBestialFury, proficiencyBonus, bestialFuryBonus });

    const speed = {};
    const baseSpeed = companionTypeConfig.speed || '30 ft';
    if (companionTypeConfig.specialSpeed) {
        speed.walk = baseSpeed;
        const speedType = companionTypeConfig.specialSpeed.split(' ')[0];
        speed[speedType] = companionTypeConfig.specialSpeed;
    } else {
        speed.walk = baseSpeed;
    }

    return {
        name: displayName,
        type: 'npc',
        monsterType: monster.type,
        initiative: String(initiativeValue - 0.1),
        targetName: null,
        ac: 13 + wisModifier,
        resistances: monster.damage_resistances || [],
        immunities: monster.damage_immunities || monster.immunities || [],
        concentration: null,
        maxHp: hp,
        currentHp: hp,
        saveBonuses: adjustedSaves,
        monsterIndex: monster.index,
        size: companionTypeConfig.size || monster.size || 'Medium',
        speed,
        actions,
        // CLA-036: machine provenance for the Bestial Fury lanes — `summonedBy`
        // feeds the Hunter's Mark rider (ranger cs concentration lookup);
        // `bestialFury` marks the combatant as double-strike eligible.
        summonedBy: casterName,
        bestialFury: hasBestialFury,
    };
}

// CLA-036: Bestial Fury structured stamps. The prose "(can be used twice
// per turn)" concat alone was inert — the double-strike economy and the
// Hunter's Mark extra-Force rider need machine keys. The Beast's Strike cs
// row is folded per-caster here (same seam as the WIS / spell-attack /
// escape_dc folds), so `bestial_fury_double_strike` + `bestial_fury_bonus`
// ride the action into MonsterCardModal's chip press (strike gate) and the
// hit-confirmed auto-damage seam (mark rider transport). Non-Fury companions
// and every non-Strike row stay byte-inert.
function resolveMonsterActions(monster, wisModifier, spellAttackMod, spellSaveDc, { hasBestialFury = false, proficiencyBonus = 0, bestialFuryBonus = null } = {}) {
    const actions = (monster.actions || []).map(action => {
        const resolved = { ...action };
        resolved.damage_dice_primary = String(resolved.damage_dice_primary || '').replace(/WIS modifier/gi, String(wisModifier));
        let desc = String(resolved.description || '');
        desc = desc.replace(/WIS modifier/gi, String(wisModifier));
        desc = desc.replace(/spell attack modifier/gi, `+${spellAttackMod}`);
        // MA-1344: caster-dependent grapple escape DC (Beast of the Sea —
        // "escape DC = 8 + Proficiency Bonus + WIS modifier"). Same caster-
        // fold seam as the WIS / spell-attack tokens above; the disk row
        // authors hit_conditions only (never a baked escape_dc — the row is
        // merged per-caster here). The MA-0010 hit-clause consumer
        // (buildHitConditionClause → handlePlainDamage.applyHitClause-
        // Conditions) reads escape_dc + grants Grappled with
        // meta {dc, ability:'str', source}. Rows without authored
        // hit_conditions stay byte-inert.
        if (Array.isArray(resolved.hit_conditions) && resolved.hit_conditions.length > 0 && resolved.escape_dc == null) {
            resolved.escape_dc = 8 + proficiencyBonus + wisModifier;
        }
        if (hasBestialFury && resolved.name && resolved.name.includes("Beast's Strike")) {
            desc += ' (can be used twice per turn)';
            resolved.damage_type_primary = 'Force';
            desc = desc.replace(/Bludgeoning\/Piercing\/Slashing/gi, 'Force')
                .replace(/Bludgeoning\/Piercing/gi, 'Force')
                .replace(/Slashing/gi, 'Force')
                .replace(/Piercing/gi, 'Force')
                .replace(/Bludgeoning/gi, 'Force');
            // Gate/rider arm ONLY the weapon attack row — save rows
            // ("Beast's Strike — Charge/Grapple", save_dc) never pass through
            // the attack-chip press or hit-confirmed auto-damage seam.
            if (resolved.save_dc == null) {
                resolved.bestial_fury_double_strike = true;
                resolved.bestial_fury_bonus = bestialFuryBonus || { expression: '1d6', damageType: 'Force' };
            }
        }
        resolved.description = desc;
        if (resolved.attack_bonus === null || resolved.attack_bonus === undefined) {
            resolved.attack_bonus = spellAttackMod;
        }
        if (resolved.save_dc != null && resolved.save_dc === 20) {
            resolved.save_dc = spellSaveDc;
        }
        return resolved;
    });

    actions.push({
        name: "Exceptional Training",
        description: `Bonus Action: The beast can take the Dash, Disengage, Dodge, or Help action. It can deal Force damage instead of its normal damage type.`,
    });

    return actions;
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionKey = 'primalCompanionType';
    const stored = getRuntimeValue(playerName, companionKey, campaignName);

    if (!stored) {
        return {
            type: 'modal',
            modalName: 'primalCompanionSummon',
            payload: { action, playerStats, campaignName },
        };
    }

    const combatSummary = getCombatSummary(campaignName);
    const companionInCombat = combatSummary?.creatures?.some(
        c => c.name === `Primal Companion (${stored})`
    );

    if (!companionInCombat) {
        return {
            type: 'modal',
            modalName: 'primalCompanionSummon',
            payload: { action, playerStats, campaignName },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${stored} companion is active.`,
            automation: auto,
        },
    };
}

function resolveCompanionInitiative(casterCreature) {
    let initiativeValue = 0;
    if (casterCreature?.initiative !== '' && casterCreature?.initiative !== undefined) {
        initiativeValue = parseInt(casterCreature.initiative, 10) || 0;
    }
    const casterInitBonus = casterCreature?.initiativeBonus || 0;
    return initiativeValue || (Math.floor(Math.random() * 20) + 1 + casterInitBonus);
}

export async function confirmPrimalCompanionSummon(action, playerStats, campaignName, selectedType) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (!selectedType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No companion type selected.',
                automation: auto,
            },
        };
    }

    const monsterIndex = TYPE_TO_MONSTER_INDEX[selectedType];
    if (!monsterIndex) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Unknown companion type: ${selectedType}.`,
                automation: auto,
            },
        };
    }

    const casterName = playerStats.name;
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Failed to load combat summary.',
                automation: auto,
            },
        };
    }

    const monsters = await loadMonsters();
    const monster = monsters.find(m => m.index === monsterIndex);
    if (!monster) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Failed to load ${selectedType} monster data.`,
                automation: auto,
            },
        };
    }

    const companionTypeConfig = auto.companionTypes?.find(ct => ct.name === selectedType);
    if (!companionTypeConfig) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Unknown companion type: ${selectedType}.`,
                automation: auto,
            },
        };
    }

    const rangerLevel = playerStats.level || 3;
    const wisModifier = getWisdomModifier(playerStats);
    const spellAttackMod = getSpellAttackModifier(playerStats);
    const proficiencyBonus = playerStats.proficiency || 2;
    const spellSaveDc = playerStats.spellAbilities?.saveDc || (8 + proficiencyBonus + wisModifier);

    const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
    const initiativeValue = resolveCompanionInitiative(casterCreature);

    const displayName = `Primal Companion (${selectedType})`;

    const hasBestialFury = hasFeature(playerStats, 'Bestial Fury');
    const bestialFuryBonus = resolveBestialFuryBonus(playerStats);

    const creature = buildPrimalCompanionCreature({ monster, companionTypeConfig, displayName, initiativeValue, rangerLevel, wisModifier, spellAttackMod, proficiencyBonus, spellSaveDc, hasBestialFury, casterName, bestialFuryBonus });
    combatSummary.creatures.push(creature);

    let targetEffects = getTargetEffects();
    const existingSummoned = targetEffects.find(
        te => te.target === creature.name && te.effect === 'summoned' && te.source === casterName
    );
    if (!existingSummoned) {
        targetEffects.push({ target: creature.name, source: casterName, effect: 'summoned' });
    }

    combatSummary.creatures.sort((a, b) => {
        const aInit = a.initiative === '' || a.initiative === undefined ? 0 : Number(a.initiative);
        const bInit = b.initiative === '' || b.initiative === undefined ? 0 : Number(b.initiative);
        return bInit - aInit;
    });

    storage.set('combatSummary', cloneDeep(combatSummary), campaignName);
    setRuntimeValue('campaign', 'targetEffects', targetEffects, campaignName);
    await setRuntimeValue(playerName, 'primalCompanionType', selectedType, campaignName);
    await setRuntimeValue(playerName, 'primalCompanionAlive', true, campaignName);
    window.dispatchEvent(new CustomEvent('initiative-rolled'));

    await addEntry(campaignName, {
        type: 'summons',
        characterName: casterName,
        summonName: 'Primal Companion',
        description: `${casterName} summons a Primal Companion (${selectedType}).`,
        summonedCreatures: [creature.name],
        timestamp: Date.now(),
    }).catch((e) => { console.error("[primalCompanionHandler:log-error]", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${casterName} summons a Primal Companion (${selectedType}). It acts on your turn, right after you.`,
            automation: auto,
        },
        logEntries: [{
            type: 'summons',
            characterName: casterName,
            summonName: 'Primal Companion',
            description: `${casterName} summons a Primal Companion (${selectedType}).`,
            summonedCreatures: [creature.name],
            timestamp: Date.now(),
        }],
    };
}

export async function handleCommand(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion summoned.',
                automation: auto,
            },
        };
    }

    let description = `${action.name}: Commanded ${companionType} to use Beast's Strike.`;

    const hasBestialFury = hasFeature(playerStats, 'Bestial Fury');
    if (hasBestialFury) {
        description += ' Bestial Fury: beast attacks twice!';
        // CLA-036 lane (a): the command ARMS the companion's double-strike
        // economy — counter keyed on companion name + round (threaded FRESH
        // getCurrentCombatRound per playbook §40; re-issue resets within the
        // round). MonsterCardModal's Beast's Strike chip press consumes via
        // resolveBestialFuryStrikeGate; a third press refuses zero-roll.
        const companionName = `Primal Companion (${companionType})`;
        const round = getCurrentCombatRound(campaignName);
        await setRuntimeValue(companionName, BESTIAL_FURY_STRIKES_KEY, { round, used: 0 }, campaignName);
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'bestial_fury_command',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} commands ${companionName} to take Beast's Strike — Bestial Fury grants 2 strikes this turn.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[primalCompanionHandler:command-log-error]', e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: description,
            automation: auto,
        },
    };
}

// CLA-036 lane (a): double-strike economy gate for the companion card's
// Beast's Strike chip press (MonsterCardModal.handleAttack). Byte-inert for
// every row without the structured `bestial_fury_double_strike` stamp.
// Counter `{ round, used }` lives on the companion's runtime key; a stale
// round reads as freshly armed (implicit command), handleCommand re-issues
// reset the same-round count. Third press in the round refuses with popup +
// `bestial_fury_refused` automation log, zero roll (§41 refusal convention).
export function resolveBestialFuryStrikeGate({ campaignName, monsterName, action, setPopupHtml }) {
    if (action?.bestial_fury_double_strike !== true) return false;
    const round = getCurrentCombatRound(campaignName);
    const stored = getRuntimeValue(monsterName, BESTIAL_FURY_STRIKES_KEY, campaignName);
    const state = (stored && stored.round === round) ? stored : { round, used: 0 };
    if (state.used >= 2) {
        if (setPopupHtml) {
            setPopupHtml({
                type: 'automation_info',
                name: 'Bestial Fury',
                description: `${monsterName} has already taken both Beast's Strike attacks granted by the command this turn — attack refused.`,
            });
        }
        addEntry(campaignName, {
            type: 'automation',
            automationType: 'bestial_fury_refused',
            characterName: monsterName,
            abilityName: action.name || "Beast's Strike",
            description: `${monsterName}: Beast's Strike refused (bestial_fury_refused — 2 strikes already used this command).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[primalCompanionHandler:refusal-log-error]', e); });
        return true;
    }
    setRuntimeValue(monsterName, BESTIAL_FURY_STRIKES_KEY, { round, used: state.used + 1 }, campaignName);
    return false;
}

// CLA-036: read the app-data Bestial Fury bonus (Hunter's Mark is a flat
// 1d6 Force at every slot level — the feature automation damageExpression is
// the builder read; never hunterMarkStrikeExpression's upcast ladder).
export function resolveBestialFuryBonus(playerStats) {
    const furyAuto = (playerStats.class?.major?.features || []).find(f => f.name === 'Bestial Fury')?.automation || [];
    const furyDamageAuto = furyAuto.find(a => a.type === 'primal_companion_double_strike_damage');
    return {
        expression: furyDamageAuto?.damageExpression || '1d6',
        damageType: furyDamageAuto?.damageType || 'Force',
    };
}

// CLA-036 lane (b): is the summoner's cs concentration Hunter's Mark on this
// target? cs `concentration` is the machine channel (spellPreparationService
// .applyNewConcentration carries target; CreatureCard.jsx mark-badge twin).
function hunterMarkArmedOnTarget(campaignName, monsterName, targetName) {
    const cs = getCombatSummary(campaignName);
    const companion = cs?.creatures?.find(c => c.name === monsterName);
    const caster = cs?.creatures?.find(c => c.name === companion?.summonedBy);
    const conc = caster?.concentration;
    if (conc?.spell !== "Hunter's Mark") return false;
    return !conc.target || conc.target === targetName;
}

// CLA-036 lane (b): Hunter's Mark extra-Force rider on a HIT companion
// Beast's Strike (hit-confirmed auto-damage seam, MA-0007 charge-bonus
// separate-leg template). The trigger event `companion_beasts_strike_hit`
// logs EVERY fury hit; the bonus folds ONCE per companion per round
// (`_BestialFury_markBonusRound` latch, sneak-step convention) when the
// summoner's cs concentration is Hunter's Mark on this target. Separate roll
// + own `roll damage` log leg (1d6 Force); dice NEVER doubled on crit
// (mirrors verified huntersMarkDamage sibling).
export async function resolveBestialFuryMarkStrike({ campaignName, monsterName, autoDamage, rollDamage }) {
    if (autoDamage?.bestialFuryRider !== true) return null;
    const round = getCurrentCombatRound(campaignName);
    const attackName = autoDamage.name || "Beast's Strike";
    const targetName = autoDamage.targetName || null;

    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'companion_beasts_strike_hit',
        characterName: monsterName,
        abilityName: attackName,
        description: `${monsterName} hits ${targetName || 'its target'} with ${attackName} (companion_beasts_strike_hit).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[primalCompanionHandler:trigger-log-error]', e); });

    const usedRound = getRuntimeValue(monsterName, BESTIAL_FURY_MARK_LATCH_KEY, campaignName);
    if (Number(usedRound) === round) {
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'bestial_fury_refused',
            characterName: monsterName,
            abilityName: attackName,
            description: `${monsterName}: Bestial Fury Hunter's Mark bonus already applied this turn (once per turn) — no extra damage.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[primalCompanionHandler:refusal-log-error]', e); });
        return null;
    }

    if (!hunterMarkArmedOnTarget(campaignName, monsterName, targetName)) return null;

    const expression = autoDamage.bestialFuryBonus?.expression || '1d6';
    const damageType = autoDamage.bestialFuryBonus?.damageType || 'Force';
    const result = rollExpression(expression);
    if (!result) {
        console.error('[primalCompanionHandler] Bestial Fury bonus roll failed for formula', expression);
        return null;
    }

    await rollDamage({
        name: `${attackName} — Bestial Fury`,
        formula: expression,
        total: result.total,
        rolls: result.rolls,
        modifier: 0,
        context: { damageType, targetName, attackerName: monsterName },
    });
    // Latch stamp awaited BEFORE the next rider read consumes it (§40).
    await setRuntimeValue(monsterName, BESTIAL_FURY_MARK_LATCH_KEY, round, campaignName);

    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'bestial_fury_mark_bonus',
        characterName: monsterName,
        abilityName: attackName,
        description: `${monsterName} deals extra ${expression} ${damageType} (Hunter's Mark on ${targetName}) — Bestial Fury ${result.total} ${damageType}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[primalCompanionHandler:grant-log-error]', e); });

    return result;
}

export async function handleRestore(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to restore.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'primalCompanionAlive', true, campaignName);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${companionType} restored with full HP after 1 minute.`,
            automation: auto,
        },
    };
}

export async function handleBonusActionCommand(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to command.',
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'primalCompanionBonusActionCommand',
        payload: {
            action,
            playerStats,
            campaignName,
            companionType,
        },
    };
}

const BONUS_ACTION_COMMANDS = [
    { name: 'Dash', description: 'Double movement speed this turn' },
    { name: 'Disengage', description: 'Movement doesn\'t trigger opportunity attacks' },
    { name: 'Dodge', description: 'Attackers have disadvantage against the companion' },
    { name: 'Help', description: 'Next ally attack against a target has advantage' },
];

export async function applyBonusActionCommand(action, playerStats, campaignName, selectedAction, useForceDamage) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);

    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to command.',
                automation: auto,
            },
        };
    }

    const commandAction = BONUS_ACTION_COMMANDS.find(c => c.name === selectedAction);
    if (!commandAction) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No action selected.',
                automation: auto,
            },
        };
    }

    let message = `${action.name}: Commanded ${companionType} to take a ${selectedAction} action as a Bonus Action.`;
    if (useForceDamage && auto.forceDamageOption) {
        message += ` Companion deals Force damage instead of its normal damage type.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: message,
            automation: auto,
        },
    };
}
