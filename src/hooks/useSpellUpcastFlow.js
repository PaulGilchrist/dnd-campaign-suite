import React from 'react'
import { getRuntimeValue, setRuntimeValue } from './useRuntimeState.js'

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
    if (!slotDmg) return false;
    return Object.keys(slotDmg).length > 1;
  }, []);

  const buildUpcastLevels = React.useCallback((spell) => {
    const slotDmg = spell.damage?.damage_at_slot_level;
    if (!slotDmg) return [];
    return Object.keys(slotDmg)
      .map(Number)
      .sort((a, b) => a - b)
      .map(level => ({
        level,
        formula: slotDmg[level],
        availableSlots: getAvailableSlotCount(level),
      }));
  }, [getAvailableSlotCount]);

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
