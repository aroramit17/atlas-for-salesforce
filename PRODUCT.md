# Product

<!-- impeccable:product-schema 1 -->

## Platform

Chrome Manifest V3 side panel.

## Stack

Plain JavaScript and CSS, no build step (chosen by user).

## Users

Salesforce administrators working in an authenticated org tab; developers are a secondary audience.

## Product purpose

Bring inspection, query, export, navigation, and carefully reviewed data and metadata tasks into one browser workspace. The initial release prioritized admin productivity. Version 0.2 expands the same workspace with write tools, source search, org tab switching, colors, and definition exports.

## Operating context

An active Salesforce tab and the user's existing browser session. The extension talks directly to Salesforce REST, Tooling, and Metadata APIs. It has no backend.

## Capabilities and constraints

- Original open-source implementation; no proprietary code or assets.
- The active org must be visible before an operation. Data, REST, and metadata writes require explicit in-panel review or typed confirmation.
- No credential vault, automatic login, or stored session token.
- Org API access depends on the current Salesforce session and permissions; some policies block it.
- Research is a selection of five popular utility extensions, not a definitive ranking or full parity claim.
- Check-only metadata validation passed in a Developer Edition org; committing write paths still need live integration verification. Local tests cover preparation and validation.

## Product principles

- Show the active org and make write effects clear.
- Label row caps, partial exports, and bounded source scans.
- Use the browser permissions that the implemented workflows need.
- Fail clearly when Salesforce denies session, object, field, or metadata access.
