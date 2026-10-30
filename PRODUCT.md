# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain JavaScript and CSS, no build step (confirmed by user). Chrome Manifest V3.

## Users

Salesforce administrators working in an authenticated org tab. Developers are a secondary audience.

## Product Purpose

Bring everyday inspection, read-only query, export, and navigation tasks into one browser side panel. Success means an admin can identify an org, inspect the current record and schema, run a query, and save results without switching tools.

## Operating Context

An active Salesforce tab and the user's existing browser session. The extension talks directly to Salesforce REST and Tooling APIs. It has no backend.

## Capabilities and Constraints

- First release prioritizes admin productivity (confirmed by user).
- Original open-source implementation; no proprietary code or assets.
- Read-only API operations in the first release. No credential vault or stored session token.
- Org API access depends on Salesforce session and permissions; some org policies can block it.
- Research is a selected comparison of five useful/popular utility extensions, not an exhaustive ranking.

## Evidence on Hand

The user's brief and public Chrome Web Store feature listings. No user Salesforce org or browser session is available for live integration testing.

## Product Principles

- Keep the active org visible before every operation.
- Make data export honest about row caps and partial results.
- Ask for no more browser power than the implemented workflows need.
- Fail clearly when session or API access is unavailable.
