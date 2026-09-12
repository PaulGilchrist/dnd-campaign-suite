import { useState, useEffect, useMemo } from 'react';
import SelectableList from './SelectableList.jsx';
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

function WizardStepMagicItems({ formData, allMagicItems, classSubtypes, onArrayFieldChange }) {
    const [warnings, setWarnings] = useState([]);

    const maxAttunement = useMemo(() => {
        return calculateAttunementLimit(formData, classSubtypes);
    }, [formData, classSubtypes]);

    useEffect(() => {
        const warnings = [];
        const selectedItems = formData.inventory?.magicItems || [];

        if (selectedItems.length > 0 && allMagicItems) {
            const attunementItems = selectedItems.filter(itemName => {
                const item = allMagicItems.find(i => i.name === itemName || i.index === itemName);
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
    }, [formData.inventory?.magicItems, allMagicItems, maxAttunement]);

    const renderItem = (item, index, { isSelected, isExpanded, onToggle, onToggleExpand }) => {
        const uniqueKey = item.index || index;

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
                        {item.type && <span className="magic-item-type">{item.type}</span>}
                        {item.rarity && <span className="magic-item-rarity">{item.rarity}</span>}
                        {item.requiresAttunement && <span className="magic-item-attunement">requires attunement</span>}
                        <div
                            className={`list-item-checkbox ${isSelected ? 'checked' : ''} list-item-checkbox-trigger`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle();
                            }}
                        >
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
            </div>
        );
    };

    const filters = [
            { label: 'Item Type', field: 'type', className: 'magic-item-type-filter' }
          ];

    return (
             <SelectableList
          items={allMagicItems}
          fieldName="inventory.magicItems"
          formData={formData}
          onArrayFieldChange={onArrayFieldChange}
          title="Step 10: Magic Items"
          searchPlaceholder="Search magic items..."
          filters={filters}
          renderItem={renderItem}
          renderWarnings={() => warnings.length > 0 && <WarningList warnings={warnings} />}
          loadingMessage="Magic item data not yet loaded. Please try again."
          className="wizard-step-magic-items"
          resultLabel="magic item"
            />
         );
}

export default WizardStepMagicItems;
