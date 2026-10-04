import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js'

// SP-015: summon_spirit HP ladder (Bestial Spirit "plus 5 per spell level
// above 2") — no damage/heal table, so the automation HP ladder builds the
// slot radio rows from baseLevel up to 9. scale:false blocks (Animate Objects,
// Giant Insect) have no hpPerLevelAbove and stay inert.
function summonHpLadderLevels(spell, getAvailableSlotCount) {
  const auto = spell.automation;
  if (!(auto && auto.type === 'summon_spirit' && Number(auto.hpPerLevelAbove) > 0)) return [];
  const base = auto.baseLevel || spell.level || 1;
  const ladder = [];
  for (let level = base; level <= 9; level++) {
    ladder.push({
      level,
      formula: `+${auto.hpPerLevelAbove} HP per slot level above ${base}`,
      availableSlots: getAvailableSlotCount(level),
    });
  }
  return ladder;
}

// CLA-050: Circle of the Land fixed-level rows offer exactly one cast level —
// no free upcast range; formula resolved at the stamped level.
function fixedLevelRow(spell, getAvailableSlotCount) {
  const fixed = spell?._circleOfTheLandFixedLevel;
  if (fixed == null) return null;
  const formula = (spell.damage?.damage_at_slot_level && spell.damage.damage_at_slot_level[fixed])
    || (spell.heal_at_slot_level && spell.heal_at_slot_level[fixed])
    || (spell.upcast_at_slot_level && spell.upcast_at_slot_level[fixed])
    || '';
  return [{ level: fixed, formula, availableSlots: getAvailableSlotCount(fixed) }];
}

export function useSpellUpcastFlow(playerStats, campaignName) {
  const [pendingUpcast, setPendingUpcast] = React.useState(null);

  const getAvailableSlotCount = React.useCallback((level) => {
    const runtime = getRuntimeValue(playerStats.name, `spell_slots_level_${level}`);
    const max = playerStats.spellAbilities?.[`spell_slots_level_${level}`] || 0;
    return runtime != null ? runtime : max;
  }, [playerStats.name, playerStats.spellAbilities]);

  const isUpcastable = React.useCallback((spell) => {
    if (!spell || spell.level === 0) return false;
    const slotDmg = spell.damage?.damage_at_slot_level;
    if (slotDmg && Object.keys(slotDmg).length > 1) return true;
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (healAtSlotLevel && Object.keys(healAtSlotLevel).length > 1) return true;
    const upcastAtSlotLevel = spell.upcast_at_slot_level;
    if (upcastAtSlotLevel && Object.keys(upcastAtSlotLevel).length > 1) return true;
    return false;
  }, []);

  const buildUpcastLevels = React.useCallback((spell) => {
    const fixedRow = fixedLevelRow(spell, getAvailableSlotCount);
    if (fixedRow) return fixedRow;
    const slotDmg = spell.damage?.damage_at_slot_level;
    const healAtSlotLevel = spell.heal_at_slot_level;
    const upcastAtSlotLevel = spell.upcast_at_slot_level;
    if (slotDmg && Object.keys(slotDmg).length > 0) {
      const isFoeSlayer = spell.name === "Hunter's Mark" && playerStats.class?.name === 'Ranger' && playerStats.level >= 20;
      return Object.keys(slotDmg)
        .map(Number)
        .sort((a, b) => a - b)
        .map(level => ({
          level,
          formula: isFoeSlayer ? String(slotDmg[level]).replace('1d6', '1d10') : slotDmg[level],
          availableSlots: getAvailableSlotCount(level),
        }));
    }
    if (healAtSlotLevel && Object.keys(healAtSlotLevel).length > 0) {
      return Object.keys(healAtSlotLevel)
        .map(Number)
        .sort((a, b) => a - b)
        .map(level => ({
          level,
          formula: healAtSlotLevel[level],
          availableSlots: getAvailableSlotCount(level),
        }));
    }
    if (upcastAtSlotLevel && Object.keys(upcastAtSlotLevel).length > 0) {
      return Object.keys(upcastAtSlotLevel)
        .map(Number)
        .sort((a, b) => a - b)
        .map(level => ({
          level,
          formula: upcastAtSlotLevel[level],
          availableSlots: getAvailableSlotCount(level),
        }));
    }
    return summonHpLadderLevels(spell, getAvailableSlotCount);
  }, [getAvailableSlotCount, playerStats.class?.name, playerStats.level]);

  const gateUpcast = React.useCallback((spell, afterUpcast, deductSlot = true) => {
    if (!isUpcastable(spell)) return false;
    setPendingUpcast({ spell, afterUpcast, deductSlot });
    return true;
  }, [isUpcastable]);

  const handleUpcastConfirm = React.useCallback((upcastLevel) => {
    const pending = pendingUpcast;
    setPendingUpcast(null);
    if (!pending) return;

    if (pending.deductSlot) {
      const slotKey = `spell_slots_level_${upcastLevel}`;
      const currentSlots = getAvailableSlotCount(upcastLevel);
      if (currentSlots > 0) {
        setRuntimeValue(playerStats.name, slotKey, currentSlots - 1, campaignName);
      }
    }

    const modifiedSpell = { ...pending.spell, level: upcastLevel };
    pending.afterUpcast(modifiedSpell);
  }, [pendingUpcast, playerStats.name, campaignName, getAvailableSlotCount]);

  const handleUpcastCancel = React.useCallback(() => {
    setPendingUpcast(null);
  }, []);

  const getCantripAutoLevel = React.useCallback((spell, playerLevel) => {
    const charDmg = spell.damage?.damage_at_character_level;
    const slotDmg = spell.damage?.damage_at_slot_level;
    const dmgObj = (charDmg && Object.keys(charDmg).length) ? charDmg : (slotDmg && Object.keys(slotDmg).length ? slotDmg : null);
    if (!dmgObj) return null;
    const levels = Object.keys(dmgObj).map(Number).sort((a, b) => a - b);
    const applicable = levels.filter(l => l <= playerLevel);
    return applicable.length > 0 ? Math.max(...applicable) : null;
  }, []);

  return {
    pendingUpcast,
    isUpcastable,
    buildUpcastLevels,
    gateUpcast,
    handleUpcastConfirm,
    handleUpcastCancel,
    getCantripAutoLevel,
  };
}
