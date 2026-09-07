# Decks

## Endpoints

**Base:** `/api/decks`
**Auth:** `requireAuth, requireWorldMatch` on read routes (`GET`); **all write routes** (`POST`, `PUT`, `DELETE`, and the card manipulation routes below) also require `requireGM`.

---

### GET `/world/:worldId`

Lists decks in a world.

---

### GET `/:id`

Fetches deck by ID.

---

### POST `/`

Creates a deck.

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `worldId` | `string` | **yes** | — |
| `name` | `string` | **yes** | — |
| `type` | `string` | no | — |
| `cards` | `array` | no | — |
| `state` | `object` | no | — |

**WS Event:** `deck.created`

---

### PUT `/:id`

Updates a deck.

**WS Event:** `deck.updated`

---

### DELETE `/:id`

Removes a deck.

**WS Event:** `decks.deleted` (note: plural, unlike `deck.created`/`deck.updated`)

---

## Card Manipulation

All require `requireGM`.

### POST `/:id/draw`

Draws card(s) from the top of `:id` to another stack (hand/pile).

**Request body:** `{ "toId": "...", "number"?: 1 }`

**Response `200`:** `{ moved: Card[], from: Deck, to: Deck }`
**Response `400`:** `toId` missing, or nothing to draw
**WS Events:** `deck.updated` (twice — source and destination)

---

### POST `/:id/deal`

Deals cards cyclically from the top of `:id` to multiple stacks.

**Request body:** `{ "toIds": ["...", "..."], "number"?: 1 }` (`number` = how many rounds)

**Response `200`:** `{ from: Deck, to: Deck[] }`
**WS Events:** `deck.updated` (once per affected stack)

---

### POST `/:id/pass`

Passes specific cards from `:id` to another stack.

**Request body:** `{ "toId": "...", "cardIds": ["...", "..."] }`

**Response `200`:** `{ moved: Card[], from: Deck, to: Deck }`
**WS Events:** `deck.updated` (twice — source and destination)

---

### POST `/:id/recall`

Recalls back to deck `:id` every card scattered across other stacks in the same world that has it as its `origin`.

**Response `200`:** `{ deck: Deck, touched: Deck[] }`
**WS Events:** `deck.updated` (once per affected stack + the deck itself)
