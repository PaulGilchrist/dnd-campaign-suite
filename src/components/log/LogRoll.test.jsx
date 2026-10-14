import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { roll, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // ── ROLL ENTRY - cover and rangeReason ───────────────
  describe('RollEntry - cover and rangeReason', () => {
    it('shows 1/2 cover with AC bonus', () => {
      setup(Log, [roll({ coverAcBonus: 2 })]);
      expect(screen.getByText(/1\/2 Cover \(.*AC\)/i)).toBeInTheDocument();
    });

    it('shows 3/4 cover with AC bonus', () => {
      setup(Log, [roll({ coverAcBonus: 3, coverLevel: 'threeQuarter' })]);
      expect(screen.getByText(/3\/4 Cover \(.*AC\)/i)).toBeInTheDocument();
    });

    it('hides cover when bonus is zero', () => {
      setup(Log, [roll()]);
      expect(screen.queryByText(/Cover/i)).not.toBeInTheDocument();
    });

    it('shows rangeReason when set', () => {
      setup(Log, [roll({ rangeReason: 'Long range' })]);
      expect(screen.getByText(/Long range/i)).toBeInTheDocument();
    });

    it('hides rangeReason when empty', () => {
      setup(Log, [roll({ rangeReason: '' })]);
      expect(screen.queryByText(/Long range/i)).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - condition save ───────────────
  describe('RollEntry - condition save', () => {
    it('shows condition save with success class and text', () => {
      setup(Log, [roll({ condition: 'charmed', dc: 15, success: true })]);
      expect(screen.getByText(/vs charmed.*SUCCESS/i)).toBeInTheDocument();
      expect(q('.log-condition-save.log-condition-success')).toBeInTheDocument();
    });

    it('shows condition save with failure class and text', () => {
      setup(Log, [roll({ condition: 'paralyzed', dc: 12, success: false })]);
      expect(screen.getByText(/FAILURE/i)).toBeInTheDocument();
      expect(q('.log-condition-save.log-condition-failure')).toBeInTheDocument();
    });

    it('shows advantage with advantageSources', () => {
      setup(Log, [roll({
        condition: 'charmed',
        dc: 15,
        success: true,
        mode: 'advantage',
        advantageSources: ['Bard', 'Paladin'],
      })]);
      expect(screen.getByText(/ADVANTAGE \(Bard, Paladin\)/i)).toBeInTheDocument();
    });

    it('shows disadvantage badge on condition save', () => {
      setup(Log, [roll({ condition: 'frightened', dc: 10, success: false, mode: 'disadvantage' })]);
      expect(screen.getByText(/DISADVANTAGE/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - resistance notice ───────────────
  describe('RollEntry - resistance notice', () => {
    it('shows resistanceNotice text', () => {
      setup(Log, [roll({ resistanceNotice: 'Half dmg' })]);
      expect(screen.getByText(/Half dmg/i)).toBeInTheDocument();
    });

    it('hides resistanceNotice when empty', () => {
      setup(Log, [roll({ resistanceNotice: '' })]);
      expect(q('.log-resistance-notice')).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - save-damage: save info ───────────────
  describe('RollEntry - save-damage save info', () => {
    it('shows save type and DC', () => {
      setup(Log, [roll({ rollType: 'save-damage', saveType: 'dex', saveDc: 15 })]);
      expect(q('.log-save-info')).toBeInTheDocument();
    });

    it('hides save info when saveType or saveDc is missing', () => {
      setup(Log, [roll({ rollType: 'save-damage' })]);
      expect(q('.log-save-info')).not.toBeInTheDocument();
    });

    it('shows disadvantage badge in save info', () => {
      setup(Log, [roll({ rollType: 'save-damage', mode: 'disadvantage', saveDc: 13, saveType: 'wis' })]);
      expect(screen.getByText(/DISADVANTAGE/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - save-damage: save result ───────────────
  describe('RollEntry - save-damage save result', () => {
    it('shows saveResult success with class', () => {
      setup(Log, [roll({ rollType: 'save-damage', saveResult: 'success', targetName: 'Gob' })]);
      expect(q('.log-save-result.log-condition-success')).toBeInTheDocument();
    });

    it('shows saveResult failure with class and text', () => {
      setup(Log, [roll({ rollType: 'save-damage', saveResult: 'failure', targetName: 'Gob' })]);
      expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument();
      expect(q('.log-save-result.log-condition-failure')).toBeInTheDocument();
    });

    it('hides save result when saveResult is null and saveSuccess is not set', () => {
      setup(Log, [roll({ rollType: 'save-damage', saveResult: null })]);
      expect(q('.log-save-result')).not.toBeInTheDocument();
    });

    it('shows saveSuccess path (boolean=true) when saveResult is null', () => {
      setup(Log, [roll({ rollType: 'save-damage', saveResult: null, saveSuccess: true })]);
      expect(screen.getByText(/SAVE SUCCESS/i)).toBeInTheDocument();
    });

    it('shows saveSuccess path (boolean=false) when saveResult is null', () => {
      setup(Log, [roll({ rollType: 'save-damage', saveResult: null, saveSuccess: false })]);
      expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument();
    });

    it('shows saveRoll with bonus', () => {
      setup(Log, [roll({
        rollType: 'save-damage',
        saveResult: 'success',
        saveRoll: 14,
        saveBonus: 3,
      })]);
      expect(screen.getByText(/d20 14\+3/i)).toBeInTheDocument();
    });

    it('shows saveRoll without bonus when bonus is null', () => {
      setup(Log, [roll({
        rollType: 'save-damage',
        saveResult: 'failure',
        saveRoll: 8,
        saveBonus: null,
      })]);
      expect(screen.getByText(/d20 8\)/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - aoe-damage ───────────────
  describe('RollEntry - aoe-damage', () => {
    it('shows formula, affected count, and damage type', () => {
      setup(Log, [roll({ rollType: 'aoe-damage', formula: '8d6+0', affectedCount: 3 })]);
      expect(screen.getByText(/8d6/)).toBeInTheDocument();
      expect(screen.getByText(/3 creatures affected/i)).toBeInTheDocument();
    });

    it('hides affected count when zero', () => {
      setup(Log, [roll({ rollType: 'aoe-damage', formula: '4d6', affectedCount: 0 })]);
      expect(screen.queryByText(/affected/i)).not.toBeInTheDocument();
    });

    it('uses singular "creature" when count is 1', () => {
      setup(Log, [roll({ rollType: 'aoe-damage', formula: '4d6', affectedCount: 1 })]);
      expect(screen.getByText(/1 creature affected/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - damage type display ───────────────
  describe('RollEntry - damage type', () => {
    it.each([
      ['damage', 'slashing'],
      ['save-damage', 'fire'],
      ['overchannel-damage', 'fire'],
      ['graze-damage', 'cold'],
    ])('shows damage type "%s" for rollType "%s"', (rollType, damageType) => {
      setup(Log, [roll({ rollType, damageType })]);
      expect(screen.getByText(new RegExp(damageType, 'i'))).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - resistance details ───────────────
  describe('RollEntry - resistance details', () => {
    it('shows immune and resistant badges', () => {
      setup(Log, [roll({
        rollType: 'damage',
        damageType: 'fire',
        resistanceDetails: [
          { damageType: 'fire', status: 'immune' },
          { damageType: 'cold', status: 'resistant' },
        ],
      })]);
      expect(screen.getByText(/Immune to fire/i)).toBeInTheDocument();
      expect(screen.getByText(/Resistant to cold/i)).toBeInTheDocument();
      expect(q('.log-immune')).toBeInTheDocument();
      expect(q('.log-resistant')).toBeInTheDocument();
    });

    it('hides resistance details when array is empty', () => {
      setup(Log, [roll({ rollType: 'damage', resistanceDetails: [] })]);
      expect(q('.log-resistance-details')).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - final damage ───────────────
  describe('RollEntry - final damage', () => {
    it('shows final damage for save-damage with damageType', () => {
      setup(Log, [roll({
        rollType: 'save-damage',
        finalDamage: 5,
        damageType: 'fire',
      })]);
      expect(screen.getByText(/→ 5 fire damage/i)).toBeInTheDocument();
    });

    it('hides final damage when finalDamage is null', () => {
      setup(Log, [roll({ rollType: 'save-damage', damageType: 'fire', finalDamage: null })]);
      expect(q('.log-final-damage')).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - hunter lore notice ───────────────
  describe('RollEntry - hunter lore notice', () => {
    it('shows hunter lore notice with eye icon', () => {
      setup(Log, [roll({ hunterLoreNotice: 'Orc weakness detected' })]);
      expect(screen.getByText(/Orc weakness detected/i)).toBeInTheDocument();
      expect(q('.log-hunter-lore-notice i.fa-eye')).toBeInTheDocument();
    });

    it('hides hunter lore notice when empty', () => {
      setup(Log, [roll({ hunterLoreNotice: '' })]);
      expect(q('.log-hunter-lore-notice')).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - attack hit/miss/crit ───────────────
  describe('RollEntry - attack hit/miss/crit', () => {
    it('shows HIT with target AC', () => {
      setup(Log, [roll({ rollType: 'attack', hit: true, targetAc: 16 })]);
      expect(screen.getByText(/HIT \(AC 16\)/i)).toBeInTheDocument();
    });

    it('shows MISS without AC when targetAc is missing', () => {
      setup(Log, [roll({ rollType: 'attack', hit: false, targetAc: null })]);
      expect(screen.getByText(/MISS/i)).toBeInTheDocument();
      expect(q('.log-hit-miss').textContent).not.toContain('AC');
    });

    it('shows AUTO-MISS', () => {
      setup(Log, [roll({ rollType: 'attack', isAutoMiss: true })]);
      expect(screen.getByText(/AUTO-MISS/i)).toBeInTheDocument();
    });

    it('shows Critical Hit on isCrit', () => {
      setup(Log, [roll({ rollType: 'attack', isCrit: true })]);
      expect(screen.getByText(/Critical Hit!/i)).toBeInTheDocument();
    });

    it('shows Critical Miss on natural 1', () => {
      setup(Log, [roll({ rollType: 'attack', isNatural1: true })]);
      expect(screen.getByText(/Critical Miss!/i)).toBeInTheDocument();
    });

    it('does not show Critical Hit when isNatural1 overrides', () => {
      setup(Log, [roll({ rollType: 'attack', isCrit: true, isNatural1: true })]);
      expect(screen.queryByText(/Critical Hit!/i)).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - natural 20 / fumble badges ───────────────
  describe('RollEntry - natural 20 and fumble badges', () => {
    it('shows NAT 20 badge and log-nat20 class', () => {
      setup(Log, [roll({ isNatural20: true })]);
      expect(screen.getByText(/NAT 20/i)).toBeInTheDocument();
      expect(q('.log-nat20')).toBeInTheDocument();
    });

    it('shows FUMBLE badge and log-nat1 class', () => {
      setup(Log, [roll({ isNatural1: true })]);
      expect(screen.getByText(/FUMBLE/i)).toBeInTheDocument();
      expect(q('.log-nat1')).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - target display ───────────────
  describe('RollEntry - target display', () => {
    it('shows target with arrow for non-save-damage rolls', () => {
      setup(Log, [roll({ targetName: 'Orc' })]);
      expect(screen.getByText(/→ Orc/i)).toBeInTheDocument();
    });

    it('shows target without arrow for save-damage rolls', () => {
      setup(Log, [roll({ rollType: 'save-damage', targetName: 'Gob' })]);
      expect(screen.getByText(/vs Gob/i)).toBeInTheDocument();
    });

    it('hides target for aoe-damage rolls', () => {
      setup(Log, [roll({ rollType: 'aoe-damage', targetName: 'Orc' })]);
      expect(screen.queryByText(/→ Orc/i)).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - bane and bless penalties ───────────────
  describe('RollEntry - bane and bless', () => {
    it('shows bane penalty when baneRoll is set', () => {
      setup(Log, [roll({ baneRoll: 3 })]);
      expect(screen.getByText(/-1d4 \[Bane\]: -3/i)).toBeInTheDocument();
    });

    it('shows bless bonus when blessRoll is set', () => {
      setup(Log, [roll({ blessRoll: 2 })]);
      expect(screen.getByText(/\+1d4 \[Bless\]: \+2/i)).toBeInTheDocument();
    });

    it('hides bane when baneRoll is null', () => {
      setup(Log, [roll({ baneRoll: null })]);
      expect(q('.log-bane-penalty')).not.toBeInTheDocument();
    });

    it('hides bless when blessRoll is null', () => {
      setup(Log, [roll({ blessRoll: null })]);
      expect(q('.log-bless-bonus')).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - ray of enfeeblement ───────────────
  describe('RollEntry - ray of enfeeblement', () => {
    it('shows enfeeblement penalty when set', () => {
      setup(Log, [roll({ rayOfEnfeebleRoll: 4 })]);
      expect(screen.getByText(/-1d8 \[Enfeeblement\]: -4/i)).toBeInTheDocument();
    });

    it('hides enfeeblement when null', () => {
      setup(Log, [roll({ rayOfEnfeebleRoll: null })]);
      expect(q('.log-ray-enfeeblement')).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - gwf (great weapon fighting) ───────────────
  describe('RollEntry - great weapon fighting', () => {
    it('shows GWF with original and display rolls', () => {
      setup(Log, [roll({
        gwfApplied: true,
        gwfOriginalRolls: [12, 8],
        gwfDisplayRolls: [15, 10],
      })]);
      expect(screen.getByText(/GWF: 12, 8 → 15, 10/i)).toBeInTheDocument();
    });

    it('falls back to rolls when gwfDisplayRolls is missing', () => {
      setup(Log, [roll({
        gwfApplied: true,
        gwfOriginalRolls: [1, 3],
        rolls: [4, 6],
      })]);
      expect(screen.getByText(/GWF: 1, 3 → 4, 6/i)).toBeInTheDocument();
    });

    it('hides GWF when not applied', () => {
      setup(Log, [roll({ gwfApplied: false })]);
      expect(q('.log-gwf')).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - bonus display ───────────────
  describe('RollEntry - bonus display', () => {
    it('shows positive bonus with plus sign', () => {
      setup(Log, [roll({ bonus: 5 })]);
      expect(q('.log-total').textContent).toContain('+5');
    });

    it('shows negative bonus with minus sign', () => {
      setup(Log, [roll({ bonus: -2 })]);
      expect(q('.log-total').textContent).toContain('-2');
    });

    it('shows bonus detail after bonus value', () => {
      setup(Log, [roll({ bonus: 3, bonusDetail: 'from bless' })]);
      expect(q('.log-total').textContent).toContain('+3 from bless');
    });

    it('hides bonus when null', () => {
      setup(Log, [roll({ bonus: null })]);
      expect(q('.log-total').textContent).not.toMatch(/\+\d/);
    });
  });

  // ── ROLL ENTRY - showBothDice modes ───────────────
  describe('RollEntry - showBothDice modes', () => {
    it('shows both dice with selected/discarded labels for advantage', () => {
      setup(Log, [roll({ rolls: [17, 9], mode: 'advantage' })]);
      expect(screen.getByText(/selected/i)).toBeInTheDocument();
      expect(screen.getByText(/discarded/i)).toBeInTheDocument();
    });

    it('shows disadvantage both dice with selected when rolls[0] <= rolls[1]', () => {
      setup(Log, [roll({ rolls: [3, 15], mode: 'disadvantage' })]);
      expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
      expect(screen.getByText(/15 discarded/i)).toBeInTheDocument();
    });

    it('shows mode badge for non-damage/save-damage/aoe rolls with two dice', () => {
      setup(Log, [roll({ rollType: 'attack', rolls: [17, 9], mode: 'advantage' })]);
      expect(screen.getByText(/ADVANTAGE/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - secondary damage ───────────────
  describe('RollEntry - secondary damage', () => {
    it('shows all secondary damage fields', () => {
      setup(Log, [roll({
        secondaryFormula: '2d6',
        secondaryTotal: 7,
        secondaryDamageType: 'cold',
        secondarySaveResult: 'success',
        secondarySaveRoll: 14,
        secondarySaveBonus: 2,
      })]);
      expect(screen.getByText(/Secondary:/i)).toBeInTheDocument();
      expect(screen.getByText(/2d6/)).toBeInTheDocument();
      expect(screen.getByText(/cold/i)).toBeInTheDocument();
      expect(screen.getByText(/SAVE SUCCESS/i)).toBeInTheDocument();
      expect(screen.getByText(/d20 14\+2/i)).toBeInTheDocument();
    });

    it('shows secondary damage without save info', () => {
      setup(Log, [roll({
        secondaryFormula: '1d4',
        secondaryTotal: 3,
        secondaryDamageType: 'fire',
      })]);
      expect(screen.getByText(/Secondary:/i)).toBeInTheDocument();
      expect(q('.log-secondary-damage b').textContent).toBe('3');
      expect(screen.getByText(/fire/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - damage rolls dice display ───────────────
  describe('RollEntry - damage rolls dice display', () => {
    it('shows formula and inline dice values for damage rolls', () => {
      setup(Log, [roll({ rollType: 'damage', formula: '8d6', rolls: [5, 3, 6, 2, 4, 1, 6, 5] })]);
      expect(screen.getByText(/8d6/)).toBeInTheDocument();
      expect(screen.getByText(/\(5, 3, 6, 2, 4, 1, 6, 5\)/i)).toBeInTheDocument();
    });
  });

  // ── ICON CLASSES mapping ───────────────
  describe('getRollIconType icon mapping', () => {
    const saveShields = [
      'save', 'condition-save', 'save-damage', 'save-ottos-dance',
      'save-banishment', 'save-imprisonment', 'save-confusion',
      'save-forcecage', 'save-forcecage-escape', 'save-maze', 'save-maze-escape',
    ];

    it.each(saveShields)('save type "%s" uses shield icon', (tp) => {
      setup(Log, [roll({ rollType: tp })]);
      expect(q('.log-roll i.fa-shield-halved')).toBeInTheDocument();
    });

    it.each([
      ['save-polymorph', 'fa-paw'],
      ['save-animal-shapes', 'fa-paw'],
    ])('save type "%s" uses "%s" icon', (tp, cls) => {
      setup(Log, [roll({ rollType: tp })]);
      expect(q(`.log-roll i.${cls}`)).toBeInTheDocument();
    });

    it.each([
      ['save-prismatic-spray', 'fa-wand-magic-sparkles'],
      ['save-prismatic-spray-indigo', 'fa-eye'],
      ['save-prismatic-spray-violet', 'fa-door-open'],
    ])('prismatic spray variant "%s" uses "%s" icon', (tp, cls) => {
      setup(Log, [roll({ rollType: tp })]);
      expect(q(`.log-roll i.${cls}`)).toBeInTheDocument();
    });

    it.each([
      ['attack', 'fa-crosshairs'],
      ['spell_attack', 'fa-wand-magic-sparkles'],
      ['initiative', 'fa-bolt'],
      ['damage', 'fa-skull'],
      ['aoe-damage', 'fa-wand-magic-sparkles'],
      ['unknown_type', 'fa-dice-d20'],
    ])('roll type "%s" uses "%s" icon', (tp, cls) => {
      setup(Log, [roll({ rollType: tp })]);
      expect(q(`.log-roll i.${cls}`)).toBeInTheDocument();
    });
  });
});
