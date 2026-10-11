// MA-1881: legendary Gaze CHILD (`delegates_to:"Gaze"`) inherit-of-variants —
// the MA-1878 parent chooser (variants[] beguiling/confusing/hypnotic,
// commit aedd1f78d) must REACH the legendary panel. Pre-fix the child rode
// the legacy inherit branch: `mechanicAction = delegate` collapsed to the
// master's FIRST clause at the inline save seam — no chip arms offered, no
// d6 rolled, first arm always applied (MA-1878 adjudication twin, second UI
// surface). Fix: legendaryDelegateChooserAction copies the master's
// variants[] + save fields onto the CHILD (MA-1853 Cast Cantrip
// inherit-BEFORE-collapse precedent) whenever the master arms
// parseSaveVariantChooser and the child authors no chooser of its own, so
// handleSaveRoll's SHARED chooser seam (tryOpenVariantChoosers →
// tryOpenSaveVariantChooser) opens the identical picker — no duplicated
// chooser logic, child never drifts from parent. `delegates_to:"Gaze"` stays
// the untouched machine link; monsters.json is NOT mirrored (code-side
// inherit is the single source of truth).
import { describe, it, expect } from 'vitest';
import { legendaryDelegateChooserAction } from './MonsterCardModal.jsx';
import { parseSaveVariantChooser } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const DEMOGORGON = monstersData.find(m => m.index === 'demogorgon');
const GAZE_CHILD = DEMOGORGON.legendary_actions.find(a => a.name === 'Gaze');
const GAZE_MASTER = DEMOGORGON.actions.find(a => a.name === 'Gaze');
const call = (action, monster = DEMOGORGON) => legendaryDelegateChooserAction(action, { monster, parseSaveVariantChooser });

describe('MA-1881 legendaryDelegateChooserAction — inherit-of-variants (Demogorgon legendary Gaze)', () => {
  it('delegate master carries the live chooser (data pin)', () => {
    expect(GAZE_CHILD.delegates_to).toBe('Gaze');
    expect(GAZE_CHILD.variants).toBeUndefined();
    expect(parseSaveVariantChooser(GAZE_MASTER)).not.toBeNull();
  });

  it('empty child + variants-bearing master → child prompt carries ALL 3 arms', () => {
    const child = call(GAZE_CHILD);
    expect(child.variants.map(v => v.key)).toEqual(['beguiling', 'confusing', 'hypnotic']);
    expect(child.variants.find(v => v.key === 'confusing').te).toBe('confusion');
    expect(child.save_dc).toBe(23);
    expect(child.save_type).toBe('Wisdom');
    expect(child.range).toBe('120 feet');
  });

  it('inherited child must arm the SHARED chooser — no first-clause auto-apply', () => {
    const child = call(GAZE_CHILD);
    const chooser = parseSaveVariantChooser(child);
    expect(chooser).not.toBeNull();
    expect(chooser.variants).toHaveLength(3);
    // Child identity pins: name stays the child's (honest spend log + picker
    // header); the child never gains the master's description prose wholesale;
    // the machine link rides the prompt untouched.
    expect(child.name).toBe('Gaze');
    expect(child.description).toBe(GAZE_CHILD.description);
    expect(child.delegates_to).toBe('Gaze');
  });

  it('byte-inert passthrough: non-delegating rows return untouched', () => {
    const tail = DEMOGORGON.legendary_actions.find(a => a.name === 'Tail');
    expect(call(tail)).toBe(tail);
  });

  it('byte-inert passthrough: unresolvable delegates return the child untouched (no-delegate refusal stays)', () => {
    const dangling = { name: 'Whisper', delegates_to: 'Nonexistent', description: '…' };
    expect(call(dangling)).toBe(dangling);
  });

  it('byte-inert passthrough: delegates WITHOUT a chooser return the master unchanged (Lash → Tentacle MA-0022 lane)', () => {
    const aboleth = monstersData.find(m => m.index === 'aboleth');
    const lash = aboleth.legendary_actions.find(a => a.delegates_to === 'Tentacle');
    const resolved = call(lash, aboleth);
    expect(resolved).toBe(aboleth.actions.find(a => a.name === 'Tentacle'));
  });

  it('child that already authors its own chooser self-resolves byte-identical (own arms kept)', () => {
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
