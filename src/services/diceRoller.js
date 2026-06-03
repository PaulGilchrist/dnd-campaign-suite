
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
  const cleaned = formula.replace(/\s/g, '');
  const match = cleaned.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  return {
    count: parseInt(match[1] || 1, 10),
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0
  };
}

function rollExpression(formula) {
  const parsed = parseExpression(formula);
  if (!parsed) return null;
  const { count, sides, modifier } = parsed;
  const { total, rolls } = rollDice(count, sides);
  return { total: total + modifier, rolls, modifier, formula };
}

function rollExpressionDoubled(formula) {
  const parsed = parseExpression(formula);
  if (!parsed) return null;
  const { sides, modifier } = parsed;
  const { total, rolls } = rollDice(parsed.count * 2, sides);
  return { total: total + modifier, rolls, modifier, formula };
}

export { rollD20, rollDie, rollDice, rollAdvantage, rollDisadvantage, parseExpression, rollExpression, rollExpressionDoubled };
