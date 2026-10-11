// MA-1907 + MA-1910: Garuda DATA fingerprints.
// MA-1907 "Whirlwind Flight (Recharge 5-6)" (actions[4], aoe-save): save
// core live-verified EXACT (DC 23 STR, 10d10 Bludgeoning, floor-half,
// 60-ft radius picker via description-token parse) — recharge ungated,
// second press fired (MA-1843/1859/1898 breath-twin). One-field fix:
// recharge:"5-6" rides the live MA-0031 lane.
// MA-1910 "Detection" (legendary_actions[2]): press burned a legendary use,
// rolled NOTHING, console error delegates_to:"undefined" — the MA-0051
// skill-check lane (legendaryCheckRow/legendaryCheckBonus → handleCheck →
// rollSkillCheck) was starved of its structured key. One-field fix:
// ability_check:{ability:"wisdom",skill:"perception"} (Dracolich "Detect"
// byte-tween, Modal spends 1 then rolls). Garuda skills:{} → bonus resolves
// +4 via the ability_score_modifiers abbr lane.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';
import { legendaryCheckRow, legendaryCheckBonus, legendaryCheckLabel } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GARUDA = monsters.find((m) => m.index === 'garuda');
const WHIRL = GARUDA.actions.find((a) => a.name.startsWith('Whirlwind Flight'));
const DETECT = GARUDA.legendary_actions.find((a) => a.name === 'Detection');

describe('MA-1907 disk fingerprint: Whirlwind Flight recharge authored', () => {
  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(WHIRL.recharge).toBe('5-6');
    expect(rechargeUsageOf(WHIRL)).toEqual({ threshold: 5 });
  });

  it('spent refuses, recovery opens; save core byte-unchanged (live-verified exact)', () => {
    expect(monsterRechargeGate(WHIRL, { 'Whirlwind Flight': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(WHIRL, {}).available).toBe(true);
    expect(WHIRL.save_dc).toBe(23);
    expect(WHIRL.save_type).toBe('Strength');
    expect(WHIRL.damage_dice_primary).toBe('10d10');
    expect(WHIRL.damage_type_primary).toBe('Bludgeoning');
    expect(WHIRL.dc_success).toBeUndefined();
  });
});

describe('MA-1910 disk fingerprint: Detection ability_check authored', () => {
  it('rides the MA-0051 skill-check lane (Dracolich Detect byte-shape)', () => {
    expect(DETECT.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(legendaryCheckRow(DETECT)).toEqual({ ability: 'wisdom', skill: 'perception' });
  });

  it('bonus resolves +4 via ability_score_modifiers abbr lane (skills:{} empty)', () => {
    expect(GARUDA.skills).toEqual({});
    expect(legendaryCheckBonus(GARUDA, DETECT)).toBe(4);
    expect(legendaryCheckLabel(DETECT)).toBe('Wisdom (Perception)');
  });

  it('description byte-unchanged; delegates_to untouched (still absent — no hijack lane)', () => {
    expect(DETECT.description).toBe('Garuda makes one Perception check.');
    expect(DETECT.delegates_to).toBeUndefined();
  });
});
