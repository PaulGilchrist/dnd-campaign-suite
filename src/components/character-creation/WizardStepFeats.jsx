import React from 'react';
import SelectableList from './SelectableList.jsx';
import FeatItemDetails from './FeatItemDetails.jsx';
import WarningList from '../common/WarningList.jsx';
import { validateFeats, getFeatLimits, getRaceFeatChoices } from '../../services/character/featValidation.js';

function WizardStepFeats({ formData, allFeats, onArrayFieldChange, preSelectedFeats, computedBuffs }) {
  const [warnings, setWarnings] = React.useState([]);
  const [raceFeatChoices, setRaceFeatChoices] = React.useState([]);
  const [isVersatile, setIsVersatile] = React.useState(false);

  const repeatableFeats = React.useMemo(() => {
    if (!allFeats) return [];
    return allFeats.filter(feat => feat.repeatable === true);
  }, [allFeats]);
  // Validate feats when selection changes
    React.useEffect(() => {
          const fetchWarnings = async () => {
            const validationWarnings = await validateFeats(formData, allFeats);
            setWarnings(validationWarnings);
          };
          fetchWarnings();
        }, [formData, formData.feats, formData.level, formData.rules, allFeats]);

  // Load race feat choices
  React.useEffect(() => {
    const fetchRaceChoices = async () => {
      if (formData.rules === '2024' && formData.race) {
        const choices = await getRaceFeatChoices(formData);
        setRaceFeatChoices(choices);
        setIsVersatile(choices.length > 0);
      } else {
        setRaceFeatChoices([]);
        setIsVersatile(false);
      }
    };
    fetchRaceChoices();
  }, [formData]);

    // Get feat limits for display
    const [featLimits, setFeatLimits] = React.useState({ allowed: 0, originRequired: false, details: '' });
  React.useEffect(() => {
        const fetchLimits = async () => {
          const limits = await getFeatLimits(formData);
          setFeatLimits(limits);
          };
        fetchLimits();
      }, [formData, formData.level, formData.rules]);

    // Render item function
  const renderItem = (feat, index, { isSelected, isPreSelected, isExpanded, onToggle, onRemove, onToggleExpand, itemCount = 0 }) => {
    const isRepeatable = repeatableFeats.some(f => f.name === feat.name);
    const showCountBadge = isRepeatable && itemCount > 1;
        return (
            <div
                key={feat.index || index}
                className={`list-item feat-item ${isSelected ? 'selected' : ''} ${isPreSelected ? 'pre-selected' : ''}`}
            >
                <div
                    className="list-item-body"
                    onClick={() => {
                        if (!isPreSelected) {
                            onToggleExpand();
                        }
                    }}
                >
                    <div className="list-item-header">
                        <div className="list-item-name">
                            {feat.name}
                            {isPreSelected && <span className="pre-selected-label">(Pre-selected)</span>}
                            {showCountBadge && <span className="feat-count-badge">({itemCount})</span>}
                        </div>
                        {feat.type && <span className="feat-type">{feat.type}</span>}
                        <div className="list-item-checkbox-group">
                            <div
                                className={`list-item-checkbox ${isSelected ? 'checked' : ''} list-item-checkbox-trigger`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isPreSelected) {
                                        onToggle();
                                    }
                                }}
                            >
                                {isSelected ? '✓' : ''}
                            </div>
                            {isRepeatable && isSelected && (
                                <div className="repeatable-feat-actions">
                                    <button
                                        type="button"
                                        className="add-another-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggle();
                                        }}
                                    >
                                        <i className="fa-solid fa-plus" /> Add Another
                                    </button>
                                    {itemCount >= 1 && !isPreSelected && (
                                        <button
                                            type="button"
                                            className="remove-feat-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove();
                                            }}
                                        >
                                            <i className="fa-solid fa-minus" /> Remove One
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <FeatItemDetails
                        feat={feat}
                        isSelected={isSelected}
                        isExpanded={isExpanded}
                        onToggleExpand={onToggleExpand}
                        ruleset={formData.rules || '5e'}
                    />
                </div>
            </div>
        );
    };

  const countSelections = (preSelected) => {
    const allSelected = formData.feats || [];
    return {
      userSelectedCount: allSelected.filter(f => !preSelected.includes(f)).length,
      preSelectedCount: allSelected.filter(f => preSelected.includes(f)).length,
    };
  };

  const countBuffTotals = (buffs) => {
    const totals = {
      abilityScoreIncreases: buffs?.abilityScoreIncreases?.filter(inc => inc.name && inc.name !== 'any').length || 0,
      proficiencies: buffs?.proficiencies?.length || 0,
      resistances: buffs?.resistances?.length || 0,
      features: buffs?.features?.length || 0,
    };
    return {
      ...totals,
      hasBuffs: Object.values(totals).some(count => count > 0)
    };
  };

  const BUFF_LINE_LABELS = {
    abilityScoreIncreases: 'ability score increase(s)',
    proficiencies: 'proficiency/proficiencie(s)',
    resistances: 'resistance(s)',
    features: 'passive/feature buff(s)',
  };

  // Render summary
  const renderSummary = () => {
    const { userSelectedCount, preSelectedCount } = countSelections(preSelectedFeats || []);
    const buffTotals = countBuffTotals(computedBuffs);

    return (
      <div className="rule-info">
        <p><strong>Rules:</strong> {featLimits.details}</p>
        <p>
          You have selected {userSelectedCount} of {featLimits.allowed} allowed feat(s)
          {preSelectedCount > 0 ? ` (plus ${preSelectedCount} pre-selected feat)` : ''}.
        </p>
        {isVersatile && raceFeatChoices.length > 0 && (
          <div className="versatile-trait-info">
            <p><strong>Versatile Trait:</strong> Your race grants an Origin feat of your choice. Available options: {raceFeatChoices.join(', ')}. Skilled is recommended.</p>
          </div>
        )}
        {buffTotals.hasBuffs && (
          <div className="feat-buffs-summary">
            <p><strong>Applied Buffs:</strong></p>
            {Object.entries(BUFF_LINE_LABELS)
              .filter(([key]) => buffTotals[key] > 0)
              .map(([key, label]) => (
                <p key={key} className="feat-buff-line">• {buffTotals[key]} {label}</p>
              ))}
          </div>
        )}
      </div>
    );
  };

     // Filter configuration
   const filters = [
         { label: 'Feat Type', field: 'type', className: 'type-filter' }
       ];

    return (
          <SelectableList
         items={allFeats}
         fieldName="feats"
         formData={formData}
         onArrayFieldChange={onArrayFieldChange}
         title="Step 4: Feats"
         searchPlaceholder="Search feats..."
         filters={filters}
         renderItem={renderItem}
         renderSummary={renderSummary}
         renderWarnings={() => warnings.length > 0 && <WarningList warnings={warnings} />}
         loadingMessage="Feat data not yet loaded. Please try again."
         preSelectedItems={preSelectedFeats || []}
         repeatableItems={repeatableFeats.map(f => f.name)}
         className="wizard-step-feats"
         resultLabel="feat"
          />
        );
}

export default WizardStepFeats;

