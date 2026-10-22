# Manifest contract — LoomVTT addons and rulesets

A package is published as **a GitHub release with two assets**:
`addon.json` (or `ruleset.json`) and the package's `.zip`.

The user pastes **a single link** into Loom, and nothing more.

## Example

```json
{
  "engine": "loom",
  "engineVersion": ">=0.0.2",
  "type": "addon",
  "name": "my-addon",
  "title": "My Addon",
  "version": "1.0.0",
  "author": "John Doe",
  "description": "What it does.",
  "manifest": "https://github.com/user/repo/releases/latest/download/addon.json",
  "download": "https://github.com/user/repo/releases/download/v1.0.0/my-addon.zip"
}
```

## Fields

| Field | Required | Note |
|---|---|---|
| `engine` | **yes** | Must be exactly `"loom"`. Without this, installation is rejected before downloading. |
| `type` | recommended | `"addon"` or `"ruleset"`. If present, must match what the user chose. |
| `name` | **yes** | Letters, numbers, `-` and `_` only. Becomes the installed folder name. |
| `version` | **yes** | Numeric dot-separated, with an optional pre-release suffix (`1.2.3`, `1.2.3-alpha`). The `version` and `name` inside the `.zip`'s own `addon.json` must equal the remote manifest's, or the install is aborted. |
| `download` | recommended | URL of the `.zip`. Point to the **tag**, not `latest`. If missing and `manifest` is a GitHub URL, Loom resolves the `.zip` asset of the latest release instead; otherwise the install fails. |
| `manifest` | recommended | URL of this very file. Point to `releases/latest/download/`. Loom writes the URL it fetched back into the installed manifest, and update checks use it. |
| `engineVersion` | no | One or more space-separated clauses with `>=`, `<=`, `>`, `<` or `=` (no operator means `>=`), e.g. `">=2.0.0"` or `">=2.0.0 <3.0.0"`. It is informational: an installation outside the range **still proceeds** and only shows a warning. A clause that does not match the format is ignored. |
| `sha256` | no | Hex SHA-256 of the `.zip`. When present, the install is aborted if the download does not match. |
| `visa` | no | Signed entitlement visa issued by Loom for paid packages. Verified against the package name and the `.zip` hash. |
| `title`, `author`, `description` | no | Display. |

## Why `manifest` should be `latest` and `download` should be the tag

`download` points to the **tag** so that the downloaded `.zip` is always the one that exactly matches
that manifest — without any desync window.

`manifest` points to `releases/latest/download/` so that checking for updates finds the
newest release. Pinning the `manifest` to its own version (a common pattern in other VTTs, which
compensates with a central registry) would freeze the package.

Loom tolerates a pinned manifest — it queries the GitHub releases API as the primary version
source — but using `latest` is correct and doesn't rely on API quotas.

## Publishing a new version

1. Update `version` and `download` (new tag) in your `addon.json`.
2. Create the release with the new tag.
3. Attach both assets: `addon.json` and the `.zip`.

There is no step 4. Whoever already installed it sees the update on the next check.

## Accepted hosts

For security, Loom only fetches packages from GitHub (`github.com`,
`raw.githubusercontent.com`, `objects.githubusercontent.com`,
`release-assets.githubusercontent.com`, `api.github.com`, `codeload.github.com`) and the official Loom catalog (`loomvtt.com`, `www.loomvtt.com`, `loomvtt.site`, `cdn.loomvtt.site`, `loomsite.vercel.app`).
