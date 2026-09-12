import { useState, useEffect, useCallback, useMemo } from 'react';
import SelectableList from './SelectableList.jsx';
import SpellListItem from './SpellListItem.jsx';
import WarningList from '../common/WarningList.jsx';
import { getSpellLimits, validateSpellSelection } from '../../services/rules/spells/spellLimits.js';
import { getSpellValidationInfo } from '../../services/rules/spells/spellValidation.js';
import { renderMarkdown } from '../../services/ui/sanitize.js';
import MagicInitiateModal from './MagicInitiateModal.jsx';
import FeyTouchedModal, { ShadowTouchedModal } from './FeyTouchedModal.jsx';
import RitualMasterModal from './RitualMasterModal.jsx';
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

// Banner offering to reopen a feat configuration modal
function FeatEditBanner({ icon, children, onClick }) {
  return (
    <div className="mi-wizard-banner">
      <button
        type="button"
        className="mi-wizard-edit-btn"
        onClick={onClick}
      >
        <i className={`fa-solid ${icon}`}></i> {children}
      </button>
    </div>
  );
}

const featNameMatches = (feat, name) =>
  feat === name || (typeof feat === 'object' && feat.name === name);

// Edit banners shown when a feat is selected, configured, and its modal is closed
function getEditBannerDescriptors({ formData, modals }) {
  const feats = formData.feats || [];
  const ritualMasterChosenCount = (formData.ritualMasterSpells || []).length;
  const descriptors = [];
  if (feats.some(f => featNameMatches(f, 'Magic Initiate')) && !modals.magicInitiate) {
    descriptors.push({ id: 'magic-initiate', modal: 'magicInitiate', icon: 'fa-hat-wizard', label: 'Edit Magic Initiate' });
  }
  if (feats.some(f => featNameMatches(f, 'Fey Touched')) && formData.feyTouchedSpell && !modals.feyTouched) {
    descriptors.push({ id: 'fey-touched', modal: 'feyTouched', icon: 'fa-leaf', label: 'Edit Fey Magic' });
  }
  if (feats.some(f => featNameMatches(f, 'Shadow Touched')) && formData.shadowTouchedSpell && !modals.shadowTouched) {
    descriptors.push({ id: 'shadow-touched', modal: 'shadowTouched', icon: 'fa-mask', label: 'Edit Shadow Magic' });
  }
  const hasRitualMaster = feats.some(f => featNameMatches(f, 'Ritual Master') || (typeof f === 'object' && f.index === 'ritual-master'));
  if (hasRitualMaster && ritualMasterChosenCount > 0 && !modals.ritualMaster) {
    descriptors.push({ id: 'ritual-master', modal: 'ritualMaster', icon: 'fa-scroll', label: `Edit Ritual Spells (${ritualMasterChosenCount})` });
  }
  return descriptors;
}

// Mystic Arcanum selection component for Warlock
function WizardStepSpells({ formData, allSpells, onArrayFieldChange, preSelectedSpells }) {
  const preSelected = useMemo(() => preSelectedSpells || [], [preSelectedSpells]);
  const isWarlock = formData?.class?.name === 'Warlock';
  const charLevel = parseInt(formData?.level) || 1;
  const [expandedArcanumSpell, setExpandedArcanumSpell] = useState(null);
  const [showMagicInitiateModal, setShowMagicInitiateModal] = useState(false);
  const [showFeyTouchedModal, setShowFeyTouchedModal] = useState(false);
  const [showShadowTouchedModal, setShowShadowTouchedModal] = useState(false);
  const [showRitualMasterModal, setShowRitualMasterModal] = useState(false);
  const miSpells = useMemo(() => {
    const spells = new Set();
    (formData.magicInitiateInstances || []).forEach(inst => {
      if (inst.cantrips?.[0]) spells.add(inst.cantrips[0]);
      if (inst.cantrips?.[1]) spells.add(inst.cantrips[1]);
      if (inst.level1Spell) spells.add(inst.level1Spell);
    });
    return spells;
  }, [formData.magicInitiateInstances]);

  const ftSpells = useMemo(() => {
    const spells = new Set();
    if (formData.feyTouchedSpell) spells.add(formData.feyTouchedSpell);
    return spells;
  }, [formData.feyTouchedSpell]);

  const stSpells = useMemo(() => {
    const spells = new Set();
    if (formData.shadowTouchedSpell) spells.add(formData.shadowTouchedSpell);
    return spells;
  }, [formData.shadowTouchedSpell]);

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

  // Show Fey Touched modal when feat is selected and spell not yet configured
  useEffect(() => {
    const feats = formData.feats || [];
    const hasFeyTouched = feats.some(f => f === 'Fey Touched' || f.index === 'fey-touched');
    if (!hasFeyTouched) {
      return;
    }
    if (!formData.feyTouchedSpell) {
      setShowFeyTouchedModal(true);
    }
  }, [formData.feats, formData.feyTouchedSpell]);

  // Show Shadow Touched modal when feat is selected and spell not yet configured
  useEffect(() => {
    const feats = formData.feats || [];
    const hasShadowTouched = feats.some(f => f === 'Shadow Touched' || f.index === 'shadow-touched');
    if (!hasShadowTouched) {
      return;
    }
    if (!formData.shadowTouchedSpell) {
      setShowShadowTouchedModal(true);
    }
  }, [formData.feats, formData.shadowTouchedSpell]);

  // FT-068: Show Ritual Master modal when feat is selected and no ritual spells chosen yet
  useEffect(() => {
    const feats = formData.feats || [];
    const hasRitualMaster = feats.some(f => f === 'Ritual Master' || (typeof f === 'object' && (f.name === 'Ritual Master' || f.index === 'ritual-master')));
    if (!hasRitualMaster) {
      return;
    }
    const chosen = formData.ritualMasterSpells;
    if (!chosen || !Array.isArray(chosen) || chosen.length === 0) {
      setShowRitualMasterModal(true);
    }
  }, [formData.feats, formData.ritualMasterSpells]);

    // Calculate spell counts by level (excluding pre-selected spells and Magic Initiate spells)
    useEffect(() => {   
      const counts = { cantrip: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 };
      
      if (formData.spells && formData.spells.length > 0) {
        formData.spells.forEach(spellName => {
          if (preSelected.includes(spellName)) return;
          if (miSpells.has(spellName)) return;
          if (ftSpells.has(spellName)) return;
          if (stSpells.has(spellName)) return;
          const spell = allSpells.find(s => s.name === spellName || s.index === spellName);
          if (spell) {
            const level = spell.level !== undefined ? spell.level : 0;
            const levelKey = level === 0 ? 'cantrip' : `level${level}`;
            counts[levelKey] = (counts[levelKey] || 0) + 1;
           }
          });
       }
       
      setSpellCounts(counts);
      }, [formData.spells, allSpells, preSelected, miSpells, ftSpells, stSpells]);

     const availableSpells = allSpells || [];

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

   // Render item function
  const renderItem = (spell, index, { isSelected, isPreSelected, isExpanded, onToggle, onToggleExpand }) => (
    <SpellListItem
      spell={spell}
      index={index}
      isSelected={isSelected}
      isPreSelected={isPreSelected}
      isExpanded={isExpanded}
      onToggle={onToggle}
      onToggleExpand={onToggleExpand}
    />
  );

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

    const editBannerDescriptors = getEditBannerDescriptors({
      formData,
      modals: {
        magicInitiate: showMagicInitiateModal,
        feyTouched: showFeyTouchedModal,
        shadowTouched: showShadowTouchedModal,
        ritualMaster: showRitualMasterModal,
      },
    });
    const openFeatModal = (modal) => {
      if (modal === 'magicInitiate') setShowMagicInitiateModal(true);
      else if (modal === 'feyTouched') setShowFeyTouchedModal(true);
      else if (modal === 'shadowTouched') setShowShadowTouchedModal(true);
      else setShowRitualMasterModal(true);
    };

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
      {showFeyTouchedModal && (
        <FeyTouchedModal
          formData={formData}
          allSpells={allSpells}
          onArrayFieldChange={onArrayFieldChange}
          onClose={() => setShowFeyTouchedModal(false)}
        />
      )}
      {showShadowTouchedModal && (
        <ShadowTouchedModal
          formData={formData}
          allSpells={allSpells}
          onArrayFieldChange={onArrayFieldChange}
          onClose={() => setShowShadowTouchedModal(false)}
        />
      )}
      {showRitualMasterModal && (
        <RitualMasterModal
          formData={formData}
          allSpells={allSpells}
          onArrayFieldChange={onArrayFieldChange}
          onClose={() => setShowRitualMasterModal(false)}
        />
      )}
      {renderArcanumSelection()}
      {editBannerDescriptors.map((banner) => (
        <FeatEditBanner
          key={banner.id}
          icon={banner.icon}
          onClick={() => openFeatModal(banner.modal)}
        >
          {banner.label}
        </FeatEditBanner>
      ))}
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
