// @maintained-by-ai
// MA-1881: legendary Gaze CHILD (`delegates_to:"Gaze"`) inherit-of-variants —
// PURE-FUNCTION lane: pins what legendaryDelegateChooserAction
// (MonsterCardModal.jsx :723-742) COPIES onto the child and its byte-inert
// passthrough branches. The pre-fix defect: the child rode the legacy
// inherit branch and collapsed to the master's FIRST clause at the inline
// save seam — no chip arms offered, no d6 rolled, first arm always applied
// (MA-1878 adjudication twin, second UI surface). Fix: inherit-BEFORE-
// collapse (MA-1853 Cast Cantrip precedent, ma1853-archlich-cast-cantrip
// .test.jsx) — when the master arms parseSaveVariantChooser and the child
// authors no chooser of its own, the master's variants[] + save fields ride
// the child so handleSaveRoll's SHARED chooser seam (tryOpenVariantChoosers
// → tryOpenSaveVariantChooser) opens the identical picker — no duplicated
// chooser logic, child never drifts from parent.
//
// Lane split (do not absorb each other's bytes):
// - Render lane sibling: MonsterCardModal.ma1881-demogorgon-legendary-gaze
//   .test.jsx owns chip-press → chooser modal arms → pick → save-context
//   stamp → skip → turn-latch → exhausted on the legendary panel.
// - Master's OWN chooser parse (Gaze positives, DC 23 / 120 feet / te-only
//   "confusing"): MonsterCardHelpers.save-variant-chooser.test.js (:20-22
//   cut note) + saveProcessing.ma1878-demogorgon-gaze.test.js DATA lock.
// - Legendary economy faces: MonsterCardModal.legendary-uses.test.jsx
//   (:190-210 exhausted, :304-326 latch) + ma1883 multi-spend owner
//   (monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js :136-210).
// - MA-0022 render roll lane (Lash → Tentacle +9 named roll, dangling
//   refusal popup): MonsterCardModal.legendary-uses.test.jsx :964-994.
// `delegates_to:"Gaze"` stays the untouched machine link; monsters.json is
// NOT mirrored (code-side inherit is the single source of truth).
import { describe, it, expect } from 'vitest';
import { legendaryDelegateChooserAction } from './MonsterCardModal.jsx';
import { parseSaveVariantChooser } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const DEMOGORGON = monstersData.find(m => m.index === 'demogorgon');
const GAZE_CHILD = DEMOGORGON.legendary_actions.find(a => a.name === 'Gaze');
const GAZE_MASTER = DEMOGORGON.actions.find(a => a.name === 'Gaze');
const call = (action, monster = DEMOGORGON) => legendaryDelegateChooserAction(action, { monster, parseSaveVariantChooser });

describe('MA-1881 legendaryDelegateChooserAction — inherit-of-variants (Demogorgon legendary Gaze)', () => {
  it('empty child + chooser-bearing master → child inherits the master\'s full chooser shape and arms the SHARED seam', () => {
    // Input precondition: child is a bare machine link (no own arms).
    expect(GAZE_CHILD.delegates_to).toBe('Gaze');
    expect(GAZE_CHILD.variants).toBeUndefined();

    const child = call(GAZE_CHILD);
    // Inherited bytes, not re-derived: arms BY NAME, te rides the confusing
    // arm, master's save face copied verbatim (explicit values = drift pin).
    expect(child.variants).toEqual(GAZE_MASTER.variants);
    expect(child.variants.map(v => v.key)).toEqual(['beguiling', 'confusing', 'hypnotic']);
    expect(child.variants.find(v => v.key === 'confusing').te).toBe('confusion');
    expect(child.save_dc).toBe(23);
    expect(child.save_type).toBe('Wisdom');
    expect(child.range).toBe('120 feet');
    // Regression signal: the enriched child arms the SAME chooser parser the
    // seam uses — never the pre-fix first-clause collapse (zero arms, zero
    // d6). Chip-press/d6 UI claims live in the render lane sibling.
    expect(parseSaveVariantChooser(child)).not.toBeNull();
    expect(parseSaveVariantChooser(child).variants).toHaveLength(3);
    // Child identity stays honest: own name (spend log + picker header),
    // own description prose, machine link untouched.
    expect(child.name).toBe('Gaze');
    expect(child.description).toBe(GAZE_CHILD.description);
    expect(child.delegates_to).toBe('Gaze');
  });

  it('byte-inert passthrough: rows that never delegate return the child untouched', () => {
    const tail = DEMOGORGON.legendary_actions.find(a => a.name === 'Tail');
    expect(call(tail)).toBe(tail);
    // Unresolvable link: no invented mechanic here — the refuse-with-popup
    // render face is owned by legendary-uses.test.jsx :977-994 (no-delegate).
    const dangling = { name: 'Whisper', delegates_to: 'Nonexistent', description: '…' };
    expect(call(dangling)).toBe(dangling);
  });

  it('delegates WITHOUT a chooser resolve to the master row pointer (MA-0022 Lash → Tentacle)', () => {
    const aboleth = monstersData.find(m => m.index === 'aboleth');
    const lash = aboleth.legendary_actions.find(a => a.delegates_to === 'Tentacle');
    // Downstream seams must see the master's real numbers, byte-inert —
    // inherit-when-empty must not fabricate a merged row (+9 roll lane:
    // legendary-uses.test.jsx :964-975).
    expect(call(lash, aboleth)).toBe(aboleth.actions.find(a => a.name === 'Tentacle'));
  });

  it('child that already authors its own chooser self-resolves byte-identical (own arms never overwritten)', () => {
    const child = {
      name: 'Custom Gaze',
      delegates_to: 'Gaze',
      save_dc: 15,
      save_type: 'Charisma',
      description: 'The demogorgon uses Gaze.',
      variants: [
        { key: 'own-a', label: 'Own A', conditions: ['prone'] },
        { key: 'own-b', label: 'Own B', conditions: ['frightened'] },
      ],
    };
    const resolved = call(child);
    expect(resolved).toBe(child);
    expect(resolved.variants.map(v => v.key)).toEqual(['own-a', 'own-b']);
  });
});
