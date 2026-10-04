 

import usePopup from '../../hooks/combat/usePopup.js'
import Popup from '../common/popup.jsx'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { loadEquipment } from '../../services/ui/dataLoader.js';
import './CharInventory.css'

const buildPropertyLines = (item) => {
    const properties = [];
    if (item.cost) {
        properties.push(`<b>Cost:</b> ${item.cost.quantity} ${item.cost.unit}`);
    }
    if (item.weight) {
        properties.push(`<b>Weight:</b> ${item.weight}`);
    }
    if (item.equipment_category) {
        properties.push(`<b>Category:</b> ${item.equipment_category}`);
    }
    if (item.ability) {
        properties.push(`<b>Ability:</b> ${item.ability}`);
    }
    if (item.utilize) {
        properties.push(`<b>Utilize:</b> ${item.utilize}`);
    }
    if (item.craft) {
        properties.push(`<b>Craft:</b> ${item.craft}`);
    }
    return properties;
};

function itemNameOf(item) {
    return typeof item === 'string' ? item.trim() : ((item && typeof item.name === 'string') ? item.name.trim() : '');
}

function getItemMeta(inventory, name) {
    const meta = inventory?.itemMeta || {};
    if (meta[name]) return meta[name];
    const lower = name.toLowerCase();
    const entry = Object.entries(meta).find(([key]) => key.toLowerCase() === lower);
    return entry ? entry[1] : null;
}

const buildItemPopupHtml = (itemName, item, metaDescription) => {
    if (item) {
        let descriptionHtml = Array.isArray(item.desc)
            ? item.desc.map(desc => desc || '').join('<br/><br/>')
            : '';
        if (metaDescription) {
            descriptionHtml = metaDescription.replace(/\n/g, '<br/>');
        }
        const properties = buildPropertyLines(item);
        return `<b>${item.name}</b><br/>${descriptionHtml}${properties.length > 0 ? `<br/>${properties.join('<br/>')}` : ''}`;
    }
    if (metaDescription) {
        return `<b>${itemName}</b><br/>${metaDescription.replace(/\n/g, '<br/>')}`;
    }
    return `<b>${itemName}</b><br/><br/>Item details not found in database.`;
};

const findEquipmentItem = (equipmentData, itemName) => {
    const findItem = (itemNameToSearch) => {
        const normalizedInput = itemNameToSearch.toLowerCase().replace(/\s+/g, '-');
        return equipmentData.find(f => {
            const normalizedName = (f.name || '').toLowerCase().replace(/\s+/g, '-');
            const normalizedIndex = (f.index || '').toLowerCase().replace(/\s+/g, '-');
            return normalizedName === normalizedInput || normalizedIndex === normalizedInput;
        });
    };
    const exact = findItem(itemName);
    if (exact) return exact;
    if (itemName.endsWith('s')) {
        const singular = findItem(itemName.slice(0, -1));
        if (singular) return singular;
    }
    return findItem(`${itemName}s`) || null;
};

function CharInventory({ playerStats }) {
    const { popupHtml, setPopupHtml } = usePopup(() => null);

    const handleItemClick = async (itemName) => {
        // Extract name if item has quantity info in parentheses (e.g., "Arrows (10)" -> "Arrows")
        let lookupName = itemName;
        const parenIndex = itemName.indexOf('(');
        if (parenIndex > 0) {
            lookupName = itemName.substring(0, parenIndex).trim();
        }
        
        const meta = getItemMeta(playerStats.inventory, lookupName);
        const metaDescription = meta && typeof meta.description === 'string' ? meta.description : '';

        try {
            const equipmentData = await loadEquipment();

            if (!equipmentData || equipmentData.length === 0) {
                setPopupHtml(buildItemPopupHtml(itemName, null, metaDescription));
                return;
            }

            // Find item, handling plural/singular variations
            const item = findEquipmentItem(equipmentData, lookupName);
            setPopupHtml(buildItemPopupHtml(itemName, item, metaDescription));
        } catch (error) {
            console.error(`[CharInventory] Error loading equipment:`, error);
            setPopupHtml(`<b>${itemName}</b><br/><br/>Error loading item details: ${error.message}. Check browser console for more details.`);
        }
    };
    
    const renderItems = (items, title) => {
        if (!items || items.length === 0) {
            return null;
        }
        return (
            <div>
                <b>{title}:</b> {items.map((rawItem, index) => {
                    const name = itemNameOf(rawItem);
                    const meta = getItemMeta(playerStats.inventory, name);
                    const quantity = meta && Number.isFinite(Number(meta.quantity)) && Number(meta.quantity) > 1 ? Math.floor(Number(meta.quantity)) : 0;
                    return (
                        <span key={index} className="clickable" onClick={() => handleItemClick(name)}>
                            {name}{quantity ? ` ×${quantity}` : ''}
                            {index < items.length - 1 ? ', ' : ''}
                        </span>
                    );
                })}
            </div>
        );
    };
    
    return (
        <div className='char-inventory'>
             {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml(null)} />}
            <div className='sectionHeader'>Inventory</div>
            {playerStats.inventory.magicItems && playerStats.inventory.magicItems.length > 0 && <div>
                <b>Magic Items:</b>
                {playerStats.inventory.magicItems.map((magicItem, index) => {
                    return <div key={`magic-item-${index}`}>
                        {magicItem.name} {magicItem.quantity ? `(qty ${magicItem.quantity}) ` : '' } -&nbsp;
                        <i>
                            {magicItem.type}
                            {magicItem.subtype && <span>&nbsp;({magicItem.subtype})</span>}, {magicItem.rarity}
                            {magicItem.requiresAttunement && !magicItem.attunementRequirements && <span> (requires attunement)</span>}
                            {magicItem.requiresAttunement && magicItem.attunementRequirements && <span> ({magicItem.attunementRequirements})</span>}
                        </i>
                        :&nbsp;
                        <span className="magic-item-description" dangerouslySetInnerHTML={{ __html: sanitizeHtml(magicItem.description) }}></span>
                    </div>}
                )}
            </div>}
            {renderItems(playerStats.inventory.equipped, 'Equipped')}
            {renderItems(playerStats.inventory.backpack, 'Backpack')}
        </div>
    )
}

export default CharInventory
