import { useCallback } from 'react';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import TargetWithCheckboxesPopup from './TargetWithCheckboxesPopup';

export default function RemoveCursePopup({ spell, creatureTargets, range, onConfirm, onSkip, ...rest }) {
  const loadTargetData = useCallback(async (targetName) => {
    const result = [];

    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
    const cursedBuffs = activeBuffs.filter(b => b.type === 'cursed' || b.cursed);
    if (cursedBuffs.length > 0) {
      result.push({ id: 'curse', label: `Curse (${cursedBuffs.length} cursed effect(s))`, selectionData: { type: 'curse' } });
    }

    const attunement = getRuntimeValue(targetName, 'attunement') || [];
    if (attunement.length > 0) {
      result.push({ id: 'attunement', label: `Attunement (${attunement.length} attuned item(s))`, selectionData: { type: 'attunement' } });
    }

    return result;
  }, []);

  return (
    <TargetWithCheckboxesPopup
      spell={spell}
      creatureTargets={creatureTargets}
      range={range}
      onConfirm={onConfirm}
      onSkip={onSkip}
      {...rest}
      icon="fa-solid fa-hand-holding-medical"
      title="Remove Curse"
      school="Abjuration"
      defaultLevel={3}
      description={
        <span>
          Choose a creature within <strong>{range}</strong>. This spell ends all curses affecting the target
          and breaks the target's attunement to any cursed magic items.
        </span>
      }
      loadTargetData={loadTargetData}
      noItemsMessage="No curses or attunement found on this target"
      confirmLabel="Cast Remove Curse"
    />
  );
}
