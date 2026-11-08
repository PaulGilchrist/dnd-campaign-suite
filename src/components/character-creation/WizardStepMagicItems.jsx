import { useState, useEffect, useMemo } from 'react';
import SelectableList from './SelectableList.jsx';
import CustomMagicItemModal from './CustomMagicItemModal.jsx';
import WarningList from '../common/WarningList.jsx';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './WizardStepMagicItems.css';

const BASE_ATTUNEMENT_LIMIT = 3;
const USE_MAGIC_DEVICE = 'Use Magic Device';

// CLA-374: the wizard stores the subclass under class.subclass (5e) and
// class.major (2024 majors) — accept either name.
function findChosenSubclass(classData, classSubtypes) {
    if (!classData?.name || !classSubtypes) {
        return null;
    }

    const selectedClass = classSubtypes.find(cs => cs.className === classData.name);
    if (!selectedClass) {
        return null;
    }

    const subclassName = classData.subclass?.name || classData.major?.name;
    if (!subclassName) {
        return null;
    }

    return selectedClass.subtypes?.find(s => s.name === subclassName) || null;
}

// CLA-374: 5e subclasses nest level-gated features under class_levels[];
// 2024 majors carry them flat on features[] — scan both shapes.
function hasUseMagicDevice(subclass, characterLevel) {
    const nested = (subclass.class_levels || []).some(cl => {
        return cl.level <= characterLevel && (cl.features || []).some(f => f.name === USE_MAGIC_DEVICE);
    });
    const flat = (subclass.features || []).some(f => f.name === USE_MAGIC_DEVICE && (f.level || 1) <= characterLevel);
    return nested || flat;
}

function calculateAttunementLimit(formData, classSubtypes) {
    const subclass = findChosenSubclass(formData?.class, classSubtypes);
    if (!subclass || !hasUseMagicDevice(subclass, formData.level || 1)) {
        return BASE_ATTUNEMENT_LIMIT;
    }
    return BASE_ATTUNEMENT_LIMIT + 1;
}

// Custom-entry controls (badge + Edit button) lifted out of renderItem to
// keep the row renderer's branch count readable.
function CustomItemControls({ item, onEdit }) {
    if (!item.custom) {
        return null;
    }
    return (
        <>
            <span className="magic-item-custom">custom</span>
            <button
                type="button"
                className="magic-item-edit-btn"
                title="Edit custom magic item"
                onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                }}
            >
                <i className="fa-solid fa-pen" /> Edit
            </button>
        </>
    );
}

// Untick-to-remove checkbox lifted out alongside CustomItemControls to keep
// renderItem under the complexity cap (QA improve 2026-11-08).
function RowSelectCheckbox({ item, isSelected, onToggle }) {
    return (
        <div
            className={`list-item-checkbox ${isSelected ? 'checked' : ''} list-item-checkbox-trigger`}
            title={isSelected ? `Un-tick to remove ${item.name}` : `Select ${item.name}`}
            onClick={(e) => {
                e.stopPropagation();
                onToggle();
            }}
        >
            {isSelected ? '✓' : ''}
        </div>
    );
}

function WizardStepMagicItems({ stepNumber, formData, allMagicItems, classSubtypes, onArrayFieldChange }) {
    const [warnings, setWarnings] = useState([]);
    // null = closed; { editing: <custom item | null> } = modal open.
    const [customModal, setCustomModal] = useState(null);

    const maxAttunement = useMemo(() => {
        return calculateAttunementLimit(formData, classSubtypes);
    }, [formData, classSubtypes]);

    const selectedEntries = useMemo(
        () => formData.inventory?.magicItems || [],
        [formData.inventory?.magicItems]
    );

    // Custom magic items are stored in inventory.magicItems as full objects
    // (name/type/rarity/requiresAttunement/description + custom flag); the
    // rules engine passes unknown objects straight through to the sheet.
    const customItems = useMemo(
        () => selectedEntries.filter(entry => entry && typeof entry === 'object'),
        [selectedEntries]
    );

    const lookupItems = useMemo(
        () => [...(allMagicItems || []), ...customItems],
        [allMagicItems, customItems]
    );

    useEffect(() => {
        const warnings = [];
        const selectedItems = formData.inventory?.magicItems || [];

        if (selectedItems.length > 0 && lookupItems.length > 0) {
            const attunementItems = selectedItems.filter(itemNameOrObj => {
                if (itemNameOrObj && typeof itemNameOrObj === 'object') {
                    return Boolean(itemNameOrObj.requiresAttunement);
                }
                const item = lookupItems.find(i => i.name === itemNameOrObj || i.index === itemNameOrObj);
                return item && item.requiresAttunement;
            });

            if (attunementItems.length > maxAttunement) {
                warnings.push({
                    message: `You have selected ${attunementItems.length} items requiring attunement, but a character can only attune to a maximum of ${maxAttunement} items.`,
                    type: 'warning'
                });
            }
        }

        setWarnings(warnings);
    }, [formData.inventory?.magicItems, lookupItems, maxAttunement]);

    // Returns '' when the name is free, otherwise the specific error copy:
    // colliding with an official catalog item is a different situation from
    // colliding with another of the character's own custom items.
    const getCustomNameConflict = (name, editingItem) => {
        const lower = name.toLowerCase();
        if (editingItem && (editingItem.name || '').toLowerCase() === lower) {
            return '';
        }
        const catalogItem = (allMagicItems || []).find(i => (i.name || '').toLowerCase() === lower);
        if (catalogItem) {
            return `"${catalogItem.name}" is an official magic item and already exists in the item catalog — tick it in the list instead of creating a custom copy.`;
        }
        if (customItems.some(i => i !== editingItem && (i.name || '').toLowerCase() === lower)) {
            return `A custom item named "${name}" already exists.`;
        }
        return '';
    };

    const handleSaveCustomItem = (draft) => {
        const editing = customModal?.editing || null;
        const next = editing
            ? selectedEntries.map(entry => (
                entry && typeof entry === 'object' && entry.name === editing.name ? draft : entry
              ))
            : [...selectedEntries, draft];
        onArrayFieldChange('inventory.magicItems', next);
        setCustomModal(null);
    };

    const renderItem = (item, index, { isSelected, isExpanded, onToggle, onToggleExpand }) => {
        const uniqueKey = item.index || index;

        // Custom descriptions are plain text — keep the author's line breaks
        // when they go through the HTML sanitizer; catalog HTML is unaffected.
        const descriptionHtml = (description) =>
            sanitizeHtml(String(description).replace(/\n/g, '<br/>'));

        return (
            <div
                key={uniqueKey}
                className={`list-item magic-item ${isSelected ? 'selected' : ''}`}
            >
                <div
                    className="list-item-body"
                    onClick={() => {
                        onToggleExpand();
                    }}
                >
                    <div className="list-item-header">
                        <div className="list-item-name">{item.name}</div>
                        <CustomItemControls item={item} onEdit={(custom) => setCustomModal({ editing: custom })} />
                        {item.type && <span className="magic-item-type">{item.type}</span>}
                        {item.rarity && <span className="magic-item-rarity">{item.rarity}</span>}
                        {item.requiresAttunement && <span className="magic-item-attunement">requires attunement</span>}
                        <RowSelectCheckbox item={item} isSelected={isSelected} onToggle={onToggle} />
                    </div>

                    <div className="list-item-details">
                        {isExpanded && (
                            <div className="list-item-full-details">
                                {item.description && (
                                    <div
                                        className="magic-item-description"
                                        dangerouslySetInnerHTML={{
                                            __html: descriptionHtml(Array.isArray(item.description) ? item.description[0] : item.description)
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
            </div>
        );
    };

    const filters = [
            { label: 'Item Type', field: 'type', className: 'magic-item-type-filter' }
          ];

    return (
        <>
             <SelectableList
          items={lookupItems}
          fieldName="inventory.magicItems"
          formData={formData}
          onArrayFieldChange={onArrayFieldChange}
          title={`Step ${stepNumber}: Magic Items`}
          searchPlaceholder="Search magic items..."
          filters={filters}
          renderItem={renderItem}
          renderSummary={() => (
              <div className="magic-item-custom-summary">
                  <button
                      type="button"
                      className="add-custom-magic-item-btn"
                      onClick={() => setCustomModal({ editing: null })}
                  >
                      <i className="fa-solid fa-plus" /> Add Custom Magic Item
                  </button>
                  <span className="field-description">
                      Custom items live on this character only — they are not added to a
                      campaign-wide item registry. Each saves its own type, rarity and
                      description on the character sheet. Untick a selected row&apos;s
                      checkbox to remove it.
                  </span>
              </div>
          )}
          renderWarnings={() => warnings.length > 0 && <WarningList warnings={warnings} />}
          loadingMessage="Magic item data not yet loaded. Please try again."
          className="wizard-step-magic-items"
          resultLabel="magic item"
            />
            {customModal && (
                <CustomMagicItemModal
                    initialItem={customModal.editing}
                    getNameConflict={(name) => getCustomNameConflict(name, customModal.editing)}
                    onSave={handleSaveCustomItem}
                    onClose={() => setCustomModal(null)}
                />
            )}
        </>
         );
}

export default WizardStepMagicItems;
