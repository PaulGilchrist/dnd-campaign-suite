/* eslint-disable react/prop-types */
import React from 'react'
import usePopup from './common/use-popup'
import './char-inventory.css'

function CharInventory({ playerStats }) {
    const { PopupElement, setPopupHtml } = usePopup(() => null);
    
    const handleItemClick = (itemName) => {
        const equipmentUrl = '/data/equipment.json';
        
        console.log(`[CharInventory] Fetching equipment from: ${equipmentUrl}`);
        
        // Extract name if item has quantity info in parentheses (e.g., "Arrows (10)" -> "Arrows")
        let lookupName = itemName;
        const parenIndex = itemName.indexOf('(');
        if (parenIndex > 0) {
            lookupName = itemName.substring(0, parenIndex).trim();
        }
        
        fetch(equipmentUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(equipmentData => {
                console.log(`[CharInventory] Loaded ${equipmentData.length} items`);
                
                // Try to find item, handling plural/singular variations
                const findItem = (itemNameToSearch) => {
                    const normalizedInput = itemNameToSearch.toLowerCase().replace(/\s+/g, '-');
                    return equipmentData.find(f => {
                        const normalizedName = (f.name || '').toLowerCase().replace(/\s+/g, '-');
                        const normalizedIndex = (f.index || '').toLowerCase().replace(/\s+/g, '-');
                        return normalizedName === normalizedInput || normalizedIndex === normalizedIndex;
                    });
                };
                
                // First try exact match
                let item = findItem(lookupName);
                
                // If not found, try removing trailing 's' (plural to singular)
                if (!item && lookupName.endsWith('s')) {
                    const singularName = lookupName.slice(0, -1);
                    item = findItem(singularName);
                    if (item) {
                        console.log(`[CharInventory] Found item via singular conversion: ${item.name} from ${lookupName}`);
                    }
                }
                
                // If still not found, try adding 's' (singular to plural)
                if (!item) {
                    const pluralName = lookupName + 's';
                    item = findItem(pluralName);
                    if (item) {
                        console.log(`[CharInventory] Found item via plural conversion: ${item.name} from ${lookupName}`);
                    }
                }
                
                if (item) {
                    console.log(`[CharInventory] Found item: ${item.name}`);
                    let descriptionHtml = '';
                    if (Array.isArray(item.desc)) {
                        descriptionHtml = item.desc.map(desc => desc || '').join('<br/><br/>');
                    }
                    let html = `<b>${item.name}</b><br/>${descriptionHtml}`;
                    
                    const properties = [];
                    if(item.cost) {
                        properties.push(`<b>Cost:</b> ${item.cost.quantity} ${item.cost.unit}`);
                    }
                    if(item.weight) {
                        properties.push(`<b>Weight:</b> ${item.weight}`);
                    }
                    if(item.equipment_category) {
                        properties.push(`<b>Category:</b> ${item.equipment_category}`);
                    }
                    if(item.ability) {
                        properties.push(`<b>Ability:</b> ${item.ability}`);
                    }
                    if(item.utilize) {
                        properties.push(`<b>Utilize:</b> ${item.utilize}`);
                    }
                    if(item.craft) {
                        properties.push(`<b>Craft:</b> ${item.craft}`);
                    }
                    
                    if(properties.length > 0) {
                        html += `<br/>${properties.join('<br/>')}`;
                    }
                    
                    setPopupHtml(html);
                } else {
                    console.warn(`[CharInventory] Item not found: ${itemName} (lookup: ${lookupName})`);
                    setPopupHtml(`<b>${itemName}</b><br/><br/>Item details not found in database.`);
                }
            })
            .catch(error => {
                console.error(`[CharInventory] Error loading equipment:`, error);
                setPopupHtml(`<b>${itemName}</b><br/><br/>Error loading item details: ${error.message}. Check browser console for more details.`);
            });
    };
    
    const renderItems = (items, title) => {
        if (!items || items.length === 0) {
            return null;
        }
        return (
            <div>
                <b>{title}:</b> {items.map((item, index) => (
                    <span key={index} className="clickable" onClick={() => handleItemClick(item)}>
                        {item}
                        {index < items.length - 1 ? ', ' : ''}
                    </span>
                ))}
            </div>
        );
    };
    
    return (
        <div>
             {PopupElement}
            {playerStats.inventory.magicItems && <div>
                <div className='sectionHeader'>Magic Items</div>
                {playerStats.inventory.magicItems.map((magicItem, index) => {
                    return <div key={`magic-item-${index}`}>
                        <b>
                            {magicItem.name} {magicItem.quantity ? `(qty ${magicItem.quantity}) ` : '' } -&nbsp;
                            <i>
                                {magicItem.type}
                                {magicItem.subtype && <span>&nbsp;({magicItem.subtype})</span>}, {magicItem.rarity}
                                {magicItem.requiresAttunement && !magicItem.attunementRequirements && <span> (requires attunement)</span>}
                                {magicItem.requiresAttunement && magicItem.attunementRequirements && <span> ({magicItem.attunementRequirements})</span>}
                            </i>
                            :&nbsp;
                        </b>
                        <span dangerouslySetInnerHTML={{ __html: magicItem.description }}></span>
                    </div>}
                )}
            </div>}
            {renderItems(playerStats.inventory.equipped, 'Equipped')}
            {renderItems(playerStats.inventory.backpack, 'Backpack')}
        </div>
    )
}

export default CharInventory

