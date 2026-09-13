import React, { useState, useCallback, useMemo } from 'react';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import { triggerSleep } from '../../../../services/rules/features/sleepService.js';

function SleepModal({
    action,
    spell,
    playerStats,
    campaignName,
    saveType,
    saveDc,
    characters,
    metamagicHeighten,
    onClose,
}) {
    const [heightenTarget, setHeightenTarget] = useState(null);

    const combatSummary = getCombatSummary(campaignName);

    const eligibleTargets = useMemo(() => {
        if (!combatSummary?.creatures) return [];
        return combatSummary.creatures
            .filter(c => c.name !== playerStats.name)
            .map(c => ({
                name: c.name,
                type: c.type,
                currentHp: c.currentHp,
                maxHp: c.maxHp,
            }));
    }, [combatSummary, playerStats.name]);

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name}: Selecting ${selectedNames.length} target(s) for WIS save (DC ${saveDc}).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SleepModal] Error logging feature use:', e); });

        await triggerSleep({
            spell: spell || { name: action.name, level: 1 },
            metaCtx: { spellSaveDc: saveDc, selectedTargets: selectedNames, heightenTarget },
            playerStats,
            campaignName,
            mapName: null,
            characters
        });

        onClose();
    }, [campaignName, playerStats, action.name, saveDc, spell, heightenTarget, characters, onClose]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    return (
        <CreatureSelectionModal
            title={action.name}
            icon="fa-moon"
            targets={eligibleTargets}
            description={`Select creatures in the 5-foot-radius Sphere. Each must make a <strong>${saveType || 'WIS'}</strong> saving throw (DC ${saveDc}).`}
            note={`On a failed save, target becomes <strong>Incapacitated</strong> until the end of its next turn, then repeats the save — failing again means <strong>Unconscious</strong> for the duration. The spell ends on a target early if it takes damage or is shaken awake. Creatures that don't sleep (elves, undead, constructs) or are immune to Exhaustion automatically succeed.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`}
            confirmLabel={action.name}
            confirmIcon="fa-moon"
            onConfirm={handleCreatureSelectionConfirm}
            onSkip={handleCreatureSelectionSkip}
            metamagicHeighten={metamagicHeighten}
            heightenTarget={heightenTarget}
            setHeightenTarget={setHeightenTarget}
        />
    );
}

export default SleepModal;
