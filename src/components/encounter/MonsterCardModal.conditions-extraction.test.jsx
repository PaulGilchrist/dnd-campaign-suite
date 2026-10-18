// @maintained-by-ai
// Trim audit (conditions-extraction lane): word-scan is re-echoed ~100x across
// monsterLairActions.test.js + saveProcessing.*.test.js on REAL save_effect strings.
// Removed with evidence:
// - 13/14 per-word extraction legs: prone/restrained/blinded/deafened/charmed/
//   incapacitated/poisoned (monsterLairActions.test.js:277/331/649/1334/1539/3861),
//   frightened (saveProcessing.ma1392:119), petrified (MonsterCardModal.logic.test.jsx:265,
//   gorgon-breath:167), cursed (sphinx-of-secrets-curse...:43), paralyzed
//   (roarService.ma1502:87, legendary-uses-ancient-silver:189), unconscious
//   (monsterRecharge.ma1940-ladon:46).
// - Multi-condition: monsterLairActions:277 ['prone','restrained'], :1539
//   ['incapacitated','poisoned']; MonsterCardModal.ma1578-tarrasque-swallow:128.
// - Case-insensitivity: gorgon-breath.test.jsx:145-167 (capitalized "Restrained"/
//   "Petrified" real prose, through the modal chip seam).
// - Absent-save_effect guard: saveProcessing.ma2072-ziz-sky-screech.test.js:54.
// - No-condition-prose -> []: monsterLairActions arcs/wall/geyser/shards legs.
// - Modal integration (chip click -> rollSavingThrow ctx saveConditions):
//   MonsterCardModal.logic.test.jsx:285-297 (non-empty ['poisoned']) and
//   MonsterCardModal.ma1863-behemoth-trumpet.test.jsx:206-213 (empty []) own the
//   same executeBlockSaveRoll seam. All mock/render scaffolding purged.
// Kept (unique): CONDITIONS word-list census incl. 'stunned' (the only canonical
// word no other test extracts) and word-boundary negatives (no other test feeds
// substring words like "petrifying" to the extractor).

import { describe, it, expect } from 'vitest';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

describe('extractConditionsFromSaveEffect', () => {
  it('extracts every canonical condition word (census of Helpers CONDITIONS list)', () => {
    const CANONICAL = ['blinded', 'charmed', 'cursed', 'deafened', 'frightened', 'grappled',
      'incapacitated', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];
    for (const word of CANONICAL) {
      expect(extractConditionsFromSaveEffect(`the target is ${word}`)).toEqual([word]);
    }
  });

  it('does not match condition words as substrings of larger words', () => {
    expect(extractConditionsFromSaveEffect('the target suffers from blindedness')).toEqual([]);
    expect(extractConditionsFromSaveEffect('the target falls into unconsciousness')).toEqual([]);
    expect(extractConditionsFromSaveEffect('the target begins petrifying')).toEqual([]);
  });
});
