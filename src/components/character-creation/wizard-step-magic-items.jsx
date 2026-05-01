import React, { useState, useEffect } from 'react';
import SelectableList from './selectable-list';
import { sanitizeHtml } from '../../services/sanitize.js';
import './wizard-step-magic-items.css';
function WizardStepMagicItems({ formData, allMagicItems, ruleset, onArrayFieldChange }) {
  const [warnings, setWarnings] = useState([]);
    // Check for attunement limit warnings
    useEffect(() => {
        const warnings = [];
        const selectedItems = formData.magicItems || [];

        if (selectedItems.length > 0 && allMagicItems) {
            const attunementItems = selectedItems.filter(itemName => {
                const item = allMagicItems.find(i => i.name === itemName || i.index === itemName);
                return item && item.requiresAttunement;
            });

            if (attunementItems.length > 3) {
                warnings.push({
                    message: `You have selected ${attunementItems.length} items requiring attunement, but a character can only attune to a maximum of 3 items.`,
                    type: 'warning'
                });
            }
        }

        setWarnings(warnings);
    }, [formData.magicItems, allMagicItems]);

      // Render item function
  const renderItem = (item, index, { isSelected, isExpanded, onToggle, onToggleExpand }) => {
        const uniqueKey = item.index || index;

        return (
            <div
                key={uniqueKey}
                className={`list-item magic-item ${isSelected ? 'selected' : ''}`}
          onClick={onToggle}
            >
                <div className="list-item-header">
                    <div className="list-item-name">{item.name}</div>
                    {item.type && <span className="magic-item-type">{item.type}</span>}
                    {item.rarity && <span className="magic-item-rarity">{item.rarity}</span>}
                    <div className={`list-item-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected ? '✓' : ''}
                    </div>
                </div>

                <div className="list-item-details">
                    {isExpanded && (
                        <div className="list-item-full-details">
                            {item.description && (
                                <div
                                    className="magic-item-description"
                                    dangerouslySetInnerHTML={{
                                        __html: sanitizeHtml(Array.isArray(item.description) ? item.description[0] : item.description)
                                    }}
                                />
                            )}
                            {item.description && Array.isArray(item.description) && item.description.length > 1 && (
                                <div
                                   className="magic-item-more-description"
                                   dangerouslySetInnerHTML={{
                                        __html: sanitizeHtml(item.description.slice(1).join('\n'))
                                    }}
                                />
                            )}
                        </div>
                    )}

                    <div className="list-item-full-details">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                  onToggleExpand();
                            }}
                            className="toggle-details-btn"
                        >
                            {isExpanded ? 'Show Less' : 'Show More'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

      // Render warnings
  const renderWarnings = () => {
    if (warnings.length === 0) return null;
            return (
                        <div className="warning-container">
                            {warnings.map((warning, index) => (
                                <div key={index} className={`warning-message ${warning.type}`}>
                                    {warning.message}
                                </div>
                            ))}
                        </div>
        );
    };

      // Filter configuration
  const filters = [
         { label: 'Item Type', field: 'type', className: 'magic-item-type-filter' }
       ];

  return (
         <SelectableList
        items={allMagicItems}
        fieldName="magicItems"
        formData={formData}
        onArrayFieldChange={onArrayFieldChange}
        title="Step 10: Magic Items"
        searchPlaceholder="Search magic items..."
        filters={filters}
        renderItem={renderItem}
        renderWarnings={renderWarnings}
        loadingMessage="Magic item data not yet loaded. Please try again."
        className="wizard-step-magic-items"
        resultLabel="magic item"
        />
       );
}

export default WizardStepMagicItems;

