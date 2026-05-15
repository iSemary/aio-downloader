# Tooling

## Postman

- **Collection** — `postman/collection.json`
- **Environment** — `postman/environment.json`

Import both into Postman and set the `base_url` / auth variables as needed for your deployment.

## Test user seeding

Management command: `apps.auth_app.management.commands.seed_test_user`.

```bash
cd backend
python manage.py seed_test_user
```

Defaults and overrides: see `backend/.env.example` (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `--force`).

## Related code

- `backend/manage.py` — Django entry.
- `backend/apps/auth_app/management/commands/seed_test_user.py` — implementation.
