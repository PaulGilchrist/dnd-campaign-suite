import { useEffect } from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import utils from '../../services/ui/utils.js'
import { rollExpression } from '../../services/dice/diceRoller.js';

export default function useInitiativeEffects(playerStats, campaignName, rollDamage) {
    // Passive: recover Focus Points and Wild Shape uses when anyone rolls initiative
    useEffect(() => {
        const handleInitiativeRolled = (e) => {
            if (!playerStats || !e.detail || !e.detail.characterName) return;
            const rollingName = utils.getName(e.detail.characterName);
            const myName = utils.getName(playerStats.name);
            if (rollingName !== myName) return;

            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);

            // Check for Perfect Focus (Monk level 15)
            const hasPerfectFocus = (playerStats.automation?.passives ?? []).some(p => p.type === 'passive_rule' && p.effect === 'perfect_focus');

            // Check if Uncanny Metabolism was used this initiative
            const uncannyMetabolismUsed = getRuntimeValue(playerStats.name, 'uncannyMetabolismUsed', campaignName) === true;

            // Recover Focus Points (Monk Uncanny Metabolism passive)
            const hasFocusPointsAction = playerStats.actions?.some(a => a.automation?.type === 'initiative_action' && a.automation?.effect !== 'wild_shape_regen_on_initiative');
            if (hasFocusPointsAction && !hasPerfectFocus) {
                const maxFP = classLevel?.focus_points || getRuntimeValue(playerStats.name, 'focusPoints', campaignName) || 0;
                if (maxFP > 0) {
                    const currentFP = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? 0);
                    if (currentFP < maxFP) {
                        setRuntimeValue(playerStats.name, 'focusPoints', maxFP, campaignName);
                    }
                }
            }

            // Perfect Focus: recover to 4 if ≤ 3 and Uncanny Metabolism not used
            if (hasPerfectFocus && !uncannyMetabolismUsed) {
                const focusPointsTarget = 4;
                const focusPointsThreshold = 3;
                const maxFP = classLevel?.focus_points || 0;
                const currentFP = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? 0);
                if (currentFP <= focusPointsThreshold && currentFP < maxFP) {
                    const newFP = Math.min(focusPointsTarget, maxFP);
                    if (newFP > currentFP) {
                        setRuntimeValue(playerStats.name, 'focusPoints', newFP, campaignName);
                    }
                }
            }

            // Recover Wild Shape use on initiative (Archdruid Evergreen Wild Shape)
            const hasEvergreen = playerStats.actions?.some(a => a.automation?.type === 'initiative_action' && a.automation?.effect === 'wild_shape_regen_on_initiative');
            if (hasEvergreen) {
                const druidLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                const maxWS = druidLevel?.wild_shape || 0;
                if (maxWS > 0) {
                    const currentWS = Number(getRuntimeValue(playerStats.name, 'wildShapeUses', campaignName) ?? 0);
                    if (currentWS === 0) {
                        setRuntimeValue(playerStats.name, 'wildShapeUses', 1, campaignName);
                    }
                }
            }

            // Recover Rage uses on initiative (Persistent Rage - Barbarian level 15)
            const hasPersistentRage = (playerStats.automation?.passives ?? []).some(p => p.type === 'passive_rule' && p.effect === 'persistent_rage');
            if (hasPersistentRage && playerStats.class?.name === 'Barbarian') {
                const rageCount = classLevel?.rages || 0;
                if (rageCount > 0) {
                    const currentRage = Number(getRuntimeValue(playerStats.name, 'ragePoints', campaignName) ?? rageCount);
                    if (currentRage < rageCount) {
                        setRuntimeValue(playerStats.name, 'ragePoints', rageCount, campaignName);
                    }
                }
            }

            // Regain Bardic Inspiration on initiative (Bard level 18/20 Superior Inspiration)
            const hasSuperiorInspiration = (playerStats.automation?.actions ?? []).some(a => a.type === 'initiative_action' && a.effect === 'regain_bardic_inspiration_on_initiative');
            if (hasSuperiorInspiration && playerStats.class?.name === 'Bard') {
                const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                const maxBI = classLevel?.bardic_inspiration_uses ?? playerStats?.proficiency ?? 0;
                const currentBI = Number(getRuntimeValue(playerStats.name, 'bardicInspirationUses', campaignName) ?? maxBI);
                const minTarget = 2;
                if (currentBI < minTarget) {
                    const newBI = Math.min(maxBI, minTarget);
                    setRuntimeValue(playerStats.name, 'bardicInspirationUses', newBI, campaignName);
                }
            }
        };

        window.addEventListener('initiative-rolled', handleInitiativeRolled);

        return () => {
            window.removeEventListener('initiative-rolled', handleInitiativeRolled);
        };
    }, [playerStats, campaignName]);

    // Apply Searing Undead Radiant damage when Turn Undead resolves
    useEffect(() => {
        const handleTurnUndeadResult = (e) => {
            if (!playerStats || !e.detail) return;
            const { failedTargets, attackerName, campaignName: eventCampaign } = e.detail;
            if (attackerName !== playerStats.name) return;
            if (campaignName !== eventCampaign) return;

            const searingUndead = playerStats.automation?.actions?.find(
                a => a.type === 'damage_bonus' && a.trigger === 'turn_undead_fail'
            );
            if (!searingUndead) return;

            const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
            const wisMod = Math.max(1, wis?.bonus || 0);
            const expr = `${wisMod}d8`;
            const result = rollExpression(expr);
            if (!result) return;

            const baseContext = {
                damageType: searingUndead.damageType || 'Radiant',
                attackerName: playerStats.name,
                saveDc: e.detail.saveDc,
                saveType: e.detail.saveType,
                dcSuccess: false,
            };

            for (const targetName of failedTargets) {
                rollDamage(
                    searingUndead.name,
                    expr,
                    result.total,
                    result.rolls,
                    result.modifier,
                    { ...baseContext, targetName }
                );
            }
        };

        window.addEventListener('turn-undead-result', handleTurnUndeadResult);
        return () => window.removeEventListener('turn-undead-result', handleTurnUndeadResult);
    }, [playerStats, campaignName, rollDamage]);
}
