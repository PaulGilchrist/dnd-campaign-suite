import { useEffect, useRef, useState, useCallback } from 'react';
import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';
import { mergeDeduplicated } from '../../services/shared/buffApplier.js';

function buildFormDataWithBuffs(prev, buffs) {
  const next = { ...prev };
  next.abilities = (prev.abilities || []).map(a => ({ ...a }));

  const nonChoiceIncreases = buffs.abilityScoreIncreases.filter(inc => inc.name && inc.name !== 'any');
  nonChoiceIncreases.forEach(inc => {
    const ability = next.abilities.find(
      a => a.name.toLowerCase() === inc.name.toLowerCase()
    );
    if (ability) {
      ability.featIncrease = (ability.featIncrease || 0) + inc.amount;
    }
  });

  if (buffs.resistances.length > 0) {
    mergeDeduplicated(next, 'resistances', buffs.resistances);
  }

  const allSkillProfs = (buffs.proficiencies || []).filter(p => p.name === 'all_skills' && p.type === 'skill');
  if (allSkillProfs.length > 0) {
    const existingSkills = new Set(prev.skillProficiencies || []);
    const skillNames = ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'];
    const newSkills = skillNames.filter(s => !existingSkills.has(s));
    if (newSkills.length > 0) {
      next.skillProficiencies = [...(prev.skillProficiencies || []), ...newSkills];
    }
  }

  const featProficiencies = (buffs.proficiencies || []).filter(
    p => p.type === 'proficiency' && p.isChoice
  );
  if (featProficiencies.length > 0) {
    const existingProfs = new Set(prev.proficiencies || []);
    featProficiencies.forEach(fp => {
      if (fp.choose && fp.from) {
        const listName = fp.from[0];
        const profName = `${fp.choose} from: ${listName}`;
        if (!existingProfs.has(profName)) {
          next.proficiencies = [...(prev.proficiencies || []), profName];
          existingProfs.add(profName);
        }
      }
    });
  }

  return next;
}

function useWizardFeatBuffs(formData, allFeats, setFormData) {
  const [computedBuffs, setComputedBuffs] = useState(null);
  const prevFeatsRef = useRef([]);

  const applyBuffs = useCallback((buffs) => {
    setFormData(prev => buildFormDataWithBuffs(prev, buffs));
  }, [setFormData]);

  const clearBuffs = useCallback(() => {
    setFormData(prev => {
      if (!prev.abilities) return prev;
      const nonChoiceIncreases = (computedBuffs?.abilityScoreIncreases || []).filter(inc => inc.name && inc.name !== 'any');
      return {
        ...prev,
        abilities: prev.abilities.map(a => {
          const ability = { ...a };
          nonChoiceIncreases.forEach(inc => {
            if (ability.name.toLowerCase() === inc.name.toLowerCase()) {
              ability.featIncrease = (ability.featIncrease || 0) - inc.amount;
            }
          });
          return ability;
        }),
      };
    });
  }, [setFormData, computedBuffs]);

  useEffect(() => {
    const currentFeats = formData.feats || [];
    const prev = prevFeatsRef.current;

    const changed =
      currentFeats.length !== prev.length ||
      currentFeats.some(f => !prev.includes(f)) ||
      prev.some(f => !currentFeats.includes(f));

    if (!changed) return;

    prevFeatsRef.current = [...currentFeats];

    if (currentFeats.length > 0 && allFeats.length > 0) {
      const buffs = computeAllFeatBuffs(formData, allFeats);
      clearBuffs();
      applyBuffs(buffs);
      setComputedBuffs(buffs);
    } else {
      if (prevFeatsRef.current.length === 0) {
        clearBuffs();
      }
      setComputedBuffs(null);
    }
  }, [formData, allFeats, applyBuffs, clearBuffs]);

  return { computedBuffs };
}

export default useWizardFeatBuffs;
