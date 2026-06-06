import React from 'react'
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from './useMetamagic.js'
import { addEntry } from '../services/logService.js'

export function useSpellMetamagicFlow(playerStats, campaignName, onExecute) {
  const isSorcerer = playerStats?.class?.name === 'Sorcerer';
  const [pendingMetamagic, setPendingMetamagic] = React.useState(null);

  const gateMetamagic = React.useCallback((spell) => {
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

    const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
    setPendingMetamagic({
      spell,
      spellName: spell.name,
      spellLevel: spell.level || 0,
      castingTime: spell.casting_time,
      _currentSP: currentSP,
    });
    }, [isSorcerer, playerStats, campaignName, onExecute]);

  const handleConfirm = React.useCallback((result) => {
    const pending = pendingMetamagic;
    setPendingMetamagic(null);
    if (!pending) return;

    if (result?.totalCost > 0) {
      spendSorceryPoints(playerStats.name, result.totalCost, campaignName, getMaxSorceryPoints(playerStats));
    }

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: result?.options || [],
      spCost: result?.totalCost || 0,
      timestamp: Date.now(),
    });

    const metaCtx = {};
    if (result?.options) {
      if (result.options.includes('Heightened Spell')) metaCtx.metamagicHeighten = true;
      if (result.options.includes('Careful Spell')) metaCtx.metamagicCareful = true;
      if (result.options.includes('Twinned Spell') && result.twinTarget) metaCtx.metamagicTwinTarget = result.twinTarget;
      if (result.options.includes('Distant Spell')) metaCtx.metamagicDistant = true;
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

  return { pendingMetamagic, gateMetamagic, handleConfirm, handleSkip };
}
