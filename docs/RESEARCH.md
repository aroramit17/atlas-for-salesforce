# Research and feature map

Research snapshot: 29 October 2026. These are five useful, publicly popular Salesforce admin and developer utility extensions selected from their Chrome Web Store descriptions and visible user counts when reviewed. They are not a definitive ranking or an installation claim. Listings and feature sets can change. Atlas is independently implemented and is not affiliated with, endorsed by, or dependent on these products.

| Extension | Public listing evidence at review | Atlas 0.2 coverage | Remaining differences |
| --- | --- | --- | --- |
| [Salesforce Inspector Reloaded](https://chromewebstore.google.com/detail/salesforce-inspector-relo/hpijlohoihegkfehhibggnkbjhoemldh) | Listing showed 600,000 users and described data and metadata inspection, query export, logs, REST exploration, and more. | Record/schema inspection, SOQL and CSV, logs, small CSV create/update/upsert/delete operations, REST requests, Metadata API ZIP validation/deploy. | No Bulk API import, live event monitor, or complete breadth of developer tools. |
| [ORGanizer for Salesforce](https://chromewebstore.google.com/detail/organizer-for-salesforce/lojdmgdchjcfnmkmodggbaafecagllnh) | Listing showed 80,000 users and described org recognition, quick links, stored accounts/login, and console tools. | Org recognition, open-tab switcher, quick links, chosen favicon colors. | No account vault, login automation, or connections to closed orgs. |
| [Salesforce Colored Favicons](https://chromewebstore.google.com/detail/salesforce-colored-favico/peohlnebahcddpmfaplmilpkgbkkcdho) | Listing showed 70,000 users and described per-org colors. | Original Atlas favicon with deterministic or selected color per API host. | Not guaranteed on every Salesforce page/domain, particularly Classic and custom domains. |
| [Salesforce advanced Code searcher](https://chromewebstore.google.com/detail/salesforce-advanced-code/lnkgcmpjkkkeffambkllliefdpjdklmi) | Listing showed 60,000 users and described Apex, Visualforce, and Lightning source search/navigation. | Component-name finder plus a bounded source-body text scan across Apex, Visualforce, and Lightning resources when accessible. | No full-org index, editor, or analysis. |
| [Salesforce DevTools](https://chromewebstore.google.com/detail/salesforce-devtools/ehgmhinnhggigkogkbhnbodhbfjgncjf) | Listing showed 50,000 users and described SOQL generation, field search, definition exports, and setup links. | Simple SOQL builder, object/field CSV exports, setup links, custom-field ZIP generator, Apex test starter. | No general mass editor or finished code-generation suite. |

## Design decisions

Atlas began as a read-only admin workspace in 0.1. Version 0.2 adds write tools within the same side panel, with an explicit review step for CSV changes and typed confirmation for other writes. Record and query results remain separate from data import. The extension does not store credentials or make a claim of full parity with any third-party product. Original extension code, branding, and assets were not copied.

## Technical sources

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), and [Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3).
- [Salesforce Query resource](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-query.html), [Describe Global](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-describeglobal.html), and [sObject Describe](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-sobject-describe.html).
- Salesforce sObject Collections: [create](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-composite-sobjects-collections-create.html), [update](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-composite-sobjects-collections-update.html), [upsert](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-composite-sobjects-collections-upsert.html), and [delete](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-composite-sobjects-collections-delete.html). Each collection is limited to 200 records.
- [Salesforce Metadata API Developer Guide](https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/api_meta.pdf), including REST metadata deployment and check-only validation.

See [version 0.1 live test](LIVE_TEST.md) and [version 0.2 verification notes](EXPANSION_TEST.md). Version 0.2's check-only metadata path succeeded in a Developer Edition org. Committing write paths still need integration checks.
