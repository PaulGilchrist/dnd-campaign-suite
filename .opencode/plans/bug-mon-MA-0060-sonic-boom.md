# Bug mon-MA-0060 — Adult Blue Dragon · Sonic Boom (legendary_actions · other)

**Verdict: FAIL** — inert free-text legendary action; no Shatter cast path, no uses economy, no once-per-turn gate.

## Evidence
- Data: monsters.json `legendary_actions` Sonic Boom = `{name, description}` only — "The dragon uses Spellcasting to cast *Shatter*. The dragon can't take this action again until the start of its next turn." No action/cast/usage fields.
- Grep: `sonic` src/server → PC ElementalAttunement flavor only; zero monster consumers. `shatter` monster path grep-zero (MA-0054/57 hold).
- E2E (test-campaign, joined, dragon in initiative): `.mc-overlay` Sonic Boom row = inert `DIV.mc-action`, cursor auto, 0 button/input/select/a/.mc-dice-link. "Uses: 3" is header display text only (MA-0058 zero-consumer confirmed).
- Forced `.click()` on row + inner `<em>` Shatter + `<strong>`: modals 0→0, no cast UI, no targetEffects, no HP change; change-data before/after zero-delta (7 keys, 0 changed); log grep shatter/sonic = 0.

## Impact
Sonic Boom cannot be taken at all: no legendary-uses expenditure, no Shatter (2d8/3d8 thunder CON save DC 18) resolution, no once-per-turn gate — GM must resolve manually.
