# Bug mon-MA-0074 — Adult Brass Dragon · "Unnamed lair actions 1" (lair_actions) · inert + drifts

## Row
- Description: "A strong wind blows around the dragon. Each creature within 60 feet … DC 15 STRENGTH saving throw or be pushed 15 feet … and knocked prone." (+ gas dispersal / flame extinguish clauses.)
- Data: `save_dc:15`, `save_type:"Constitution"`, `save_effect:"The target is blinded for 1 minute."`, no `name` → "Unnamed lair actions 1"; conditions [prone].

## Defect 1 — inert row (MV-21/24 fingerprint)
- `MonsterLairAction` (src/components/encounter/MonsterCardBody.jsx:306) object branch renders `<strong>{la.name}.</strong>` + sanitized description span only — no `onClick`, no save-roll affordance.
- `save_dc`/`save_type`/`save_effect` are never consumed at runtime: zero lair consumers in src/services and src/components (all apparent "lair" grep hits are "clairvoyant" substrings); `npcStatBlockUtils.js:80` nulls `lair_actions`; targetEffectDefinitions.js has zero lair entries.
- E2E: `.mc-overlay` row = inert `DIV.mc-action`, cursor auto, 0 interactive children, header `.`; forced pointer/mouse/dblclick/`.click()` ×3 → 0 modals, 0 save prompts, no roll; change-data sha256 stable (`bb9b04af…`, 10,915 B); log grep lair|wind|prone|pushed|blinded = 0.

## Defect 2 — data drifts
- **CON-vs-STR:** data `save_type:"Constitution"` vs description "DC 15 STRENGTH" (2024 block; 5e canonical is STR).
- **blinded-vs-prone:** `save_effect:"The target is blinded for 1 minute."` is copied from lair_actions[1] (sand cloud, DC15 CON blinded) and does not match this row's outcome "pushed 15 feet and knocked prone". Prone appears only in description text; no structured push/prone producer anywhere.

## Fix suggestions
- Correct `save_type` → "Strength"; rewrite `save_effect` to "pushed 15 feet and knocked prone"; add push (60-ft emanation, 15-ft) + prone application producer or grant the row a clickable save affordance (reuse ActionSaveRoll + prone te + movement effect).
- Disperse-gas / extinguish-flame clauses need explicit modelled effects or documented as flavor.
