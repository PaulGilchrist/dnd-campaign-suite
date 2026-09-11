import { toggleBuff, isBuffActive } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { handle as handleTeleport } from '../class-warlock/tempTeleportHandler.js';
import { handle as handleVowOfEnmity } from '../class-cleric-paladin/vowOfEnmityHandler.js';
import { handle as handleSacredWeapon } from '../class-cleric-paladin/sacredWeaponHandler.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary, loadCombatSummary } from '../../../encounters/combatData.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { setTempHp } from './tempHpService.js'
import { cleanupWildShape } from '../class-druid/wildShapeCreatureBuilder.js';
import { addEntry } from '../../../ui/logService.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

const ADRENALINE_RUSH_USES_KEY = 'adrenalineRushUses';
const PSYCHIC_WHISPERS_FREE_KEY = 'psychicWhispersFreeUsed';
const PSYCHIC_WHISPERS_TARGETS_KEY = 'psychicWhispersTargets';

const TELEPORT_EFFECTS = new Set([
    'teleport_on_rage',
    'teleport_swap_with_illusion',
    'shadow_step_teleport',
    'moonlight_step_teleport',
    'bonus_teleport',
]);

// Effect → dedicated handler delegations performed before generic buff handling.
const EFFECT_DELEGATES = {
    // Vow of Enmity: delegate to dedicated handler
    vow_of_enmity: handleVowOfEnmity,
    // Sacred Weapon (CLA-301): delegate to dedicated Channel Divinity spend +
    // damage-type picker handler — the generic temp_buff path granted the buff
    // for free and dropped the options picker.
    sacred_weapon: handleSacredWeapon,
    // Adrenaline Rush: bonus action dash with temp HP, uses = proficiency_bonus, short_rest recharge
    bonus_action_dash: handleBonusActionDash,
    // Blessing of the Trickster: defer to modal for ally selection
    advantage_on_stealth: handleTricksterBlessing,
    // Corona of Light: defer to modal for enemy selection
    sunlight_aura: handleCoronaOfLight,
};

function getPsionicEnergy(playerStats, campaignName) {
    const stored = getRuntimeValue(playerStats.name, 'psionicEnergy', campaignName);
    const defaultMax = playerStats._trackedResources?.psionicEnergy?.max || 0;
    return Number(stored ?? defaultMax);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const delegate = auto?.effect ? EFFECT_DELEGATES[auto.effect] : null;
    if (delegate) {
        return delegate(action, playerStats, campaignName, _mapName);
    }

    // dash_action trigger: temporary speed bonus
    if (auto?.trigger === 'dash_action' && auto?.effect === 'speed_bonus') {
        const dashPopup = handleDashSpeedBonus(action, auto, playerStats, campaignName);
        if (dashPopup) return dashPopup;
    }

    // Check requiredLevel before allowing the buff (e.g., Draconic Flight at level 5)
    if (auto?.requiredLevel && playerStats.level < auto.requiredLevel) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires character level ${auto.requiredLevel}. You are level ${playerStats.level}.`,
                automation: auto,
            },
        };
    }

    // Check long rest recharge for traits with no explicit uses field
    const longRestPopup = buildLongRestRechargePopup(action, auto, playerStats, campaignName);
    if (longRestPopup) return longRestPopup;

    if (TELEPORT_EFFECTS.has(auto?.effect)) {
        return handleTeleport(action, playerStats, campaignName, _mapName);
    }

    // Telepathic Speech: defer to modal for target selection
    if (auto?.effect === 'telepathic_speech') {
        // CLA-276: Psychic Whispers is the multi-target psionic variant
        // (data declares multiTarget + targets cap + psionic die cost)
        if (auto?.multiTarget) {
            return handlePsychicWhispers(action, playerStats, campaignName, _mapName);
        }
        return handleTelepathicSpeech(action, playerStats, campaignName, _mapName);
    }

    let targetName = resolveWillingTargetName(auto, playerStats, campaignName);

    // Wild Shape: uses gate applies to the ON leg only — toggling OFF must
    // always be able to end the form, even at 0 uses (CLA-391).
    if (auto?.effect === 'shape_shift') {
        return handleShapeShift(action, auto, playerStats, campaignName, targetName);
    }

    // Tracked uses consumption for temp_buff features that declare uses (e.g., Psychic Veil: 1 use per Long Rest)
    let usesKey = null;
    let usesRemaining = null;
    if (auto?.uses != null || auto?.usesMax != null) {
        const usesMax = resolveBuffUsesMax(auto, playerStats);
        usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
        const gate = await gateBuffUses(action, auto, playerStats, campaignName, usesMax, usesKey);
        if (gate.popup) return gate.popup;
        usesRemaining = gate.usesRemaining;
    }

    const { wasActive } = toggleBuff(
        playerStats.name,
        action.name,
        auto,
        campaignName,
        targetName
    );

    // Consumption happens on activation only; toggling OFF does not refund the use.
    let usesAfterActivation = null;
    if (usesKey != null && !wasActive) {
        usesAfterActivation = Math.max(0, usesRemaining - 1);
        await setRuntimeValue(playerStats.name, usesKey, usesAfterActivation, campaignName);
    }

    if (usesKey != null && !wasActive) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${playerStats.name} activated ${action.name} (${usesAfterActivation} use${usesAfterActivation !== 1 ? 's' : ''} remaining).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[buffHandler] Tracked buff activation log error:', e); });
    }

    await applyGenericBuffSideEffects(action, auto, playerStats, targetName, campaignName, wasActive);

    return buildBuffTogglePopup(action, auto, playerStats, targetName, wasActive, usesKey, usesAfterActivation);
}

function resolveWillingTargetName(auto, playerStats, campaignName) {
    if (auto?.target !== 'willing_creature') return playerStats.name;
    const combatSummary = getCombatSummary(campaignName);
    const target = combatSummary ? getTargetFromAttacker(combatSummary, playerStats.name) : null;
    return target ? target.name : playerStats.name;
}

function buildLongRestRechargePopup(action, auto, playerStats, campaignName) {
    if (!(auto?.recharge === 'long_rest' && !auto?.uses)) return null;
    const stored = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    if (!activeBuffs.some(b => b.name === action.name)) return null;
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name} has been used and cannot be used again until a Long Rest.`,
            automation: auto,
        },
    };
}

async function applyGenericBuffSideEffects(action, auto, playerStats, targetName, campaignName, wasActive) {
    if (auto?.effect === 'invisible') {
        applyInvisibilityToggle(targetName, playerStats, campaignName, wasActive);
    }

    if (auto?.effect === 'see_invisibility') {
        logSeeInvisibilityToggle(action, playerStats, campaignName, wasActive);
    }

    if (auto?.effect === 'haste') {
        await handleHasteToggle(action, playerStats, targetName, campaignName, wasActive);
    }

    if (!wasActive && auto?.tempHpExpression) {
        const amount = evaluateAutoExpression(auto.tempHpExpression, playerStats);
        if (typeof amount === 'number' && amount > 0) {
            setTempHp(playerStats.name, amount, campaignName);
        }
    }
}

function buildBuffTogglePopup(action, auto, playerStats, targetName, wasActive, usesKey, usesAfterActivation) {
    const displayTarget = targetName === playerStats.name ? 'yourself' : targetName;
    let durationDisplay = auto.duration || '10 min';
    if (auto.effect === 'shape_shift' && durationDisplay === 'half_druid_level_hours') {
        durationDisplay = `${Math.floor((playerStats.level || 0) / 2)} hours`;
    }
    const usesDisplay = usesKey != null && !wasActive
        ? ` (${usesAfterActivation} use${usesAfterActivation !== 1 ? 's' : ''} remaining)`
        : '';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: wasActive
                ? `${action.name} toggled OFF`
                : `${action.name} activated on ${displayTarget} (${durationDisplay})${usesDisplay}`,
            automation: auto,
        },
    };
}

function handleDashSpeedBonus(action, auto, playerStats, campaignName) {
    const bonusMatch = String(auto.bonus || '0 ft').match(/(\d+)/);
    const bonusAmount = bonusMatch ? parseInt(bonusMatch[1], 10) : 0;
    if (bonusAmount <= 0) return null;

    const storedBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const buffs = Array.isArray(storedBuffs) ? storedBuffs : [];
    const dashBuff = buffs.find(b => b.name === action.name && b.tempBuff);
    if (!dashBuff) {
        setRuntimeValue(playerStats.name, 'activeBuffs', [
            ...buffs,
            { name: action.name, tempBuff: true, speedBonus: bonusAmount, duration: auto.duration || 'same_action' },
        ], campaignName);
    }
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: +${bonusAmount} ft Speed for this Dash action.`,
            automation: auto,
        },
    };
}

// Wild Shape ON leg consumes a use, shows the form chooser; OFF leg cleans up (CLA-391).
async function handleShapeShift(action, auto, playerStats, campaignName, targetName) {
    const storedWSBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const formActive = (Array.isArray(storedWSBuffs) ? storedWSBuffs : []).some(b => b.name === action.name);
    if (!formActive) {
        const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
        const currentWS = Number(getRuntimeValue(playerStats.name, 'wildShapeUses', campaignName) ?? maxWS);
        if (currentWS <= 0) {
            addEntry(campaignName, {
                type: 'automation',
                automationType: 'wild_shape_refused',
                characterName: playerStats.name,
                creatureName: playerStats.name,
                name: action.name,
                description: `${action.name}: No Wild Shape uses remaining.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[buffHandler] Wild Shape refusal log error:', e); });
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
    }

    const { wasActive } = toggleBuff(
        playerStats.name,
        action.name,
        auto,
        campaignName,
        targetName
    );

    if (!wasActive) {
        return {
            type: 'popup',
            payload: {
                type: 'wild_shape_select',
                action: action,
                playerStats: playerStats,
                campaignName: campaignName,
            },
        };
    }

    cleanupWildShape(playerStats.name, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} deactivated Wild Shape.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[buffHandler] Wild Shape log error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} toggled OFF`,
            automation: auto,
        },
    };
}

function resolveBuffUsesMax(auto, playerStats) {
    if (typeof auto.usesMax === 'number') return auto.usesMax;
    if (typeof auto.uses === 'number') return auto.uses;
    if (typeof auto.uses === 'string' && /^\d+$/.test(auto.uses)) return parseInt(auto.uses, 10);
    if (auto.uses === 'proficiency_bonus') return playerStats.proficiency || 0;
    return 1;
}

async function gateBuffUses(action, auto, playerStats, campaignName, usesMax, usesKey) {
    const storedUses = getRuntimeValue(playerStats.name, usesKey, campaignName);
    const usesRemaining = storedUses != null ? Number(storedUses) : usesMax;

    const storedBuffsBefore = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const buffActiveBefore = (Array.isArray(storedBuffsBefore) ? storedBuffsBefore : []).some(b => b.name === action.name);

    if (usesRemaining > 0 || buffActiveBefore) {
        return { popup: null, usesRemaining };
    }

    if (auto.resourceCost === 'psionic_energy' && getPsionicEnergy(playerStats, campaignName) > 0) {
        const psionicCurrent = getPsionicEnergy(playerStats, campaignName);
        await setRuntimeValue(playerStats.name, 'psionicEnergy', psionicCurrent - 1, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${playerStats.name} expended 1 Psionic Energy Die to restore a use of ${action.name}. Psionic Energy: ${psionicCurrent - 1}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[buffHandler] Psionic restore log error:', e); });
        return { popup: null, usesRemaining };
    }

    return {
        popup: {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} has been used and cannot be used again until a Long Rest.`,
                automation: auto,
            },
        },
    };
}

function applyInvisibilityToggle(targetName, playerStats, campaignName, wasActive) {
    const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const invisKey = `_activeInvisibility_${targetName}`;
    if (!wasActive) {
        if (!conditions.some(c => String(c).toLowerCase() === 'invisible')) {
            setRuntimeValue(targetName, 'activeConditions', [...conditions, 'invisible'], campaignName);
        }
        setRuntimeValue('campaign', invisKey, playerStats.name, campaignName);
    } else {
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'invisible');
        if (filtered.length !== conditions.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        }
        setRuntimeValue('campaign', invisKey, null, campaignName);
    }
}

function logSeeInvisibilityToggle(action, playerStats, campaignName, wasActive) {
    const description = wasActive
        ? `${playerStats.name} deactivated See Invisibility.`
        : `See Invisibility activated for 1 hour. You can see invisible creatures and objects within 30 feet.`;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[buffHandler] See Invisibility log error:', e); });
}

async function handleHasteToggle(action, playerStats, targetName, campaignName, wasActive) {
    if (!wasActive) {
        addExpiration(playerStats.name, targetName, [
            { type: 'remove_active_buff', buffName: action.name }
        ], campaignName);
        return;
    }
    const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'speed_zero');
    if (filtered.length !== conditions.length) {
        await setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }
}

async function handleCoronaOfLight(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if corona is already active
    const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(storedBuffs) ? storedBuffs : [];
    const wasActive = activeBuffs.some(b => b.effect === 'sunlight_aura');

    if (wasActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} is already active. It expires after 1 minute (10 rounds) or on a short/long rest.`,
                automation: auto,
            },
        };
    }

    // Fetch fresh creature targets from server (exclude self)
    const combatSummary = await loadCombatSummary(campaignName);
    const creatureTargets = combatSummary?.creatures
        ? combatSummary.creatures
            .filter(c => c.name !== playerName)
        : [];

    return {
        type: 'modal',
        modalName: 'coronaEnemySelection',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
        },
    };
}

async function handleBonusActionDash(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Adrenaline Rush';

    const usesKey = ADRENALINE_RUSH_USES_KEY;

    let usesMax;
    if (auto.uses === 'proficiency_bonus') {
        usesMax = playerStats.proficiency || 0;
    } else if (typeof auto.uses === 'number') {
        usesMax = auto.uses;
    } else {
        usesMax = auto.usesMax != null ? auto.usesMax : 1;
    }

    const stored = getRuntimeValue(playerName, usesKey, campaignName);
    const usesRemaining = stored != null ? Number(stored) : usesMax;
    const canUse = usesRemaining > 0;

    if (!canUse) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName} has no uses remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    if (auto?.bonusEffect === 'temp_hp' && auto?.bonusExpression) {
        const tempHpAmount = evaluateAutoExpression(auto.bonusExpression, playerStats);
        if (typeof tempHpAmount === 'number' && tempHpAmount > 0) {
            setTempHp(playerName, tempHpAmount, campaignName);
        }
    }

    const newUses = usesRemaining - 1;
    await setRuntimeValue(playerName, usesKey, newUses, campaignName);

    const tempHpAmount = auto?.bonusEffect === 'temp_hp' && auto?.bonusExpression
        ? evaluateAutoExpression(auto.bonusExpression, playerStats)
        : 0;

    const tempHpDesc = tempHpAmount > 0
        ? ` Gained ${tempHpAmount} temporary hit points.`
        : '';

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName}: Dash as a Bonus Action.${tempHpDesc} (${newUses} use${newUses !== 1 ? 's' : ''} remaining).`,
    }).catch((e) => { console.error("[buffHandler:log-error]", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName}: You take the Dash action as a Bonus Action.${tempHpDesc} (${newUses} use${newUses !== 1 ? 's' : ''} remaining).`,
            automation: auto,
        },
    };
}

export function restoreAdrenalineRushUses(playerName, campaignName) {
    setRuntimeValue(playerName, ADRENALINE_RUSH_USES_KEY, null, campaignName);
}

async function handleTricksterBlessing(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Blessing of the Trickster';

    const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(storedBuffs) ? storedBuffs : [];
    const wasActive = activeBuffs.some(b => b.name === featureName);

    if (wasActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} is already active. It expires after a Long Rest or when you use this feature again.`,
                automation: auto,
            },
        };
    }

    const combatSummary = await loadCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];
    const allyTargets = allCreatures
        .filter(c => c.type === 'player' || c.type === 'npc' || c.type === 'monster')
        .map(c => ({
            name: c.name,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            size: c.size,
            type: c.type,
        }));

    return {
        type: 'modal',
        modalName: 'tricksterBlessing',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets: allyTargets,
        },
    };
}

async function handleTelepathicSpeech(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Telepathic Speech';

    const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(storedBuffs) ? storedBuffs : [];
    const wasActive = activeBuffs.some(b => b.name === featureName);

    if (wasActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} is already active.`,
                automation: auto,
            },
        };
    }

    const combatSummary = await loadCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];
    const creatureTargets = allCreatures
        .filter(c => c.name !== playerName)
        .map(c => ({
            name: c.name,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            size: c.size,
            type: c.type,
        }));

    return {
        type: 'modal',
        modalName: 'telepathicSpeech',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
        },
    };
}

export async function confirmTelepathicSpeech(action, playerStats, campaignName, targetName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Telepathic Speech';

    const chaMod = getAbilityModifier(playerStats.abilities, 'CHA');
    const miles = Math.max(1, chaMod);
    const durationMinutes = playerStats.level;

    const { wasActive } = toggleBuff(
        playerName,
        featureName,
        auto,
        campaignName,
        playerName
    );

    if (action.name === 'Awakened Mind') {
        if (!wasActive) {
            setRuntimeValue(playerName, 'awakenedMindTarget', targetName, campaignName);
        } else {
            setRuntimeValue(playerName, 'awakenedMindTarget', null, campaignName);
        }
    }

    if (!wasActive) {
        addExpiration(playerName, playerName, [
            { type: 'remove_active_buff', buffName: featureName }
        ], campaignName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated ${featureName} with ${targetName} for ${miles} mile${miles !== 1 ? 's' : ''} (duration: ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[buffHandler] Telepathic Speech log error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: wasActive
                ? `${featureName} deactivated.`
                : `${featureName} activated with ${targetName} (${miles} mile${miles !== 1 ? 's' : ''}, ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''} duration).`,
            automation: auto,
        },
    };
}

function resolvePsychicWhispersMaxTargets(auto, playerStats) {
    if (auto?.targets === 'proficiency_bonus') {
        return playerStats.proficiency || 1;
    }
    if (typeof auto?.targets === 'number') {
        return auto.targets;
    }
    return 1;
}

async function handlePsychicWhispers(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const maxTargets = resolvePsychicWhispersMaxTargets(auto, playerStats);

    const combatSummary = await loadCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];
    const creatureTargets = allCreatures
        .filter(c => c.name !== playerName)
        .map(c => ({
            name: c.name,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            size: c.size,
            type: c.type,
        }));

    const dieSize = evaluateAutoExpression('psionic_energy_die', playerStats) || 6;

    return {
        type: 'modal',
        modalName: 'psychicWhispersTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            maxTargets,
            dieSize,
        },
    };
}

export async function confirmPsychicWhispers(action, playerStats, campaignName, targetNames) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Psychic Whispers';
    const maxTargets = resolvePsychicWhispersMaxTargets(auto, playerStats);
    const finalTargets = (targetNames || []).slice(0, maxTargets);

    // First use after a Long Rest is free: the flag is nulled by LONG_REST_RESOURCES,
    // so anything other than `true` means no die has been spent since the last rest.
    const freeFlag = getRuntimeValue(playerName, PSYCHIC_WHISPERS_FREE_KEY, campaignName);
    const isFreeUse = freeFlag !== true;

    const defaultMax = playerStats._trackedResources?.psionicEnergy?.max || 0;
    const poolBefore = Number(getRuntimeValue(playerName, 'psionicEnergy', campaignName) ?? defaultMax);

    if (!isFreeUse && poolBefore <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName}: No Psionic Energy remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    const dieSize = evaluateAutoExpression('psionic_energy_die', playerStats) || 6;
    const dieRoll = Math.floor(Math.random() * dieSize) + 1;
    const hours = dieRoll;

    if (isFreeUse) {
        await setRuntimeValue(playerName, PSYCHIC_WHISPERS_FREE_KEY, true, campaignName);
    } else {
        await setRuntimeValue(playerName, 'psionicEnergy', poolBefore - 1, campaignName);
    }

    const buffAuto = {
        effect: 'telepathic_speech',
        duration: `${hours} hour${hours !== 1 ? 's' : ''}`,
        casting_time: auto?.casting_time || '1 action',
    };

    // Re-activation replaces the previous link: drop stale targets first.
    const storedPrevious = getRuntimeValue(playerName, PSYCHIC_WHISPERS_TARGETS_KEY, campaignName);
    const previousTargets = Array.isArray(storedPrevious) ? storedPrevious : [];
    for (const staleName of previousTargets) {
        if (!finalTargets.includes(staleName) && isBuffActive(staleName, featureName, campaignName)) {
            toggleBuff(staleName, featureName, buffAuto, campaignName);
        }
    }

    const { wasActive } = toggleBuff(playerName, featureName, buffAuto, campaignName);
    if (wasActive) {
        // toggleBuff removed the existing buff on re-activation — re-apply refreshed duration.
        toggleBuff(playerName, featureName, buffAuto, campaignName);
    }

    for (const targetName of finalTargets) {
        const { wasActive: targetWasActive } = toggleBuff(targetName, featureName, buffAuto, campaignName);
        if (targetWasActive) {
            // Re-link: refresh the existing buff with the new duration.
            toggleBuff(targetName, featureName, buffAuto, campaignName);
        }
    }

    await setRuntimeValue(playerName, PSYCHIC_WHISPERS_TARGETS_KEY, [...finalTargets], campaignName);

    const costText = isFreeUse
        ? 'Free first use after Long Rest — no Psionic Energy Die expended.'
        : `Expended 1 Psionic Energy Die. Psionic Energy: ${poolBefore - 1}/${defaultMax}.`;
    const linkText = finalTargets.length > 0
        ? `${finalTargets.join(', ')} can speak telepathically with ${playerName}`
        : 'no creatures were linked';

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated ${featureName}: Rolled d${dieSize} for ${hours} hour${hours !== 1 ? 's' : ''} — ${linkText} (within 35 feet). ${costText}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[buffHandler] Psychic Whispers log error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName} activated: ${linkText} for ${hours} hour${hours !== 1 ? 's' : ''} (Rolled d${dieSize}: ${dieRoll}). ${costText}`,
            automation: auto,
        },
    };
}
