Referral loan changes will use additive migrations, immutable historical records, idempotent wallet references, audit events, and existing backup/restore gates.

Production dependency safety: the transitive `nanoid` dependency is pinned and lock-synchronized at `3.3.18`; deployment remains gated by `npm ci`, Security Audit, data-safety snapshots, encrypted D1 backup, and post-migration comparison.
