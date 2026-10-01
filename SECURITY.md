# Security Policy

## Reporting a vulnerability

Security issues affecting the production Telegraph Sentinel service or repository runtime components should be reported privately rather than disclosed in a public issue.

Use GitHub's private security-advisory mechanism for this repository when available. Include:

- a concise description of the issue;
- affected component(s) and endpoint(s);
- reproduction steps or a minimal proof of concept;
- expected and observed behavior; and
- any practical mitigation you have identified.

**Do not include private keys, API tokens, credentials, or other secrets in reports.**

## Security expectations

- Credentials belong in deployment environment variables, not source control.
- Wallet private keys must never be committed or pasted into issues, pull requests, or logs.
- Production endpoints should use HTTPS.
- Upstream provider failures should fail closed for unavailable data rather than inventing values.
- Dependency and build artifacts should not be committed unless they are intentional protocol artifacts.
