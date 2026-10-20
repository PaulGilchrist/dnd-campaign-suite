// @maintained-by-ai
// MA-1907 + MA-1910: Garuda DATA fingerprints — TWO tickets, ONE file, split
// honestly per ticket (disk rows read 2026-10-20).
// MA-1907 "Whirlwind Flight (Recharge 5-6)" (actions[4], aoe-save): save core
// live-verified EXACT but recharge ungated — second press fired (breath-twin
// MA-1843/1859/1898/1916). Fix byte: recharge:"5-6" rides the live MA-0031
// lane (monsterRecharge.js). Field arms the lane, NOT the name text.
// MA-1910 "Detection" (legendary_actions[2]): press burned a legendary use,
// rolled NOTHING, console error delegates_to:"undefined" — the MA-0051
// skill-check lane was starved of its structured key. Fix byte:
// ability_check:{ability:"wisdom",skill:"perception"} (Dracolich "Detect"
// byte-twin). Garuda skills:{} → bonus resolves +4 via the
// ability_score_modifiers abbr lane.
//
// Family cites (not re-driven here):
//   monsterLegendaryUses.test.js:79-110  — MA-0021 expend gate/refusal vocab
//   monsterLegendaryUses.test.js:432-471 — MA-0051 check-row/bonus/label vocab
//   monsterRecharge.test.js:51-60,145-149 — gate spent-refused/fresh/recovery
//     walk, incl. threshold-5 (Lightning Breath)
//   ma1579-tarrasque-general / ma1868 cooldown walk / ma1883 cost grammar —
//     no garuda ticket touches these lanes.
// Cross-file dupes REPORTED (not edited): ma2002:71-81 and ma2054:66-78
// re-assert garuda ability_check/+4 — owner fingerprint lives here.
//
// Dup-map (old 5 → new 3):
//   old t1 recharge-arm + old t2 save-bytes → new t1 (name-text decoy leg added)
//   old t2 gate spent/recovery walk → deleted, cited monsterRecharge.test.js
//   old t3 ride-lane + old t5 desc/delegates → new t2 (fingerprint superset)
//   old t4 bonus/+4 → new t3 (+wis provenance)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeUsageOf, rechargeActionKey } from '../../services/encounters/monsterRecharge.js';
import { legendaryCheckRow, legendaryCheckBonus, legendaryCheckLabel } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GARUDA = monsters.find((m) => m.index === 'garuda');
const WHIRL = GARUDA.actions.find((a) => a.name.startsWith('Whirlwind Flight'));
const DETECT = GARUDA.legendary_actions.find((a) => a.name === 'Detection');

describe('MA-1907 disk fingerprint: Whirlwind Flight recharge authored', () => {
  it('fix byte recharge:"5-6" arms the MA-0031 lane via the FIELD, not the name text; save core byte-locked', () => {
    expect(WHIRL.name).toBe('Whirlwind Flight (Recharge 5-6)');
    expect(WHIRL.recharge).toBe('5-6');
    expect(rechargeUsageOf(WHIRL)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(WHIRL)).toBe('Whirlwind Flight');
    // Pre-fix regression: the bug was ungated name-text — strip the name and
    // the lane must still arm from the field alone.
    expect(rechargeUsageOf({ ...WHIRL, name: 'Whirlwind Flight' })).toEqual({ threshold: 5 });
    // Save core live-verified EXACT, byte-unchanged by the fix.
    expect(WHIRL.save_dc).toBe(23);
    expect(WHIRL.save_type).toBe('Strength');
    expect(WHIRL.damage_dice_primary).toBe('10d10');
    expect(WHIRL.damage_type_primary).toBe('Bludgeoning');
    expect(WHIRL.dc_success).toBeUndefined();
  });
});

describe('MA-1910 disk fingerprint: Detection ability_check authored', () => {
  it('row fingerprint: fix byte + Dracolich Detect byte-shape, no delegate hijack', () => {
    expect(DETECT.name).toBe('Detection');
    expect(DETECT.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(Object.keys(DETECT)).toEqual(['name', 'ability_check', 'description']);
    expect(DETECT.description).toBe('Garuda makes one Perception check.');
    expect(DETECT.delegates_to).toBeUndefined();
    expect(legendaryCheckRow(DETECT)).toEqual({ ability: 'wisdom', skill: 'perception' });
  });

  it('bonus +4 honest: skills:{} starves the skill lane, abbr wis:4 resolves it', () => {
    expect(GARUDA.skills).toEqual({});
    expect(GARUDA.ability_score_modifiers.wis).toBe(4);
    expect(legendaryCheckBonus(GARUDA, DETECT)).toBe(4);
    expect(legendaryCheckLabel(DETECT)).toBe('Wisdom (Perception)');
  });
});
