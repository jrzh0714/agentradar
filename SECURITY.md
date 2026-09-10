# Security policy

## Supported versions

Security fixes are applied to the latest `1.x` release on the `main` branch.

## Reporting a vulnerability

Please use the repository's private
[GitHub security advisory form](https://github.com/jrzh0714/agentradar/security/advisories/new).
Do not include secrets or private user data in a public issue.

Include reproduction steps, affected routes or files, and the impact you
observed. You should receive an acknowledgement within seven days.

## Secrets

Never commit API keys, database credentials, cron secrets, or authenticated
Git remote URLs. If a credential appears in Git history or logs, revoke it at
the provider immediately; removing it from the current tree is not sufficient.
