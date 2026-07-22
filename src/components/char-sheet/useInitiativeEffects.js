import { useEffect } from 'react'
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import utils from '../../services/ui/utils.js'
import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import * as storageService from '../../services/ui/storage.js';

export default function useInitiativeEffects(playerStats, campaignName, rollDamage) {
    // Passive: recover Focus Points and Wild Shape uses when anyone rolls initiative
    useEffect(() => {
        const handleInitiativeRolled = (e) => {
            if (!playerStats) return;

            const updates = {};

            // Reset Action Surge once-per-turn flag at the start of each turn
            updates.actionSurgeUsedThisRound = null;

            // Reset Psionic Strike once-per-turn flag on initiative (new combat)
            updates.psionicStrikeUsedThisTurn = null;

            // Reset Dread Ambush once-per-turn flag on initiative (new combat)
            updates.dreadAmbushUsedThisTurn = null;

            // Reset Hurl Through Hell once-per-turn flag on initiative (new combat)
            updates.hurlThroughHellTurnUsed = null;

            // Reset Portent once-per-turn flag on initiative (new combat)
            updates.portentUsedThisTurn = null;

            // Reset Relentless (Battle Master level 15) when the player rolls initiative
            const hasRelentless = (playerStats.automation?.passives ?? []).some(p => p.type === 'passive_rule' && p.effect === 'relentless');
            if (hasRelentless) {
                updates.relentlessUsedRound = null;
            }

            // Reset Boon of Combat Prowess and Stroke of Luck on initiative (new turn)
            updates.boonOfCombatProwessUsed = null;
            updates.strokeOfLuckUsed = null;

            if (!e.detail || !e.detail.characterName) return;
            const rollingName = utils.getName(e.detail.characterName);
            const myName = utils.getName(playerStats.name);
            if (rollingName !== myName) return;

            // Clear War God's Blessing active state on new combat
            setRuntimeValue(playerStats.name, '_War_Gods_Blessing_active', null, campaignName);

            // Clear Living Legend active state on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'livingLegendActive', null, campaignName);
            setRuntimeValue(playerStats.name, 'unerringStrikeUsed', null, campaignName);

            // Reset Boon of Combat Prowess and Stroke of Luck for the rolling character
            setRuntimeValue(playerStats.name, 'boonOfCombatProwessUsed', null, campaignName);
            setRuntimeValue(playerStats.name, 'strokeOfLuckUsed', null, campaignName);

            // Clear Living Legend active state on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'livingLegendActive', null, campaignName);
            setRuntimeValue(playerStats.name, 'unerringStrikeUsed', null, campaignName);

            // Clear Holy Nimbus active state on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'holyNimbusActive', null, campaignName);

            // Clear Elder Champion active state on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'elderChampionActive', false, campaignName);

            // Clear Avenging Angel active state on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'avengingAngelActive', false, campaignName);

            // Clear Vow of Enmity active state on initiative roll (new combat)
            const vowTarget = getRuntimeValue(playerStats.name, 'vowOfEnmityTarget', campaignName);
            setRuntimeValue(playerStats.name, 'vowOfEnmityTarget', null, campaignName);
            setRuntimeValue(playerStats.name, 'vowOfEnmityCostPaid', null, campaignName);
            if (vowTarget) {
                const targetBuffs = getRuntimeValue(vowTarget, 'activeBuffs', campaignName) || [];
                const filteredTargetBuffs = targetBuffs.filter(b => b.effect !== 'vow_of_enmity');
                setRuntimeValue(vowTarget, 'activeBuffs', filteredTargetBuffs, campaignName);
            }

            // Clear Revelation in Flesh active state on initiative roll (new combat)
            const revelationBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
            const filteredRevelationBuffs = revelationBuffs.filter(b => b.name !== 'Revelation in Flesh');
            if (filteredRevelationBuffs.length !== revelationBuffs.length) {
                setRuntimeValue(playerStats.name, 'activeBuffs', filteredRevelationBuffs, campaignName);
            }

            // Clear concentration on initiative roll (new combat round)
            const cs = getCombatSummary(campaignName);
            if (cs && cs.creatures) {
                const creature = cs.creatures.find(c => c.name === playerStats.name);
                if (creature?.concentration) {
                    creature.concentration = null;
                    storageService.default.set('combatSummary', cs, campaignName);
                }
            }

            // Clear Bastion of Law ward on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'bastionOfLawActive', null, campaignName);
            setRuntimeValue(playerStats.name, 'bastionOfLawWardDice', null, campaignName);
            setRuntimeValue(playerStats.name, 'bastionOfLawWardSource', null, campaignName);
            setRuntimeValue(playerStats.name, 'bastionOfLawWardUsed', null, campaignName);
            setRuntimeValue(playerStats.name, 'bastionOfLawLastAttackDamage', null, campaignName);

            // Clear Trance of Order on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'tranceOfOrderActive', null, campaignName);

            // Clear Large Form active state on initiative roll (rest-used flag persists)
            setRuntimeValue(playerStats.name, 'largeFormActive', null, campaignName);

            // Clear Superior Defense buff on initiative roll (new combat)
            const superiorDefenseBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
            const filteredSuperiorDefense = superiorDefenseBuffs.filter(b => b.name !== 'Superior Defense');
            if (filteredSuperiorDefense.length !== superiorDefenseBuffs.length) {
                setRuntimeValue(playerStats.name, 'activeBuffs', filteredSuperiorDefense, campaignName);
            }

            // Clear Awakened Mind buff and target on initiative roll (new combat)
            const awakenedMindBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
            const filteredAwakenedMind = awakenedMindBuffs.filter(b => b.name !== 'Awakened Mind');
            if (filteredAwakenedMind.length !== awakenedMindBuffs.length) {
                setRuntimeValue(playerStats.name, 'activeBuffs', filteredAwakenedMind, campaignName);
            }
            setRuntimeValue(playerStats.name, 'awakenedMindTarget', null, campaignName);

            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);

            // Check for Perfect Focus (Monk level 15)
            const hasPerfectFocus = (playerStats.automation?.passives ?? []).some(p => p.type === 'passive_rule' && p.effect === 'perfect_focus');

            // Check if Uncanny Metabolism was used this initiative
            const uncannyMetabolismUsed = getRuntimeValue(playerStats.name, 'uncannyMetabolismUsed', campaignName) === true;

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
            const hasEvergreen = (playerStats.automation?.actions ?? []).some(a => a.type === 'initiative_action' && a.effect === 'wild_shape_regen_on_initiative');
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

            if (Object.keys(updates).length > 0) {
                setRuntimeBatch(playerStats.name, updates, campaignName);
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
