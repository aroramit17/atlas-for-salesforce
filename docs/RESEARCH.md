# Research and feature map

Research snapshot: 29 October 2026. This is a selection of five useful and publicly popular **Salesforce admin/developer utility extensions**, based on their Chrome Web Store descriptions and visible user counts at the time reviewed. It is not a definitive ranking, endorsement, or claim about installations. The official Salesforce Sales Cloud Everywhere extension serves a broader sales workflow and was outside this utility-focused comparison.

| Extension | Public listing evidence | Relevant capabilities | Atlas implementation |
| --- | --- | --- | --- |
| [Salesforce Inspector Reloaded](https://chromewebstore.google.com/detail/salesforce-inspector-relo/hpijlohoihegkfehhibggnkbjhoemldh) | Listing showed 600,000 users; describes data/metadata inspection, query export, logs, REST exploration, and more. | Record/field inspection, query export, logs, schema, shortcuts. | Record inspector, read-only query/CSV, recent logs, schema, quick links. No import, deploy, REST write explorer, event monitor, or bulk field creation. |
| [ORGanizer for Salesforce](https://chromewebstore.google.com/detail/organizer-for-salesforce/lojdmgdchjcfnmkmodggbaafecagllnh) | Listing showed 80,000 users; describes org recognition, quick links, account storage/login, and console tools. | Org recognition, navigation. | Deterministic org favicon, visible org strip, built-in and custom quick links. No password vault, login automation, or cross-org console. |
| [Salesforce Colored Favicons](https://chromewebstore.google.com/detail/salesforce-colored-favico/peohlnebahcddpmfaplmilpkgbkkcdho) | Listing showed 70,000 users; describes per-org colored favicons. | Distinguishing org tabs. | Original Atlas favicon with stable color per host. No per-org color editor yet. |
| [Salesforce advanced Code searcher](https://chromewebstore.google.com/detail/salesforce-advanced-code/lnkgcmpjkkkeffambkllliefdpjdklmi) | Listing showed 60,000 users; describes searching Apex, Visualforce, and Lightning source and navigating components. | Component search. | Bounded Apex class/trigger and Visualforce **name** finder. Source-body search and Lightning component indexing remain open. |
| [Salesforce DevTools](https://chromewebstore.google.com/detail/salesforce-devtools/ehgmhinnhggigkogkbhnbodhbfjgncjf) | Listing showed 50,000 users; describes SOQL generation, object/field search, definitions export, and setup links. | Object and field discovery, queries, setup navigation. | Schema browser, query workspace, setup links. No generated Apex tests, document export, or mass editing. |

## Design decisions

The first release is cohesive around a read-only workflow: orient to the org, inspect the current record or schema, run a query, export the returned data, and navigate to the next Salesforce page. Admin workflows take priority. Developer additions are intentionally bounded and labeled. Atlas uses its own code, interface, and geometric icon; it does not include code, branding, screenshots, or assets from the five extensions.

## Technical sources

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) and [permission declarations](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions): side panel and host/cookie access requirements.
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) and [content security policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy): packaged scripts and service worker architecture.
- [Salesforce Query resource](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-query.html): SOQL endpoint, pagination, and `nextRecordsUrl`.
- [Salesforce Describe Global](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-describeglobal.html) and [sObject Describe](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-sobject-describe.html): object and field metadata.

Store descriptions may change. A feature appearing in a listing does not guarantee it works in every org or Chrome version. Atlas behavior was implemented independently from public API documentation. A limited live smoke test is recorded in [LIVE_TEST.md](LIVE_TEST.md).
