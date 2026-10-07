import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { parseMagicItemName } from '../core/attackWeaponUtils.js';
import { loadEquipment } from '../../ui/dataLoader.js';
import { addEntry } from '../../ui/logService.js';

/**
 * SP-074: canonical 2024 Mage Armor — "The spell ends early if the target dons
 * armor." The Edit wizard's Inventory step (16) is the live donning seam: when a
 * save ADDS an armored item to inventory.equipped (CLA-225 armor-category catalog
 * lookup via the same predicate speedUtils.checkAnyArmor uses — never a name
 * heuristic), the mage_armor buff is stripped from the runtime store in ONE write
 * (§39 spread new array) and logged. Mirrors the invisibilityService buff-strip
 * endOnHostileAction shape. Unequipping never restores the spell (RAW).
 */
function armorNamesOf(names, allEquipment) {
    return names.filter(name => {
        const raw = String(name || '');
        const noSuffix = raw.includes('(') ? raw.substring(0, raw.indexOf('(')).trim() : raw;
        const { baseName } = parseMagicItemName(noSuffix);
        const item = allEquipment.find(eq => eq.name === baseName || eq.name === noSuffix || eq.name === raw);
        return Boolean(item && item.armor_category && item.armor_category !== 'Shield');
    });
}

export async function endMageArmorOnDonning(originalCharacter, characterData, campaignName) {
    if (!characterData?.name || !campaignName) return false;

    const originalEquipped = Array.isArray(originalCharacter?.inventory?.equipped) ? originalCharacter.inventory.equipped : [];
    const equipped = Array.isArray(characterData?.inventory?.equipped) ? characterData.inventory.equipped : [];
    const added = equipped.filter(name => !originalEquipped.some(o => String(o).toLowerCase() === String(name).toLowerCase()));
    if (added.length === 0) return false;

    const allEquipment = await loadEquipment();
    const donnedArmor = armorNamesOf(added, allEquipment);
    if (donnedArmor.length === 0) return false;

    const stored = getRuntimeValue(characterData.name, 'activeBuffs', campaignName) || [];
    const buffs = Array.isArray(stored) ? stored : [];
    const mageArmors = buffs.filter(b => b.effect === 'mage_armor');
    if (mageArmors.length === 0) return false;

    setRuntimeValue(characterData.name, 'activeBuffs', buffs.filter(b => b.effect !== 'mage_armor'), campaignName);
    addEntry(campaignName, {
        type: 'automation',
        automationType: 'mage_armor_ends',
        characterName: characterData.name,
        abilityName: 'Mage Armor',
        description: `${characterData.name} dons ${donnedArmor.join(', ')} — Mage Armor ends early (armor donned).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[mageArmorService:end-on-donning]', e); });
    return true;
}
