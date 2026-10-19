// @maintained-by-ai
// Lane: EFFECTS config view — the form mounted after selecting an effect badge.
// Owns: selection→config header bytes + Back→browse (:215-220, :292),
// field-conditionality matrix (fields render iff the registry def declares them,
// :222-279), Value:/Save DC: config-specific defaults + sanitizers, ability
// select exact ABILITY_OPTIONS bytes (:8-15, upgrade per #856 rec), 'Other…'
// custom-source reveal round-trip (:235-242), and the exact 'effects' onApply
// payload applied exactly once (:91-99, #786 exact bytes / #744 once).
// NOT owned here (cited): creature-option census of the source select →
// EffectAdder.creatures.test.jsx #857 (byte-exact option census supersedes the
// old :47-55 toContain names — CUT); browse/search/filter + empty pane +
// search-clears-selection → EffectAdder.effects-browsing.test.jsx #859;
// dispatch landing of the payload into targetEffects → createEffectAdderHandlers
// #839; overlay/tabs → EffectAdder.rendering.test.jsx; DC-sanitizer generic
// pattern exemplar → EffectAdder.concentration.test.jsx #855 (only the
// config-specific 15-default and 0/10 fallbacks are pinned here); registry
// completeness golden-once → targetEffectDefinitions tests (#820).
// Old -> new map (10 its / 20 cases -> 7 its / 13 cases):
//   header it.each(Goad, Tasha) + back-navigation -> test 1: single Goad header
//     pins icon/label/desc byte-exact vs live def, Back+Apply present, then Back
//     click returns to the live browse pane. Tasha row CUT — same code path;
//     its dc face is owned by tests 2/5/7.
//   'populate creature names + Other' -> CUT (#857 exact census owns).
//   'Other shows custom input' -> test 6, strengthened with the reverse leg
//     (selecting a creature hides the custom input again).
//   'no source field for NOA' -> test 2: full 4-effect conditionality matrix
//     (carried #859 rec: absence of Value:/Save DC:/Ability: too).
//   value defaults + reset + invalid -> test 3: defaults read live from the
//     registry defs (golden-once, never hand-copied), edit→Back→select other
//     proves reset, invalid→0 sanitizer.
//   ability default + change -> test 4: exact option census + live def default
//     + edit (#856 toEqual upgrade; toContain('wis') retired).
//   dc default + invalid -> test 5.
//   notes textarea -> CUT: notes round-trip is proved by payload row 7 bytes.
//   payload it.each (5 rows) -> test 7: exact effectKey derived from the def,
//     full 6-key payload toEqual, exactly-once, plus Apply-absent-before-select
//     (absorbs the old 'no Apply in browse' test) and two new rows: ability
//     payload bytes ('Check Disadv', :96 hasField('ability') branch had no
//     payload coverage) and 'Other…' with EMPTY custom → source undefined
//     (:94 sourceCustom || undefined branch).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';
import { TARGET_EFFECT_DEFINITIONS } from '../../services/combat/conditions/targetEffectDefinitions.js';

const defFor = label => TARGET_EFFECT_DEFINITIONS.find(d => d.label === label);

const openEffectsTab = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Effects' }));

const selectEffect = label =>
  fireEvent.click(screen.getByRole('button', { name: label }));

const goBack = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));

describe('EffectAdder - effects config view', () => {
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

  it('selecting Goad mounts the config header byte-exact, then Back returns to the live browse pane', () => {
    const def = defFor('Goad');
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();
    selectEffect('Goad');

    expect(document.querySelector('.ea-config')).toBeInTheDocument();
    const header = document.querySelector('.ea-config-header');
    expect(header.querySelector('i').className).toBe(`fa-solid ${def.icon}`);
    expect(header.querySelector('strong').textContent).toBe(def.label);
    expect(document.querySelector('.ea-config-desc').textContent).toBe(def.description);
    expect(screen.getByLabelText('Source (who caused this):')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(document.querySelector('.ea-config')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search effects…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Goad' })).toBeInTheDocument();
  });

  it('renders config input fields only when the effect definition declares them', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();

    // No fields declared (no_opportunity_attacks): no field labels, but the
    // config pane still mounts honestly with its always-on notes textarea.
    selectEffect('No Opportunity Attacks');
    ['Source (who caused this):', 'Value:', 'Save DC:', 'Ability:'].forEach(label =>
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText('GM notes about this effect…')).toBeInTheDocument();

    // source + value only.
    goBack();
    selectEffect('Next Attack +N Bonus');
    expect(screen.getByText('Source (who caused this):')).toBeInTheDocument();
    expect(screen.getByLabelText('Value:')).toBeInTheDocument();
    expect(screen.queryByText('Save DC:')).not.toBeInTheDocument();
    expect(screen.queryByText('Ability:')).not.toBeInTheDocument();

    // source + dc only.
    goBack();
    selectEffect("Tasha's Hideous Laughter");
    expect(screen.getByText('Save DC:')).toBeInTheDocument();
    expect(screen.queryByText('Value:')).not.toBeInTheDocument();
    expect(screen.queryByText('Ability:')).not.toBeInTheDocument();

    // ability + source only.
    goBack();
    selectEffect('Check Disadv');
    expect(screen.getByLabelText('Ability:')).toBeInTheDocument();
    expect(screen.queryByText('Value:')).not.toBeInTheDocument();
    expect(screen.queryByText('Save DC:')).not.toBeInTheDocument();
  });

  it('Value: defaults from the registry def, resets when selecting another effect, and sanitizes invalid input to 0', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();
    selectEffect('Next Attack +N Bonus');

    const valueInput = screen.getByLabelText('Value:');
    expect(valueInput).toHaveValue(defFor('Next Attack +N Bonus').defaults.value);
    fireEvent.change(valueInput, { target: { value: '99' } });
    expect(valueInput).toHaveValue(99);

    // Switching effects resets to the new def's own default (#52).
    goBack();
    selectEffect('AC Penalty');
    expect(screen.getByLabelText('Value:')).toHaveValue(defFor('AC Penalty').defaults.value);

    fireEvent.change(screen.getByLabelText('Value:'), { target: { value: 'abc' } });
    expect(screen.getByLabelText('Value:')).toHaveValue(0);
  });

  it('Ability: select offers the six ability bytes, defaults from the def, and keeps edits', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();
    selectEffect('Check Disadv');

    const abilitySelect = screen.getByLabelText('Ability:');
    expect(Array.from(abilitySelect.options).map(o => o.value)).toEqual(
      ['str', 'dex', 'con', 'int', 'wis', 'cha']
    );
    expect(Array.from(abilitySelect.options).map(o => o.textContent)).toEqual(
      ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
    );
    expect(abilitySelect).toHaveValue(defFor('Check Disadv').defaults.ability);

    fireEvent.change(abilitySelect, { target: { value: 'str' } });
    expect(abilitySelect).toHaveValue('str');
  });

  it('Save DC: defaults to 15, keeps valid edits, and sanitizes invalid input to 10', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();
    selectEffect("Tasha's Hideous Laughter");

    const dcInput = screen.getByLabelText('Save DC:');
    expect(dcInput).toHaveValue(15);
    fireEvent.change(dcInput, { target: { value: '20' } });
    expect(dcInput).toHaveValue(20);
    fireEvent.change(dcInput, { target: { value: 'abc' } });
    expect(dcInput).toHaveValue(10);
  });

  it("'Other…' reveals the custom-source input and selecting a creature hides it again", () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();
    selectEffect('Goad');

    const select = screen.getByRole('combobox');
    expect(screen.queryByPlaceholderText('Custom source name')).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: '__other__' } });
    expect(screen.getByPlaceholderText('Custom source name')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'Alice' } });
    expect(screen.queryByPlaceholderText('Custom source name')).not.toBeInTheDocument();
  });

  it.each`
    effectLabel                     | selectSource    | customSource          | newValue | newAbility | newDc | notesText     | source                 | value | ability | dc   | notes
    ${'Goad'}                       | ${'Alice'}      | ${undefined}          | ${null}  | ${null}    | ${null}| ${null}       | ${'Alice'}             | ${undefined} | ${undefined} | ${undefined} | ${undefined}
    ${'Goad'}                       | ${'__other__'}  | ${'Mysterious Stranger'} | ${null}| ${null}    | ${null}| ${null}       | ${'Mysterious Stranger'} | ${undefined} | ${undefined} | ${undefined} | ${undefined}
    ${'Goad'}                       | ${'__other__'}  | ${''}                 | ${null}  | ${null}    | ${null}| ${null}       | ${undefined}           | ${undefined} | ${undefined} | ${undefined} | ${undefined}
    ${'Goad'}                       | ${''}           | ${undefined}          | ${null}  | ${null}    | ${null}| ${null}       | ${undefined}           | ${undefined} | ${undefined} | ${undefined} | ${undefined}
    ${'Next Attack +N Bonus'}       | ${undefined}    | ${undefined}        | ${'8'}   | ${null}    | ${null}| ${null}       | ${undefined}           | ${8}    | ${undefined} | ${undefined} | ${undefined}
    ${'Check Disadv'}              | ${undefined}      | ${undefined}        | ${null}  | ${'str'}   | ${null}| ${null}       | ${undefined}           | ${undefined} | ${'str'} | ${undefined} | ${undefined}
    ${"Tasha's Hideous Laughter"}  | ${'Bob'}          | ${undefined}        | ${null}  | ${null}    | ${'18'}| ${'Boss spell'} | ${'Bob'}              | ${undefined} | ${undefined} | ${18} | ${'Boss spell'}
  `('dispatches the exact effects payload once for "$effectLabel" (Apply absent before selection)', ({
    effectLabel, selectSource, customSource, newValue, newAbility, newDc, notesText,
    source, value, ability, dc, notes,
  }) => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    openEffectsTab();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();

    selectEffect(effectLabel);
    if (selectSource !== undefined) {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: selectSource } });
    }
    if (selectSource === '__other__') {
      fireEvent.change(screen.getByPlaceholderText('Custom source name'), { target: { value: customSource } });
    }
    if (newValue !== null) {
      fireEvent.change(screen.getByLabelText('Value:'), { target: { value: newValue } });
    }
    if (newAbility !== null) {
      fireEvent.change(screen.getByLabelText('Ability:'), { target: { value: newAbility } });
    }
    if (newDc !== null) {
      fireEvent.change(screen.getByLabelText('Save DC:'), { target: { value: newDc } });
    }
    if (notesText !== null) {
      fireEvent.change(screen.getByPlaceholderText('GM notes about this effect…'), { target: { value: notesText } });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply).toHaveBeenCalledWith('effects', {
      target: 'Goblin',
      effectKey: defFor(effectLabel).effect,
      source,
      value,
      ability,
      dc,
      notes,
    });
  });
});
