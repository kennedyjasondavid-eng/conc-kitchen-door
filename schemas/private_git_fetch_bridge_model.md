# Inactive private Git browser bridge

The `private-git-fetch-bridge-v1` block implements the existing transport request contract using explicitly supplied native fetch, timer and AbortController capabilities. Construction performs no I/O. There are no production callers, default credentials, storage reads or migration.

The bridge captures a fixed repository/branch and admits only its metadata and immutable Git reads, plus the existing four-path `createCommitOnBranch` mutation. The transport remains responsible for private package validation, expected-head admission and exact immutable readback. The shared mutation document is unchanged.

Each request has a 15-second header-and-body deadline, route-specific byte limits enforced while streaming, detached returned buffers, omitted cookies and referrers, rejected redirects and fixed sanitized errors. Unknown response or cancellation outcomes never establish acceptance. Connection testing observes authenticated authority read-only and always reports `writeVerified:false`.

Synthetic tests prove the bounded implementation, not actual authentication, browser CORS, administrator credential installation or staff-device continuity. Native API canary, actual browser observation, current-source migration and serving activation remain separate gates. No public upload is authorized by this module.
