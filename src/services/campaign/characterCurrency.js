/**
 * Character purse resolution — the SINGLE client-side mirror of the server's
 * characterCurrency()/transfer debit rule (server/routes/inventory.js, which stays
 * canonical for writes): the { pp, gp, sp, cp } block when present, else positive
 * inventory.gold counted as gp. Every read face (the From Players pane, the sheet's
 * purse row) imports this one implementation so a display never shows coin a
 * transfer lane could not actually move.
 */
export function characterCurrency(character) {
  const currency = { pp: 0, gp: 0, sp: 0, cp: 0 };
  const raw = character.inventory?.currency;
  if (raw) {
    for (const key of Object.keys(currency)) {
      const value = Number(raw[key]);
      currency[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    }
    return currency;
  }
  const gold = Number(character.inventory?.gold);
  if (Number.isFinite(gold) && gold > 0) currency.gp = Math.floor(gold);
  return currency;
}
