// @maintained-by-ai
// Lane: EFFECTS config zone hint (QA 2026-11-19, owner decision: informational hint ONLY).
// Manual adds of the four cast-armed zone defs (grease/sleet_storm/stinking_cloud/web)
// are inert markers — the recurring turn-start saves arm only from the cast lane — so the
// config pane must say so. The hint keys off the registry flag `castArmedSaves`, NEVER
// off the presence of a `dc` field: dc-bearing non-zone defs (Sanctuary) and plain defs
// (Save Disadv, Warding Bond) must render no hint.
// NOT owned here (cited, not cloned): config view face + payload bytes →
// EffectAdder.effects-config.test.jsx #858; flag census → targetEffectDefinitions.test.js
// (#820 golden shape + castArmedSaves member census); zero functional change (no caster
// `_<prefix>_<source>` seed, saveDc-without-saveAbility te) → createEffectAdderHandlers
// #839 + live re-verification.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

const HINT = 'Recurring saves only when cast — GM manual add marks the zone.';

const openEffectsTab = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Effects' }));

const selectEffect = label =>
  fireEvent.click(screen.getByRole('button', { name: label }));

const headerLabel = () =>
  document.querySelector('.ea-config-header strong').textContent;

describe('EffectAdder - effects config zone castArmedSaves hint', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'conditions',
      onCancel: vi.fn(),
      onApply: vi.fn(),
      creatures: [{ name: 'Goblin' }],
    };
  });

  it.each(['Grease (Zone)', 'Sleet Storm', 'Stinking Cloud', 'Web'])(
    'selecting zone def %s renders the cast-armed hint in the config pane',
    label => {
      render(<EffectAdder {...props} />);
      openEffectsTab();
      selectEffect(label);

      // Guard against fuzzy capture: the mounted config IS the selected def.
      expect(headerLabel()).toBe(label);
      const hint = document.querySelector('.ea-dc-hint');
      expect(hint).not.toBeNull();
      expect(hint.textContent.trim()).toBe(HINT);
    }
  );

  // 'Save Disadv'/'Warding Bond' per the QA bullet; 'Sanctuary' is the dc-bearing
  // non-zone probe — pins that the hint keys off the flag, not off fields~dc.
  it.each(['Save Disadv', 'Warding Bond', 'Sanctuary'])(
    'selecting non-zone def %s renders no hint',
    label => {
      render(<EffectAdder {...props} />);
      openEffectsTab();
      selectEffect(label);

      expect(headerLabel()).toBe(label);
      expect(document.querySelector('.ea-dc-hint')).toBeNull();
    }
  );
});
