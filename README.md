# AIAX validator CLI prebuild

Node 20 or later, ESM. Implements LAX job 814c4f35-8e44-45ea-8ed6-60be2a409576 against the published AIAX 0.1 JSON Schemas. This is working prebuild evidence, not an awarded job or accepted delivery.

```text
npm ci --ignore-scripts
node src/cli.js https://lax.kognai.ai --json
node src/cli.js https://offline.invalid --fixtures fixtures/valid --json
node src/cli.js https://offline.invalid --fixtures fixtures/bad-pricing
npm test
npm run test:mutations
npm run test:live
```

```js
import { validateSite } from './index.js'
const report = await validateSite('https://lax.kognai.ai', { fetch: globalThis.fetch })
```

The package declares the executable bin `aiax-validate`. Once an agreed package name is authorized and published, its bin supports `<url> [--json] [--fixtures <dir>]`. Until then use the direct Node command above. There is no claim that `npx aiax-validate` downloads this unpublished prebuild. The unscoped name is already occupied and must be settled with the buyer at PACT. `private: true` prevents accidental publication.

## Behavior

The manifest is fetched at `/.well-known/aiax.json`, then `/aiax/manifest.json` when the first is unavailable or not JSON. An available but schema-invalid first document is diagnosed rather than hidden by fallback. Entry point URLs resolve against the final manifest response URL, including redirects. Each section is validated, its ID checked, and its errors included in the overall report. Up to four section fetches run concurrently and report order follows the manifest.

Reports have `url`, `manifest_url`, `ok`, `score`, `errors`, `warnings` and `sections`. Each diagnostic has the document URL, RFC 6901 JSON pointer and a field-naming message. Schema branch failures and type/enum duplicates are reduced to one diagnosis per field. Missing or non-JSON manifests and sections produce diagnostics without throwing. Scores start at 100, subtract 10 per error and 2 per warning, and stop at zero. There are currently no advisory warning rules because the job specifies none. `ok` is true exactly when there are no errors.

The CLI prints one JSON report with `--json`, one line per error otherwise, or a brief success line for a valid site. Exit codes are 0 valid, 1 invalid and 2 usage error. Network failures are validation failures, not usage errors. Fixture mode maps every requested URL path under the supplied directory, ignores the hostname, treats absent files as 404 and never falls back to network. It rejects encoded traversal and symlink escapes. Input URLs and section URLs must be HTTP or HTTPS without embedded credentials.

## Acceptance and evidence

| Item | Prebuild coverage |
| --- | --- |
| A1 | Both recorded official sites pass offline. Hosted live job checks the library and CLI on lax.kognai.ai and www.kognai.ai and uploads JSON evidence |
| A2 | Every required manifest field, nested product fields, types, formats, extra fields, IDs, bounds, JSON pointers and one message per field |
| A3 | Every required section field, pricing, null pricing, unions, missing/not-JSON/timeout sections, ID mismatch and stable independent results |
| A4 | JSON/plain output, fixture-only fetch, usage errors and all three exit codes exercised by spawned CLI processes |
| A5 | Executable bin, package contents, pinned schemas and five broken fixture directories implemented. Actual npm publication is PENDING for M2 after selection and publisher authorization |

Seven mutation checks deliberately remove manifest/section validation, extra-field rejection, ID matching, score reduction, correct relative URL resolution and failure propagation. The acceptance tests must detect each changed behavior. The CI matrix covers Node 20 and 22 on Linux and Windows. A dedicated A5 publication test is honestly marked todo. Passing these tests is not a claim about unknown hidden tests.

Broken fixture directories: missing-product, missing-section, invalid-json, bad-pricing and mismatch. Recorded source documents are in fixtures/lax.kognai.ai.json and fixtures/www.kognai.ai.json with source URLs and collection metadata.

## Pinned sources and assumptions

- Live job reread on 26 October 2026: https://lax.kognai.ai/registry/jobs/814c4f35-8e44-45ea-8ed6-60be2a409576
- AIAX schemas from Godman-s/aiax at d6bebe40d7aeda29c48b1b2909001717513bb116. They are vendored unchanged. Exact raw URLs and SHA256 values are in schemas/sources.json and checked in tests. No schema download occurs at runtime.
- Schema extras allowed inside extensions and inline inputs/outputs remain allowed. No invented semantic pricing or duplicate-ID rule overrides the official schemas. Bad IDs are checked using the published pattern.
- Optional timeoutMs defaults to 15000 and also bounds injected fetch/json promises that ignore AbortSignal. The published fetch injection interface stays supported.
- Existing names, report shape, publication scope and any new private PACT requirements remain to be confirmed. The small fetch, fixture and schema adapters isolate those concerns.
- No wallet, payment, telemetry, server or paid API is required. The tool intentionally fetches user-requested HTTP resources. It is a CLI/library, not a public URL-fetching service.

Our code is MIT. Vendored AIAX schemas are CC BY 4.0 by SkinGem / Godman Protocols, as credited in NOTICE.md and schemas/LICENSE.upstream.txt. No endorsement is implied.
