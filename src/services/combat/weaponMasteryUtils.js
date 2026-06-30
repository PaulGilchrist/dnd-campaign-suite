import { collectWeaponMastery } from '../../services/combat/automation/automationService.js';

export function getWeaponMastery(weaponName, attack, playerStats) {
    if (playerStats.rules !== '2024') {
        return null;
    }

    const available = collectWeaponMastery(weaponName, playerStats);
    return available.baseMastery || attack?.mastery || null;
}
