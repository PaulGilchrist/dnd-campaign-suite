// @maintained-by-ai
// Lane: tokenStatus pure derivation (roadmap Item 6 — map token indicators).
// Uses the REAL targetEffectDefinitions registry + CONDITION_DESCRIPTIONS:
// the whole point of this service is that map and tracker read the SAME
// sources, so nothing here may be mocked away.
import { describe, it, expect } from 'vitest';
import {
  buildTokenStatusIndicators,
  indicatorGlyph,
  TOKEN_STATUS_VISIBLE_LIMIT,
} from './tokenStatus.js';
import { getEffectDefinition } from './targetEffectDefinitions.js';
import { CONDITION_DESCRIPTIONS } from './effectDescriptions.js';

const NAME = 'Thorin';

describe('buildTokenStatusIndicators — conditions lane', () => {
  it('derives one indicator per unique condition, tracker label/tone/tooltip', () => {
    const out = buildTokenStatusIndicators(NAME, ['prone', 'poisoned'], []);
    expect(out.map(i => i.label)).toEqual(['Prone', 'Poisoned']);
    expect(out[0].id).toBe('condition-prone');
    expect(out[0].tone).toBe('effect-condition');
    expect(out[0].tooltip).toBe(CONDITION_DESCRIPTIONS.Prone);
    expect(out[0].glyph).toBe('P');
  });

  it('Invisible rides the shared tone law (buff), speed_zero its label special case', () => {
    const out = buildTokenStatusIndicators(NAME, ['invisible', 'speed_zero'], []);
    expect(out[0]).toMatchObject({ label: 'Invisible', tone: 'effect-buff' });
    expect(out[1]).toMatchObject({ label: 'Speed 0', glyph: 'S' });
  });

  it('dedupes string + object rows carrying the same key', () => {
    const out = buildTokenStatusIndicators(NAME, ['poisoned', { key: 'poisoned' }], []);
    expect(out).toHaveLength(1);
  });

  it('unknown condition keys degrade honestly (capitalized key, condition tone, key tooltip)', () => {
    const out = buildTokenStatusIndicators(NAME, ['confused'], []);
    expect(out[0]).toMatchObject({ label: 'Confused', tone: 'effect-condition' });
    expect(out[0].tooltip).toBe('Confused'); // no CONDITION_DESCRIPTIONS entry
  });
});

describe('buildTokenStatusIndicators — targetEffects lane', () => {
  it('keeps only rows aimed at this creature (string OR array targets), in store order', () => {
    const targetEffects = [
      { target: 'Someone Else', effect: 'bless_bonus', source: 'Other' },
      { target: NAME, effect: 'bless_bonus', source: 'Wizard' },
      { target: [NAME, 'Miahee'], effect: 'bane_penalty', source: 'Hag' },
    ];
    const out = buildTokenStatusIndicators(NAME, [], targetEffects);
    expect(out.map(i => i.label)).toEqual(['Bless (+1d4)', 'Bane (-1d4)']);
    expect(out[0].id).toBe('effect-bless_bonus');
  });

  it('labels/tones come from the registry through the shared tone fold', () => {
    const out = buildTokenStatusIndicators(NAME, [], [
      { target: NAME, effect: 'infernal_wound' },   // effect-debuff (passes through)
      { target: NAME, effect: 'dodge' },            // effect-target-disadv → folded buff
    ]);
    expect(out[0].tone).toBe('effect-debuff');
    expect(out[1].tone).toBe('effect-buff');
  });

  it('tooltip is the registry description + source, byte-shaped like the badge lane', () => {
    const def = getEffectDefinition('infernal_wound');
    const out = buildTokenStatusIndicators(NAME, [], [{ target: NAME, effect: 'infernal_wound', source: 'Bearded Devil' }]);
    expect(out[0].tooltip).toBe(`${def.description} (from Bearded Devil)`);
    const noSource = buildTokenStatusIndicators(NAME, [], [{ target: NAME, effect: 'infernal_wound' }]);
    expect(noSource[0].tooltip).toBe(def.description);
  });

  it('unregistered te keys degrade honestly (label = key, neutral tone) — never dropped', () => {
    const out = buildTokenStatusIndicators(NAME, [], [{ target: NAME, effect: 'gm_invented_thing' }]);
    expect(out[0]).toMatchObject({ label: 'gm_invented_thing', tone: 'effect-neutral', tooltip: 'gm_invented_thing' });
  });

  it('a te whose registry label collides with a condition label dedupes to the condition chip', () => {
    // thri_kreen_bite_poison carries label "Poisoned" — same dedupeByLabel law
    // as the tracker badges.
    const out = buildTokenStatusIndicators(NAME, ['poisoned'], [{ target: NAME, effect: 'thri_kreen_bite_poison', source: 'Thri-Kreen' }]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('condition-poisoned');
  });
});

describe('buildTokenStatusIndicators — shape guards', () => {
  it('empty/missing inputs render no indicators (never fabricates a chip)', () => {
    expect(buildTokenStatusIndicators(NAME, null, null)).toEqual([]);
    expect(buildTokenStatusIndicators(NAME, [], [])).toEqual([]);
    expect(buildTokenStatusIndicators(NAME, [null, 42, {}], [null])).toEqual([]);
  });

  it('conditions precede effects (the load-bearing states lead the row)', () => {
    const out = buildTokenStatusIndicators(NAME, ['prone'], [{ target: NAME, effect: 'bless_bonus' }]);
    expect(out.map(i => i.id)).toEqual(['condition-prone', 'effect-bless_bonus']);
  });
});

describe('indicatorGlyph + cap constant', () => {
  it('glyph is the capitalized first letter of the SAME tracker label', () => {
    expect(indicatorGlyph('Prone')).toBe('P');
    expect(indicatorGlyph("Can't Regain Hit Points")).toBe('C');
    expect(indicatorGlyph('')).toBe('');
  });

  it('the visible cap is 3 chips (a "+N" chip rides on top)', () => {
    expect(TOKEN_STATUS_VISIBLE_LIMIT).toBe(3);
  });
});
