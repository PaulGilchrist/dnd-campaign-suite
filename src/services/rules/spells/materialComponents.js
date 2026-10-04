import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

function getFileNameFromName(name) {
    return `${name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
}

const MATERIAL_REGISTRY = {
    'Animate Dead': { itemName: 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust', required: 'a drop of blood, a piece of flesh, and a pinch of bone dust' },
    'Create Undead': { itemName: 'Black Onyx (150 gp)', required: 'one 150+ GP black onyx stone for each corpse' },
    'Arcane Lock': { itemName: 'Gold Dust (25 gp)', required: 'gold dust worth 25+ GP, which the spell consumes' },
    'Astral Projection': { itemName: 'Jacinth (1,000 gp)', required: 'jacinth and silver bar, all of which the spell consumes' },
    'Awaken': { itemName: 'Agate (1,000 gp)', required: 'an agate worth 1,000+ GP, which the spell consumes' },
    'Clone': { itemName: 'Diamond (1,000 gp)', required: 'a diamond worth 1,000+ GP, which the spell consumes' },
    'Continual Flame': { itemName: 'Ruby Dust (50 gp)', required: 'ruby dust worth 50+ GP, which the spell consumes' },
    'Divination': { itemName: 'Incense (25 gp)', required: 'incense worth 25+ GP, which the spell consumes' },
    'Find Familiar': { itemName: 'Incense (10 gp)', required: 'burning incense worth 10+ GP, which the spell consumes' },
    'Forcecage': { itemName: 'Ruby Dust (1,500 gp)', required: 'ruby dust worth 1,500+ GP, which the spell consumes' },
    'Gentle Repose': { itemName: 'Copper Piece (2 gp)', required: '2 Copper Pieces, which the spell consumes' },
    'Glyph of Warding': { itemName: 'Powdered Diamond (200 gp)', required: 'powdered diamond worth 200+ GP, which the spell consumes' },
    'Greater Restoration': { itemName: 'Diamond Dust (100 gp)', required: 'diamond dust worth 100+ GP, which the spell consumes' },
    'Hallow': { itemName: 'Incense (1,000 gp)', required: 'incense worth 1,000+ GP, which the spell consumes' },
    "Heroes' Feast": { itemName: 'Gem-Encrusted Bowl (1,000 gp)', required: 'a gem-encrusted bowl worth 1,000+ GP, which the spell consumes' },
    'Illusory Script': { itemName: 'Ink (10 gp)', required: 'ink worth 10+ GP, which the spell consumes' },
    'Legend Lore': { itemName: 'Incense (250 gp)', required: 'incense worth 250+ GP, which the spell consumes' },
    'Magic Circle': { itemName: 'Salt and Powdered Silver (100 gp)', required: 'salt and powdered silver worth 100+ GP, which the spell consumes' },
    'Magic Mouth': { itemName: 'Jade Dust (10 gp)', required: 'jade dust worth 10+ GP, which the spell consumes' },
    'Nondetection': { itemName: 'Diamond Dust (25 gp)', required: 'a pinch of diamond dust worth 25+ GP, which the spell consumes' },
    'Planar Binding': { itemName: 'Jewel (1,000 gp)', required: 'a jewel worth 1,000+ GP, which the spell consumes' },
    'Protection from Evil and Good': { itemName: 'Flask of Holy Water (25 gp)', required: 'a flask of Holy Water worth 25+ GP, which the spell consumes' },
    'Raise Dead': { itemName: 'Diamond (500 gp)', required: 'a diamond worth 500+ GP, which the spell consumes' },
    'Reincarnate': { itemName: 'Rare Oils (1,000 gp)', required: 'rare oils worth 1,000+ GP, which the spell consumes' },
    'Resurrection': { itemName: 'Diamond (1,000 gp)', required: 'a diamond worth 1,000+ GP, which the spell consumes' },
    'Revivify': { itemName: 'Diamond (300 gp)', required: 'a diamond worth 300+ GP, which the spell consumes' },
    'Sequester': { itemName: 'Gem Dust (5,000 gp)', required: 'gem dust worth 5,000+ GP, which the spell consumes' },
    'Simulacrum': { itemName: 'Powdered Ruby (1,500 gp)', required: 'powdered ruby worth 1,500+ GP, which the spell consumes' },
    'Stone Skin': { itemName: 'Diamond Dust (100 gp)', required: 'diamond dust worth 100+ GP, which the spell consumes' },
    'Symbol': { itemName: 'Powdered Diamond (1,000 gp)', required: 'powdered diamond worth 1,000+ GP, which the spell consumes' },
    'Teleportation Circle': { itemName: 'Rare Inks (50 gp)', required: 'rare inks worth 50+ GP, which the spell consumes' },
    'True Resurrection': { itemName: 'Diamond (25,000 gp)', required: 'diamonds worth 25,000+ GP, which the spell consumes' },
    'True Seeing': { itemName: 'Mushroom Powder (25 gp)', required: 'mushroom powder worth 25+ GP, which the spell consumes' },
};

export function getConsumedMaterial(spell) {
    if (!spell || !spell.name) return null;
    return MATERIAL_REGISTRY[spell.name] || null;
}

// CLA-404: Beast Spells (Druid lv18) exception detection — a spell is blocked
// in Beast form when its Material component has a cost specified or the spell
// consumes it. Both rulesets carry cost/consumption only in the free-text
// `material` field ("worth 200+ GP", "which the spell consumes"), so the text
// is the primary detector; MATERIAL_REGISTRY is the name-based fallback for
// trimmed spell refs. Registry rows are never added for this ticket: they are
// backpack-gating consumers (useSpellMetamagicGates) and arming them is a
// separate material-economy change.
const COSTLY_OR_CONSUMED_MATERIAL_RE = /(\d[\d,]*\s*(?:gp|gold)|worth|consumes)/i;

export function spellHasCostlyOrConsumedMaterial(spell) {
    if (!spell) return false;
    const material = typeof spell.material === 'string' ? spell.material : '';
    return COSTLY_OR_CONSUMED_MATERIAL_RE.test(material) || !!getConsumedMaterial(spell);
}

export function hasMaterial(playerStats, itemName) {
    const backpack = playerStats.inventory?.backpack || [];
    return backpack.some(item => {
        const name = typeof item === 'string' ? item : (item.name || '');
        return name === itemName;
    });
}

function findItemMetaKey(inventory, itemName) {
    const meta = inventory?.itemMeta || {};
    if (itemName in meta) return itemName;
    return Object.keys(meta).find(key => key.toLowerCase() === itemName.toLowerCase()) || null;
}

export async function consumeMaterial(playerStats, itemName, campaignName) {
    const backpack = playerStats.inventory?.backpack || [];
    const materialIndex = backpack.findIndex(item => {
        const name = typeof item === 'string' ? item : (item.name || '');
        return name === itemName;
    });

    if (materialIndex === -1) {
        console.error(`[materialComponents] No ${itemName} found in backpack for ${playerStats.name}`);
        return false;
    }

    const newBackpack = [...backpack];
    const newInventory = { ...playerStats.inventory, backpack: newBackpack };

    const metaKey = findItemMetaKey(playerStats.inventory, itemName);
    const metaQuantity = metaKey ? Number(playerStats.inventory.itemMeta[metaKey]?.quantity) : NaN;
    if (Number.isFinite(metaQuantity) && metaQuantity > 1) {
        // Multiple carried: decrement quantity, keep the backpack string so
        // equipment checks (exact name match) keep finding the item.
        newInventory.itemMeta = {
            ...playerStats.inventory.itemMeta,
            [metaKey]: { ...playerStats.inventory.itemMeta[metaKey], quantity: metaQuantity - 1 },
        };
    } else {
        newBackpack.splice(materialIndex, 1);
        if (metaKey) {
            // Character PATCH deep-merges, so removed keys survive — zero
            // the quantity instead; readers treat 0 as "not carried".
            newInventory.itemMeta = {
                ...playerStats.inventory.itemMeta,
                [metaKey]: { ...playerStats.inventory.itemMeta[metaKey], quantity: 0 },
            };
        }
    }

    const casterFile = getFileNameFromName(playerStats.name);
    const patchUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(casterFile)}`;
    const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory: newInventory }),
    });
    if (!patchRes.ok) {
        const errText = await patchRes.text();
        console.error(`[materialComponents] PATCH error body: ${errText}`);
    }

    setRuntimeValue(playerStats.name, 'inventory', newInventory, campaignName);

    addEntry(campaignName, {
        type: 'material_consumed',
        characterName: playerStats.name,
        material: itemName,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[materialComponents] Error logging material consumption:', e); });

    return true;
}

export function getMaterialRequirementMessage(spell) {
    const material = getConsumedMaterial(spell);
    if (!material) return null;
    const alreadyConsumes = /which the spell consumes/i.test(material.required);
    return `${spell.name} requires ${material.required}${alreadyConsumes ? '.' : ', which the spell consumes.'}`;
}
