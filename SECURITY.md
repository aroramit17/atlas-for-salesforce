# Security policy

## Report a vulnerability

Open a private GitHub security advisory in this repository. If advisories are unavailable, contact the maintainer privately before publishing exploit details. Include the affected version, reproduction steps, and impact. There is no paid bug bounty.

## Security model

Atlas reads the active Salesforce tab and its `sid` cookie when an API operation needs it. The service worker sends requests directly over HTTPS to the mapped Salesforce API host, with redirects blocked. It does not save, log, or expose the cookie to the side panel. API paths for the general workbench must remain under the configured Salesforce REST version; all other tools use fixed endpoints or constrained identifiers. Salesforce responses are rendered as text, not HTML. CSV exports escape spreadsheet formulas.

Version 0.2 adds write operations: CSV record create/update/upsert/delete, a REST workbench with write methods, and Metadata API ZIP deployment. Data changes require a review step and an exact phrase; REST writes require `WRITE`; metadata validation and deployment require `VALIDATE` or `DEPLOY`. The active org host is checked again when the request is sent. These prompts reduce accidental clicks but are not a substitute for reviewing the target org and payload. The REST workbench can invoke powerful Salesforce endpoints, and metadata ZIPs can contain destructive changes. Use an appropriately privileged account and validate packages in a non-production org.

Chrome host permissions cover common Salesforce and Force domains. Review `manifest.json` and your organization's extension policy before installation. Custom links and chosen org colors are stored in Chrome's local extension storage; links can contain sensitive path data, so do not put secrets in them. Query results, CSV contents, API responses, and ZIP contents are kept in memory during the side-panel session and are not sent to any third-party service.

This project has not had an independent security audit. Salesforce permissions, session policy, and API limits remain the enforcement boundary. Check-only metadata validation succeeded in a Developer Edition org; live data writes, REST writes, and committing deployments remain unverified. See [verification notes](docs/EXPANSION_TEST.md).
