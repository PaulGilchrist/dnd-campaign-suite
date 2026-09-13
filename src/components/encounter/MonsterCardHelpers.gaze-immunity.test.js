// MA-0030 regression: Abominable Yeti Chilling Gaze — authored success
// immunity ("Success: immune to this yeti's Chilling Gaze for 1 hour").
// A target carrying the gaze_immunity te sourced from this monster must
// refuse the row click (popup + chilling_gaze_refused (immunity) log,
// zero save prompt). Rows without the clause are untouched.
import { describe, it, expect } from 'vitest';
import { parseSuccessImmunity, gazeImmunityActive, buildGazeImmunityRefusalLog } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

const YETI = 'Abominable Yeti 1';
const TARGET = 'AberrantSorcerer';

const gazeRow = monsters.find(m => m.name === 'Abominable Yeti').actions.find(a => a.name === 'Chilling Gaze');
const coldBreathRow = monsters.find(m => m.name === 'Abominable Yeti').actions.find(a => a.name.startsWith('Cold Breath'));

const immunityTe = { target: TARGET, effect: 'gaze_immunity', source: YETI, duration: '1_hour' };

describe('MA-0030 Chilling Gaze authored data', () => {
  it('authored dc_success:none + gaze_immunity success_immunity (1 hour = 60 min)', () => {
    expect(gazeRow.dc_success).toBe('none');
    expect(parseSuccessImmunity(gazeRow)).toEqual({ effect: 'gaze_immunity', duration: '1_hour', durationMinutes: 60 });
  });

  it('gaze_immunity registered in targetEffectDefinitions registry', () => {
    const def = getEffectDefinition('gaze_immunity');
    expect(def).toBeTruthy();
    expect(def.effect).toBe('gaze_immunity');
  });

  it('Cold Breath (MA-0031) keeps default half — no dc_success, no immunity clause', () => {
    expect(coldBreathRow.dc_success).toBeUndefined();
    expect(parseSuccessImmunity(coldBreathRow)).toBeNull();
  });
});

describe('MA-0030 gaze-immunity row-click gate', () => {
  it('armed target with gaze_immunity sourced from this monster → gate fires', () => {
    expect(gazeImmunityActive({ action: gazeRow, target: { name: TARGET }, monsterName: YETI, targetEffects: [immunityTe] })).not.toBeNull();
  });

  it('immunity from a DIFFERENT yeti does not block this yeti', () => {
    expect(gazeImmunityActive({
      action: gazeRow, target: { name: TARGET }, monsterName: YETI,
      targetEffects: [{ ...immunityTe, source: 'Abominable Yeti 2' }],
    })).toBeNull();
  });

  it('rows without success_immunity are never gated (Cold Breath unchanged)', () => {
    expect(gazeImmunityActive({ action: coldBreathRow, target: { name: TARGET }, monsterName: YETI, targetEffects: [immunityTe] })).toBeNull();
  });

  it('no target / no te → not gated', () => {
    expect(gazeImmunityActive({ action: gazeRow, target: null, monsterName: YETI, targetEffects: [immunityTe] })).toBeNull();
    expect(gazeImmunityActive({ action: gazeRow, target: { name: TARGET }, monsterName: YETI, targetEffects: [] })).toBeNull();
  });

  it('refusal log is chilling_gaze_refused (immunity), zero-spend wording', () => {
    const log = buildGazeImmunityRefusalLog({ monsterName: YETI, actionName: gazeRow.name, targetName: TARGET });
    expect(log.automationType).toBe('chilling_gaze_refused (immunity)');
    expect(log.characterName).toBe(YETI);
    expect(log.description).toMatch(/immune to Abominable Yeti 1's Chilling Gaze/);
    expect(log.description).toMatch(/no save rolled/i);
  });
});
