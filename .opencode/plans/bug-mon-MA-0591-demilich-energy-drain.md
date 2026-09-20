# BUG MA-0591 — Demilich "Energy Drain": no legendary header → ungated multi-fire, zero uses economy, max-HP reduction advisory

**Verdict: FAIL — DATA (§46/§99 missing numeric header; §61/MA-0406 ungated repeat-fire; §124 advisory max-HP reduction).** test-campaign only.

## Expected (manifest MA-0591 + RAW)
Demilich legendary_actions[0] "Energy Drain": 1 legendary use (RAW demilich = **3**/round), one creature sighted within 120 ft, DC 19 Constitution. Failure: target's Hit Point maximum decreases by 14 (4d6). Both-outcomes clause: "can't take this action again until the start of its next turn." No damage on either outcome.

## Disk — public/data/monsters.json demilich.legendary_actions (exact keys)
- rows[0] = **Energy Drain** `{name, description, save_dc:19, save_type:"Constitution", range:"120 feet", save_effect}` — **NO header dict "Legendary Action Uses: N" anywhere; no numeric `uses` on any legendary row except child Necrosis `uses:1`.**
- No numeric dice field (4d6 is prose-only inside save_effect), no `hp_max_reduction` structured field, no recharge/own-turn clause field, no `delegates_to`.
- Rows: [Energy Drain, Grave-Dust Flight, Necrosis]. RAW total legendary uses = 3 — unrepresentable (no header).

## Live evidence (test-campaign, Demilich 1 + Bandit 1 staged 999/999)
- Card legendary section: **no counter/header row** (`legendaryHeaderAction`→null because rows[0].uses==null, monsterLegendaryUses.js:153-157). Fallback branch (MonsterCardBody.jsx:56-57) renders ALL rows as plain MonsterAction WITHOUT legendaryGate.
- Energy Drain renders a clickable chip `mc-dice-link-save-clickable` "DC 19 Constitution" (MonsterAction.jsx:88-115; formula null — extractDamageDiceFromDescription regex needs "Failure: 14 (4d6)" contiguous — HTML tag breaks it, so no dice chip).
- Click 1 (target armed Bandit 1): save resolved — victim `roll save` "Energy Drain" rolls [10] bonus 0, **saveDc 19, saveType Constitution, saveResult failure**; lastAttack machine-truth `{saveResult:"failure", saveDc:19, saveType:"Constitution", attackName:"Energy Drain"}`. Popup prints attacker-dupe "DC Unknown" (§138 cosmetic). Zero hp_change, maxHp **999→999**.
- Click 2 SAME turn: second save fired (rolls [18] → failure DC19). **ZERO refusal, zero spend, zero `legendary_use_refused`, zero `ability_use`** — once-per-turn clause NOT enforced. MA-0073 per-action cooldown machinery exists (`hasLegendaryCooldownClause` regex matches this row verbatim, monsterLegendaryUses.js:134-151) but is only consulted inside the header-branch legendaryGate — never wired for headerless demilich.
- Success rig (Bandit 1 `activeBuffs [{effect:'warding_bond', saveBonus:19}]` full-store POST): click 3 → rolls [14] total 33, wb 19, **saveResult success**; zero hp_change, maxHp 999→999 (RAW success = no reduction — trivially satisfied; zero-damage on both legs is RAW-correct, not flagged).
- Turn walk: initiative crossed Demilich 1's own turn-start (activeCreatureName Demilich 1 → Bandit 1 → AasimarTest…): **zero regain entries, zero ability_use, no maxHp consumer** — readers-only confirmed (§70).

## Grep evidence (fresh)
- `rg "hpMaxReduction|maxHp.*reduc|hitDiceMax" src/`: consumers ONLY — CharActionSpellPopups.jsx:239, TargetSpellPopups.jsx:52, greaterRestorationHandler.js:95-104 (reads + clears), plus tests + residual-lock test MonsterCardModal.banish-success-damage.test.jsx:452 (MA-0483 § lock). **ZERO producers.**
- `legendaryHeaderAction` (monsterLegendaryUses.js:153): `rows[0]?.uses != null ? rows[0] : null` → demilich null → economy (expend/refuse/regain + per-action cooldowns) never engages.
- MonsterCardBody.jsx:54 header branch vs :56 ungated fallback — headerless monsters get plain chips bypassing the entire legendary economy.

## Likely fix location
DATA in `public/data/monsters.json` demilich `legendary_actions` — header+children SAME pass (§46):
```json
[
  { "name": "Legendary Action Uses", "uses": 3 },
  { "name": "Energy Drain", "description": "...", "save_dc": 19, "save_type": "Constitution", "range": "120 feet", "save_effect": "..." },
  { "name": "Grave-Dust Flight", ... },
  { "name": "Necrosis", "description": "The demilich makes one Necrotic Burst attack.", "delegates_to": "Necrotic Burst" }
]
```
Header authored → gate engages: spend/`legendary_use_refused`, once-per-turn cooldown via hasLegendaryCooldownClause (MA-0073 seam auto-matches the row's verbatim clause), rows[1+] DC chips ride the shared gate (§110/MA-0567). Max-HP-reduction clause stays honest advisory-unbuilt (§124/MA-0483 precedent) — needs a structured te + producer ticket, not this row.

## Notes
- MA-0580 (Death Tyrant Chomp) sibling precedent: same headerless shape family; demilich variant lacks even the swallowed counter (rows[0] has no uses) → no counter renders at all.
- dc_success:"half" default leak (§63/MV-20) observed on lastAttack (`dcSuccess:"half"`) but moot — zero-damage row, nothing halves.
- "Failure or Success:" marker is picker-only (§157); single-target fail-only path moot here (condition-less row).
- Registry untouched (orchestrator-owned); no src/public-data writes.
