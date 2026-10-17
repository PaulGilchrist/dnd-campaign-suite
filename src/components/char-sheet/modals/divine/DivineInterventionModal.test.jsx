// @maintained-by-ai
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DivineInterventionModal from './DivineInterventionModal.jsx';

// ── Ownership ──
// This file owns the spell-picker modal UI in isolation: verbatim header and
// note-switch rendering, level-group filter derivation and click-filtering
// (including the level-0 zero path), the list→detail→Back navigation with
// filter preservation, the cast seam emitting exactly onSelect(spell) with
// object identity WITHOUT closing, Cancel-close, and overlay/content
// inertness. sanitize.js runs UNMOCKED — description rendering exercises the
// real sanitizeHtml pass-through, so the sanitizer inertness contract lives
// here. The component is fully presentational — no runtime-store or
// dice-module reads, so no module mocks and no live stores; fresh vi.fn
// props per makeProps cover the mock-freshness need (no clearAllMocks,
// nothing to mockReset). All updates are synchronous under fireEvent, so
// getBy idiom suffices — no findBy/await seams in this lane.
// Deferred to owners:
// - CharActionModals.SecondaryModals.jsx render site / CharActionModals.handler-callbacks.test.jsx —
//   onSelect → handleDivineInterventionCast wiring and close → clearing
//   divineInterventionModal + divineInterventionAction state.
// - useCharActionsAutomation.test.divine-intervention.js — handleDivineInterventionCast
//   execution, spell dispatch, and popup handling.
// - divineInterventionHandler.js — onSpellSelected automation, uses
//   bookkeeping, and campaign-log entries.
// - restRules-longRest.js — divineInterventionUses / _divineInterventionWishCooldown resets.

// NOTE — flagged product defects (parity audit vs the divine siblings),
// not fixed here:
// 1. Dead guard: handleCast's `if (!selectedSpell) return;` sits behind the
//    Cast button, which only renders when selectedSpell is truthy — the
//    guard can never fire from the UI.
// 2. Duplicate className attribute on the Back button: JSX last-one-wins, so
//    it ships only `back-btn` and silently loses `sp-dismiss-btn` styling.
// 3. Cantrip detail wording: `Level {spell.level || 'Cantrip'}` renders the
//    awkward "Level Cantrip — ..." zero path (pinned in detail it.each).
// 4. Cross-file: caller handleDivineInterventionCast awaits
//    onDivineInterventionSpellSelected with no try/catch
//    (useCharActionsAutomation.js:479) — unguarded await owned there.
// No Number()||max pool read and no debug console.error in this component.

// ── Fixtures ──
// Frozen so the cast-seam identity assertion proves the component forwards
// the exact spell object from eligibleSpells, untouched.
const freezeSpell = (spell) => {
  if (spell.damage) Object.freeze(spell.damage);
  return Object.freeze(spell);
};

const GUIDING_BOLT = freezeSpell({
  index: 'guiding-bolt',
  name: 'Guiding Bolt',
  level: 1,
  school: 'Evocation',
  casting_time: '1 action',
  range: '120 feet',
  components: 'V, S',
  duration: '1 instant',
  concentration: false,
  ritual: false,
  description: ['A bolt of light streaks toward a creature within range.'],
  damage: {
    damage_at_slot_level: { '1': '4d6', '2': '5d6' },
    damage_type: 'Radiant',
  },
});

const THUNDERWAVE = freezeSpell({
  index: 'thunderwave',
  name: 'Thunderwave',
  level: 1,
  school: 'Evocation',
  casting_time: '1 action',
  range: 'Self (15-foot cube)',
  components: 'V, S',
  duration: '1 instant',
  concentration: false,
  ritual: false,
  description: ['A wave of thunder sound out.'],
});

const FIRE_BOLT = freezeSpell({
  index: 'fire-bolt',
  name: 'Fire Bolt',
  level: 0,
  school: 'Evocation',
  casting_time: '1 action',
  range: '120 feet',
  components: 'V, S',
  duration: 'instantaneous',
  concentration: false,
  ritual: false,
  description: ['A streak of flame shoots toward a creature.'],
  damage: {
    damage_at_character_level: { '1': '1d10' },
    damage_type: 'Fire',
  },
});

const SACRED_FLAME = freezeSpell({
  index: 'sacred-flame',
  name: 'Sacred Flame',
  level: 0,
  school: 'Evocation',
  casting_time: '1 action',
  range: '60 feet',
  components: 'V, S',
  duration: '1 instant',
  concentration: false,
  ritual: false,
  description: ['Flame-like radiance descends on a creature.'],
  damage: {
    damage_at_character_level: { '1': '1d8' },
    damage_type: 'Radiant',
  },
});

const SPIRITUAL_WEAPON = freezeSpell({
  index: 'spiritual-weapon',
  name: 'Spiritual Weapon',
  level: 2,
  school: 'Evocation',
  casting_time: '1 bonus action',
  range: '60 feet',
  components: 'V, S',
  duration: '1 minute',
  concentration: true,
  ritual: false,
  description: ['You create a floating weapon.'],
  damage: {
    damage_at_slot_level: { '2': '1d8', '3': '1d8' },
    damage_type: 'Force',
  },
});

const DETECT_MAGIC = freezeSpell({
  index: 'detect-magic',
  name: 'Detect Magic',
  level: 1,
  school: 'Divination',
  casting_time: '1 action',
  range: 'Self',
  components: 'V, S',
  duration: '10 minutes',
  concentration: false,
  ritual: true,
  description: ['You sense the presence of magic.'],
});

const WISH = freezeSpell({
  index: 'wish',
  name: 'Wish',
  level: 9,
  school: 'Evocation',
  casting_time: '1 action',
  range: 'Self',
  components: 'V',
  duration: 'Instantaneous',
  concentration: false,
  ritual: false,
  description: ['You wish upon a star.'],
});

const BURNING_HANDS = freezeSpell({
  index: 'burning-hands',
  name: 'Burning Hands',
  level: 1,
  school: 'Evocation',
  casting_time: '1 action',
  range: 'Self',
  components: 'V, S',
  duration: '1 instant',
  concentration: false,
  ritual: false,
  description: ['Flames erupt.'],
});

const MINION = freezeSpell({
  index: 'minion',
  name: 'Minion',
  level: 1,
  school: 'Evocation',
  casting_time: '1 action',
  range: '60 feet',
  description: ['A simple spell.'],
});

const baseSpells = [GUIDING_BOLT, THUNDERWAVE, FIRE_BOLT, SACRED_FLAME, SPIRITUAL_WEAPON];

const NOTE_NORMAL = "Choose any Cleric spell of level 5 or lower that doesn't require a Reaction to cast.";
const NOTE_GREATER = 'You can choose any Cleric spell of level 5 or lower, or select Wish.';

function makeProps(overrides = {}) {
  return {
    eligibleSpells: baseSpells,
    isGreater: false,
    featureName: 'Divine Intervention',
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides) {
  return render(<DivineInterventionModal {...makeProps(overrides)} />);
}

const spellItem = (name) => screen.getByText(name).closest('.divine-intervention-spell-item');
const filterBtn = (label) => screen.getByRole('button', { name: label });
const castBtn = () => screen.getByRole('button', { name: 'Cast with Divine Intervention' });
const backBtn = () => screen.getByRole('button', { name: 'Back' });
const cancelBtn = () => screen.getByRole('button', { name: 'Cancel' });

// ── Tests ──

describe('DivineInterventionModal', () => {
  // ── Rendering ──

  describe('rendering', () => {
    it('renders overlay, default feature name, one note, Cancel, and no Cast button or heading', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(screen.getByText('Divine Intervention')).toBeInTheDocument();
      expect(document.querySelectorAll('.sp-note')).toHaveLength(1);
      expect(cancelBtn()).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cast with Divine Intervention' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('shows a custom featureName in the header instead of the default', () => {
      renderModal({ featureName: "Gods' Gambit" });
      expect(screen.getByText("Gods' Gambit")).toBeInTheDocument();
      expect(screen.queryByText('Divine Intervention')).not.toBeInTheDocument();
    });

    it.each([
      { label: 'non-greater', isGreater: false, note: NOTE_NORMAL },
      { label: 'greater', isGreater: true, note: NOTE_GREATER },
    ])('renders the verbatim $label note as the only .sp-note', ({ isGreater, note }) => {
      renderModal({ isGreater });
      const notes = document.querySelectorAll('.sp-note');
      expect(notes).toHaveLength(1);
      expect(notes[0]).toHaveTextContent(note);
      const strong = notes[0].querySelector('strong');
      if (isGreater) {
        expect(strong).toHaveTextContent('Wish');
      } else {
        expect(strong).toBeNull();
      }
    });

    it.each([
      { spells: baseSpells, name: 'Guiding Bolt', meta: 'Level 1 — 1 action' },
      { spells: baseSpells, name: 'Fire Bolt', meta: 'Cantrip — 1 action' },
      { spells: baseSpells, name: 'Spiritual Weapon', meta: 'Level 2 — 1 bonus action — Concentration' },
      { spells: [DETECT_MAGIC], name: 'Detect Magic', meta: 'Level 1 — 1 action — Ritual' },
    ])('lists $name with exact meta line', ({ spells, name, meta }) => {
      renderModal({ eligibleSpells: spells });
      expect(within(spellItem(name)).getByText(meta)).toBeInTheDocument();
    });

    it('joins description fragments through the real sanitizeHtml and strips script tags', () => {
      const MARKDOWN_SPELL = freezeSpell({
        index: 'holy-strike',
        name: 'Holy Strike',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        range: 'Self',
        description: ['A bolt of light. ', 'It seeks your enemy. <strong>holy</strong> light <script>alert(1)</script>'],
      });
      renderModal({ eligibleSpells: [MARKDOWN_SPELL] });
      fireEvent.click(spellItem('Holy Strike'));
      const desc = document.querySelector('.spell-description div');
      expect(desc).toHaveTextContent('A bolt of light. It seeks your enemy. holy light');
      expect(desc.querySelector('strong')).toHaveTextContent('holy');
      expect(desc.querySelector('script')).toBeNull();
    });
  });

  // ── Level filters ──

  describe('level filters', () => {
    it.each([
      { label: 'mixed levels', spells: baseSpells, buttons: ['All Levels', 'Cantrip', 'Level 1', 'Level 2'], absent: ['Level 9'] },
      { label: 'a level-9 spell', spells: [WISH], buttons: ['All Levels', 'Level 9'], absent: ['Cantrip', 'Level 1', 'Level 2'] },
      { label: 'one level-1 spell', spells: [BURNING_HANDS], buttons: ['All Levels', 'Level 1'], absent: ['Cantrip', 'Level 2'] },
    ])('derives exactly $buttons from $label, with All Levels active by default', ({ spells, buttons, absent }) => {
      renderModal({ eligibleSpells: spells });
      expect(screen.getAllByRole('button')).toHaveLength(buttons.length + 1); // + Cancel
      buttons.forEach((label) => expect(filterBtn(label)).toBeInTheDocument());
      absent.forEach((label) => expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument());
      expect(filterBtn('All Levels')).toHaveClass('active');
      buttons.filter((label) => label !== 'All Levels').forEach((label) => {
        expect(filterBtn(label)).not.toHaveClass('active');
      });
      expect(screen.queryByText('No spells found for this level.')).not.toBeInTheDocument();
    });

    it('shows only All Levels plus the empty notice verbatim when eligibleSpells is empty', () => {
      renderModal({ eligibleSpells: [] });
      expect(screen.getAllByRole('button')).toHaveLength(2); // All Levels + Cancel
      expect(filterBtn('All Levels')).toBeInTheDocument();
      expect(screen.getByText('No spells found for this level.')).toBeInTheDocument();
      expect(document.querySelectorAll('.divine-intervention-spell-item')).toHaveLength(0);
    });

    it('filters to the clicked level, keeps same-level siblings, restores on All Levels, and selects nothing', () => {
      const props = makeProps();
      render(<DivineInterventionModal {...props} />);

      fireEvent.click(filterBtn('Level 1'));
      expect(filterBtn('Level 1')).toHaveClass('active');
      expect(filterBtn('All Levels')).not.toHaveClass('active');
      expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
      expect(screen.getByText('Thunderwave')).toBeInTheDocument();
      expect(screen.queryByText('Fire Bolt')).not.toBeInTheDocument();
      expect(screen.queryByText('Sacred Flame')).not.toBeInTheDocument();
      expect(screen.queryByText('Spiritual Weapon')).not.toBeInTheDocument();

      fireEvent.click(filterBtn('Cantrip'));
      expect(filterBtn('Cantrip')).toHaveClass('active');
      expect(filterBtn('Level 1')).not.toHaveClass('active');
      expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
      expect(screen.getByText('Sacred Flame')).toBeInTheDocument();
      expect(screen.queryByText('Guiding Bolt')).not.toBeInTheDocument();

      fireEvent.click(filterBtn('All Levels'));
      expect(document.querySelectorAll('.divine-intervention-spell-item')).toHaveLength(5);
      expect(props.onSelect).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  // ── Detail view ──

  describe('detail view', () => {
    it('swaps list for detail on select, restores the filtered list on Back, and emits nothing', () => {
      const props = makeProps();
      render(<DivineInterventionModal {...props} />);

      fireEvent.click(filterBtn('Level 1'));
      fireEvent.click(spellItem('Guiding Bolt'));
      expect(screen.getByRole('heading', { name: 'Guiding Bolt' })).toBeInTheDocument();
      expect(castBtn()).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.queryByText('Thunderwave')).not.toBeInTheDocument();
      expect(document.querySelectorAll('.divine-intervention-spell-item')).toHaveLength(0);

      fireEvent.click(backBtn());
      expect(screen.queryByRole('button', { name: 'Cast with Divine Intervention' })).not.toBeInTheDocument();
      expect(cancelBtn()).toBeInTheDocument();
      expect(screen.getByText('Thunderwave')).toBeInTheDocument();
      expect(filterBtn('Level 1')).toHaveClass('active');
      expect(document.querySelectorAll('.divine-intervention-spell-item')).toHaveLength(2);
      expect(props.onSelect).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it.each([
      {
        label: 'slot-level damage spell',
        spell: GUIDING_BOLT,
        meta: 'Level 1 — Evocation',
        details: 'Casting Time: 1 action — Range: 120 feet — Components: V, S — Duration: 1 instant',
        damage: 'Damage: 4d6 / 5d6 (Radiant)',
      },
      {
        // Pinned awkward wording — see NOTE defect 3 (zero path, not a zero-lie).
        label: 'cantrip zero path',
        spell: FIRE_BOLT,
        meta: 'Level Cantrip — Evocation',
        details: 'Casting Time: 1 action — Range: 120 feet — Components: V, S — Duration: instantaneous',
        damage: 'Damage: 1d10 (Fire)',
      },
      {
        label: 'concentration spell',
        spell: SPIRITUAL_WEAPON,
        meta: 'Level 2 — Evocation — Concentration',
        details: 'Casting Time: 1 bonus action — Range: 60 feet — Components: V, S — Duration: 1 minute',
        damage: 'Damage: 1d8 / 1d8 (Force)',
      },
      {
        label: 'ritual spell',
        spell: DETECT_MAGIC,
        meta: 'Level 1 — Divination — Ritual',
        details: 'Casting Time: 1 action — Range: Self — Components: V, S — Duration: 10 minutes',
        damage: null,
      },
      {
        label: 'damage-less spell',
        spell: THUNDERWAVE,
        meta: 'Level 1 — Evocation',
        details: 'Casting Time: 1 action — Range: Self (15-foot cube) — Components: V, S — Duration: 1 instant',
        damage: null,
      },
      {
        label: 'minimal spell without components or duration',
        spell: MINION,
        meta: 'Level 1 — Evocation',
        details: 'Casting Time: 1 action — Range: 60 feet',
        damage: null,
      },
    ])('renders the $label detail verbatim', ({ spell, meta, details, damage }) => {
      renderModal({ eligibleSpells: [spell] });
      fireEvent.click(spellItem(spell.name));
      expect(screen.getByRole('heading', { name: spell.name })).toBeInTheDocument();
      expect(screen.getByText(meta)).toBeInTheDocument();
      expect(screen.getByText(details)).toBeInTheDocument();
      if (damage) {
        expect(screen.getByText(damage)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/^Damage:/)).not.toBeInTheDocument();
      }
      expect(screen.getByText(spell.description[0])).toBeInTheDocument();
    });
  });

  // ── Cast seam ──

  describe('cast seam', () => {
    it('emits exactly onSelect(Spiritual Weapon) with object identity without closing', () => {
      const props = makeProps();
      render(<DivineInterventionModal {...props} />);

      fireEvent.click(spellItem('Spiritual Weapon'));
      fireEvent.click(castBtn());

      expect(props.onSelect).toHaveBeenCalledTimes(1);
      expect(props.onSelect.mock.calls[0][0]).toBe(SPIRITUAL_WEAPON);
      expect(props.onClose).not.toHaveBeenCalled();
      expect(castBtn()).toBeInTheDocument();
    });
  });

  // ── Close flows ──

  describe('close flows', () => {
    it('closes once when Cancel is clicked without selecting', () => {
      const props = makeProps();
      render(<DivineInterventionModal {...props} />);

      fireEvent.click(cancelBtn());

      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(props.onSelect).not.toHaveBeenCalled();
    });

    it('stays inert when the overlay or modal container is clicked', () => {
      const props = makeProps();
      render(<DivineInterventionModal {...props} />);

      fireEvent.click(document.querySelector('.sp-overlay'));
      fireEvent.click(document.querySelector('.sp-modal'));

      expect(props.onClose).not.toHaveBeenCalled();
      expect(props.onSelect).not.toHaveBeenCalled();
      expect(cancelBtn()).toBeInTheDocument();
      expect(document.querySelectorAll('.divine-intervention-spell-item')).toHaveLength(5);
    });
  });
});
