# Version 0.2 verification notes

Tested 30 October 2026 with the unpacked extension in Google Chrome and an authenticated Salesforce Developer Edition org. No customer record was created, changed, or deleted during this test. The org host, record IDs, source code, and deployment ID are omitted from this public note.

## Confirmed in Chrome

- Chrome reloaded Atlas as version 0.2.0, and the side panel connected to the org using the existing session.
- **Orgs** listed two open Salesforce tabs from the current window.
- **Schema** loaded Account metadata and displayed 118 fields; the object and selected-field CSV export controls enabled.
- **Code** source search for `Account` returned 55 results across accessible Apex and Lightning resources, within the stated scan cap. This is a bounded result, not a complete org index.
- **API** sent a GET request to `/services/data/v61.0/limits` and displayed a Salesforce response.
- **Data** reviewed a synthetic one-row `Name` CSV for Account. The field passed metadata checks, the preview showed the sample row, and Atlas displayed `APPLY 1 Account`. The Apply button was **not** clicked.
- **Metadata** submitted an original generated custom-field ZIP with `checkOnly: true` and `NoTestRun`. Salesforce accepted the request; status refresh returned `Succeeded`, `success: true`, one component validated, zero component errors, and zero test errors. Check-only validation did not add the field.

The first metadata attempt returned `INVALID_MULTIPART_REQUEST`. Atlas's multipart encoder was corrected to send distinct JSON and ZIP parts with the documented headers and CRLF boundaries; the subsequent check-only validation succeeded.

## Local checks

`npm run check` passed syntax checks and 13 tests covering host and path validation, read-only query guardrails, CSV behavior, data mutation preparation, field ZIP generation, and multipart request layout. The generated Metadata API ZIP also passed `unzip -t`.

## Still needs an org integration check

- Create, update, upsert, and delete via CSV were prepared and reviewed but **not submitted**. Check Salesforce's per-row result behavior and failure/rollback handling with disposable test records in a non-production org before relying on these operations.
- POST, PATCH, PUT, and DELETE in the REST workbench were not sent.
- A committing metadata deployment was not run. The check-only result proves transport and package format for the tested custom-field package, not every metadata type or test-level combination.
- User-selected favicon color was not checked visually after a Salesforce page transition.
- Cross-org behavior, custom domains, Classic pages, and orgs without usable browser API sessions were not tested.

See the earlier [version 0.1 live test](LIVE_TEST.md) for record inspection, query export, component name search, logs, and quick links.
