import { useState, useCallback } from 'react';
import Popup from '../common/popup.jsx'
import MetamagicPopup from './popups/MetamagicPopup.jsx'
import CreatureSelectionModal from './modals/shared/CreatureSelectionModal.jsx'
import MagicMissileTargetPopup from './popups/MagicMissileTargetPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx'
import utils from '../../services/ui/utils.js'
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js'
import { getCombatSummary } from '../../services/encounters/combatData.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'

const ALLY_SELECTION_MODAL_SPECS = [
    {
        pending: 'actionPendingAid', onConfirm: 'actionHandleAidConfirm', onSkip: 'actionHandleAidSkip',
        title: 'Aid', icon: 'fa-hand-holding-heart', confirmLabel: 'Cast Aid',
        description: 'Your spell bolsters your allies with toughness and resolve. Choose up to 3 creatures within range.',
    },
    {
        pending: 'actionPendingBane', onConfirm: 'actionHandleBaneConfirm', onSkip: 'actionHandleBaneSkip',
        title: 'Bane', icon: 'fa-shield-halved', confirmLabel: 'Cast Bane',
        description: 'Curse up to three creatures of your choice that you can see within range. Affected creatures subtract 1d4 from attack rolls and saving throws.',
    },
    {
        pending: 'actionPendingBless', onConfirm: 'actionHandleBlessConfirm', onSkip: 'actionHandleBlessSkip',
        title: 'Bless', icon: 'fa-hands', confirmLabel: 'Cast Bless',
        description: 'You bless up to three creatures of your choice within range. Affected creatures add 1d4 to attack rolls and saving throws.',
    },
    {
        pending: 'actionPendingFaerieFire', onConfirm: 'actionHandleFaerieFireConfirm', onSkip: 'actionHandleFaerieFireSkip',
        title: 'Faerie Fire', icon: 'fa-fire', confirmLabel: 'Cast Faerie Fire', confirmIcon: 'fa-fire',
        description: 'Each creature in a 20-foot Cube within range must succeed on a Dexterity saving throw or be outlined in light for the duration. Affected creatures shed Dim Light in a 10-foot radius, can\'t benefit from the Invisible condition, and attack rolls against them have Advantage if the attacker can see them. Concentration, up to 1 minute.',
    },
    {
        pending: 'actionPendingBeaconOfHope', onConfirm: 'actionHandleBeaconOfHopeConfirm', onSkip: 'actionHandleBeaconOfHopeSkip',
        title: 'Beacon of Hope', icon: 'fa-heart-pulse', confirmLabel: 'Cast Beacon of Hope',
        description: 'This spell bestows hope and vitality. Choose any number of creatures within range. For the duration, each target has advantage on wisdom saving throws and death saving throws, and regains the maximum number of hit points possible from any healing.',
    },
    {
        pending: 'actionPendingPassWithoutTrace', onConfirm: 'actionHandlePassWithoutTraceConfirm', onSkip: 'actionHandlePassWithoutTraceSkip',
        title: 'Pass Without Trace', icon: 'fa-ghost', confirmLabel: 'Cast Pass Without Trace',
        description: 'A veil of shadows and silence radiates from you, masking you and your companions from detection. Choose creatures within 30 feet of you. Each chosen creature has a +10 bonus to Dexterity (Stealth) checks and can\'t be tracked except by magical means.',
    },
];

const TOUCH_TARGET_MODAL_SPECS = [
    {
        pending: 'actionPendingHaste', onConfirm: 'actionHandleHasteConfirm', onSkip: 'actionHandleHasteSkip',
        title: 'Haste', confirmLabel: 'Cast Haste', confirmIcon: 'fa-bolt', pick: 'array',
        description: 'Choose a willing creature within range. Target\'s speed doubles, gains +2 AC, and gets advantage on DEX saves.',
    },
    {
        pending: 'actionPendingBarkskin', onConfirm: 'actionHandleBarkskinConfirm', onSkip: 'actionHandleBarkskinSkip',
        title: 'Barkskin', confirmLabel: 'Cast Barkskin', confirmIcon: 'fa-tree', pick: 'array',
        description: 'Choose a willing creature within range. Target\'s AC becomes 17.',
    },
    {
        pending: 'actionPendingHeal', onConfirm: 'actionHandleHealConfirm', onSkip: 'actionHandleHealSkip',
        title: 'Heal', confirmLabel: 'Cast Heal', confirmIcon: 'fa-heart', pick: 'object',
        description: 'A surge of positive energy washes through the creature, causing it to regain 70 hit points. This spell also ends blindness, deafness, and any diseases affecting the target.',
    },
    {
        pending: 'actionPendingCureWounds', onConfirm: 'actionHandleCureWoundsConfirm', onSkip: 'actionHandleCureWoundsSkip',
        title: 'Cure Wounds', confirmLabel: 'Cast Cure Wounds', confirmIcon: 'fa-heart', pick: 'object',
        description: 'Choose a creature within touch range. The target regains hit points equal to the roll of your dice plus your spellcasting ability modifier.',
    },
    {
        pending: 'actionPendingRevivify', onConfirm: 'actionHandleRevivifyConfirm', onSkip: 'actionHandleRevivifySkip',
        title: 'Revivify', confirmLabel: 'Cast Revivify', confirmIcon: 'fa-heart', pick: 'object',
        description: 'Choose a creature to revive. The target must have 0 Hit Points. A diamond worth 300+ GP is consumed.',
    },
    {
        pending: 'actionPendingRemoveCurse', onConfirm: 'actionHandleRemoveCurseConfirm', onSkip: 'actionHandleRemoveCurseSkip',
        title: 'Remove Curse', confirmLabel: 'Cast Remove Curse', confirmIcon: 'fa-hand-holding-medical', pick: 'object',
        description: state => `Choose a creature within <strong>${state.range}</strong>. This spell ends all curses affecting the target and breaks the target's attunement to any cursed magic items.`,
    },
    {
        pending: 'actionPendingMageArmor', onConfirm: 'actionHandleMageArmorConfirm', onSkip: 'actionHandleMageArmorSkip',
        title: 'Mage Armor', confirmLabel: 'Cast Mage Armor', confirmIcon: 'fa-shield-halved', pick: 'array',
        description: 'Choose a creature within range. The target\'s base AC becomes 13 + Dexterity modifier. Mage Armor lasts 8 hours and ends on a long rest.',
    },
];

function ActionMetamagicHost({ pending, playerStats, campaignName, onConfirm, onSkip }) {
    if (!pending) return null;
    return (
        <MetamagicPopup
            spell={{ name: pending.spellName, level: pending.spellLevel || 0 }}
            playerStats={{ ...playerStats, _metamagicCurrentSP: pending._currentSP, _isPsionicSpell: pending.isPsionic, _psionicCost: pending.psionicCost }}
            campaignName={campaignName}
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}

function MagicMissileTargetHost({ pending, playerStats, campaignName, filterTargets, onConfirm, onSkip }) {
    if (!pending) return null;
    const { spell, totalMissiles, missileDamage, creatureTargets } = pending;
    const currentTargetName = getTargetFromAttacker(getCombatSummary(campaignName), playerStats.name)?.name;
    return (
        <MagicMissileTargetPopup
            spell={{ name: spell.name, level: spell.level || 0 }}
            playerStats={playerStats}
            campaignName={campaignName}
            totalMissiles={totalMissiles}
            missileDamage={missileDamage}
            creatureTargets={filterTargets(creatureTargets)}
            currentTargetName={currentTargetName}
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}

function GreaterRestorationHost({ pending, selectedTarget, filterTargets, onTargetSelected, onEffectSelected, onEffectSkip, onNoEffectsDismiss, onCancel }) {
    if (pending && !selectedTarget) {
        return (
            <SecondaryTargetModal
                title="Greater Restoration"
                targets={filterTargets(pending.creatureTargets).map(name => ({ name, type: 'creature' }))}
                onTargetSelected={onTargetSelected}
                onSkip={onCancel}
                description={`Choose a creature within <strong>${pending.range}</strong>. You'll select which debilitating effect to remove.`}
                confirmLabel="Cast Greater Restoration"
                confirmIcon="fa-hand-holding-medical"
            />
        );
    }
    if (selectedTarget) {
        const hasEffects = selectedTarget.effects.length > 0;
        return (
            <SecondaryTargetModal
                title="Greater Restoration"
                targets={selectedTarget.effects.map(e => ({ value: e.value, label: e.label }))}
                onTargetSelected={onEffectSelected}
                onSkip={hasEffects ? onEffectSkip : onNoEffectsDismiss}
                description={hasEffects
                    ? `Choose one effect to remove from ${selectedTarget.targetName}.`
                    : `No removable effects found on ${selectedTarget.targetName}.`}
                confirmLabel="Remove Effect"
                confirmIcon="fa-hand-holding-medical"
                hideConfirm={!hasEffects}
            />
        );
    }
    return null;
}

export default function CharActionSpellPopups(props) {
    const {
        playerStats,
        campaignName,
        selectedActionSpell,
        setSelectedActionSpell,
        buildUpcastLevels,
        handleActionSpellCast,
        actionPendingMetamagic,
        actionHandleConfirm,
        actionHandleSkip,
        actionHandleGreaterRestorationConfirm,
        actionHandleGreaterRestorationSkip,
        actionHandleGreaterRestorationNoEffects,
        actionPendingMagicMissile,
        actionHandleMagicMissileConfirm,
        actionHandleMagicMissileSkip,
        pendingActionMetamagic,
        handleActionMetamagicConfirm,
        handleActionMetamagicSkip,
    } = props;
    const playerStatsName = playerStats?.name;

    const isForcecageBlocked = (attackerName, targetName) => {
        if (!attackerName || !targetName) return false;
        const forcecageEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        if (!Array.isArray(forcecageEffects) || forcecageEffects.length === 0) return false;

        const attackerTrapped = forcecageEffects.some(te => te.effect === 'forcecage' && te.target === attackerName);
        const targetTrapped = forcecageEffects.some(te => te.effect === 'forcecage' && te.target === targetName);

        if (!attackerTrapped && !targetTrapped) return false;
        if (attackerTrapped && targetTrapped) {
            const attackerSources = forcecageEffects
                .filter(te => te.effect === 'forcecage' && te.target === attackerName)
                .map(te => te.source);
            return !forcecageEffects.some(te => te.effect === 'forcecage' && te.target === targetName && attackerSources.includes(te.source));
        }
        return true;
    };

    const filterForcecageBlockedTargets = (targets) => {
        return targets.filter(target => {
            const name = typeof target === 'string' ? target : target.name;
            return !isForcecageBlocked(playerStatsName, name);
        });
    };

    const [greaterRestorationSelectedTarget, setGreaterRestorationSelectedTarget] = useState(null);

    const loadGreaterRestorationEffects = useCallback(async (targetName) => {
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
        const conditionMatches = (c, targetCondition) =>
            (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
        const RESTORATION_CONDITIONS = ['charmed', 'petrified'];
        RESTORATION_CONDITIONS
            .filter(c => allConditions.some(cond => conditionMatches(cond, c)))
            .forEach(c => {
                result.push({ value: `condition:${c}`, label: `${c.charAt(0).toUpperCase() + c.slice(1)} condition` });
            });
        const exhaustion = getRuntimeValue(targetName, 'exhaustionLevel') || 0;
        if (exhaustion > 0) {
            result.push({ value: 'exhaustion', label: `Exhaustion level (current: ${exhaustion})` });
        }
        const activeBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
        const hasCurse = activeBuffs.some(b => b.type === 'cursed' || b.cursed);
        if (hasCurse) {
            result.push({ value: 'curse', label: 'Curse (including attunement to cursed magic item)' });
        }
        const abilityReductions = getRuntimeValue(targetName, 'abilityReductions') || {};
        if (Object.keys(abilityReductions).length > 0) {
            result.push({ value: 'ability_reduction', label: 'Ability score reduction' });
        }
        const hpMaxReduction = getRuntimeValue(targetName, 'hpMaxReduction') || 0;
        if (hpMaxReduction > 0) {
            result.push({ value: 'hp_max_reduction', label: 'Hit Point maximum reduction' });
        }
        return result;
    }, [campaignName]);

    const handleGreaterRestorationTargetSelected = useCallback(async (targetName) => {
        const effects = await loadGreaterRestorationEffects(targetName);
        setGreaterRestorationSelectedTarget({ targetName, effects });
    }, [loadGreaterRestorationEffects]);

    const handleGreaterRestorationEffectSelected = useCallback((effectValue) => {
        const parts = effectValue.split(':');
        const type = parts[0];
        const detail = parts[1] || null;
        const selection = { type };
        if (detail) {
            selection[type === 'condition' ? 'condition' : type] = detail;
        }
        actionHandleGreaterRestorationConfirm({ targetName: greaterRestorationSelectedTarget.targetName, selections: [selection] });
        setGreaterRestorationSelectedTarget(null);
    }, [greaterRestorationSelectedTarget, actionHandleGreaterRestorationConfirm]);

    const handleGreaterRestorationEffectSkip = useCallback(() => {
        setGreaterRestorationSelectedTarget(null);
    }, []);

    const handleNoEffectsDismiss = useCallback(() => {
        actionHandleGreaterRestorationNoEffects();
        setGreaterRestorationSelectedTarget(null);
    }, [actionHandleGreaterRestorationNoEffects]);
    const renderAllySelectionModals = () => ALLY_SELECTION_MODAL_SPECS.map(({ pending, onConfirm, onSkip, ...modalProps }) => {
        const state = props[pending];
        if (!state) return null;
        return (
            <CreatureSelectionModal
                key={modalProps.title}
                {...modalProps}
                targets={filterForcecageBlockedTargets(state.creatureTargets)}
                maxTargets={state.maxTargets}
                onConfirm={props[onConfirm]}
                onSkip={props[onSkip]}
            />
        );
    });

    const renderTouchTargetModals = () => TOUCH_TARGET_MODAL_SPECS.map(({ pending, onConfirm, onSkip, pick, ...modalProps }) => {
        const state = props[pending];
        if (!state) return null;
        const confirm = props[onConfirm];
        const selectTarget = pick === 'array'
            ? (targetName) => confirm([targetName])
            : (targetName) => confirm({ targetName });
        return (
            <SecondaryTargetModal
                key={modalProps.title}
                {...modalProps}
                description={typeof modalProps.description === 'function' ? modalProps.description(state) : modalProps.description}
                targets={filterForcecageBlockedTargets(state.creatureTargets).map(name => ({ name, type: 'creature' }))}
                onTargetSelected={selectTarget}
                onSkip={props[onSkip]}
            />
        );
    });

    return (
        <>
            {selectedActionSpell && (
                <Popup onClickOrKeyDown={() => setSelectedActionSpell(null)}>
                    <SpellDetailPopup
                        spell={selectedActionSpell}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        playerLevel={playerStats.level}
                        upcastLevels={buildUpcastLevels(selectedActionSpell)}
                        onClose={() => setSelectedActionSpell(null)}
                        onCast={handleActionSpellCast}
                    />
                </Popup>
            )}
            <ActionMetamagicHost
                pending={actionPendingMetamagic}
                playerStats={playerStats}
                campaignName={campaignName}
                onConfirm={actionHandleConfirm}
                onSkip={actionHandleSkip}
            />
            {renderAllySelectionModals()}
            {renderTouchTargetModals()}
            <GreaterRestorationHost
                pending={props.actionPendingGreaterRestoration}
                selectedTarget={greaterRestorationSelectedTarget}
                filterTargets={filterForcecageBlockedTargets}
                onTargetSelected={handleGreaterRestorationTargetSelected}
                onEffectSelected={handleGreaterRestorationEffectSelected}
                onEffectSkip={handleGreaterRestorationEffectSkip}
                onNoEffectsDismiss={handleNoEffectsDismiss}
                onCancel={actionHandleGreaterRestorationSkip}
            />
            <MagicMissileTargetHost
                pending={actionPendingMagicMissile}
                playerStats={playerStats}
                campaignName={campaignName}
                filterTargets={filterForcecageBlockedTargets}
                onConfirm={actionHandleMagicMissileConfirm}
                onSkip={actionHandleMagicMissileSkip}
            />
            <ActionMetamagicHost
                pending={pendingActionMetamagic}
                playerStats={playerStats}
                campaignName={campaignName}
                onConfirm={handleActionMetamagicConfirm}
                onSkip={handleActionMetamagicSkip}
            />
        </>
    )
}
