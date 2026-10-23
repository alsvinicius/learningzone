# Pre-Test Review

## Last-minute priorities
- Check timeout boundaries before selecting a retry policy.

## Timeout boundaries
- A request deadline bounds the complete operation; a connection timeout only bounds connection establishment.
- Retrying a non-idempotent write can repeat its side effects; use an idempotency key when supported.
