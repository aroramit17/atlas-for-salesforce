# Atlas for Salesforce

An independent, open-source Chrome side panel for Salesforce administrators and developers. Atlas combines record inspection, SOQL and CSV export, schema and source discovery, org navigation, and carefully reviewed data and metadata operations. It uses plain JavaScript and CSS, with no build step, backend, telemetry, or third-party runtime dependencies.

Atlas is not affiliated with Salesforce or the extensions below. Its code, design, and icons are original. The comparison describes specific workflows, not complete feature or user-count parity.

## Coverage of five popular utility extensions

| Extension | Atlas capabilities | Remaining differences |
| --- | --- | --- |
| [Salesforce Inspector Reloaded](https://chromewebstore.google.com/detail/salesforce-inspector-relo/hpijlohoihegkfehhibggnkbjhoemldh) | Inspect records and fields; query and export CSV; review logs; create, update, upsert, or delete up to 200 rows from CSV; send REST requests; validate or deploy a Metadata API ZIP. | No Bulk API workflow, live event monitor, or complete Inspector feature parity. |
| [ORGanizer for Salesforce](https://chromewebstore.google.com/detail/organizer-for-salesforce/lojdmgdchjcfnmkmodggbaafecagllnh) | Recognize the active org, switch among open org tabs, and use standard or saved quick links. | No stored account vault, automatic login, or connections to orgs that are not already open and signed in. |
| [Salesforce Colored Favicons](https://chromewebstore.google.com/detail/salesforce-colored-favico/peohlnebahcddpmfaplmilpkgbkkcdho) | Mark supported org tabs with a stable Atlas color and optionally choose a per-org color. | Some Salesforce page transitions may replace the favicon until Atlas reapplies it; unusual Classic or custom domains may not be recognized. |
| [Salesforce advanced Code searcher](https://chromewebstore.google.com/detail/salesforce-advanced-code/lnkgcmpjkkkeffambkllliefdpjdklmi) | Find Apex classes, triggers, and Visualforce pages by name; scan bounded accessible Apex, Visualforce, and Lightning source bodies for text. | No source editor, static analysis, or full-org index. Lightning results depend on Tooling API access. |
| [Salesforce DevTools](https://chromewebstore.google.com/detail/salesforce-devtools/ehgmhinnhggigkogkbhnbodhbfjgncjf) | Browse and export object and field definitions, build simple SOQL, generate a custom-field Metadata API ZIP and Apex test starter, and open setup pages. | Generated test classes are templates requiring real assertions; field generation supports four types; no general mass editor. |

See [research notes](docs/RESEARCH.md) for the public-listing snapshot and technical sources. Features named here are implemented independently using Salesforce and Chrome APIs. This table does not assert that every original extension feature is replaced.

## Install as an unpacked extension

Atlas is **not on the Chrome Web Store**.

1. Clone with `git clone https://github.com/aroramit17/atlas-for-salesforce.git`, or choose **Code → Download ZIP** on GitHub and extract it. To modify your own copy, use GitHub's **Fork** button.
2. In Chrome 116 or later, open `chrome://extensions` and turn on **Developer mode**.
3. Select **Load unpacked**, then choose the folder containing `manifest.json`.
4. Review Chrome's permission prompt. Atlas uses the current Salesforce tab and its session cookie for direct API requests.
5. Sign in to a Salesforce org, open its tab, and click the Atlas toolbar button. Pin Atlas from Chrome's Extensions menu if you want it always visible.
6. After pulling a newer version from GitHub, use **Reload** on Atlas's card at `chrome://extensions`, then refresh the Salesforce tab.

No npm installation, Connected App, or external service is required for this unpacked version. `npm` is used only for local tests and ZIP packaging.

## Screenshots

These screenshots were captured in Chrome from version 0.1 against a Salesforce Developer Edition org. They show a sanitized metadata query and actual components from that org. The new version 0.2 tools are described below; see [test notes](docs/EXPANSION_TEST.md) for their verification status.

| Home | Query results |
| --- | --- |
| ![Atlas home](screenshots/home.png) | ![Metadata SOQL results](screenshots/query-results.png) |

| Schema | Component finder |
| --- | --- |
| ![Account field definitions](screenshots/schema-browser.png) | ![Existing Account trigger matches](screenshots/component-finder.png) |

| Debug logs | Quick links |
| --- | --- |
| ![Recent debug log](screenshots/debug-logs.png) | ![Standard and custom links](screenshots/quick-links.png) |

Also see the [query editor](screenshots/query-workspace.png) and [version 0.1 live test record](docs/LIVE_TEST.md).

## Everyday workflow

- **Home and Orgs:** Confirm the active org before every operation. Orgs lists open Salesforce tabs; click one to switch. Choose a favicon color for the current org if desired.
- **Record:** Open a Lightning record page or enter an object API name and record ID to inspect accessible fields and values.
- **Query:** Write one `SELECT` SOQL query or use the simple builder. Atlas previews 100 rows and exports up to 10,000 returned rows to CSV. A partial result is clearly labeled.
- **Schema:** Search objects, inspect fields, and download object or selected-field definitions as CSV. A separate generator turns a field-definition CSV into a Metadata API ZIP for review.
- **Code:** Search component names or text inside accessible source. Source search scans at most 500 items per type and shows an excerpt. Download an Apex test class starter as a starting point for your own test.
- **Logs and Links:** Read or download accessible recent debug logs; open common setup pages or locally saved, org-specific links.

## Reviewed changes to Salesforce

**Data:** In **Data**, provide an object name, operation, and CSV file. Select **Review CSV** to validate field names and permissions and preview the first five rows. Type the exact displayed phrase before applying. A request contains 1–200 rows and sets `allOrNone=true`. Create CSVs use field API names; update and delete need `Id`; upsert needs an external ID field in the CSV. An empty cell is omitted, and `#NULL` sends JSON null. Delete files may contain only `Id`. Verify the Salesforce result before retrying a request whose response may have been lost.

**REST:** In **API**, choose GET, POST, PATCH, PUT, or DELETE and a relative path under `/services/data/v61.0/`. Write methods require typing `WRITE`. Requests go only to the current org's API host. This is a general workbench: review the endpoint, JSON body, and org carefully.

**Metadata:** In **API**, choose a Metadata API ZIP (up to 10 MB), a test level, and **Validate only** or deployment. Type `VALIDATE` or `DEPLOY` to submit. Validation uses Salesforce's check-only option; deployment can change or remove org metadata. Atlas displays the request ID and lets you refresh its status. For custom fields, start with a CSV whose headers are `Object,ApiName,Label,Type,Length,Scale`; the generator supports Text, Number, Checkbox, and Date. Review the generated ZIP and validate it in a non-production org before deployment.

These operations use your existing Salesforce permissions and session. They do not bypass object, field, metadata, or API access controls. The generated ZIP and check-only validation succeeded in a Developer Edition org. Live data writes, REST writes, and a committing metadata deployment have not been exercised. See [verification notes](docs/EXPANSION_TEST.md).

## Permissions, privacy, and limits

| Permission | Purpose |
| --- | --- |
| `cookies` | Read the current org's `sid` session cookie in the service worker to authorize direct Salesforce API calls. The cookie is never sent to the side panel, saved, or logged. |
| `tabs` | Find the active org, switch among open org tabs, and open links. |
| `storage` | Save custom quick links and org colors locally. |
| `sidePanel` | Show Atlas alongside the org. |
| Salesforce and Force host access | Call Salesforce REST and Tooling APIs and apply the Atlas favicon. Chrome shows a broad host-access warning. |

Atlas supports common HTTPS Salesforce production, sandbox, and Lightning hosts. Custom domains, Government Cloud, Experience Cloud, some Classic and Visualforce hosts, and unusual routing may need more work. The connected user needs API Enabled and access to the requested resources. Some org policies block API use from a browser session. Query export stops at 10,000 rows or 20 pages; source search stops at 500 items per type. CSV changes stop at 200 rows per operation; use an approved bulk tool for larger jobs. Source search can be slow or incomplete for large orgs.

Query, record, API, and source results stay in side-panel memory until it closes. Atlas saves only custom links and chosen colors. It does not save passwords, session tokens, or account credentials. There are no analytics or remote scripts. Review [SECURITY.md](SECURITY.md) before using write tools.

## Development

Node 20+ is needed for tests and packaging only:

```sh
npm run check
npm run package
```

`src/background.js` handles session and API requests. `src/core/` contains pure validation, CSV, and ZIP code. `src/ui/` is the side panel. `src/content/` manages the favicon. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [docs/EXPANSION_TEST.md](docs/EXPANSION_TEST.md) for what was verified.

## License

MIT. See [LICENSE](LICENSE).
