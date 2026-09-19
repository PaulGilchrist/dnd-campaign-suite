# bug-mon-MA-0564-death-knight-spellcasting-unmarked-names

**Row:** MA-0564 — Death Knight (death-knight) actions[3] "Spellcasting" — Spellcasting, saveDc 18 (prose), CHA.
**Verdict:** FAIL(b) — inert DATA, MA-0421 markup-gap class (twins MA-0524/0532/0536/0543/0552/0558, same as MA-0459).

## Disk evidence (public/data/monsters.json, death-knight actions[3])
- description marks ONLY tier headers: `<strong>At Will:</strong>`, `<strong>2/Day Each:</strong>`.
- Spell names **Command, Phantom Steed, Destructive Wave (Necrotic), Dispel Magic are plain text** — no `<strong>/<em>`.
- No numeric `save_dc`/`save_type` on the row (prose "spell save DC 18" only).

## Code evidence
- `extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:288) matches `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g` and skips `:`-terminated headers → returns **[]** for this row → SpellCastLinks renders zero chips.
- `extractSpellcastingSpellUses` (:301) binds "2/Day" limit to marked names only → Destructive Wave/Dispel Magic uses invisible + ungated even if chip route existed.
- MA-0532: row named "Spellcasting" renders SpellCastLinks XOR ActionSaveRoll — row-level numeric save_dc would never render here; fix must be markup on each spell name (MA-0421 archmage/lich byte-shape template).

## Live evidence (localhost:5173, test-campaign, EB-joined "Death Knight 1" cs idx0 currentHp199)
- `.mc-overlay` Spellcasting `.mc-action` audit: `role=button: 0`, `.mc-dice-link: 0`, `.mc-dice-link-spell: 0`, `a: 0` — zero affordances.
- Same-card sibling chips alive (Dread Blade +11, Hellfire Orb DC 18 Dexterity, Expend Legendary) → renderer healthy; row-specific gap proven.
- Command DC18 cast probe vs Bandit unreachable — zero adjudication surface; no uses-gate observable.
- Spell data: Command / Phantom Steed / Dispel Magic standard 5e `public/data/spells.json`; **Destructive Wave only in `public/data/2024/spells.json`** — any fix must also confirm spell lookup resolves for this monster's rules path.

## Fix (DATA)
Wrap each spell name in `<strong>` (or `<em>`) in actions[3].description per MA-0421 template; keep tier headers; strip-tag byte-equality check; re-join EB combatant to refresh stale snapshot; verify chips, DC18 CHA on cast, 2/Day gating on Destructive Wave/Dispel Magic, At-Will ungated.

## Cleanup
Admin-cleared change-data (keys 0) + log (0 entries), verified quiet tab, campaign header test-campaign, no manifest/git writes.
