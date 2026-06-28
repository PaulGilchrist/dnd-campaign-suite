
function rollD20() {
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

function parseExpression(formula) {
  if (!formula) return null;
  const stripped = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
  if (!stripped) return null;
  const cleaned = stripped.replace(/\s/g, '');
  const match = cleaned.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
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

function rollExpression(formula, options = {}) {
  if (!formula) return null;
  const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
  if (!baseFormula) return null;
  if (baseFormula.includes(' or ')) {
    const parts = baseFormula.split(/\s+or\s+/i);
    for (const part of parts) {
      const result = rollExpression(part, options);
      if (result) return result;
    }
  }
  if (baseFormula.includes(' plus ')) {
    const parts = baseFormula.split(/\s+plus\s+/);
    let total = 0;
    let rolls = [];
    let modifier = 0;
    for (const part of parts) {
      const result = rollExpression(part, options);
      if (result) {
        total += result.total;
        rolls = rolls.concat(result.rolls);
        modifier += result.modifier;
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
    let modifier = 0;
    for (const part of parts) {
      const result = rollExpressionDoubled(part);
      if (result) {
        total += result.total;
        rolls = rolls.concat(result.rolls);
        modifier += result.modifier;
      }
    }
    return { total, rolls, modifier, formula };
  }
  const parsed = parseExpression(formula);
  if (!parsed) return null;
  const { count, sides, modifier } = parsed;
  const { total, rolls } = rollDice(count, sides);
  return { total: (total * 2) + modifier, rolls, modifier, formula };
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

export { rollD20, rollDie, rollDice, rollAdvantage, rollDisadvantage, parseExpression, rollExpression, rollExpressionDoubled, rollExpressionMaximized, formatDamageFormula };
