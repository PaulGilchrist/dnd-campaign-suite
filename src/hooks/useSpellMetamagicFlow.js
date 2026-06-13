import React from 'react'
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from './useMetamagic.js'
import { addEntry } from '../services/ui/logService.js'
import { getMultiTargetSpreadForSpell } from '../services/rules/postCastRiderService.js'
import { getCombatSummary } from '../services/encounters/combatData.js'
import { isPsionicSpell, hasPsionicSorcery } from '../services/rules/metamagicRules.js'

function getCreatureTargets(excludeName) {
  const cs = getCombatSummary();
  if (!cs?.creatures) return [];
  return cs.creatures
    .filter(c => c.name !== excludeName)
    .map(c => c.name);
}

export function useSpellMetamagicFlow(playerStats, campaignName, onExecute) {
  const isSorcerer = playerStats?.class?.name === 'Sorcerer';
  const [pendingMetamagic, setPendingMetamagic] = React.useState(null);
  const [pendingMultiTarget, setPendingMultiTarget] = React.useState(null);

  const gateMetamagic = React.useCallback((spell) => {
    const multiTargetSpread = getMultiTargetSpreadForSpell(playerStats, spell.name);

    if (multiTargetSpread) {
      const creatureTargets = getCreatureTargets(playerStats?.name);
      if (creatureTargets.length > 0) {
        setPendingMultiTarget({
          spell,
          spellName: spell.name,
          spellLevel: spell.level || 0,
          castingTime: spell.casting_time,
          range: multiTargetSpread.range || '10 ft',
          creatureTargets,
        });
        return;
      }
    }

    if (!isSorcerer) {
      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        spellName: spell.name,
        spellLevel: spell.level || 0,
        castingTime: spell.casting_time,
        metamagic: [],
        spCost: 0,
        timestamp: Date.now(),
      });
      onExecute(spell, {});
      return;
    }

    const spellLevel = spell.level || 0;
    const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
    const isPsionic = isPsionicSpell(playerStats, spell.name);
    const hasPsionic = hasPsionicSorcery(playerStats);

    setPendingMetamagic({
      spell,
      spellName: spell.name,
      spellLevel: spell.level || 0,
      castingTime: spell.casting_time,
      _currentSP: currentSP,
      isPsionic: isPsionic && hasPsionic,
      psionicCost: isPsionic && hasPsionic ? spellLevel : 0,
    });
    }, [isSorcerer, playerStats, campaignName, onExecute]);

  const handleConfirm = React.useCallback((result) => {
    const pending = pendingMetamagic;
    setPendingMetamagic(null);
    if (!pending) return;

    let totalMetamagicCost = result?.totalCost || 0;
    let psionicCost = 0;

    if (pending.isPsionic && !result?.options?.includes('Subtle Spell')) {
      psionicCost = pending.psionicCost;
    }

    const totalCost = totalMetamagicCost + psionicCost;
    if (totalCost > 0) {
      spendSorceryPoints(playerStats.name, totalCost, campaignName, getMaxSorceryPoints(playerStats));
    }

    const metamagicOptions = result?.options || [];
    if (psionicCost > 0 && !metamagicOptions.includes('Psionic Sorcery')) {
      metamagicOptions.push('Psionic Sorcery');
    }

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: metamagicOptions,
      spCost: totalCost,
      timestamp: Date.now(),
    });

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

    onExecute(pending.spell, metaCtx);
  }, [pendingMetamagic, playerStats, campaignName, onExecute]);

  const handleSkip = React.useCallback(() => {
    const pending = pendingMetamagic;
    setPendingMetamagic(null);
    if (!pending) return;

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: [],
      spCost: 0,
      timestamp: Date.now(),
    });

    onExecute(pending.spell, {});
  }, [pendingMetamagic, playerStats.name, campaignName, onExecute]);

  const handleMultiTargetConfirm = React.useCallback((result) => {
    const pending = pendingMultiTarget;
    setPendingMultiTarget(null);
    if (!pending) return;

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: ['Words of Creation'],
      spCost: 0,
      timestamp: Date.now(),
    });

    const metaCtx = {};
    if (result?.secondTarget) {
      metaCtx.multiTarget = result.secondTarget;
    }

    onExecute(pending.spell, metaCtx);
  }, [pendingMultiTarget, playerStats, campaignName, onExecute]);

  const handleMultiTargetSkip = React.useCallback(() => {
    const pending = pendingMultiTarget;
    setPendingMultiTarget(null);
    if (!pending) return;

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: [],
      spCost: 0,
      timestamp: Date.now(),
    });

    onExecute(pending.spell, {});
  }, [pendingMultiTarget, playerStats, campaignName, onExecute]);

  return { pendingMetamagic, pendingMultiTarget, gateMetamagic, handleConfirm, handleSkip, handleMultiTargetConfirm, handleMultiTargetSkip };
}
