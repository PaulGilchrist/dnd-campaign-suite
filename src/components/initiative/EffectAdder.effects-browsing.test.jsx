// @maintained-by-ai
// Lane: EFFECTS-TAB BROWSING — search input mount byte + focus (:181-188), group
// heading + badge census derived ONCE from registry data (:192-209), the four
// searchable faces of the filter (label/description/group/effect-key,
// case-insensitive, :62-71), zero-match empty-pane exact byte (:211), and the
// search-change clears-selection contract (:186 onChange).
// NOT owned here (cited): selection→config form + 'Other…' + apply payload →
// EffectAdder.effects-config.test.jsx (:180/:57, incl. Back/Apply presence and
// No-Opportunity-Attacks field absence); dispatch payloads (#839); tab-bar
// existence + overlay/modal clicks → EffectAdder.rendering.test.jsx (:40);
// registry completeness golden-once → targetEffectDefinitions tests (#820);
// concentration face (#855); conditions face (#856); source-dropdown creature
// census (#857); default/invalid tab routing → EffectAdder.edge-cases.test.jsx.
// Old -> new map (11 -> 4 blocks / 15 -> 8 cases):
//   'search input when switching' + 'auto-focus' + 'all effects grouped' +
//   'each definition badge' + 'tooltip' -> test 1: one mount verifies placeholder
//     byte, focus, exact group-heading census (old hardcoded 5-list silently
//     omitted the authored 'Lair' group), and title-byte census for EVERY def
//     (old tooltip test sampled only the first).
//   filter it.each + 'only matching groups when searching' -> test 2: one row
//     per searchable face + uppercase query. 'step' hits effect-key alone
//     (taunting_step; token absent from label/description/group);
//     'Disadvantage on attack rolls' hits description alone ('Attack Disadv');
//     'Movement' pins heading survival both legs (present/absent).
//   'empty message' -> test 3: exact byte `No effects match "q"` (:211) plus
//     zero-heading/zero-badge census — honest empty pane, not a crash.
//   'clear selection when search input changes' -> test 4, strengthened to
//     role-based observation (Back button gone, browse badge live) over the old
//     .ea-config class selector.
//   'navigate to config view' + 'render effects without fields without errors'
//     -> CUT: selection→config form is byte-owned by effects-config.test.jsx
//     (:24-43 header/Back/Apply, :66-71 No-Opportunity-Attacks absence).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';
import { TARGET_EFFECT_DEFINITIONS } from '../../services/combat/conditions/targetEffectDefinitions.js';

const openEffectsTab = () => fireEvent.click(screen.getByRole('button', { name: 'Effects' }));

const searchEffects = query =>
  fireEvent.change(screen.getByPlaceholderText('Search effects…'), { target: { value: query } });

describe('EffectAdder - effects browsing', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'conditions',
      onCancel: vi.fn(),
      onApply: vi.fn(),
      creatures: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Dragon' },
      ],
    };
  });

  it('mounts the browse pane via tab click: focused search input, every group heading, every badge with its description tooltip', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();

    expect(screen.getByPlaceholderText('Search effects…')).toHaveFocus();

    // Group headings: exact census derived once from registry data — no
    // hand-typed list, so new authored groups surface here.
    const groups = [...new Set(TARGET_EFFECT_DEFINITIONS.map(d => d.group))].sort();
    const headings = [...document.querySelectorAll('.ea-group-label')].map(el => el.textContent);
    expect(headings).toHaveLength(groups.length);
    expect([...headings].sort()).toEqual(groups);

    // Badge census: every definition renders as a clickable button whose title
    // is the description byte-for-byte.
    TARGET_EFFECT_DEFINITIONS.forEach(def => {
      expect(screen.getByRole('button', { name: def.label })).toHaveAttribute('title', def.description);
    });
    expect(document.querySelectorAll('.ea-badge')).toHaveLength(TARGET_EFFECT_DEFINITIONS.length);
  });

  it.each`
    query                             | shouldContain     | shouldNotContain     | face
    ${'Goad'}                         | ${'Goad'}         | ${'Escape the Horde'} | ${'label'}
    ${'GOAD'}                         | ${'Goad'}         | ${'Escape the Horde'} | ${'uppercase query, mixed-case data'}
    ${'step'}                         | ${'Taunted'}       | ${'Goad'}            | ${'effect key (taunting_step)'}
    ${'Disadvantage on attack rolls'} | ${'Attack Disadv'} | ${'Goad'}          | ${'description'}
    ${'Movement'}                     | ${'Movement'}      | ${'Attack'}          | ${'group heading survival'}
  `('filters by $face ("$query"): matching face survives, others are absent', ({ query, shouldContain, shouldNotContain }) => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();
    searchEffects(query);
    expect(screen.getByText(shouldContain)).toBeInTheDocument();
    expect(screen.queryByText(shouldNotContain)).not.toBeInTheDocument();
  });

  it('shows the exact empty-pane byte and no groups or badges when nothing matches', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();
    searchEffects('zzzznotfound');
    expect(screen.getByText('No effects match "zzzznotfound"')).toBeInTheDocument();
    expect(document.querySelectorAll('.ea-group-label')).toHaveLength(0);
    expect(document.querySelectorAll('.ea-badge')).toHaveLength(0);
  });

  it('drops a selected effect back to the live browse list when the search text changes', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();
    // Selection mounts the config view (contract owned by effects-config tests;
    // used here only as the observable "selected" state before the search edit).
    fireEvent.click(screen.getByRole('button', { name: 'Goad' }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();

    searchEffects('a');
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search effects…')).toHaveValue('a');
    expect(screen.getByRole('button', { name: 'Goad' })).toBeInTheDocument();
  });
});
