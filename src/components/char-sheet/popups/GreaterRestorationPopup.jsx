import { useCallback } from 'react';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import utils from '../../../services/ui/utils.js';
import TargetWithCheckboxesPopup from './TargetWithCheckboxesPopup';

const RESTORATION_CONDITIONS = [
  { id: 'charmed', label: 'Charmed' },
  { id: 'petrified', label: 'Petrified' },
];

function conditionMatches(c, targetCondition) {
  return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

export default function GreaterRestorationPopup({ spell, campaignName, creatureTargets, range, onConfirm, onSkip, ...rest }) {
  const loadTargetData = useCallback(async (targetName) => {
    const result = [];
    const conditions = getRuntimeValue(targetName, 'activeConditions') || [];

    let csConditions = [];
    try {
      const cs = await getCombatSummary(campaignName);
      if (cs) {
        const creature = cs.creatures?.find(c => utils.getName(c.name) === utils.getName(targetName));
        if (creature && Array.isArray(creature.conditions)) {
          csConditions = creature.conditions.map(c => c.key);
        }
      }
    } catch { /* ignore */ }

    const allConditions = [...new Set([...conditions, ...csConditions])];

    const exhaustion = getRuntimeValue(targetName, 'exhaustionLevel') || 0;
    if (exhaustion > 0) {
      result.push({ id: 'exhaustion', label: `Exhaustion level (current: ${exhaustion})`, selectionData: { type: 'exhaustion' } });
    }

    RESTORATION_CONDITIONS
      .filter(c => allConditions.some(cond => conditionMatches(cond, c.id)))
      .forEach(c => {
        result.push({ id: c.id, label: `${c.label} condition`, selectionData: { type: 'condition', condition: c.id } });
      });

    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
    const hasCurse = activeBuffs.some(b => b.type === 'cursed' || b.cursed);
    if (hasCurse) {
      result.push({ id: 'curse', label: 'Curse (including attunement to cursed magic item)', selectionData: { type: 'curse' } });
    }

    const abilityReductions = getRuntimeValue(targetName, 'abilityReductions') || {};
    if (Object.keys(abilityReductions).length > 0) {
      result.push({ id: 'ability_reduction', label: 'Ability score reduction', selectionData: { type: 'ability_reduction' } });
    }

    const hpMaxReduction = getRuntimeValue(targetName, 'hpMaxReduction') || 0;
    if (hpMaxReduction > 0) {
      result.push({ id: 'hp_max_reduction', label: 'Hit Point maximum reduction', selectionData: { type: 'hp_max_reduction' } });
    }

    return result;
  }, [campaignName]);

  return (
    <TargetWithCheckboxesPopup
      spell={spell}
      campaignName={campaignName}
      creatureTargets={creatureTargets}
      range={range}
      onConfirm={onConfirm}
      onSkip={onSkip}
      {...rest}
      icon="fa-solid fa-hand-holding-medical"
      title="Greater Restoration"
      school="Abjuration"
      defaultLevel={5}
      description={
        <span>
          Choose a creature within <strong>{range}</strong> and select the effect(s) to remove.
          This spell can remove one or more of the following from the target:
          an exhaustion level, the Charmed or Petrified condition, a curse (including attunement to a cursed magic item),
          any reduction to an ability score, or any reduction to the target's Hit Point maximum.
        </span>
      }
      loadTargetData={loadTargetData}
      noItemsMessage="No removable effects found on this target"
      confirmLabel="Cast Greater Restoration"
    />
  );
}
