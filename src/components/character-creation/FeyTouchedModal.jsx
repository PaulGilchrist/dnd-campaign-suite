import { useState, useCallback, useMemo } from 'react';
import SpellDetails from './SpellDetails.jsx';
import './MagicInitiateModal.css';

function FeyTouchedModal({ formData, allSpells, onArrayFieldChange, onClose }) {
  const existingSpell = formData.feyTouchedSpell;
  const [selectedSpell, setSelectedSpell] = useState(() => existingSpell || null);
  const [expandedSpell, setExpandedSpell] = useState(null);
  const [errors, setErrors] = useState({});

  const filteredSpells = useMemo(() => {
    if (!allSpells) return [];
    return allSpells;
  }, [allSpells]);

  const getLevel1SpellsForSchool = useCallback((schools) => {
    return filteredSpells.filter(spell => {
      if (spell.level !== 1) return false;
      const school = spell.school;
      if (!school) return false;
      const schoolName = school.charAt(0).toUpperCase() + school.slice(1);
      return schools.includes(schoolName);
    });
  }, [filteredSpells]);

  const divinationEnchantmentSpells = useMemo(() => {
    return getLevel1SpellsForSchool(['Divination', 'Enchantment']);
  }, [getLevel1SpellsForSchool]);

  const validateSpell = () => {
    const errs = {};
    if (!selectedSpell) {
      errs.spell = 'You must choose one level 1 Divination or Enchantment spell';
    }
    if (selectedSpell) {
      const spell = filteredSpells.find(s => s.name === selectedSpell);
      if (spell) {
        const school = spell.school;
        const schoolName = school.charAt(0).toUpperCase() + school.slice(1);
        if (!['Divination', 'Enchantment'].includes(schoolName)) {
          errs.spell = 'Spell must be from Divination or Enchantment school';
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveSpell = () => {
    if (!validateSpell()) return;

    const existingSpells = formData.spells || [];
    const newSpells = [...new Set([...existingSpells, selectedSpell])];
    onArrayFieldChange('spells', newSpells);

    onArrayFieldChange('feyTouchedSpell', selectedSpell);

    onClose();
  };

  const getSpellDetails = (spellName) => {
    if (!spellName) return null;
    return filteredSpells.find(s => s.name === spellName);
  };

  return (
    <div className="mi-overlay" onClick={onClose}>
      <div className="mi-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mi-header">
          <i className="fa-solid fa-leaf"></i> Fey Magic
        </div>
        <div className="mi-body">
          <p className="mi-description">
            Choose one level 1 spell from the Divination or Enchantment school of magic. You always have that spell and the Misty Step spell prepared. You can cast each of these spells without expending a spell slot. Once you cast either spell in this way, you can't cast that spell in this way again until you finish a Long Rest.
          </p>

          <div className="mi-selector">
            <label className="mi-selector-label">Level 1 Spell:</label>
            <select
              className="mi-selector-select"
              value={selectedSpell || ''}
              onChange={(e) => {
                setSelectedSpell(e.target.value || null);
                setErrors({});
              }}
            >
              <option value="">Select a spell...</option>
              {divinationEnchantmentSpells.map(spell => (
                <option key={spell.name} value={spell.name}>
                  {spell.name} ({spell.school})
                </option>
              ))}
            </select>
            {selectedSpell && (
              <SpellDetails
                spell={getSpellDetails(selectedSpell)}
                expanded={expandedSpell === selectedSpell}
                onToggle={() => setExpandedSpell(expandedSpell === selectedSpell ? null : selectedSpell)}
              />
            )}
            {errors.spell && <span className="mi-error">{errors.spell}</span>}
          </div>

          <div className="mi-save-all">
            <button type="button" className="mi-save-all-btn" onClick={saveSpell}>
              <i className="fa-solid fa-check"></i> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShadowTouchedModal({ formData, allSpells, onArrayFieldChange, onClose }) {
  const existingSpell = formData.shadowTouchedSpell;
  const [selectedSpell, setSelectedSpell] = useState(() => existingSpell || null);
  const [expandedSpell, setExpandedSpell] = useState(null);
  const [errors, setErrors] = useState({});

  const filteredSpells = useMemo(() => {
    if (!allSpells) return [];
    return allSpells;
  }, [allSpells]);

  const getLevel1SpellsForSchool = useCallback((schools) => {
    return filteredSpells.filter(spell => {
      if (spell.level !== 1) return false;
      const school = spell.school;
      if (!school) return false;
      const schoolName = school.charAt(0).toUpperCase() + school.slice(1);
      return schools.includes(schoolName);
    });
  }, [filteredSpells]);

  const illusionNecromancySpells = useMemo(() => {
    return getLevel1SpellsForSchool(['Illusion', 'Necromancy']);
  }, [getLevel1SpellsForSchool]);

  const validateSpell = () => {
    const errs = {};
    if (!selectedSpell) {
      errs.spell = 'You must choose one level 1 Illusion or Necromancy spell';
    }
    if (selectedSpell) {
      const spell = filteredSpells.find(s => s.name === selectedSpell);
      if (spell) {
        const school = spell.school;
        const schoolName = school.charAt(0).toUpperCase() + school.slice(1);
        if (!['Illusion', 'Necromancy'].includes(schoolName)) {
          errs.spell = 'Spell must be from Illusion or Necromancy school';
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveSpell = () => {
    if (!validateSpell()) return;

    const existingSpells = formData.spells || [];
    const newSpells = [...new Set([...existingSpells, selectedSpell])];
    onArrayFieldChange('spells', newSpells);

    onArrayFieldChange('shadowTouchedSpell', selectedSpell);

    onClose();
  };

  const getSpellDetails = (spellName) => {
    if (!spellName) return null;
    return filteredSpells.find(s => s.name === spellName);
  };

  return (
    <div className="mi-overlay" onClick={onClose}>
      <div className="mi-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mi-header">
          <i className="fa-solid fa-mask"></i> Shadow Magic
        </div>
        <div className="mi-body">
          <p className="mi-description">
            Choose one level 1 spell from the Illusion or Necromancy school of magic. You always have that spell and the Invisibility spell prepared. You can cast each of these spells without expending a spell slot. Once you cast either spell in this way, you can't cast that spell in this way again until you finish a Long Rest.
          </p>

          <div className="mi-selector">
            <label className="mi-selector-label">Level 1 Spell:</label>
            <select
              className="mi-selector-select"
              value={selectedSpell || ''}
              onChange={(e) => {
                setSelectedSpell(e.target.value || null);
                setErrors({});
              }}
            >
              <option value="">Select a spell...</option>
              {illusionNecromancySpells.map(spell => (
                <option key={spell.name} value={spell.name}>
                  {spell.name} ({spell.school})
                </option>
              ))}
            </select>
            {selectedSpell && (
              <SpellDetails
                spell={getSpellDetails(selectedSpell)}
                expanded={expandedSpell === selectedSpell}
                onToggle={() => setExpandedSpell(expandedSpell === selectedSpell ? null : selectedSpell)}
              />
            )}
            {errors.spell && <span className="mi-error">{errors.spell}</span>}
          </div>

          <div className="mi-save-all">
            <button type="button" className="mi-save-all-btn" onClick={saveSpell}>
              <i className="fa-solid fa-check"></i> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeyTouchedModal;
export { ShadowTouchedModal };
