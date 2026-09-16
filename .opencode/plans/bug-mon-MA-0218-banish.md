# MA-0218 — Ancient Gold Dragon "Banish" legendary save: once-per-turn gate + uses economy dead; half damage over-applied on successful save

## Overview
Live EB probe (test-campaign, 2026-09-15): the Banish legendary save row's core save math is exact (DC 24 Charisma, full 7d6 Force + Incapacitated on fail, demiplane te + rounds:2 expiry clock granted fail-only). BUT the row's own gate clause — "Failure or Success: The dragon can't take this action again until the start of its next turn" — is completely unenforced (8+ triggers in one round, zero refusals, zero uses spend), and successful saves still apply HALF 7d6 damage. FAIL.

## Expected (manifest row + monsters.json `ancient-gold-dragon` legendary_actions[1])
- "Charisma Saving Throw: DC 24, one creature the dragon can see within 120 feet. Failure: 24 (7d6) Force damage, and the target has the Incapacitated condition and is transported to a harmless demiplane until the start of the dragon's next turn... Failure or Success: The dragon can't take this action again until the start of its next turn."
- save_dc 24, save_type Charisma, damage_dice_primary 7d6, damage_type_primary Force, conditions [incapacitated].
- Success → no damage, no condition (damage listed under Failure only).
- Second click same turn → refusal + zero spend.

## Actual
1. Core fail branch EXACT: save_result "failed Charisma save (DC 24, rolled 4 +16 = 20)" / "(rolled 3 +11 = 15)"; full 7d6 Force applied via hp_change deltas -25 (41→16), -31 (224→193… chain to 107); `condition applied Incapacitated sourceName:"Ancient Gold Dragon 1" sourceAbility:"Banish"`; activeConditions ['incapacitated']; te `banished_demiplane` granted fail-only + dragon-store `pendingExpirations` rounds:2 remove_target_effect clock + `banished_demiplane_granted` log (MA-0104 consumer live).
2. Success branch WRONG: every success log ("succeeded Charisma save, rolled 20 +11 = 31") still produced hp_change HALF damage (save-damage roll sums halved: 31→-15, 28→-14, 28→-11, 26→-10; floor-half via dcSuccess:'half' hardcode, row authors no `dc_success`). No condition/te on success (correct), but damage over-applied (MV-20 seam).
3. Once-per-turn gate DEAD: Banish chip re-clicked 8× in one round (plus an earlier double-trigger "(1 of 2)") — fresh save prompt every time, refusal logs: [], ability_use spend logs: [], `monsterLegendaryUses` key never created.

## Steps to Reproduce
1. test-campaign, Encounters → EB search "Ancient Gold Dragon" exact → tick → Join Encounter (dragon cs idx0, init 14).
2. Initiative page → dragon card `[data-testid="target-select"]` → arm ElderPaladin → open dragon `.mc-overlay`.
3. Click Banish row "DC 24 Charisma" chip → Roll Save → Done. Repeat-click the same chip 8× without ending the round.
4. Observe log: every click resolves a new save + damage; zero `legendary_use_refused`, zero spend, successes still deal half damage.

## Likely Location
- `src/services/encounters/monsterLegendaryUses.js` — `legendaryHeaderAction()` (~:153) requires numeric `rows[0].uses`; header is name-text "Legendary Action Uses: 3 (4 in Lair)" only → null → `MonsterCardBody.jsx` renders plain ungated branch; `expendLegendaryUse` + MA-0073 `legendaryCooldownRefusal`/`hasLegendaryCooldownClause` consumers never reached (grep: only wired via `legendaryGate` prop when header exists).
- `src/components/encounter/MonsterCardModal.jsx` handleSaveRoll — `dcSuccess:'half'` hardcode (MV-20 seam, ~:212/:592); row needs `dc_success:"none"` on success + per-action cooldown wiring, `MonsterCardHelpers.js` clause parse.
- `public/data/monsters.json` ancient-gold-dragon legendary header lacks numeric `uses:3` (same DATA-root-cause as MA-0217/MA-0070 pattern).

## Notes
- Demiplane transport: NOT advisory-only — MA-0104 `banished_demiplane` te (MonsterCardModal.jsx:844 `parseBanishTransportClause` → saveProcessing.js:586-614 `grantDemiplaneTransport`) grants fail-only with rounds:2 expiry; reappearance *placement* ("unoccupied space of the dragon's choice") is GM-enforced advisory (log says so) — acceptable CLA-325 residual.
- Ungated once-per-turn family: MA-0184 / MA-0187 / MA-0217 (same header-`uses` fingerprint) + MA-0092; MA-0217's control probe already saw THIS Banish row fire ungated 4× — re-confirmed 8× here.
- Cosmetic: save prompt boilerplate "Half damage on successful save"; some `roll save` log entries echo both a phantom and real d20 (`rolls:[16,9]`); 0-HP victim clamp echo (AB 41→16→down→`delta:+1→1` death-flow quirk, MV-10) — avoided in success math judgment.
- Evidence: campaign log + change-data admin-Full-Reset after probe; verified log [] / change-data {}.
