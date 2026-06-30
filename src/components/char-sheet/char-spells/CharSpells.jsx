
import React from 'react'
import { cloneDeep } from 'lodash';
import useActionPopup from '../../../hooks/combat/useActionPopup.js'
import useLoggedDiceRoll from '../../../hooks/combat/useLoggedDiceRoll.js'
import { useDiceRollPopup } from '../../../hooks/combat/DiceRollContext.js'
import Popup from '../../common/popup.jsx'
import MetamagicPopup from '../popups/MetamagicPopup.jsx'
import SpellDetailPopup from './SpellDetailPopup.jsx'
import CharSpellSlots from './CharSpellSlots.jsx'
import MultiTargetPopup from '../popups/MultiTargetPopup.jsx'
import MultiTargetCountPopup from '../popups/MultiTargetCountPopup.jsx'
import TargetWithCheckboxesPopup from '../popups/TargetWithCheckboxesPopup.jsx'
import SingleTargetPopup from '../popups/SingleTargetPopup.jsx'
import TargetWithTypePopup from '../popups/TargetWithTypePopup.jsx'
import { getExcludedSpellNames } from '../../../services/ui/spellSectionUtils.js'
import MagicMissileTargetPopup from '../popups/MagicMissileTargetPopup.jsx'
import { rollExpression, rollExpressionDoubled, rollExpressionMaximized } from '../../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker, getAttackerTargetName } from '../../../services/rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from '../../../hooks/combat/useMetamagic.js'
import { isPsionicSpell, hasPsionicSorcery } from '../../../services/rules/spells/metamagicRules.js';
import { useSpellMetamagicFlow } from '../../../hooks/combat/useSpellMetamagicFlow.js'
import { useSpellUpcastFlow } from '../../../hooks/combat/useSpellUpcastFlow.js'
import UpcastPopup from './UpcastPopup.jsx'
import { executeSpellCast } from '../../../services/rules/spells/spellCastService.js'
import * as mapsService from '../../../services/maps/mapsService.js';
import { getNearestPlacedItem } from '../../../services/rules/combat/rangeValidation.js';
import { isInnateSorceryActive } from '../../../services/combat/buffs/buffService.js';
import { useRuntimeValue, setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../../services/ui/utils.js';
import { addEntry } from '../../../services/ui/logService.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../../services/rules/spells/postCastRiderService.js';
import './CharSpells.css'

const CharSpells = function CharSpells({ playerStats, handleTogglePreparedSpells, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, characters }) {
    const _activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName); (void _activeBuffs); // subscribe to activeBuffs changes for re-render
    const innateSorceryActive = isInnateSorceryActive(playerStats.name, campaignName);
    useActionPopup('spell');
    const { setPopupHtml } = useDiceRollPopup();
    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats.name, campaignName, {
        characters,
        autoDamageSource: 'char-spells',
        autoDamageRoll: (autoDamage, isCrit) => {
          let autoFormula = autoDamage.formula;
          const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(playerStats).length > 0;
          const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(playerStats) : 0;
          const spellSchool = (autoDamage.autoDamageSchool || '').toLowerCase();
          const isEvocation = spellSchool === 'evocation';
          const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && empEvocIntMod > 0;
          if (shouldApplyEmpoweredEvoc) {
            autoFormula = `${autoFormula} + ${empEvocIntMod} [Empowered Evocation]`;
          }
          const isOverchannel = autoDamage.overchannelActive;
          const overchannelUseCount = autoDamage.overchannelUseCount || 0;
          const overchannelSpellLevel = autoDamage.overchannelSpellLevel || 1;

          let overchannelResult;
          if (isOverchannel) {
              overchannelResult = rollExpressionMaximized(autoFormula);
          } else {
              overchannelResult = isCrit ? rollExpressionDoubled(autoFormula) : rollExpression(autoFormula);
          }
          if (overchannelResult) {
            const context = {
              damageType: autoDamage.damageType,
              targetName: autoDamage.targetName,
              attackerName: autoDamage.attackerName,
              isAutoCrit: isCrit,
              playerStats,
              doubledRolls: overchannelResult.doubledRolls,
             };
            if (autoDamage.saveDc) {
               context.saveDc = autoDamage.saveDc;
               context.saveType = autoDamage.saveType;
               context.dcSuccess = autoDamage.dcSuccess;
              }
            if (autoDamage.metamagicTwinTarget) {
              context.metamagicTwinTarget = autoDamage.metamagicTwinTarget;
            }
            if (autoDamage.metamagicHeighten) {
              context.metamagicHeighten = autoDamage.metamagicHeighten;
            }
            rollDamage(autoDamage.name, autoFormula, overchannelResult.total, overchannelResult.rolls, overchannelResult.modifier, context);

            if (isOverchannel && overchannelUseCount > 1) {
                const dicePerLevel = 2 + (overchannelUseCount - 1);
                const totalDice = dicePerLevel * overchannelSpellLevel;
                const necroticFormula = `${totalDice}d12`;
                const necroticResult = rollExpression(necroticFormula);
                if (necroticResult) {
                    const combatSummary = getCombatSummary(campaignName) || { creatures: [] };
                    const applyResult = applyDamageToTarget(combatSummary, playerStats.name, necroticResult.total, ['Necrotic'], campaignName, null, true, playerStats.name);
                    addEntry(campaignName, {
                        type: 'roll',
                        characterName: playerStats.name,
                        rollType: 'overchannel-damage',
                        name: 'Overchannel',
                        formula: necroticFormula,
                        rolls: necroticResult.rolls,
                        total: necroticResult.total,
                        modifier: necroticResult.modifier,
                        damageType: 'Necrotic',
                        targetName: playerStats.name,
                        finalDamage: applyResult?.finalDamage,
                        note: 'Overchannel self-damage (ignores resistance/immunity)',
                    }).catch((e) => { console.error("[CharSpells] Error:", e); });
                }
            }
            }
            // Remarkable Athlete: after critical hit, enable movement without opportunity attacks
            if (isCrit) {
                const hasRemarkableAthlete = (playerStats.automation?.passives || []).some(
                    p => p.type === 'auto_effect' && p.effect === 'remarkable_athlete_movement'
                );
                if (hasRemarkableAthlete) {
                    setRuntimeValue(playerStats.name, 'remarkableAthleteNoOA', true, campaignName);
                }
            }
           },
         });
    const [selectedSpell, setSelectedSpell] = React.useState(null);
    const isSorcerer = playerStats.class?.name === 'Sorcerer';
    const [pendingSimpleMetamagic, setPendingSimpleMetamagic] = React.useState(null);

    const handleSimpleConfirm = React.useCallback((result) => {
      const pending = pendingSimpleMetamagic;
      setPendingSimpleMetamagic(null);
      if (!pending) return;

      let totalMetamagicCost = result?.totalCost || 0;
      let psionicCost = 0;
      if (pending.isPsionic && !result?.options?.includes('Subtle Spell')) {
        psionicCost = pending.psionicCost;
      }
      const totalCost = totalMetamagicCost + psionicCost;
      if (totalCost > 0) spendSorceryPoints(playerStats.name, totalCost, campaignName, getMaxSorceryPoints(playerStats));

      const metamagicOptions = result?.options || [];
      if (psionicCost > 0 && !metamagicOptions.includes('Psionic Sorcery')) {
        metamagicOptions.push('Psionic Sorcery');
      }

      const metaCtx = {};
      if (result?.options) {
        if (result.options.includes('Heightened Spell')) metaCtx.metamagicHeighten = true;
        if (result.options.includes('Careful Spell')) metaCtx.metamagicCareful = true;
        if (result.options.includes('Twinned Spell') && result.twinTarget) metaCtx.metamagicTwinTarget = result.twinTarget;
        if (result.options.includes('Distant Spell')) metaCtx.metamagicDistant = true;
      }
      if (psionicCost > 0) {
        metaCtx.psionicSpell = true;
      }

      pending.action(metaCtx);
    }, [pendingSimpleMetamagic, playerStats, campaignName]);

    const handleSimpleSkip = React.useCallback(() => {
      const pending = pendingSimpleMetamagic;
      setPendingSimpleMetamagic(null);
      if (!pending) return;
      pending.action({});
    }, [pendingSimpleMetamagic]);

    const getDamageFormula = (effect) => {
        const match = effect.match(/^(\d+d\d+(?:[+-]\d+)?)/);
        return match ? match[1] : null;
    };

    const getTargetInfo = React.useCallback(async () => {
        const cs = await getCombatContext(campaignName);
        if (!cs) return null;
        const target = getTargetFromAttacker(cs, playerStats.name);
        if (target) return target;
        const overlayTargetName = getAttackerTargetName(cs, playerStats.name);
        if (overlayTargetName) return { name: overlayTargetName };
        return null;
    }, [playerStats.name, campaignName]);

    const cachedCastPosRef = React.useRef(null);

    const castAction = React.useCallback((spell, metaCtx) => {
      const pos = cachedCastPosRef.current;
      executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos: pos?.attackerPos, targetPos: pos?.targetPos, campaignName, mapName, characters }).then((result) => {
        if (result && result.healAmount > 0) {
          const bonusHealDetail = result.bonusDetails?.length > 0
            ? result.bonusDetails.map(d => `${d.amount} ${d.name}`).join(', ')
            : '';
          const rawTotal = result.rawTotal ?? result.healAmount;
          setPopupHtml({
            type: 'heal',
            name: spell.name,
            formula: result.formula,
            rolls: result.rolls || [],
            total: rawTotal,
            targetName: result.targetName,
            finalHeal: result.healAmount,
            bonusHeal: result.bonusHeal || 0,
            bonusHealDetail,
          });
        }
      }).catch((e) => { console.error('[CharSpells] executeSpellCast error:', e); });
      cachedCastPosRef.current = null;
      }, [rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml]);
    const { pendingMetamagic, pendingMultiTarget, gateMetamagic, handleConfirm, handleSkip, handleMultiTargetConfirm, handleMultiTargetSkip, pendingAid, handleAidConfirm, handleAidSkip, pendingHeroesFeast, handleHeroesFeastConfirm, handleHeroesFeastSkip, pendingGreaterRestoration, handleGreaterRestorationConfirm, handleGreaterRestorationSkip, pendingLesserRestoration, handleLesserRestorationConfirm, handleLesserRestorationSkip, pendingMageArmor, handleMageArmorConfirm, handleMageArmorSkip, pendingShieldOfFaith, handleShieldOfFaithConfirm, handleShieldOfFaithSkip, pendingProtectionFromEnergy, handleProtectionFromEnergyConfirm, handleProtectionFromEnergySkip, pendingResistance, handleResistanceConfirm, handleResistanceSkip, pendingRemoveCurse, handleRemoveCurseConfirm, handleRemoveCurseSkip, pendingMagicMissile, handleMagicMissileConfirm, handleMagicMissileSkip } = useSpellMetamagicFlow(playerStats, campaignName, castAction);
    const { pendingUpcast, buildUpcastLevels, gateUpcast, handleUpcastConfirm, handleUpcastCancel, getCantripAutoLevel } = useSpellUpcastFlow(playerStats, campaignName);

    const resolveSpellPositions = React.useCallback(async () => {
      if (!mapName) return;
      try {
        const [mapData] = await Promise.all([
          mapsService.loadMapData(campaignName, mapName),
        ]);
        const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
        if (attackerPlayer) {
          const cs = await getCombatContext(campaignName);
          const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
          if (target) {
            const targetPlayer = mapData?.players?.find(p => p.name === target.name);
            const targetNpc = mapData?.placedItems?.length
              ? getNearestPlacedItem(mapData.placedItems, target.name, attackerPlayer)
              : null;
            const targetPos = targetPlayer
              ? { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY }
              : targetNpc
                ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY }
                : null;
            if (targetPos) {
              cachedCastPosRef.current = {
                attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                targetPos,
              };
            }
          }
        }
      } catch { /* positions unavailable */ }
    }, [mapName, campaignName, playerStats.name]);

    const handleSpellCast = React.useCallback(async (spell, metaCtx) => {
        setSelectedSpell(null);

        await resolveSpellPositions();

        gateMetamagic(spell, metaCtx);
    }, [gateMetamagic, resolveSpellPositions]);

    const handleDamageRoll = (formula, spellName, spell) => {
      let targetSpell = { ...spell, baseLevel: spell.level };
      if (spellName === "Hunter's Mark" && playerStats.class?.name === 'Ranger' && playerStats.level >= 20) {
        targetSpell = { ...targetSpell, damage: { ...targetSpell.damage, damage_at_slot_level: { ...(targetSpell.damage?.damage_at_slot_level || {}), '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' } } };
      }

      if (spellName && spellName.toLowerCase() === 'magic missile') {
        const mmAfterUpcast = (modifiedSpell) => {
          gateMetamagic(modifiedSpell);
        };
        if (gateUpcast(targetSpell, mmAfterUpcast, false)) {
          return;
        }
        return;
      }

      if (isSorcerer) {
        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        const spellLevel = targetSpell.level || 0;
        const isPsionic = isPsionicSpell(playerStats, spellName);
        const hasPsionic = hasPsionicSorcery(playerStats);
        setPendingSimpleMetamagic({
          spellName,
          spellLevel,
          action: (metaCtx) => {
            const totalMetamagicCost = metaCtx?.totalCost || 0;
            const psionicCost = (isPsionic && !metaCtx?.options?.includes('Subtle Spell')) ? (metaCtx?.psionicCost || 0) : 0;
            const totalCost = totalMetamagicCost + psionicCost;
            if (totalCost > 0) spendSorceryPoints(playerStats.name, totalCost, campaignName, getMaxSorceryPoints(playerStats));
            const castSpell = { ...targetSpell, baseLevel: spell.level };
            castAction(castSpell, metaCtx);
          },
          _currentSP: currentSP,
          isPsionic: isPsionic && hasPsionic,
          psionicCost: isPsionic && hasPsionic ? spellLevel : 0,
        });
        return;
      }

      const afterUpcast = (modifiedSpell) => {
        const castSpell = { ...modifiedSpell, baseLevel: spell.level };
        castAction(castSpell, {});
      };

      if (gateUpcast(targetSpell, afterUpcast, false)) {
        return;
      }

      if (spell.level === 0) {
        const autoLevel = getCantripAutoLevel(spell, playerStats.level);
        if (autoLevel) {
          const modifiedSpell = { ...spell, level: autoLevel, baseLevel: 0 };
          castAction(modifiedSpell, {});
          return;
        }
      }

      castAction(targetSpell, {});
    };
    const [filterPrepared, setFilterPrepared] = React.useState(false);
    const [spells, setSpells] = React.useState([]);
    const is2024 = playerStats.rules === '2024';

    React.useEffect(() => {
        if(playerStats.spellAbilities) {
            setFilterPrepared(false);
            const excludedSpellNames = getExcludedSpellNames(playerStats, campaignName);
            const allSpells = playerStats.spellAbilities.spells;
            setSpells(allSpells.filter(spell => !excludedSpellNames.has(spell.name)));
          }
      }, [playerStats, campaignName]);
    const handleTogglePreparedFilter = () => {
        const excludedSpellNames = getExcludedSpellNames(playerStats, campaignName);
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        if(!filterPrepared) {
            const filtered = spells.filter(spell => !excludedSpellNames.has(spell.name) && (spell.prepared === 'Always' || spell.prepared === 'Prepared'));
            setSpells(filtered);
        } else {
            const filtered = spells.filter(spell => !excludedSpellNames.has(spell.name));
            setSpells(filtered);
        }
        setFilterPrepared(!filterPrepared)
    }
    const handleSortLevel = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        // Sort by level (ascending) then by name
        spells.sort((a, b) => {
            if (a.level !== b.level) {
                return a.level - b.level;
            } else {
                return a.name.localeCompare(b.name);
              }
          });
        setSpells(spells);
    }
    const handleSortSpell = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        spells.sort((a, b) => a.name.localeCompare(b.name));
        setSpells(spells);
    }
return (
        <div className="char-spells">
            {(playerStats.spellAbilities && playerStats.spellAbilities.spells.length > 0) && <div className="spell-popup-parent">
                    {selectedSpell && (
                        <Popup onClickOrKeyDown={() => setSelectedSpell(null)}>
                            <SpellDetailPopup
                                spell={selectedSpell}
                                playerStats={playerStats}
                                campaignName={campaignName}
                                playerLevel={playerStats.level}
                                upcastLevels={buildUpcastLevels(selectedSpell)}
                                onClose={() => setSelectedSpell(null)}
                                onCast={handleSpellCast}
                            />
                        </Popup>
                    )}
                    {pendingUpcast && (
                      <UpcastPopup
                        spell={pendingUpcast.spell}
                        levels={buildUpcastLevels(pendingUpcast.spell)}
                        onConfirm={handleUpcastConfirm}
                        onCancel={handleUpcastCancel}
                      />
                    )}
                    {pendingMetamagic && (
                      <MetamagicPopup
                        spell={{ name: pendingMetamagic.spellName, level: pendingMetamagic.spellLevel || 0 }}
                        playerStats={{ ...playerStats, _metamagicCurrentSP: pendingMetamagic._currentSP, _isPsionicSpell: pendingMetamagic.isPsionic, _psionicCost: pendingMetamagic.psionicCost }}
                        campaignName={campaignName}
                        onConfirm={handleConfirm}
                        onSkip={handleSkip}
                      />
                    )}
                    {pendingSimpleMetamagic && (
                      <MetamagicPopup
                        spell={{ name: pendingSimpleMetamagic.spellName, level: pendingSimpleMetamagic.spellLevel || 0 }}
                        playerStats={{ ...playerStats, _metamagicCurrentSP: pendingSimpleMetamagic._currentSP, _isPsionicSpell: pendingSimpleMetamagic.isPsionic, _psionicCost: pendingSimpleMetamagic.psionicCost }}
                        campaignName={campaignName}
                        onConfirm={handleSimpleConfirm}
                        onSkip={handleSimpleSkip}
                      />
                    )}
                    {pendingMagicMissile && (() => {
                      const { spell, totalMissiles, missileDamage, creatureTargets } = pendingMagicMissile;
                      const currentTargetName = getTargetFromAttacker(getCombatSummary(campaignName), playerStats.name)?.name;
                      return (
                        <MagicMissileTargetPopup
                          spell={{ name: spell.name, level: spell.level || 0 }}
                          playerStats={playerStats}
                          campaignName={campaignName}
                          totalMissiles={totalMissiles}
                          missileDamage={missileDamage}
                          creatureTargets={creatureTargets}
                          currentTargetName={currentTargetName}
                          onConfirm={handleMagicMissileConfirm}
                          onSkip={handleMagicMissileSkip}
                        />
                      );
                    })()}
                    {pendingMultiTarget && (
                      <MultiTargetPopup
                        spell={{ name: pendingMultiTarget.spellName, level: pendingMultiTarget.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        range={pendingMultiTarget.range}
                        creatureTargets={pendingMultiTarget.creatureTargets}
                        onConfirm={handleMultiTargetConfirm}
                        onSkip={handleMultiTargetSkip}
                      />
                    )}
                    {pendingAid && (
                      <MultiTargetCountPopup
                        spell={{ name: pendingAid.spellName, level: pendingAid.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        range={pendingAid.range}
                        rangeFt={pendingAid.rangeFt}
                        creatureTargets={pendingAid.creatureTargets}
                        maxTargets={pendingAid.maxTargets}
                        attackerPos={pendingAid.attackerPos}
                        onConfirm={handleAidConfirm}
                        onSkip={handleAidSkip}
                      />
                    )}
                    {pendingHeroesFeast && (
                      <MultiTargetCountPopup
                        spell={{ name: pendingHeroesFeast.spellName, level: pendingHeroesFeast.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        range={pendingHeroesFeast.range}
                        rangeFt={pendingHeroesFeast.rangeFt}
                        creatureTargets={pendingHeroesFeast.creatureTargets}
                        maxTargets={pendingHeroesFeast.maxTargets}
                        attackerPos={pendingHeroesFeast.attackerPos}
                        onConfirm={handleHeroesFeastConfirm}
                        onSkip={handleHeroesFeastSkip}
                      />
                    )}
                    {pendingGreaterRestoration && (() => {
                      const loadTargetData = async (targetName) => {
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
                        const RESTORATION_CONDITIONS = [{ id: 'charmed' }, { id: 'petrified' }];
                        const conditionMatches = (c, targetCondition) =>
                          (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
                        RESTORATION_CONDITIONS
                          .filter(c => allConditions.some(cond => conditionMatches(cond, c.id)))
                          .forEach(c => {
                            result.push({ id: c.id, label: `${c.id.charAt(0).toUpperCase() + c.id.slice(1)} condition`, selectionData: { type: 'condition', condition: c.id } });
                          });
                        const exhaustion = getRuntimeValue(targetName, 'exhaustionLevel') || 0;
                        if (exhaustion > 0) {
                          result.push({ id: 'exhaustion', label: `Exhaustion level (current: ${exhaustion})`, selectionData: { type: 'exhaustion' } });
                        }
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
                      };
                      return (
                        <TargetWithCheckboxesPopup
                          spell={{ name: pendingGreaterRestoration.spellName, level: pendingGreaterRestoration.spellLevel || 0 }}
                          playerStats={playerStats}
                          campaignName={campaignName}
                          creatureTargets={pendingGreaterRestoration.creatureTargets}
                          range={pendingGreaterRestoration.range}
                          onConfirm={handleGreaterRestorationConfirm}
                          onSkip={handleGreaterRestorationSkip}
                          loadTargetData={loadTargetData}
                          icon="fa-solid fa-hand-holding-medical"
                          title="Greater Restoration"
                          school="Abjuration"
                          defaultLevel={5}
                          description={
                            <span>
                              Choose a creature within <strong>{pendingGreaterRestoration.range}</strong> and select the effect(s) to remove.
                              This spell can remove one or more of the following from the target:
                              an exhaustion level, the Charmed or Petrified condition, a curse (including attunement to a cursed magic item),
                              any reduction to an ability score, or any reduction to the target's Hit Point maximum.
                            </span>
                          }
                          noItemsMessage="No removable effects found on this target"
                          confirmLabel="Cast Greater Restoration"
                        />
                      );
                    })()}
                    {pendingLesserRestoration && (() => {
                      const loadTargetData = async (targetName) => {
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
                        const ALLOWED_CONDITIONS = [{ id: 'blinded' }, { id: 'deafened' }, { id: 'paralyzed' }, { id: 'poisoned' }];
                        const conditionMatches = (c, targetCondition) =>
                          (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
                        return ALLOWED_CONDITIONS
                          .filter(c => allConditions.some(a => conditionMatches(a, c.id)))
                          .map(c => ({ id: c.id, label: `${c.id.charAt(0).toUpperCase() + c.id.slice(1)} condition`, selectionData: { condition: c.id } }));
                      };
                      return (
                        <TargetWithCheckboxesPopup
                          spell={{ name: pendingLesserRestoration.spellName, level: pendingLesserRestoration.spellLevel || 0 }}
                          playerStats={playerStats}
                          campaignName={campaignName}
                          creatureTargets={pendingLesserRestoration.creatureTargets}
                          range={pendingLesserRestoration.range}
                          onConfirm={handleLesserRestorationConfirm}
                          onSkip={handleLesserRestorationSkip}
                          loadTargetData={loadTargetData}
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
                    })()}
                    {pendingRemoveCurse && (() => {
                      const loadTargetData = async (targetName) => {
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
                      };
                      return (
                        <TargetWithCheckboxesPopup
                          spell={{ name: pendingRemoveCurse.spellName, level: pendingRemoveCurse.spellLevel || 0 }}
                          playerStats={playerStats}
                          campaignName={campaignName}
                          creatureTargets={pendingRemoveCurse.creatureTargets}
                          range={pendingRemoveCurse.range}
                          onConfirm={handleRemoveCurseConfirm}
                          onSkip={handleRemoveCurseSkip}
                          loadTargetData={loadTargetData}
                          icon="fa-solid fa-hand-holding-medical"
                          title="Remove Curse"
                          school="Abjuration"
                          defaultLevel={3}
                          description={
                            <span>
                              Choose a creature within <strong>{pendingRemoveCurse.range}</strong>. This spell ends all curses affecting the target
                              and breaks the target's attunement to any cursed magic items.
                            </span>
                          }
                          noItemsMessage="No curses or attunement found on this target"
                          confirmLabel="Cast Remove Curse"
                        />
                      );
                    })()}
                    {pendingMageArmor && (
                      <SingleTargetPopup
                        spell={{ name: pendingMageArmor.spellName, level: pendingMageArmor.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        range={pendingMageArmor.range}
                        creatureTargets={pendingMageArmor.creatureTargets}
                        onConfirm={handleMageArmorConfirm}
                        onSkip={handleMageArmorSkip}
                      />
                    )}
                    {pendingShieldOfFaith && (
                      <SingleTargetPopup
                        spell={{ name: pendingShieldOfFaith.spellName, level: pendingShieldOfFaith.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        range={pendingShieldOfFaith.range}
                        creatureTargets={pendingShieldOfFaith.creatureTargets}
                        onConfirm={handleShieldOfFaithConfirm}
                        onSkip={handleShieldOfFaithSkip}
                      />
                    )}
                    {pendingProtectionFromEnergy && (
                      <TargetWithTypePopup
                        spell={{ name: pendingProtectionFromEnergy.spellName, level: pendingProtectionFromEnergy.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        range={pendingProtectionFromEnergy.range}
                        creatureTargets={pendingProtectionFromEnergy.creatureTargets}
                        damageTypes={pendingProtectionFromEnergy.damageTypes}
                        onConfirm={handleProtectionFromEnergyConfirm}
                        onSkip={handleProtectionFromEnergySkip}
                      />
                    )}
                    {pendingResistance && (
                      <TargetWithTypePopup
                        spell={{ name: pendingResistance.spellName, level: pendingResistance.spellLevel || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        range={pendingResistance.range}
                        creatureTargets={pendingResistance.creatureTargets}
                        damageTypes={pendingResistance.damageTypes}
                        onConfirm={handleResistanceConfirm}
                        onSkip={handleResistanceSkip}
                      />
                    )}
            <hr />
            <div className='spell-abilities'>
                <div className="sectionHeader"><h4>&nbsp;Spells</h4></div>
                <div>
                    <b className={'clickable' + (cannotAct ? ' disabled-attack' : '') + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? ' stat--penalized' : '')} onClick={() => {
                      if (cannotAct) return;
                       const doAttack = (metaCtx) => {
                         const innateAdv = isSorcerer && innateSorceryActive && !conditionAttackMode ? 'advantage' : undefined;
                         rollAttack('Spell Attack', playerStats.spellAbilities.toHit - exhaustionPenalty, { forcedMode: conditionAttackMode !== 'normal' ? conditionAttackMode : innateAdv, ...metaCtx });
                        };
                      if (isSorcerer) {
                        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
                        setPendingSimpleMetamagic({
                          spellName: 'Spell Attack',
                          action: doAttack,
                          _currentSP: currentSP,
                        });
                      } else {
                        doAttack({});
                      }
                    }}>Attack (to hit):</b> <span className={exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? 'stat--penalized' : ''}>+{playerStats.spellAbilities.toHit - exhaustionPenalty}</span><br/>
                    <b>Modifier:</b> <span className={exhaustionPenalty > 0 ? 'stat--penalized' : ''}>+{playerStats.spellAbilities.modifier - exhaustionPenalty}</span><br/>
                      <b>Save DC:</b> {playerStats.spellAbilities.saveDc + (innateSorceryActive ? 1 : 0)}
                </div>
                <div>
                    <b>Cantrips Known:</b> {playerStats.spellAbilities.cantrips_known ? playerStats.spellAbilities.cantrips_known : 0}<br/>
                    {!is2024 && <div>
                        <b>Prepared Spells:</b> {playerStats.spellAbilities.prepared_spells || playerStats.spellAbilities.spells_known ? (playerStats.spellAbilities.prepared_spells || playerStats.spellAbilities.spells_known) : 'All'}<br/>                    
                        <b>Max Prepared:</b> {playerStats.spellAbilities.maxPreparedSpells ? playerStats.spellAbilities.maxPreparedSpells : 'All'}
                    </div>}
                </div>
                <CharSpellSlots playerStats={playerStats} campaignName={campaignName}></CharSpellSlots>
            </div>
            <table className='table-spells table-striped'>
                <thead>
                    <tr>
                        <th className='left clickable' onClick={handleSortSpell}>Spell</th>
                        <th className='clickable' onClick={handleSortLevel}>Level</th>
                        {!is2024 && <th className='clickable' onClick={handleTogglePreparedFilter}>Prepared</th>}
                        <th>Time</th>
                        <th>Range</th>
                        <th>Effect</th>
                        <th>Duration</th>
                        <th className='left'>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {spells.map((spell) => {
                        let notes = [];
                        if(spell.components) notes.push(spell.components.join('/'));
                        let effect = 'Utility';
                        if(spell.damage) {
                            const slotDmg = spell.damage.damage_at_slot_level;
                            const charDmg = spell.damage.damage_at_character_level;
                            const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;
                            if (dmgObj) {
                                const isCantrip = spell.level === 0;
                                let damageDisplay = isCantrip ? dmgObj[Math.max(...Object.keys(dmgObj).map(Number).filter(l => l <= playerStats.level))] || dmgObj[Object.keys(dmgObj)[0]] : dmgObj[Object.keys(dmgObj)[0]];
                                if (spell.name === "Hunter's Mark" && playerStats.class?.name === 'Ranger' && playerStats.level >= 20) {
                                    damageDisplay = damageDisplay.replace('1d6', '1d10');
                                }
                                if (isCantrip) {
                                    effect = `${damageDisplay} ${spell.damage.damage_type}`;
                                } else {
                                    effect = `${damageDisplay} ${spell.damage.damage_type}`;
                                }
                                if (spell.dc) {
                                    const saveLabel = spell.dc.dc_success === 'half' ? 'half' : 'negates';
                                    effect += ` (${spell.dc.dc_type} ${saveLabel})`;
                                }
                            }
                        }
                        return <tr key={spell.name}>
                            <td className='left spell-name clickable' onClick={() => setSelectedSpell(spell)}>{spell.name}</td>
                            <td>{spell.level === 0 ? 'Cantrip' : spell.level}</td>
                            {!is2024 && (spell.prepared !== 'Prepared' && spell.prepared !== '') && <td>{spell.prepared}</td>}
                            {!is2024 && (spell.prepared === 'Prepared' || spell.prepared === '') && <td><input tabIndex={0} type="checkbox" checked={spell.prepared === 'Prepared'} onChange={() => handleTogglePreparedSpells(spell.name)}/></td>}
                            <td>{spell.casting_time ? spell.casting_time.replace(/\bbonus action\b/g, 'BA').replace(/\baction\b/g, ' A').replace(/\breaction\b/g, 'Reaction').replace(/\bminute\b/g, 'min').replace(/\bminutes\b/g, 'min') : ''}</td>
                            <td>{spell.range}</td>
                            <td className={getDamageFormula(effect) ? 'clickable' : ''} onClick={getDamageFormula(effect) ? () => handleDamageRoll(getDamageFormula(effect), spell.name, spell) : undefined}>{effect}</td>
                            <td>{spell.duration ? spell.duration.replace('Instantaneous','Instant').replace('minute','min').replace('minutes','min').replace('up to ','') : ''}</td>
                            <td className='left'>{notes.join(', ').replace('Concentration','Con')}</td>
                        </tr>
                    })}
                </tbody>
            </table>
        </div>}
    </div>
    )
};

export default CharSpells
