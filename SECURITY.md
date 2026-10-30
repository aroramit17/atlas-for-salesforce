# Security policy

## Reporting a vulnerability

Please open a private GitHub security advisory in the repository that hosts this project. If advisories are unavailable, contact the repository maintainer privately before posting exploit details publicly. Include the affected version, reproduction steps, and impact. There is no paid bug bounty.

## Security model

Atlas reads the active Salesforce tab and its `sid` cookie only when an operation needs API access. The cookie is used in the extension service worker for direct HTTPS requests to the mapped Salesforce API host. It is not saved, logged, included in UI messages, or sent to a third-party server. Requests are GET only, do not follow redirects, and accept only constrained Salesforce API paths. The side panel writes untrusted Salesforce values with `textContent`, not HTML. CSV cells guard against spreadsheet formula execution.

Chrome host permissions are broad enough to cover common Salesforce and Force domains. Review the manifest before installation and use Chrome's site-access controls if your organization requires narrower access. Custom quick links are stored locally and may contain sensitive path data; avoid placing secrets in them.

This project has not been audited. A user's org permissions and Salesforce session policies remain the enforcement boundary for Salesforce data.
