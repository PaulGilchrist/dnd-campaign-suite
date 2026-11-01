import { createMassHealSpellTrigger } from './massHealSpellFactory.js';

const MASS_HEALING_WORD_NAME = 'Mass Healing Word';

// Disk 5e spells.json:6760 'up to six creatures of your choice that you can
// see within range' — 'of your choice' with no friendly/allies wording, so
// hostile selection is RAW-legal (#1385 choice-clause verdict). The shared
// factory enforces the #1385 selection law: candidates pass canonical
// isWithinRange(caster, name, rangeToFeet(spell.range)) — disk '60 feet'
// enforced, no hardcoded feet. maxTargets reads automation.maxTargets
// (:6794 = 6); defaultMaxTargets 6 below is the disk-text fallback for rows
// without it. Lawful pool keeps combatSummary array order.
//
// UNIQUE vs the Mass Cure Wounds twin: NO postCastHealService import —
// CLA-038 blessed-healer does NOT fire from this lane (postCastSelfHeal
// config stays absent; the factory therefore never pulls that module in).

// fix#349 #1385: the dispatcher at triggerSpells.js `spell.name.toLowerCase() ===
// 'mass healing word'` lets any casing through to the factory gate, which
// folds case on BOTH sides (fix#109 dual-literal-case-fold precedent): the
// constant stays disk-canonical PascalCase, the comparison is case-insensitive.
export const triggerMassHealingWord = createMassHealSpellTrigger({
    spellName: MASS_HEALING_WORD_NAME,
    defaultSlotLevel: 3,
    defaultMaxTargets: 6,
    serviceTag: '[massHealingWordService]',
    logTag: '[massHealingWord]',
});
