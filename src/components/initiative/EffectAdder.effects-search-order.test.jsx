// @maintained-by-ai
// Lane: EFFECTS-TAB SEARCH — token-AND word-order semantics of the search
// filter (QA backlog `effect-adder-search-word-order`): each whitespace token
// must appear (case-insensitive substring) in the effect's combined searchable
// text (label + description + group + effect key), so word order is
// irrelevant. Pins: exact multi-word census, order parity, cross-face AND
// (one token via label, another via effect key / group), single-token parity
// against the legacy whole-string substring semantics, and empty/whitespace
// queries showing the full registry.
// NOT owned here (cited): the four single-face searchable routes, exact
// empty-pane byte, clear-selection-on-change → EffectAdder.effects-browsing.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EffectAdder from './EffectAdder.jsx';
import { TARGET_EFFECT_DEFINITIONS } from '../../services/combat/conditions/targetEffectDefinitions.js';

const openEffectsTab = () => fireEvent.click(screen.getByRole('button', { name: 'Effects' }));

const searchEffects = query =>
  fireEvent.change(screen.getByPlaceholderText('Search effects…'), { target: { value: query } });

// Visible badge labels, in render order (icons contribute no text).
const badgeLabels = () =>
  [...document.querySelectorAll('.ea-badge')].map(el => el.textContent.trim());

// Legacy whole-string substring semantics (pre-token-AND), for the
// single-token parity legs below.
const legacyLabels = query => {
  const q = query.toLowerCase();
  return TARGET_EFFECT_DEFINITIONS
    .filter(def =>
      def.label.toLowerCase().includes(q) ||
      def.description.toLowerCase().includes(q) ||
      def.group.toLowerCase().includes(q) ||
      def.effect.toLowerCase().includes(q)
    )
    .map(d => d.label);
};

const mountEffectsBrowse = () => {
  render(
    <EffectAdder
      targetName='Goblin'
      initialTab='conditions'
      onCancel={vi.fn()}
      onApply={vi.fn()}
      creatures={[{ name: 'Alice' }]}
    />
  );
  openEffectsTab();
};

describe('EffectAdder - effects search token-AND word order', () => {
  it('AND-matches multi-word queries per token: "speed half" returns exactly the both-token entries', () => {
    mountEffectsBrowse();
    searchEffects('speed half');
    // Exact census in render order: Resilient Sphere (Spells group, description
    // "…roll sphere at half speed…") before Speed Halved (Movement group,
    // effect key speed_half) — and nothing else.
    expect(badgeLabels()).toEqual(['Resilient Sphere', 'Speed Halved']);
  });

  it('word order is irrelevant: "half speed" and "speed half" return the same result set', () => {
    mountEffectsBrowse();
    searchEffects('half speed');
    const halfSpeed = badgeLabels();
    expect(halfSpeed).toEqual(['Resilient Sphere', 'Speed Halved']);

    searchEffects('speed half');
    expect(badgeLabels()).toEqual(halfSpeed);
  });

  it.each([
    ['taunted step', ['Taunted']],
    ['halved movement', ['Speed Halved']],
  ])('tokens AND across faces — one via label, another via effect key/group ("%s")', (query, expected) => {
    mountEffectsBrowse();
    searchEffects(query);
    expect(badgeLabels()).toEqual(expected);
    // Reversed token order returns the identical set.
    searchEffects(query.split(/\s+/).reverse().join(' '));
    expect(badgeLabels()).toEqual(expected);
  });

  it('every whitespace token must match — a partial-token superset is excluded', () => {
    mountEffectsBrowse();
    // "half zzzznotfound": 'half' matches several entries but 'zzzznotfound'
    // matches none, so AND-semantics yield the honest empty pane.
    searchEffects('half zzzznotfound');
    expect(document.querySelectorAll('.ea-badge')).toHaveLength(0);
    expect(screen.getByText('No effects match "half zzzznotfound"')).toBeInTheDocument();
  });

  it.each(['resist', 'step', 'goad', 'movement', 'speed', 'poison'])(
    'single-token query "%s" matches the legacy whole-string result set exactly',
    query => {
      mountEffectsBrowse();
      searchEffects(query);
      expect([...badgeLabels()].sort()).toEqual([...legacyLabels(query)].sort());
    }
  );

  it.each(['', '   ', '\t'])(
    'empty/whitespace-only query (%j) shows the full registry',
    query => {
      mountEffectsBrowse();
      searchEffects(query);
      expect([...badgeLabels()].sort()).toEqual(
        [...TARGET_EFFECT_DEFINITIONS.map(d => d.label)].sort()
      );
      expect(document.querySelectorAll('.ea-badge')).toHaveLength(TARGET_EFFECT_DEFINITIONS.length);
      expect(document.querySelectorAll('.ea-empty')).toHaveLength(0);
    }
  );
});
