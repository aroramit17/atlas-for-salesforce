# Contributing

Issues and pull requests are welcome. Keep changes original and compatible with Manifest V3. Do not add third-party extension code or assets without a clearly compatible license and attribution.

1. Open an issue for a feature that changes permissions, stores new data, or writes to Salesforce.
2. Run `npm run check` before submitting a pull request.
3. Add focused tests for validation, URL handling, CSV behavior, and other security-sensitive pure logic.
4. Update README permission and technical-limit sections when behavior changes.
5. Avoid dependencies unless they solve a concrete problem; runtime code must be packaged locally for MV3.

For Salesforce integration work, document the org type, API access level, and a reproducible test using non-sensitive sample data. Never attach session cookies, credentials, customer records, or raw debug logs to issues.
