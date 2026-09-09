import React, { useState } from 'react'
import Popup from '../common/popup.jsx'
import MetamagicPopup from './popups/MetamagicPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import HexAbilityModal from './modals/HexAbilityModal.jsx'
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx'
import TargetSpellPopups from './char-spells/TargetSpellPopups.jsx'

import { getCategories } from '../../services/character/featureCategories.js'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { getBonusActionSpellNames } from '../../services/ui/spellSectionUtils.js'
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js'
import { hasAutomation } from '../../services/combat/automation/automationService.js'
import { addEntry } from '../../services/ui/logService.js'

import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import { isWithinRange } from '../../services/rules/combat/rangeCheck.js'
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js'
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js'
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js'
import { getCurrentCombatRound } from '../../services/encounters/combatData.js'
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { formatRange, signFormatter, getAttackSpellLevel } from '../../services/ui/formatUtils.js';
import { resolveSpellDamageAtLevel, isAutoHitSpell, resolveHealExpression } from '../../services/rules/core/spellDamageUtils.js';
import { useSimpleDamageRoll } from '../../hooks/combat/useSimpleDamageRoll.js';
import { useSpellPositionResolver } from '../../hooks/combat/useSpellPositionResolver.js';
import { useSpellCastExecutor } from '../../hooks/combat/useSpellCastExecutor.js';
import { resolveSpiritualWeaponMoveAndAttack } from '../../services/rules/features/spiritualWeaponService.js';
import ArcaneVigorModal from './ArcaneVigorModal.jsx';
import './CharActions.css'

function CharBonusActions({ playerStats, campaignName, exhaustionPenalty, conditionAttackMode, cannotAct, mapName, characters, onAttackClick, onResolveSpellDamage, onAutomationAction, getWeaponMastery, rollAttack, rollDamage, getTargetInfo, setModalState, modalState }) {
    const { popupHtml, setPopupHtml } = useDiceRollPopup();
    const [selectedBonusSpell, setSelectedBonusSpell] = useState(null);
    const [pendingHexSpell, setPendingHexSpell] = useState(null);

    const handleHexCancel = React.useCallback(() => {
      setPendingHexSpell(null);
    }, []);

    const { saveDcBonus: displaySaveDcBonus } = getInnateSorceryBonus(playerStats.name, campaignName);
    const activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName);

    const [hordeBreakerTargets, setHordeBreakerTargets] = useState(null);
    const huntersPreyChoice = useRuntimeValue(playerStats.name, "_Hunter's_Prey_choice", campaignName);
    const hordeBreakerReady = useRuntimeValue(playerStats.name, '_Hunters_Prey_HordeBreaker_Ready', campaignName);
    const hordeBreakerUsedRound = useRuntimeValue(playerStats.name, '_Hunters_Prey_HordeBreaker_UsedRound', campaignName);

    const is2024Rules = playerStats.rules === '2024';
    const hasWeaponMastery = (playerStats.automation?.passives || []).some(p => p.type === 'weapon_kind_mastery');

    const bolsteringTreat = useRuntimeValue(playerStats.name, 'bolsteringTreat', campaignName);
    const chefBolsteringTreats = useRuntimeValue(playerStats.name, 'chefBolsteringTreats', campaignName);
    const hasBolsteringTreat = Number(bolsteringTreat ?? 0) > 0;
    const hasChefBolsteringTreats = Number(chefBolsteringTreats ?? 0) > 0;
    const showEatTreat = hasBolsteringTreat || hasChefBolsteringTreats;

    const hasApplyPoison = (playerStats.automation?.bonusActions ?? []).some(
        a => a.type === 'apply_poison' && a.name === 'Apply Poison'
    );
    const poisonDoses = useRuntimeValue(playerStats.name, 'poisonDoses', campaignName);
    const showApplyPoison = hasApplyPoison && Number(poisonDoses ?? 0) > 0 && !cannotAct;

    // CLA-320: Soulknife Soul Blades Psychic Teleportation — the router routes
    // the auto_effect half into automation.bonusActions; render it as a
    // clickable Bonus Actions row (same pattern as Apply Poison) that
    // dispatches psychicTeleportationHandler (expends 1 Psionic Energy die).
    const psychicTeleportationAuto = (playerStats.automation?.bonusActions ?? []).find(
        a => a.effect === 'psychic_teleportation'
    );
    const showPsychicTeleportation = !!psychicTeleportationAuto && !cannotAct;

    const handleApplyPoison = React.useCallback(async () => {
        if (cannotAct) return;
        const currentDoses = Number(getRuntimeValue(playerStats.name, 'poisonDoses', campaignName) ?? 0);
        if (currentDoses <= 0) return;
        const dexMod = playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus ?? 0;
        const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus ?? 0;
        const poisonerAbilityModifier = Math.max(dexMod, intMod);
        const proficiencyBonus = playerStats.proficiency || 0;
        const saveDc = 8 + poisonerAbilityModifier + proficiencyBonus;
        setRuntimeValue(playerStats.name, 'poisonDoses', currentDoses - 1, campaignName);
        setRuntimeValue(playerStats.name, 'poisonedWeaponsActive', true, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Apply Poison',
            description: `${playerStats.name} applied a poison dose to a weapon. Doses remaining: ${currentDoses - 1}. Poisoned weapons active until initiative roll, short rest, or long rest.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[charBonusActions:log-error]", e); });
        const html = `<b>Apply Poison</b><br/>Poison applied to weapons. Doses Remaining ${currentDoses - 1}.<br/>When a creature takes damage from a poisoned weapon, it must succeed on a CON save (DC ${saveDc}) or take 2d8 Poison damage and have the Poisoned condition until the end of your next turn.<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
    }, [cannotAct, campaignName, setPopupHtml, playerStats.abilities, playerStats.name, playerStats.proficiency]);

    const handleEatBolsteringTreat = React.useCallback(async () => {
        if (cannotAct) return;
        const isChef = hasChefBolsteringTreats;
        const usesKey = isChef ? 'chefBolsteringTreats' : 'bolsteringTreat';
        const current = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 0);
        if (current <= 0) return;
        const tempHpAmount = playerStats.proficiency || 0;
        setTempHp(playerStats.name, tempHpAmount, campaignName);
        setRuntimeValue(playerStats.name, usesKey, current - 1, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Bolstering Treat',
            description: `${playerStats.name} ate a bolstering treat, gaining ${tempHpAmount} temporary hit points.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[charBonusActions:log-error]", e); });
        const html = `<b>Bolstering Treat</b><br/>Gained ${tempHpAmount} temporary hit points. (${current - 1} treat${current - 1 !== 1 ? 's' : ''} remaining)<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
    }, [cannotAct, hasChefBolsteringTreats, playerStats, campaignName, setPopupHtml]);

    const getBonusSpellDamageDisplay = React.useCallback((spell) => {
        if (spell.heal_at_slot_level) {
            const spellCastingMod = playerStats.spellAbilities?.modifier || 0;
            return resolveHealExpression(spell, playerStats.level, spellCastingMod);
        }
        const resolved = resolveSpellDamageAtLevel(spell, playerStats.level);
        if (!resolved || spell.level !== 0) return resolved;
        const potentFeature = playerStats.automation?.actions?.find(
            a => a.type === 'damage_bonus' && !a.upgrades && a.options?.some(o => o.toLowerCase().includes('spellcasting'))
        );
        if (!potentFeature) return resolved;
        const optKey = `_${(potentFeature.name || 'PotentSpellcasting').replace(/\s+/g, '_')}_option`;
        const chosen = getRuntimeValue(playerStats.name, optKey, campaignName);
        if (potentFeature.options.length > 1 && !chosen) return resolved;
        if (chosen && !chosen.toLowerCase().includes('spellcasting')) return resolved;
        const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
        const wisMod = Math.max(0, wis?.bonus || 0);
        if (wisMod <= 0) return resolved;
        return `${resolved}+${wisMod}`;
    }, [playerStats, campaignName]);

    const handleBonusSpellClick = (spellName) => {
        const spell = bonusSpellNames[spellName];
        if (!spell) return;
        setSelectedBonusSpell(spell);
     };

    const handleSimpleDamageRoll = useSimpleDamageRoll(playerStats.name, campaignName, popupHtml, setPopupHtml);

    const { resolvePositions: resolveBonusSpellPositions, cachedPosRef: cachedBonusCastPosRef } = useSpellPositionResolver(campaignName, mapName, playerStats.name);

    const { castAction: bonusCastAction } = useSpellCastExecutor(rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, { innateSorceryActive: !!displaySaveDcBonus }, cachedBonusCastPosRef, setModalState);

    const { pendingMetamagic, pendingBarkskin, pendingHealingWord, pendingSanctuary, gateMetamagic, handleConfirm, handleSkip, handleBarkskinConfirm, handleBarkskinSkip, handleHealingWordConfirm, handleHealingWordSkip, handleSanctuaryConfirm, handleSanctuarySkip, pendingLesserRestoration, handleLesserRestorationConfirm, handleLesserRestorationSkip } = useSpellMetamagicFlow(playerStats, campaignName, bonusCastAction, null, characters, setPopupHtml);
    const [pendingLesserRestorationTarget, setPendingLesserRestorationTarget] = useState(null);
    const { buildUpcastLevels } = useSpellUpcastFlow(playerStats, campaignName);

    const handleBonusSpellCast = React.useCallback(async (spell, metaCtx) => {
      if (spell.name === 'Hex') {
        setPendingHexSpell(spell);
        return;
      }
      setSelectedBonusSpell(null);

      await resolveBonusSpellPositions();
      gateMetamagic(spell, metaCtx);
    }, [gateMetamagic, resolveBonusSpellPositions]);

    const handleHexAbilitySelected = React.useCallback((hexAbility) => {
      const spell = pendingHexSpell;
      setPendingHexSpell(null);
      if (spell) {
        setSelectedBonusSpell(null);
        resolveBonusSpellPositions().then(() => {
          gateMetamagic(spell, { hexAbility });
        });
      }
    }, [pendingHexSpell, gateMetamagic, resolveBonusSpellPositions]);

    const bonusActionAttacks = playerStats.attacks.filter((attack) => {
        if (attack.type !== 'Bonus Action') return false;
        // Horde Breaker placeholder is rendered conditionally below (after a melee weapon hit)
        if (attack.isHordeBreaker) return false;
        // Filter out Light weapon bonus action attack when Nick mastery has been used this turn
        if (attack.properties?.includes('Light') && is2024Rules) {
            const nickUsedKey = '_Nick_UsedRound';
            const currentRound = getCurrentCombatRound(campaignName);
            const nickUsedRound = getRuntimeValue(playerStats.name, nickUsedKey, campaignName);
            if (nickUsedRound === currentRound) {
                return false;
            }
        }
        return true;
    });
    const bonusSpellNameSet = getBonusActionSpellNames(playerStats, campaignName);
    const bonusActionSpells = (playerStats.spellAbilities?.spells || []).filter(spell => bonusSpellNameSet.has(spell.name));
    const hasBonusActions = playerStats.bonusActions.length > 0;

    const hordeBreakerMarker = (playerStats.attacks || []).find(a => a.isHordeBreaker);
    const hordeBreakerWeapon = React.useMemo(() => {
        if (!hordeBreakerReady || !hordeBreakerReady.attackName) return null;
        return (playerStats.attacks || []).find(a => !a.isHordeBreaker && a.name === hordeBreakerReady.attackName) || null;
    }, [hordeBreakerReady, playerStats.attacks]);
    const showHordeBreakerRow = !!hordeBreakerMarker
        && huntersPreyChoice === 'Horde Breaker'
        && !!hordeBreakerReady
        && hordeBreakerReady.round === getCurrentCombatRound()
        && hordeBreakerUsedRound !== getCurrentCombatRound()
        && !cannotAct;
    if (showHordeBreakerRow && !hordeBreakerWeapon) {
        console.error('Horde Breaker: no attack entry found for weapon', hordeBreakerReady.attackName);
    }
    const hordeBreakerAttackItem = React.useMemo(() => {
        if (!hordeBreakerMarker || !hordeBreakerWeapon) return null;
        return {
            ...hordeBreakerMarker,
            damage: hordeBreakerWeapon.damage,
            damageType: hordeBreakerWeapon.damageType,
            hitBonus: hordeBreakerWeapon.hitBonus,
            hitBonusFormula: hordeBreakerWeapon.hitBonusFormula,
            range: hordeBreakerWeapon.range,
            weaponName: hordeBreakerWeapon.name,
        };
    }, [hordeBreakerMarker, hordeBreakerWeapon]);
    const visibleHordeBreakerItem = showHordeBreakerRow ? hordeBreakerAttackItem : null;
    const displayedBonusAttacks = visibleHordeBreakerItem ? [...bonusActionAttacks, visibleHordeBreakerItem] : bonusActionAttacks;

    const handleHordeBreakerClick = React.useCallback(async () => {
        if (cannotAct || !hordeBreakerAttackItem || !hordeBreakerReady) return;
        const cs = await getCombatContext(campaignName);
        const creatures = cs?.creatures || [];
        const validTargets = [];
        for (const c of creatures) {
            if (c.name === hordeBreakerReady.targetName) continue;
            if ((c.currentHp ?? 1) <= 0) continue;
            const nearOriginal = await isWithinRange(hordeBreakerReady.targetName, c.name, 5);
            if (!nearOriginal) continue;
            const inWeaponRange = await isWithinRange(playerStats.name, c.name, hordeBreakerAttackItem.range || 5);
            if (!inWeaponRange) continue;
            validTargets.push({ name: c.name, type: 'creature' });
        }
        if (validTargets.length === 0) {
            setPopupHtml(`<b>Horde Breaker</b><br/>No valid target — no other creature within 5 feet of ${hordeBreakerReady.targetName} and within weapon range.<br/><span class="dice-roll-hint">click to dismiss</span>`);
            return;
        }
        setHordeBreakerTargets(validTargets);
    }, [cannotAct, hordeBreakerAttackItem, hordeBreakerReady, campaignName, setPopupHtml, playerStats.name]);

    const handleHordeBreakerTargetSelected = React.useCallback(async (selectedName) => {
        setHordeBreakerTargets(null);
        if (!hordeBreakerAttackItem || !hordeBreakerReady) return;
        rollAttack('Horde Breaker', (hordeBreakerAttackItem.hitBonus || 0) - (exhaustionPenalty || 0), {
            targetName: selectedName,
            damageType: hordeBreakerAttackItem.damageType,
            autoDamageFormula: hordeBreakerAttackItem.damage,
            autoDamageName: 'Horde Breaker',
        });
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Horde Breaker',
            description: `${playerStats.name} used Horde Breaker: extra attack with ${hordeBreakerAttackItem.weaponName} against ${selectedName} (within 5 ft of ${hordeBreakerReady.targetName}).`,
            targetName: selectedName,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[charBonusActions:log-error]", e); });
    }, [hordeBreakerAttackItem, hordeBreakerReady, campaignName, exhaustionPenalty, playerStats.name, rollAttack]);

    const hasBonusContent = bonusActionSpells.length > 0 || bonusActionAttacks.length > 0 || hasBonusActions || !!visibleHordeBreakerItem;

    if (!hasBonusContent) return null;

    const bonusSpellNames = bonusActionSpells.reduce((acc, spell) => { acc[spell.name] = spell; return acc; }, {});

    return (
         <div className='char-actions'>
            {/*
             * CHAR BONUS ACTIONS — Spells with casting time of "Bonus Action".
             * These go on the bonus action bar of the character sheet.
             * Use getBonusActionSpellNames() to determine which spells belong here.
             *
             * MODALS/HANDLERS: Bonus action spells that need target selection or complex
             * automation should go in CharBonusActions modals (e.g. Elder Champion converts
             * action spells to bonus action spells).
             *
             * DO NOT put action or reaction spell handlers here.
             */}
              <div className='sectionHeader'>Bonus Actions</div>
                {(displayedBonusAttacks.length > 0 || bonusActionSpells.length > 0) ? (
                  <div className={`attacks ${is2024Rules && hasWeaponMastery ? 'mastery-enabled' : ''}`}>
                    <div className='left'><b>Name</b></div>
                        <div><b>Level</b></div>
                        <div><b>Range</b></div>
                        <div><b>Hit</b></div>
                        <div><b>Damage</b></div>
                        <div className='left'><b>Type</b></div>
                        {is2024Rules && hasWeaponMastery && <div><b>Mastery</b></div>}
                        {displayedBonusAttacks.map((attack) => {
                            const attackLevel = getAttackSpellLevel(playerStats.spellAbilities, attack.name);
                            const attackItem = { ...attack };
                            const isHbRow = !!attack.isHordeBreaker;
                            const hbClick = () => handleHordeBreakerClick();
                            const sacredWeaponBonus = (() => {
                                const buffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
                                if (!Array.isArray(buffs) || !buffs.some(b => b.effect === 'sacred_weapon')) return 0;
                                if (attack.weaponType !== 'melee' && attack.weaponType !== 'unarmed') return 0;
                                const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
                                return Math.max(1, cha?.bonus || 0);
                            })();
                            const effectiveHit = attack.hitBonus + sacredWeaponBonus;
                            const hitTitle = sacredWeaponBonus > 0
                                ? `Base: +${attack.hitBonus}, Sacred Weapon: +${sacredWeaponBonus}`
                                : undefined;
                            return <React.Fragment key={attack.name}>
                                <div className={isHbRow ? 'left clickable' : 'left'} onClick={isHbRow ? hbClick : undefined}>{attack.name}</div>
                                <div>{attackLevel != null ? (attackLevel === 0 ? 'Cantrip' : attackLevel) : ''}</div>
                                <div>{formatRange(attack.range)}</div>
                                {attack.saveDc
                                   ? <div className="save-dc-display">DC {attack.saveDc + displaySaveDcBonus} {attack.saveType}</div>
                                 : isHbRow
                                     ? <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} title={`Attack a different creature within 5 feet of ${hordeBreakerReady?.targetName || 'the original target'} with your ${attack.weaponName || attack.name}`} onClick={hbClick}>{signFormatter.format(effectiveHit - exhaustionPenalty)}</div>
                                     : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} title={hitTitle} onClick={() => onAttackClick(attackItem)}>{signFormatter.format(effectiveHit - exhaustionPenalty)}</div>}
                               <div className={attack.damage ? "clickable" : ""} onClick={() => {
                                   if (cannotAct) return;
                                   if (isHbRow) { hbClick(); return; }
                                   if (attack.saveDc) { onResolveSpellDamage(attackItem); return; }
                                   handleSimpleDamageRoll(attackItem);
                               }}>{attack.damage}</div>
                              <div className='left'>{attack.damageType}</div>
                               {is2024Rules && hasWeaponMastery && (() => { const mastery = getWeaponMastery(attack.name, attack, playerStats); return <div className={mastery ? "clickable" : ""} onClick={() => { if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{mastery}</div>; })()}
                         </React.Fragment>;
                         })}
                        {bonusActionSpells.map((spell) => {
                            const damageType = typeof spell.damage === 'string' ? '' : (spell.damage?.damage_type || '');
                            const resolvedDamage = spell.heal_at_slot_level
                                ? resolveHealExpression(spell, playerStats.level, playerStats.spellAbilities?.modifier || 0)
                                : resolveSpellDamageAtLevel(spell, playerStats.level);
                            const autoHit = isAutoHitSpell(spell);
                            const isSpellAtk = !spell.dc;
                            const hasAttackType = spell.attack_type != null && spell.attack_type !== '';
                            const isUtilityConc = spell.concentration && !spell.dc;
                            const attackItem = { ...spell, type: 'Bonus Action', hitBonus: playerStats.spellAbilities?.toHit, saveDc: spell.dc ? playerStats.spellAbilities.saveDc : null, saveType: spell.dc?.dc_type, saveSuccess: spell.dc?.dc_success, damage: resolvedDamage, damageType };
                            return <React.Fragment key={spell.name}>
                                <div className='left clickable' onClick={() => handleBonusSpellClick(spell.name)}>{spell.name}</div>
                                <div>{spell.level === 0 ? 'Cantrip' : spell.level}</div>
                                <div>{formatRange(spell.range)}</div>
                                {isUtilityConc
                                    ? <div></div>
                                    : autoHit
                                        ? <div></div>
                                        : isSpellAtk && hasAttackType
                                            ? <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => onAttackClick(attackItem)}>{signFormatter.format(playerStats.spellAbilities?.toHit - exhaustionPenalty)}</div>
                                            : isSpellAtk && !hasAttackType
                                                ? <div></div>
                                                : <div className="save-dc-display">DC {playerStats.spellAbilities?.saveDc + displaySaveDcBonus} {spell.dc?.dc_type}</div>}
                                <div className={isUtilityConc ? "" : (resolvedDamage ? "clickable" : "")} onClick={() => {
                                    if (cannotAct || isUtilityConc) return;
                                    // SINGLE ENTRY POINT for bonus action spell casting:
                                    // - Save DC spells: onResolveSpellDamage handles AoE modals + prepareSpellCast (from parent)
                                    // - Non-save-DC spells: gateMetamagic is the single entry point (calls prepareSpellCast → spell slots, concentration)
                                    // NEVER call bonusCastAction, castAction, or executeSpellCast directly from JSX onClick handlers.
                                    if (isSpellAtk && spell.saveDc) { onResolveSpellDamage(attackItem); return; }
                                    if (isSpellAtk) { gateMetamagic(spell, {}); return; }
                                    gateMetamagic(spell, {});
                                }}>{isUtilityConc ? '' : getBonusSpellDamageDisplay(spell)}</div>
                                <div className='left'>{isUtilityConc ? 'Utility' : (damageType || (spell.heal_at_slot_level ? 'Healing' : 'Utility'))}</div>
                                {is2024Rules && hasWeaponMastery && <div></div>}
                           </React.Fragment>;
                      })}
                      <div className='half-line'></div>
                  </div>
               ) : null}
              {selectedBonusSpell && (
                 <Popup onClickOrKeyDown={() => setSelectedBonusSpell(null)}>
                     <SpellDetailPopup
                        spell={selectedBonusSpell}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        playerLevel={playerStats.level}
                        upcastLevels={buildUpcastLevels(selectedBonusSpell)}
                        onClose={() => setSelectedBonusSpell(null)}
                         onCast={handleBonusSpellCast}
                     />
                 </Popup>
             )}
                {pendingMetamagic && (
                   <div>
                       <MetamagicPopup
                         spell={{ name: pendingMetamagic.spellName, level: pendingMetamagic.spellLevel || 0 }}
                         playerStats={{ ...playerStats, _metamagicCurrentSP: pendingMetamagic._currentSP }}
                         campaignName={campaignName}
                         onConfirm={handleConfirm}
                         onSkip={handleSkip}
                      />
                  </div>
              )}
             {(popupHtml && hasBonusActions) && <br />}
               {hasBonusActions && <div>
                  {((playerStats.bonusActions || []).filter(a => getCategories(playerStats.rules || '5e').featuresToIgnore.includes(a.name) === false)).map((bonusAction) => {
                         const isBonusClickable = bonusAction.details || hasAutomation(bonusAction);
                         const handleBonusClick = () => {
                            if (hasAutomation(bonusAction)) {
                                onAutomationAction(bonusAction);
                             } else {
                                setPopupHtml(buildFeatureDetailHtml(bonusAction));
                             }
                         };
                       return <div key={bonusAction.name}>
                            <b className={isBonusClickable ? "clickable" : ""} onClick={handleBonusClick}>{bonusAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(bonusAction.description) }}></span>
                            {hasAutomation(bonusAction) && bonusAction.automation?.type === 'healing_pool' && <span className="automation-badge"> Pool: {bonusAction.automation.pool} HP</span>}
                           {hasAutomation(bonusAction) && bonusAction.automation?.damage && <span className="automation-badge"> {bonusAction.automation.damage} {bonusAction.automation.damageType}</span>}
                       </div>
                   })}
                </div>}

                {(() => {
                    const wrathActive = getRuntimeValue(playerStats.name, 'wrathOfTheSeaActive', campaignName);
                    if (!wrathActive) return null;
                    const hasWotSInBonusActions = (playerStats.bonusActions || []).some(a => a.name === 'Wrath of the Sea');
                    if (hasWotSInBonusActions) return null;
                    return (
                        <div>
                            <b className="clickable" onClick={() => onAutomationAction({
                                name: 'Wrath of the Sea',
                                description: 'Force a creature to make a CON save or take WIS modifier d6 Cold damage.',
                                automation: {
                                    type: 'wrath_of_the_sea',
                                    action: 'bonus_action',
                                    allyAttack: true,
                                },
                            })}>Wrath of the Sea:</b> <span>Force a creature to make a CON save or take WIS modifier d6 Cold damage.</span>
                        </div>
                    );
                })()}

                {(() => {
                    const starryFormBuff = Array.isArray(activeBuffs) ? activeBuffs.find(b => b.name === 'Starry Form' && b.constellation === 'Archer') : null;
                    if (!starryFormBuff) return null;
                    const level = playerStats.level || 1;
                    const isTwinkled = level >= 10;
                    const damageDice = isTwinkled ? '2d8' : '1d8';
                    const wis = playerStats.abilities.find(a => a.name === 'Wisdom');
                    const wisMod = wis?.bonus || 0;
                    const spellAttackMod = playerStats.spellAbilities?.toHit || 0;
                    return (
                        <div>
                            <b className="clickable" onClick={() => onAutomationAction({
                                name: 'Starry Form: Luminous Arrow',
                                description: `Ranged spell attack, 60 ft. On a hit: ${damageDice} + ${wisMod} Radiant damage.`,
                                automation: {
                                    type: 'starry_form_arrow',
                                    action: 'bonus_action',
                                    damageDice,
                                    damageType: 'Radiant',
                                    damageBonus: wisMod,
                                    spellAttackMod,
                                    range: '60_ft',
                                },
                            })}>Starry Form: Luminous Arrow:</b> <span>Ranged spell attack, 60 ft. On a hit: ${damageDice} + ${wisMod} Radiant damage.</span>
                        </div>
                    );
                })()}

                {(() => {
                    // SP-112: Spiritual Weapon — once the spectral force is active,
                    // surface a "Move up to 20 ft & repeat the attack" Bonus Action row
                    // on the caster's LATER turns (activatedRound gate), mirroring the
                    // Starry Form conditional-row pattern.
                    const forceBuff = Array.isArray(activeBuffs) ? activeBuffs.find(b => b.effect === 'spiritual_weapon_force') : null;
                    if (!forceBuff) return null;
                    const currentRound = getCurrentCombatRound(campaignName);
                    if (currentRound <= (forceBuff.activatedRound ?? 0)) return null;
                    const spellAttackMod = playerStats.spellAbilities?.toHit || 0;
                    return (
                        <div>
                            <b className={"clickable" + (cannotAct ? " disabled-attack" : "")} onClick={async () => {
                                if (cannotAct) return;
                                const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);
                                if (res.refused) { setPopupHtml({ type: 'automation_info', name: 'Spiritual Weapon', description: res.message }); return; }
                                rollAttack(res.attack.name, res.attack.hitBonus - (exhaustionPenalty || 0), {
                                    targetName: res.targetName,
                                    damageType: res.attack.damageType,
                                    autoDamageFormula: res.attack.autoDamageFormula,
                                    autoDamageName: res.attack.autoDamageName,
                                    autoDamageSchool: res.attack.school,
                                    spellName: 'Spiritual Weapon',
                                });
                            }}>Spiritual Weapon: Move 20 ft &amp; Attack:</b> <span>Move the spectral force up to 20 feet and repeat the melee spell attack (+{spellAttackMod}) against a creature within 5 feet of it. {forceBuff.damageFormula || '1d8 + 3'} Force.</span>
                        </div>
                    );
                })()}

                {(() => {
                    // CLA-366: Invoke Duplicity "Move" bonus action — while the
                    // illusion is active, surface the move row (GM adjudicates the
                    // illusion position; no illusion token exists). Trickster's
                    // Transposition lets the caster swap places as part of the
                    // same Bonus Action, so the row routes to the swap confirm.
                    const illusionBuff = Array.isArray(activeBuffs) ? activeBuffs.find(b => b.effect === 'create_illusion') : null;
                    if (!illusionBuff) return null;
                    return (
                        <div>
                            <b className={"clickable" + (cannotAct ? " disabled-attack" : "")} onClick={() => {
                                if (cannotAct) return;
                                onAutomationAction({
                                    name: 'Trickster\'s Transposition',
                                    description: 'Move the Invoke Duplicity illusion up to 30 feet, swapping places with it.',
                                    automation: {
                                        type: 'temp_buff',
                                        effect: 'teleport_swap_with_illusion',
                                        action: 'bonus_action',
                                        duration: 'while_illusion_active',
                                        distance: '30 ft',
                                        casting_time: '1 bonus action',
                                        moveIllusion: true,
                                    },
                                });
                            }}>Move Invoke Duplicity (Transposition):</b> <span>Move the illusion up to 30 feet (GM adjudicates its position) and swap places with it.</span>
                        </div>
                    );
                })()}

                {showEatTreat && (
                    <div>
                        <b className="clickable" onClick={handleEatBolsteringTreat}>Eat Bolstering Treat:</b> <span>Eat treat to gain a number of Temporary Hit Points equal to your Proficiency Bonus.</span>
                    </div>
                )}

                {showApplyPoison && (
                    <div>
                        <b className="clickable" onClick={handleApplyPoison}>Apply Poison:</b> <span>Apply a poison dose to a weapon. Target must succeed on a CON save (DC {8 + Math.max(playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus ?? 0, playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus ?? 0) + (playerStats.proficiency || 0)}) or take 2d8 Poison damage and have the Poisoned condition until the end of your next turn.</span>
                    </div>
                )}

                {showPsychicTeleportation && (
                    <div>
                        <b className="clickable" onClick={() => onAutomationAction({
                            name: 'Psychic Teleportation',
                            description: 'Expend 1 Psionic Energy die, throw a manifested Psychic Blade to an unoccupied space you can see, and teleport to that space. The blade vanishes.',
                            automation: psychicTeleportationAuto,
                        })}>Psychic Teleportation:</b> <span>Expend 1 Psionic Energy die and teleport up to 10 ft per the die roll to an unoccupied space you can see. The blade vanishes.</span>
                    </div>
                )}

                {hordeBreakerTargets && (
                    <SecondaryTargetModal
                        title="Horde Breaker"
                        targets={hordeBreakerTargets}
                        description={`Choose a different creature within 5 feet of <b>${hordeBreakerReady?.targetName || 'the original target'}</b> to attack with your ${hordeBreakerAttackItem?.weaponName || 'weapon'}:`}
                        onTargetSelected={handleHordeBreakerTargetSelected}
                        onSkip={() => setHordeBreakerTargets(null)}
                        confirmLabel="Attack Target"
                        confirmIcon="fa-bolt"
                        showSize={true}
                    />
                )}

                {pendingHexSpell && (
                    <HexAbilityModal
                        onAbilitySelected={handleHexAbilitySelected}
                        onCancel={handleHexCancel}
                    />
                )}

                {pendingBarkskin && (
                    <SecondaryTargetModal
                        title="Barkskin"
                        targets={pendingBarkskin.creatureTargets.map(name => ({ name, type: 'creature' }))}
                        onTargetSelected={(targetName) => handleBarkskinConfirm([targetName])}
                        onSkip={handleBarkskinSkip}
                        description="Choose a willing creature within range. Target's AC becomes 17."
                        confirmLabel="Cast Barkskin"
                        confirmIcon="fa-tree"
                    />
                )}

                {pendingHealingWord && (
                    <SecondaryTargetModal
                        title="Healing Word"
                        targets={pendingHealingWord.creatureTargets.map(name => ({ name, type: 'creature' }))}
                        onTargetSelected={(targetName) => handleHealingWordConfirm({ targetName })}
                        onSkip={handleHealingWordSkip}
                        description="Choose a creature within range. The target regains hit points equal to the roll of your dice plus your spellcasting ability modifier."
                        confirmLabel="Cast Healing Word"
                        confirmIcon="fa-heart"
                    />
                )}
                {pendingSanctuary && (
                    <SecondaryTargetModal
                        title="Sanctuary"
                        targets={pendingSanctuary.creatureTargets.map(name => ({ name, type: 'creature' }))}
                        onTargetSelected={(targetName) => handleSanctuaryConfirm(targetName)}
                        onSkip={handleSanctuarySkip}
                        description="Choose a creature within range. Until the spell ends, any creature who targets the warded creature with an attack roll or a damaging spell must succeed on a WIS save or lose the attack or spell. Does not protect from areas of effect. Spell ends if the warded creature makes an attack roll, casts a spell, or deals damage."
                        confirmLabel="Cast Sanctuary"
                        confirmIcon="fa-shield-halved"
                    />
                )}

                {pendingLesserRestoration && (
                    <TargetSpellPopups
                        campaignName={campaignName}
                        pendingLesserRestoration={pendingLesserRestoration}
                        handleLesserRestorationConfirm={handleLesserRestorationConfirm}
                        handleLesserRestorationSkip={handleLesserRestorationSkip}
                        pendingLesserRestorationTarget={pendingLesserRestorationTarget}
                        setPendingLesserRestorationTarget={setPendingLesserRestorationTarget}
                    />
                )}

                {modalState?.arcaneVigorModal && (
                    <ArcaneVigorModal
                        {...modalState.arcaneVigorModal}
                        onClose={() => setModalState({ arcaneVigorModal: null })}
                        onComplete={() => setModalState({ arcaneVigorModal: null })}
                    />
                )}

            </div>
        );
}

export default CharBonusActions
