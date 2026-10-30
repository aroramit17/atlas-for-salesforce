# Live Chrome smoke test

Observed on 29 October 2026 in Google Chrome with Atlas loaded as an unpacked extension and an authenticated Salesforce Developer Edition org. Org address and record values are omitted from this report and redacted in public screenshots.

| Check | Observed result |
| --- | --- |
| Side panel connection | Connected; API limits resource returned a daily remaining count. |
| Current record inspector | An Account record loaded with 118 accessible field definitions and values. Record values are excluded from screenshots. |
| Schema browser | Account appeared in the object list and its 118 field definitions loaded. One attempt briefly returned an API 404; retry succeeded. Cause not established. |
| SOQL query | `SELECT QualifiedApiName FROM EntityDefinition LIMIT 5` returned five metadata rows. Export button became enabled. CSV download was not exercised. |
| Component finder | Searching `AccountTrigger` returned an Apex class and an Apex trigger already present in the org. No code or metadata was created for this test. |
| Debug logs | Initially empty. After a safe anonymous Apex debug statement was run in the org, Atlas listed one successful log. Its 1,265-byte body opened and contained the expected `Atlas screenshot smoke test` marker. Download was not exercised. |
| Quick links | Standard and custom-link controls rendered. Opening targets and saving custom links were not exercised. |

These are UI and API smoke checks on one org, not a full compatibility or security test. The screenshots include metadata, generic component names, a successful log list with the user name hidden, and safe empty states. The raw log body contained a user identifier and email, so it was excluded from the project package. Source captures showing customer data were also kept out of the package.
