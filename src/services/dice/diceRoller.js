
// ── Dev-only forced-d20 seam (backlog 2026-11-20 BBB, harness ergonomics) ──
// QA harnesses need forced natural 20/1 chip commits without re-wrapping
// Math.random page-side (the pin window bleeds into unrelated consumers like
// utils.guid()). The seam lives INSIDE rollD20 so no global RNG is patched:
// arm once, the next rollD20() call returns the value verbatim and the seam
// auto-disarms. Arming lanes (both gated import.meta.env.DEV, mirroring the
// Map3D __map3d handle pattern):
//   1. globalThis.__forceNextD20(n) — arm with an integer 1..20, or
//      __forceNextD20(null) to disarm. Rejects out-of-range/non-integer.
//   2. `?testRoll=<n>` URL param — arms the same one-shot seam at module
//      load, so a fresh dev-server page ride needs zero page-side injection.
// The override rides ONLY the rollD20() primitive (attack/save/initiative
// d20s via computeD20Roll); damage dice (rollDie/rollDice) never consume it.
let forcedD20 = null;

function armForcedD20(value) {
  if (value === null) {
    forcedD20 = null;
    return true;
  }
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    console.error('[diceRoller] forced-d20 seam rejected (need an integer 1..20, or null to disarm):', value);
    return false;
  }
  forcedD20 = value;
  return true;
}

if (import.meta.env.DEV) {
  globalThis.__forceNextD20 = armForcedD20;
  const testRollParam = new URLSearchParams(globalThis.location?.search || '').get('testRoll');
  if (testRollParam !== null) {
    armForcedD20(Number(testRollParam));
  }
}

function rollD20() {
  if (import.meta.env.DEV && forcedD20 !== null) {
    const forced = forcedD20;
    forcedD20 = null;
    return forced;
  }
  return Math.floor(Math.random() * 20) + 1;
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(sides));
  }
  return { total: rolls.reduce((sum, r) => sum + r, 0), rolls };
}

function rollAdvantage() {
  const a = rollD20();
  const b = rollD20();
  return { total: Math.max(a, b), rolls: [a, b], label: 'advantage' };
}

function rollDisadvantage() {
  const a = rollD20();
  const b = rollD20();
  return { total: Math.min(a, b), rolls: [a, b], label: 'disadvantage' };
}

function parseConstant(formula) {
  if (!formula) return null;
  const stripped = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
  if (/^[+-]?\d+$/.test(stripped)) return parseInt(stripped, 10);
  return null;
}

function parseExpression(formula) {
  if (!formula) return null;
  const stripped = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
  if (!stripped) return null;
  const cleaned = stripped.replace(/\s/g, '');
  // sides must be >=1: no d0 exists in RAW — rollDie(0) would silently
  // fabricate a phantom 1 (#1072). Zero-COUNT dice ('0d6') stay legal and
  // contribute nothing (disk-honest: True Strike damage_at_slot_level "0").
  // d0-shaped junk joins the house parse-failure class: null, never a roll.
  const match = cleaned.match(/^(\d+)?d([1-9]\d*)((?:[+-]\d+)+)?$/i);
  if (match) {
    const modifierStr = match[3];
    let modifier = 0;
    if (modifierStr) {
      const segments = modifierStr.match(/([+-]\d+)/g);
      for (const seg of segments) {
        modifier += parseInt(seg, 10);
      }
    }
    return {
      count: parseInt(match[1] || 1, 10),
      sides: parseInt(match[2], 10),
      modifier
    };
  }
  if (stripped.toLowerCase().includes(' or ')) {
    const parts = stripped.split(/\s+or\s+/i);
    for (const part of parts) {
      const result = parseExpression(part);
      if (result) return result;
    }
  }
  return null;
}

function canRollExpression(formula) {
  if (!formula) return false;
  const stripped = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
  if (!stripped) return false;
  if (/\s+or\s+/i.test(stripped)) return stripped.split(/\s+or\s+/i).some(canRollExpression);
  if (/\s+plus\s+/i.test(stripped)) return stripped.split(/\s+plus\s+/i).some(part => canRollExpression(part) || parseConstant(part) !== null);
  return parseExpression(stripped) !== null;
}

function rollExpression(formula, options = {}) {
  if (!formula) return null;
  const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
  if (!baseFormula) return null;
  // Case-insensitive gates mirror canRollExpression's /\s+or\s+/i + /\s+plus\s+/i
  // (fix#337S #1072): canRoll('1d8 PLUS 2d6') was true while rollExpression returned
  // null — the case-sensitive includes() split the can/roll contract in two.
  if (/\s+or\s+/i.test(baseFormula)) {
    const parts = baseFormula.split(/\s+or\s+/i);
    for (const part of parts) {
      const result = rollExpression(part, options);
      if (result) return result;
    }
  }
  if (/\s+plus\s+/i.test(baseFormula)) {
    const parts = baseFormula.split(/\s+plus\s+/i);
    let total = 0;
    let rolls = [];
    let modifier = 0;
    for (const part of parts) {
      const result = rollExpression(part, options);
      if (result) {
        total += result.total;
        rolls = rolls.concat(result.rolls);
        modifier += result.modifier;
      } else {
        const flat = parseConstant(part);
        if (flat !== null) {
          total += flat;
          modifier += flat;
        }
      }
    }
    return { total, rolls, modifier, formula };
  }
  const parsed = parseExpression(formula);
  if (!parsed) return null;
  const { count, sides, modifier } = parsed;
  const { total, rolls } = rollDice(count, sides);
  if (options.rerollOnes) {
    const rerolledRolls = rolls.map(r => r === 1 ? Math.floor(Math.random() * sides) + 1 : r);
    return { total: rerolledRolls.reduce((sum, r) => sum + r, 0) + modifier, rolls: rerolledRolls, modifier, formula };
  }
  return { total: total + modifier, rolls, modifier, formula };
}

function rollExpressionDoubled(formula) {
  if (!formula) return null;
  const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
  if (!baseFormula) return null;
  if (baseFormula.includes(' or ')) {
    const parts = baseFormula.split(/\s+or\s+/i);
    for (const part of parts) {
      const result = rollExpressionDoubled(part);
      if (result) return result;
    }
  }
  if (baseFormula.includes(' plus ')) {
    const parts = baseFormula.split(/\s+plus\s+/);
    let total = 0;
    let rolls = [];
    let doubledRolls = [];
    let modifier = 0;
    for (const part of parts) {
      const result = rollExpressionDoubled(part);
      if (result) {
        total += result.total;
        rolls = rolls.concat(result.rolls);
        doubledRolls = doubledRolls.concat(result.doubledRolls || result.rolls);
        modifier += result.modifier;
      } else {
        const flat = parseConstant(part);
        if (flat !== null) {
          total += flat;
          modifier += flat;
        }
      }
    }
    return { total, rolls, doubledRolls, modifier, formula };
  }
  const parsed = parseExpression(formula);
  if (!parsed) return null;
  const { count, sides, modifier } = parsed;
  const { total, rolls } = rollDice(count, sides);
  const doubledRolls = rolls.concat(rolls);
  return { total: (total * 2) + modifier, rolls, doubledRolls, modifier, formula };
}

function rollExpressionMaximized(formula) {
  const parsed = parseExpression(formula);
  if (!parsed) return null;
  const { count, sides, modifier } = parsed;
  const maxTotal = count * sides;
  const rolls = Array(count).fill(sides);
  return { total: maxTotal + modifier, rolls, modifier, formula, maximized: true };
}

function formatDamageFormula(formula, rolls, isCrit) {
  if (!formula) return formula;
  const stripped = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
  if (!stripped) return formula;
  const parsed = parseExpression(formula);
  if (!parsed) return formula;
  const { count, sides, modifier } = parsed;
  const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
  const critSuffix = isCrit ? '*2' : '';
  let formulaStr = `${count}d${sides}`;
  formulaStr += critSuffix;
  if (modifier > 0) {
    formulaStr += `+${modifier}`;
  } else if (modifier < 0) {
    formulaStr += `${modifier}`;
  }
  return `${formulaStr}${rollStr}`;
}

function applyHealingRerollOnes(rolls, expression) {
  if (!rolls || !Array.isArray(rolls)) return { displayRolls: rolls, originalRolls: null };
  const parsed = parseExpression(expression);
  if (!parsed) return { displayRolls: rolls, originalRolls: null };
  const { sides } = parsed;
  const originalRolls = [...rolls];
  const rerolled = rolls.map(r => r === 1 ? rollDie(sides) : r);
  if (rerolled.some((r, i) => r !== originalRolls[i])) {
    return { displayRolls: rerolled, originalRolls };
  }
  return { displayRolls: rolls, originalRolls: null };
}

export { rollD20, rollDie, rollDice, rollAdvantage, rollDisadvantage, parseExpression, parseConstant, canRollExpression, rollExpression, rollExpressionDoubled, rollExpressionMaximized, formatDamageFormula, applyHealingRerollOnes };
