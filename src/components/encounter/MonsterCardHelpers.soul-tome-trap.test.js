// @maintained-by-ai
// MA-0298: Arcanaloth Banishing Claw (Requires Soul Tome) — parseSoulTomeTrapClause
// truth-table owner (sole test call-site; consumer MonsterCardModal.jsx:1338 arms
// soulTomeTrap) + BY-name disk fingerprint (#387) for the row feeding it. MA-0104
// cross-parser discrimination is both directions on the real disk row (the MA-0104
// parseBanishTransportClause truth table lives in MonsterCardHelpers.banish-transport
// .test.js, which cites this file for Soul Tome discrimination). Consumer lanes
// (useLoggedDiceRollEventHandlers.ma0298-soul-tome, handlePlayerSaveDamage.ma0298-crit-trap)
// run transcribed arm fixtures — disk shape is locked here only. CUT per #505/#499:
// attack/damage numeric transcriptions, description prose, and Incapacitated wording
// (soulTomeTrapService.js:85/:162 hardcodes the Incapacitated grant — prose is inert);
// "never transported" on save_effect is folded into the discrimination test below
// (identical regex, byte-equivalent).
import { describe, it, expect } from 'vitest';
import { parseSoulTomeTrapClause, parseBanishTransportClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const banishingClaw = () => monstersData
  .find(m => /arcanaloth/i.test(m.name))
  .actions.find(a => /banishing claw/i.test(a.name));

describe('MA-0298 parseSoulTomeTrapClause', () => {
  it('arms { effect: banished_demiplane, soulTome: true } on the RAW "trapped in a demiplane" clause (disk row + case-insensitive)', () => {
    expect(parseSoulTomeTrapClause(banishingClaw().save_effect)).toEqual({ effect: 'banished_demiplane', soulTome: true });
    expect(parseSoulTomeTrapClause('The Target Is Trapped In A Demiplane Inside The Soul Tome.')).toEqual({ effect: 'banished_demiplane', soulTome: true });
  });

  it('MA-0104 discrimination — the demiplane parsers never cross-match (both directions, real disk row)', () => {
    expect(parseBanishTransportClause(banishingClaw().save_effect)).toBeNull();
    expect(parseSoulTomeTrapClause('transported to a harmless demiplane until the start of the dragon\'s next turn')).toBeNull();
  });

  it('is byte-inert (null) for clauseless text and non-strings', () => {
    expect(parseSoulTomeTrapClause('Target is Poisoned.')).toBeNull();
    expect(parseSoulTomeTrapClause(null)).toBeNull();
    expect(parseSoulTomeTrapClause(undefined)).toBeNull();
    expect(parseSoulTomeTrapClause(42)).toBeNull();
  });
});

describe('MA-0298 Arcanaloth disk fingerprint (BY-name, #387)', () => {
  it('Banishing Claw row gates ONLY the trap: DC 17 CHA, dc_success "none" (MV-20 leak fix), MA-0147 repeat_save object seam', () => {
    const row = banishingClaw();
    expect(row.name).toBe('Banishing Claw (Requires Soul Tome)');
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Charisma');
    expect(row.dc_success).toBe('none');
    expect(row.repeat_save).toEqual({ save_type: 'Charisma' });
  });
});
