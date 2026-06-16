import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';

const POLEARM_WEAPONS = ['Quarterstaff', 'Spear'];

function hasPolearmWeapon(allEquipment, equippedWeapons) {
    if (!allEquipment || !equippedWeapons) return false;
    for (const equippedName of equippedWeapons) {
        let baseName = equippedName;
        if (equippedName && typeof equippedName === 'string' && equippedName.charAt(0) === '+') {
            baseName = equippedName.substring(3);
        }
        const weapon = allEquipment.find(item => item.name === baseName);
        if (!weapon) continue;
        if (POLEARM_WEAPONS.some(pw => weapon.name === pw)) return true;
        const props = weapon.properties || [];
        if (props.includes('Heavy') && props.includes('Reach')) return true;
    }
    return false;
}

export async function handle(action, playerStats, campaignName, _mapName, allEquipment) {
    const auto = action.automation;

    if (auto?.trigger === 'after_attack_action_with_polearm' || auto?.weaponRequirement === 'quarterstaff_spear_heavy_reach') {
        const hasWeapon = hasPolearmWeapon(allEquipment, playerStats.inventory?.equipped);
        if (!hasWeapon) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} requires you to be holding a Quarterstaff, Spear, or a weapon with the Heavy and Reach properties.`,
                    automation: auto,
                },
            };
        }
    }

    const usesMax = auto.usesMax ?? 0;

    if (usesMax > 0) {
        const usesKey = auto.resourceKey || 'warPriestUses';
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has no uses remaining. Recharges on a ${auto.recharge || 'Long Rest'}.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
    }

    if (auto?.effect === 'disengage_end_grappled') {
        const storedConditions = getRuntimeValue(playerStats.name, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'grappled');
        if (filtered.length !== conditions.length) {
            await setRuntimeValue(playerStats.name, 'activeConditions', filtered, campaignName);
        }
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `You take the Disengage action and the Grappled condition ends on you.`,
                automation: auto,
            },
        };
    }

    return automationInfoPopup(action);
}
