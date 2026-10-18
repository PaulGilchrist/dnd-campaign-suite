// @maintained-by-ai
// MA-0030 regression: Abominable Yeti Chilling Gaze — authored success
// immunity ("Success: immune to this yeti's Chilling Gaze for 1 hour").
// A target carrying the gaze_immunity te sourced from this monster must
// refuse the row click (popup + chilling_gaze_refused (immunity) log,
// zero save prompt). Rows without the clause are untouched.
// Lane canon: gate + refusal-log truth tables live here; consumer lanes
// (MonsterCardModal.jsx:2472-2474 click path; FP twins ancient-black/
// adult-white/tarrasque/smaug/tiamat) carry their own echo coverage.
// This file is the ONLY monsters.json lock of the Abominable Yeti row —
// yeti-chilling-gaze-dc-success.test.js locks plain Yeti (index 'yeti'),
// saveProcessing.chilling-gaze-immunity.test.js mirrors the row only.
// Registry lookup of gaze_immunity is cited-skipped: targetEffectDefinitions
// .test.js:41-68 shape-loops and :416-421 lookup-loops every definition,
// including gaze_immunity (targetEffectDefinitions.js:243).
import { describe, it, expect } from 'vitest';
import { parseSuccessImmunity, gazeImmunityActive, buildGazeImmunityRefusalLog } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const YETI = 'Abominable Yeti 1';
const TARGET = 'AberrantSorcerer';

const yetiActions = monsters.find(m => m.name === 'Abominable Yeti').actions;
const gazeRow = yetiActions.find(a => a.name === 'Chilling Gaze');
const coldBreathRow = yetiActions.find(a => a.name.startsWith('Cold Breath'));

const immunityTe = { target: TARGET, effect: 'gaze_immunity', source: YETI, duration: '1_hour' };
const gate = (over = {}) => gazeImmunityActive({
  action: gazeRow, target: { name: TARGET }, monsterName: YETI, targetEffects: [immunityTe], ...over,
});

describe('MA-0030 authored success_immunity parsing', () => {
  it('Abominable Yeti Chilling Gaze row (sole JSON lock) + defaults/null branches', () => {
    expect(parseSuccessImmunity(gazeRow)).toEqual({ effect: 'gaze_immunity', duration: '1_hour', durationMinutes: 60 });
    expect(parseSuccessImmunity({ success_immunity: { effect: 'x' } })).toEqual({ effect: 'x', duration: '1_hour', durationMinutes: 60 });
    expect(parseSuccessImmunity(coldBreathRow)).toBeNull();
    expect(parseSuccessImmunity({})).toBeNull();
  });
});

describe('MA-0030 gaze-immunity row-click gate truth table', () => {
  it('armed match returns parsed immunity; every miss is null', () => {
    expect(gate()).toEqual({ effect: 'gaze_immunity', duration: '1_hour', durationMinutes: 60 });
    expect(gate({ targetEffects: [{ ...immunityTe, source: 'Abominable Yeti 2' }] })).toBeNull();
    expect(gate({ targetEffects: [{ ...immunityTe, target: 'Other 1' }] })).toBeNull();
    expect(gate({ targetEffects: [{ ...immunityTe, effect: 'frightful_presence_immunity' }] })).toBeNull();
    expect(gate({ target: null })).toBeNull();
    expect(gate({ targetEffects: [] })).toBeNull();
    expect(gate({ action: coldBreathRow })).toBeNull();
  });
});

describe('MA-0030 gaze-immunity refusal log', () => {
  it('chilling_gaze_refused (immunity), zero-spend wording; slug fallback for missing action', () => {
    const log = buildGazeImmunityRefusalLog({ monsterName: YETI, actionName: gazeRow.name, targetName: TARGET });
    expect(log.automationType).toBe('chilling_gaze_refused (immunity)');
    expect(log.characterName).toBe(YETI);
    expect(log.abilityName).toBe('Chilling Gaze');
    expect(log.targetName).toBe(TARGET);
    expect(log.description).toBe("AberrantSorcerer is immune to Abominable Yeti 1's Chilling Gaze (save-granted immunity) — no save rolled, no damage, nothing spent.");
    expect(buildGazeImmunityRefusalLog({ monsterName: YETI, targetName: TARGET }).automationType).toBe('action_refused (immunity)');
  });
});
