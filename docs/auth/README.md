# Authentication and users

## Model (`auth_app.User`)

The project uses a custom user model (`AUTH_USER_MODEL = auth_app.User`) extending Django’s `AbstractUser`. Notable fields:

| Field | Purpose |
|-------|---------|
| `email` | Unique login identifier (`USERNAME_FIELD`). |
| `uuid` | Stable public identifier (UUID v4), used for per-user storage directories. Immutable after creation. |
| `default_format` / `default_quality` | Defaults for new downloads from the dashboard. |
| `storage_retention_days` | Per-user retention for completed files on disk (default `7`). `0` disables automatic deletion. |

## API

- **Register** `POST /auth/register/` — returns `user` (including `uuid`) and JWT pair.
- **Login** `POST /auth/login/` — body uses `email` + `password` (see SimpleJWT customisation if extended).
- **Current user** `GET/PATCH /auth/me/` — read/update profile; writable subset includes `storage_retention_days`.
- **Password** `POST /auth/me/password/` — change password with old password verification.

## Security notes

- JWT access/refresh lifetimes are configured in `config/settings/base.py` (`SIMPLE_JWT`).
- Rate limits apply to register/login views (`django-ratelimit`).
