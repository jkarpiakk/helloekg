---
name: Audit log field names
description: Correct field names for storage.createAuditLog() calls.
---

The `audit_log` table (and `InsertAuditLog` type) has these fields:
- `actorId` — UUID, **foreign key to users.id** — must be a valid user UUID, never a string like `'system'`
- `action` — varchar(100)
- `entityType` — varchar(50)  ← NOT `targetType`
- `entityId` — UUID  ← NOT `details` or `targetId`
- `diff` — JSON (optional)
- `ipAddress`, `userAgent` — optional

**Why:** Using wrong field names (targetType, details) silently drops the call or causes a TS/runtime error.

**How to apply:** When creating an audit log for a system-triggered event (e.g. webhook), use the userId of the affected user as actorId. There is no service-account UUID.
