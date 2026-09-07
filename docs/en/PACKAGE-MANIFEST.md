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
| `version` | **yes** | Dot-separated numeric (`1.2.3`). |
| `download` | **yes** | URL of the `.zip`. Point to the **tag**, not `latest`. |
| `manifest` | **yes** | URL of this very file. Point to `releases/latest/download/`. |
| `engineVersion` | no | `">=X.Y.Z"` or `"X.Y.Z"`. Cleanly rejects if Loom is older. |
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
`release-assets.githubusercontent.com`, `api.github.com`, `codeload.github.com`).
