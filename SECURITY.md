# Security Policy

## Supported status

The static `preview/` application is a demonstration environment and must not be used to store or process real patient, caregiver, employment, payroll, identity, or medical information. Authentication and authorization implemented only in browser JavaScript or `localStorage` are not security controls.

Production use requires server-side authentication, authorization, session management, database access control, encrypted object storage, audit logging, rate limiting, monitoring, backups, and incident response.

## Reporting a vulnerability

Do not open a public GitHub issue for a vulnerability that could expose credentials, personal information, medical information, or privileged access. Report it privately to the repository owner and include:

- affected URL or file
- reproduction steps
- impact
- screenshots or logs with secrets redacted
- suggested remediation, if known

## Handling requirements

- Treat every credential committed to Git history as compromised and rotate it immediately.
- Never commit passwords, API tokens, OTP provider secrets, database URLs, signing keys, or Cloudflare credentials.
- Use environment secrets for all production credentials.
- Disable or isolate the affected service until a critical vulnerability is remediated.
- Preserve security logs and timestamps for incident investigation.

## Security baseline

The target baseline is OWASP ASVS Level 2, with additional controls for sensitive health and employment data.
