import { useState, useEffect, useCallback, useMemo } from 'react';
import SelectableList from './SelectableList.jsx';
import WarningList from '../common/WarningList.jsx';
import { getSpellLimits, validateSpellSelection } from '../../services/rules/spells/spellLimits.js';
import { getSpellValidationInfo } from '../../services/rules/spells/spellValidation.js';
import { renderMarkdown } from '../../services/ui/sanitize.js';
import MagicInitiateModal from './MagicInitiateModal.jsx';
import './WizardStepSpells.css';

// Mystic Arcanum level requirements for Warlock
const ARCANUM_LEVEL_REQUIREMENTS = [
  { level: 6, charLevel: 11 },
  { level: 7, charLevel: 13 },
  { level: 8, charLevel: 15 },
  { level: 9, charLevel: 17 },
];

// Get qualifying arcanum levels for a given character level
function getQualifyingArcanumLevels(charLevel) {
  return ARCANUM_LEVEL_REQUIREMENTS.filter(req => charLevel >= req.charLevel);
}

// Mystic Arcanum selection component for Warlock
function WizardStepSpells({ formData, allSpells, onArrayFieldChange, preSelectedSpells }) {
  const preSelected = useMemo(() => preSelectedSpells || [], [preSelectedSpells]);
  const isWarlock = formData?.class?.name === 'Warlock';
  const charLevel = parseInt(formData?.level) || 1;
  const [expandedArcanumSpell, setExpandedArcanumSpell] = useState(null);
  const [showMagicInitiateModal, setShowMagicInitiateModal] = useState(false);
  const miSpells = useMemo(() => {
    const spells = new Set();
    (formData.magicInitiateInstances || []).forEach(inst => {
      if (inst.cantrips?.[0]) spells.add(inst.cantrips[0]);
      if (inst.cantrips?.[1]) spells.add(inst.cantrips[1]);
      if (inst.level1Spell) spells.add(inst.level1Spell);
    });
    return spells;
  }, [formData.magicInitiateInstances]);

  const qualifyingArcanumLevels = useMemo(() => {
    if (!isWarlock) return [];
    return getQualifyingArcanumLevels(charLevel);
  }, [isWarlock, charLevel]);
  const arcanumSpells = formData?.class?.arcanums || [];

  // Get Warlock spells at specific levels for Mystic Arcanum
  const arcanumSpellByLevel = useMemo(() => {
    if (!allSpells) return {};
    const result = {};
    qualifyingArcanumLevels.forEach(({ level }) => {
      result[level] = (allSpells || []).filter(spell => {
        const spellLevel = spell.level !== undefined ? spell.level : 0;
        return spellLevel === level && (spell.classes || []).includes('Warlock');
      });
    });
    return result;
  }, [allSpells, qualifyingArcanumLevels]);

  // Calculate spell counts by level (excluding pre-selected spells)
  const [spellCounts, setSpellCounts] = useState({ cantrip: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 });
  const [spellLimits, setSpellLimits] = useState({ cantrip: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 });
  const [spellWarnings, setSpellWarnings] = useState([]);
  const [, setValidationMessage] = useState('');
  const [, setIsLoadingLimits] = useState(false);
  // Fetch spell limits dynamically based on class and level
  useEffect(() => {
    const fetchSpellLimits = async () => {
      if (!formData || !formData.class || !formData.level) {
        return;
      }
      
      const className = formData.class.name;
      const charLevel = parseInt(formData.level) || 1;
      const version = formData.rules || '5e';
      const majorName = formData.class.major?.name || formData.class.subclass?.name || null;
      const classOptions = {
        divineOrder: formData.class.divineOrder || null,
        primalOrder: formData.class.primalOrder || null
      };
      
      setIsLoadingLimits(true);
      try {
      const limits = await getSpellLimits(className, charLevel, version, majorName, classOptions, formData.abilities);
        setSpellLimits(limits);
      } catch (error) {
        console.error('Error fetching spell limits:', error);
        setSpellLimits({ cantrip: 4, level1: 2, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 });
      } finally {
        setIsLoadingLimits(false);
       }
      };
    
    fetchSpellLimits();
  }, [formData, formData.class, formData.level, formData.rules]);

  // Show Magic Initiate modal when feat is selected and instances not yet configured
  useEffect(() => {
    const feats = formData.feats || [];
    const magicInitiateCount = feats.filter(f => f === 'Magic Initiate' || f.index === 'magic-initiate').length;
    if (magicInitiateCount === 0) {
      return;
    }
    const existingInstances = formData.magicInitiateInstances;
    if (!existingInstances || !Array.isArray(existingInstances) || existingInstances.length !== magicInitiateCount) {
      setShowMagicInitiateModal(true);
    }
  }, [formData.feats, formData.magicInitiateInstances]);

    // Calculate spell counts by level (excluding pre-selected spells and Magic Initiate spells)
    useEffect(() => {   
      const counts = { cantrip: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 };
      
      if (formData.spells && formData.spells.length > 0) {
        formData.spells.forEach(spellName => {
          if (preSelected.includes(spellName)) return;
          if (miSpells.has(spellName)) return;
          const spell = allSpells.find(s => s.name === spellName || s.index === spellName);
          if (spell) {
            const level = spell.level !== undefined ? spell.level : 0;
            const levelKey = level === 0 ? 'cantrip' : `level${level}`;
            counts[levelKey] = (counts[levelKey] || 0) + 1;
           }
          });
       }
      
      setSpellCounts(counts);
      }, [formData.spells, allSpells, preSelected, miSpells]);

     // Filter spells to only those of levels for which the character has at least one spell slot.
    // Cantrips are always available since they don't require spell slots.
    const availableSpells = useMemo(() => {
       if (!spellLimits.spellType) return allSpells || [];

       let maxSlotLevel = 0;
       for (let i = 9; i >= 1; i--) {
         if ((spellLimits[`level${i}`] || 0) > 0) {
           maxSlotLevel = i;
           break;
         }
       }

       return (allSpells || []).filter(spell => {
         const level = spell.level !== undefined ? spell.level : 0;
         if (level === 0) return true;
         return level <= maxSlotLevel;
       });
     }, [allSpells, spellLimits]);

      // Calculate total prepared spells (non-cantrip), for classes with spellType === 'prepared'
     const totalPrepared = useMemo(() => {
      if (spellLimits.spellType !== 'prepared') return 0;
      return (
       spellCounts.level1 +
       spellCounts.level2 +
       spellCounts.level3 +
       spellCounts.level4 +
       spellCounts.level5 +
       spellCounts.level6 +
       spellCounts.level7 +
       spellCounts.level8 +
       spellCounts.level9
     );
    }, [spellLimits.spellType, spellCounts]);

    // Render summary
    const renderSummary = () => {
      const isPrepared = spellLimits.spellType === 'prepared';
      
      if (isPrepared) {
        return (
          <div className="spells-summary">
            <h4>Spell Selection Summary</h4>
            <div className="spell-levels-summary">
               <div className="level-summary-item">
                 <span className="level-label">Cantrips:</span>
                 <span className={`level-count ${spellCounts.cantrip > (spellLimits.cantrip || 0) ? 'exceeded' : ''}`}>
                    {spellCounts.cantrip}/{spellLimits.cantrip || 0}
                   </span>
                </div>
               <div className="level-summary-item">
                  <span className="level-label">Prepared Spells:</span>
                   <span className={`level-count ${totalPrepared > (spellLimits.preparedSpells || 0) ? 'exceeded' : ''}`}>
                      {totalPrepared}/{spellLimits.preparedSpells || 0}
                     </span>
                  </div>
              </div>
            
              {spellWarnings.length > 0 && <WarningList warnings={spellWarnings} showIcons />}
           </div>
         );
       }

      return (
        <div className="spells-summary">
          <h4>Spell Selection Summary</h4>
          <div className="spell-levels-summary">
            <div className="level-summary-item">
              <span className="level-label">Cantrips:</span>
              <span className={`level-count ${spellCounts.cantrip > (spellLimits.cantrip || 0) ? 'exceeded' : ''}`}>
                {spellCounts.cantrip}/{spellLimits.cantrip || 0}
               </span>
            </div>
           {['level1', 'level2', 'level3', 'level4', 'level5', 'level6', 'level7', 'level8', 'level9'].map(levelKey => (
             <div key={levelKey} className="level-summary-item">
               <span className="level-label">{levelKey.replace('level', '')}th level:</span>
                <span className={`level-count ${spellCounts[levelKey] > (spellLimits[levelKey] || 0) ? 'exceeded' : ''}`}>
                  {spellCounts[levelKey] || 0}/{spellLimits[levelKey] || 0}
                 </span>
             </div>
           ))}
          </div>
          
          {spellWarnings.length > 0 && <WarningList warnings={spellWarnings} showIcons />}
         </div>
        );
       };
  const getValidationMessage = useCallback(async () => {
    if (!formData || !formData.class) {
      return '';
    }

    const className = formData.class.name;
    const charLevel = parseInt(formData.level) || 1;
    const version = formData.rules || '5e';
    const majorName = formData.class.major?.name || formData.class.subclass?.name || null;

    // Validate spell selection (excluding pre-selected spells)
    const userSpells = (formData.spells || []).filter(s => !preSelected.includes(s));
    const validation = await validateSpellSelection(userSpells, allSpells || [], className, charLevel, version, majorName, formData.abilities);

    if (!validation.valid) {
      return `Spell limit exceeded: ${validation.violations.join(', ')}`;
    }

    return '';
  }, [formData, allSpells, preSelected]);

  useEffect(() => {
    const validate = async () => {
      const message = await getValidationMessage();
      setValidationMessage(message);
    };
    validate();
  }, [spellCounts, spellLimits, formData.class, formData.level, formData.spells, allSpells, formData.rules, getValidationMessage]);

  // Spell validation warnings using the new spell-validation service
  useEffect(() => {
    const validateSpells = async () => {
      if (!formData || !formData.class || !formData.spells || formData.spells.length === 0) {
        setSpellWarnings([]);
        return;
       }
      
      const version = formData.rules || '5e';
      try {
        const validationInfo = await getSpellValidationInfo(
          formData,
          formData.spells,
          allSpells || [],
          version,
          preSelected
          );
        
        setSpellWarnings(validationInfo.warnings || []);
       } catch (error) {
        console.error('Error validating spells:', error);
        setSpellWarnings([]);
        }
      };
    
    validateSpells();
   }, [formData, formData.class, formData.race, formData.background, formData.feats, formData.spells, formData.level, formData.rules, allSpells, preSelected]);

   // Get level class for styling
  const getLevelClass = (spell) => {
    const level = spell.level !== undefined ? spell.level : 0;
    if (level === 0) return 'cantrip';
    if (level <= 3) return 'low';
    if (level <= 5) return 'mid';
    return 'high';
  };

   // Render item function
  const renderItem = (spell, index, { isSelected, isPreSelected, isExpanded, onToggle, onToggleExpand }) => {
    return (
      <div
        key={spell.index || index}
        className={`list-item spell-item ${isSelected ? 'selected' : ''} ${isPreSelected ? 'pre-selected' : ''}`}
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
              {spell.name}
              {isPreSelected && <span className="pre-selected-label"> (Auto-assigned)</span>}
            </div>
            <span className={`spell-level ${getLevelClass(spell)}`}>
              {spell.level !== undefined ? spell.level : '0'}
            </span>
            <div
              className={`list-item-checkbox ${(isSelected || isPreSelected) ? 'checked' : ''} list-item-checkbox-trigger`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isPreSelected) {
                  onToggle();
                }
              }}
            >
              {(isSelected || isPreSelected) ? '✓' : ''}
            </div>
          </div>

          <div className="list-item-details">
            <div className="spell-meta">
              <span className="spell-school">{spell.school || 'Unknown'}</span>
              {spell.ritual && <span className="spell-ritual">Ritual</span>}
              {spell.concentration && <span className="spell-concentration">Concentration</span>}
              {spell.duration && <span className="spell-duration">Duration: {spell.duration}</span>}
              {spell.casting_time && <span className="spell-casting-time">Casting: {spell.casting_time}</span>}
            </div>

            {isExpanded && (
              <div className="list-item-full-details">
                <div className="spell-description">
                  {spell.description && spell.description[0] && (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(spell.description[0]) }} />
                  )}
                </div>


                {spell.components && spell.components.length > 0 && (
                  <div className="spell-components">
                    <strong>Components:</strong> {spell.components.join(', ')}
                  </div>
                )}

                {spell.damage && spell.damage.damage_type && (
                  <div className="spell-damage">
                    <strong>Damage:</strong> {spell.damage.damage_type}
                  </div>
                )}

                {spell.material && (
                  <div className="spell-material">
                    <strong>Material:</strong> {spell.material}
                  </div>
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

    // Filter configuration
  const filters = [
    {
      label: 'Spell Level',
      field: 'level',
      className: 'level-filter',
      getValue: (spell) => spell.level !== undefined ? spell.level.toString() : '0',
      renderOption: (level) => level === '0' ? 'Cantrip' : level,
      sortFn: (a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return parseInt(a) - parseInt(b);
}
     },
      {
       label: 'Class',
       field: 'class',
       className: 'class-filter',
       getValue: (spell) => {
          const classes = spell.classes || [];
         if (classes.includes('Wizard')) {
           return [...classes, 'Fighter', 'Rogue'];
          }
         return classes;
        },
        renderOption: (cls) => cls
       },
    ];

    // Mystic Arcanum spell selection rendering
    const renderArcanumSelection = () => {
      if (!isWarlock || qualifyingArcanumLevels.length === 0) return null;

      return (
        <div className="arcanum-selection-section">
          <h3>Mystic Arcanum</h3>
          <p className="arcanum-description">
            Your patron bestows upon you a magical secret called an arcanum. Choose one warlock spell of the specified level.
            You can cast each of your arcanum spells once without using a spell slot. You must finish a long rest before you can cast an arcanum spell this way again.
          </p>
          {qualifyingArcanumLevels.map(({ level }) => {
            const availableSpellsForLevel = arcanumSpellByLevel[level] || [];
            const selectedSpell = arcanumSpells.find(s => {
              const spell = allSpells?.find(sp => sp.name === s || sp.index === s);
              return spell && spell.level === level;
            });
            const isSelected = !!selectedSpell;

            return (
              <div key={level} className="arcanum-slot">
                <div className="arcanum-slot-header">
                  <span className="arcanum-slot-label">{level}th Level Arcanum:</span>
                  <span className={`arcanum-slot-count ${isSelected ? 'selected' : 'available'}`}>
                    {isSelected ? '1/1' : '0/1'}
                  </span>
                </div>
                <div className="arcanum-slot-options">
                  {availableSpellsForLevel.length === 0 ? (
                    <span className="no-arcanum-spells">No warlock spells available at this level.</span>
                  ) : (
                    availableSpellsForLevel.map(spell => {
                      const isCurrentlySelected = arcanumSpells.includes(spell.name);
                      const isExpanded = expandedArcanumSpell === spell.index;
                      return (
                        <div
                          key={spell.index}
                          className={`arcanum-option ${isCurrentlySelected ? 'selected' : ''}`}
                        >
                          <div className="arcanum-option-row" onClick={() => {
                            const currentArcanums = [...arcanumSpells];
                            if (isCurrentlySelected) {
                              onArrayFieldChange('class.arcanums', currentArcanums.filter(s => s !== spell.name));
                            } else {
                              const newArcanums = currentArcanums.filter(s => {
                                const existingSpell = allSpells?.find(sp => sp.name === s || sp.index === s);
                                return !existingSpell || existingSpell.level !== level;
                              });
                              newArcanums.push(spell.name);
                              onArrayFieldChange('class.arcanums', newArcanums);
                            }
                          }}>
                            <div className="arcanum-option-name">{spell.name}</div>
                            <div className="arcanum-option-level">{spell.level}</div>
                            <div className={`arcanum-option-check ${isCurrentlySelected ? 'checked' : ''}`}>
                              {isCurrentlySelected ? '✓' : ''}
                            </div>
                            <i
                              className="fa-solid fa-circle-info arcanum-option-info"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedArcanumSpell(isExpanded ? null : spell.index);
                              }}
                              title="View spell details"
                            />
                          </div>
                          {isExpanded && (
                            <div className="arcanum-option-details">
                              {spell.description && spell.description[0] && (
                                <div
                                  className="arcanum-option-desc"
                                  dangerouslySetInnerHTML={{ __html: renderMarkdown(spell.description[0]) }}
                                />
                              )}
                              <div className="arcanum-option-meta">
                                {spell.school && <span>School: {spell.school}</span>}
                                {spell.casting_time && <span>Casting: {spell.casting_time}</span>}
                                {spell.ritual && <span>Ritual</span>}
                                {spell.concentration && <span>Concentration</span>}
                                {spell.duration && <span>Duration: {spell.duration}</span>}
                                {spell.components && <span>Components: {spell.components.join(', ')}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    const magicInitiateFeats = (formData.feats || []).filter(f => f === 'Magic Initiate' || (typeof f === 'object' && f.name === 'Magic Initiate'));
    const hasMagicInitiate = magicInitiateFeats.length > 0;

    return (
        <div className="wizard-step-spells">
      {showMagicInitiateModal && (
        <MagicInitiateModal
          formData={formData}
          allSpells={allSpells}
          onArrayFieldChange={onArrayFieldChange}
          onClose={() => setShowMagicInitiateModal(false)}
        />
      )}
      {renderArcanumSelection()}
      {hasMagicInitiate && !showMagicInitiateModal && (
        <div className="mi-wizard-banner">
          <button
            type="button"
            className="mi-wizard-edit-btn"
            onClick={() => setShowMagicInitiateModal(true)}
          >
            <i className="fa-solid fa-hat-wizard"></i> Edit Magic Initiate
          </button>
        </div>
      )}
        <SelectableList
        items={availableSpells}
        fieldName="spells"
        formData={formData}
        onArrayFieldChange={onArrayFieldChange}
        title="Step 9: Spells"
        searchPlaceholder="Search spells..."
        filters={filters}
        renderItem={renderItem}
        renderSummary={renderSummary}
        loadingMessage="Spell data not yet loaded. Please try again."
        preSelectedItems={preSelected}
        resultLabel="spell"
       />
       </div>
     );
}

export default WizardStepSpells;
