// MA-1014: modal-wide spells.json NAME index (5e-then-2024, same resolution
// order as findMonsterSpell) so spell chips on a spell_save_dc-only utility
// row (Ice Devil "Ice Wall") arm ONLY for names that resolve in the DB
// (§158 fake-chip noise guard). loadSpells is cached (dataLoader) — the
// fetch never re-hits per card open. Extracted from MonsterCardModal to hold
// the max-statements ceiling.
import { useEffect, useState } from 'react';
import { loadSpells } from '../../services/ui/dataLoader.js';

export function useSpellNameIndex() {
  const [spellNameIndex, setSpellNameIndex] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all([loadSpells('5e'), loadSpells('2024')])
      .then(([fiveESpells, spells2024]) => {
        if (live) setSpellNameIndex(new Set([...fiveESpells.map(s => s.name), ...spells2024.map(s => s.name)]));
      })
      .catch((e) => { console.error('[useSpellNameIndex] Error loading spell name index:', e); });
    return () => { live = false; };
  }, []);
  return spellNameIndex;
}
