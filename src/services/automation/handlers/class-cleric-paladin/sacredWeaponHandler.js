import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration, KEY } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

// 10 minutes × 10 rounds/minute — expirationQueue round-based pattern
// (naturesSanctuaryHandler precedent: 1 minute = 10 rounds).
const SACRED_WEAPON_ROUNDS = 100;

const LIGHT_TEXT = 'Your melee weapon sheds bright light in a 20-foot radius and dim light for an additional 20 feet.';

function getMaxCharges(playerStats) {
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    return classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
}

function getRemainingCharges(playerStats, campaignName) {
    const stored = getRuntimeValue(playerStats.name, 'channelDivinityCharges', campaignName);
    return stored != null ? Number(stored) : getMaxCharges(playerStats);
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === action.name);

    if (wasActive) {
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

        // Drop the queued 10-minute expiry so it cannot kill a future re-activation.
        const expirations = getRuntimeValue(playerName, KEY, campaignName);
        if (Array.isArray(expirations) && expirations.length) {
            const kept = expirations.filter(e => !(e.effects || []).some(ef => ef.type === 'remove_active_buff' && ef.buffName === action.name));
            if (kept.length !== expirations.length) {
                setRuntimeValue(playerName, KEY, kept, campaignName);
            }
        }

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} ended ${action.name}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[sacredWeaponHandler] End log error:', e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} ended`,
                automation: auto,
            },
        };
    }

    const currentCharges = getRemainingCharges(playerStats, campaignName);

    if (currentCharges <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: 'No Channel Divinity charges remaining.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'channelDivinityCharges', currentCharges - 1, campaignName);

    const options = auto.options || [];
    if (options.length > 0) {
        return {
            type: 'modal',
            modalName: 'sacredWeaponDamageType',
            payload: {
                action,
                playerStats,
                campaignName,
            },
        };
    }

    return activateSacredWeapon(action, playerStats, campaignName, null);
}

// CLA-301: refund the charge spent by handle() when the picker modal is cancelled.
export async function cancelSacredWeapon(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const stored = getRuntimeValue(playerName, 'channelDivinityCharges', campaignName);
    if (stored == null) return;
    const max = getMaxCharges(playerStats);
    await setRuntimeValue(playerName, 'channelDivinityCharges', Math.min(max, Number(stored) + 1), campaignName);
}

export async function applyDamageTypeChoice(action, playerStats, campaignName, chosenOptionName) {
    return activateSacredWeapon(action, playerStats, campaignName, chosenOptionName);
}

async function activateSacredWeapon(action, playerStats, campaignName, chosenOptionName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const chosen = chosenOptionName
        ? (auto.options || []).find(o => o.name === chosenOptionName)
        : null;

    const buff = {
        name: action.name,
        effect: 'sacred_weapon',
        duration: auto.duration || '10_minutes',
        damageTypeChoice: chosen?.damageType || null,
    };

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = [...activeBuffs.filter(b => b.name !== action.name), buff];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    addExpiration({ attackerName: playerName, targetName: playerName, effects: [
        { type: 'remove_active_buff', buffName: action.name },
    ], campaignName, rounds: SACRED_WEAPON_ROUNDS });

    const chaMod = Math.max(1, getAbilityModifier(playerStats.abilities, 'CHA'));
    const charges = getRemainingCharges(playerStats, campaignName);
    const max = getMaxCharges(playerStats);
    const damageText = chosen?.damageType === 'Radiant'
        ? 'hits deal Radiant damage'
        : 'hits deal the weapon\u0027s normal damage type';

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} (Channel Divinity) \u2014 imbued weapon with positive energy for 10 minutes: +${chaMod} to attack rolls (min +1), ${damageText}. ${LIGHT_TEXT} Channel Divinity: ${charges}/${max}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[sacredWeaponHandler] Activation log error:', e); });

    const damageTypeText = chosen
        ? ` Damage type set to ${chosen.damageType}.`
        : '';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated for 10 minutes. ${LIGHT_TEXT} Add your Charisma modifier to attack rolls (minimum +1).${damageTypeText} Channel Divinity: ${charges}/${max}.`,
            automation: auto,
        },
    };
}
