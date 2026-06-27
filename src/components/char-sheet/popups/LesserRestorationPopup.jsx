import { useCallback } from 'react';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import utils from '../../../services/ui/utils.js';
import TargetWithCheckboxesPopup from './TargetWithCheckboxesPopup';

const ALLOWED_CONDITIONS = [
  { id: 'blinded', label: 'Blinded' },
  { id: 'deafened', label: 'Deafened' },
  { id: 'paralyzed', label: 'Paralyzed' },
  { id: 'poisoned', label: 'Poisoned' },
];

function conditionMatches(c, targetCondition) {
  return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

export default function LesserRestorationPopup({ spell, campaignName, creatureTargets, range, onConfirm, onSkip, ...rest }) {
  const loadTargetData = useCallback(async (targetName) => {
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
    const applicableConditions = allConditions.filter(c =>
      ALLOWED_CONDITIONS.some(ac => conditionMatches(c, ac.id))
    );

    return ALLOWED_CONDITIONS
      .filter(c => applicableConditions.some(a => conditionMatches(a, c.id)))
      .map(c => ({ id: c.id, label: `${c.label} condition`, selectionData: { condition: c.id } }));
  }, [campaignName]);

  return (
    <TargetWithCheckboxesPopup
      spell={spell}
      campaignName={campaignName}
      creatureTargets={creatureTargets}
      range={range}
      onConfirm={({ targetName, selections }) => {
        onConfirm({ targetName, condition: selections[0]?.condition });
      }}
      onSkip={onSkip}
      {...rest}
      icon="fa-solid fa-hand-holding-medical"
      title="Lesser Restoration"
      school="Abjuration"
      defaultLevel={2}
      description="Choose a creature within range and select one condition to remove. This spell can end one condition on the target: Blinded, Deafened, Paralyzed, or Poisoned."
      loadTargetData={loadTargetData}
      noItemsMessage="No applicable conditions found on this target"
      confirmLabel="Cast Lesser Restoration"
    />
  );
}
