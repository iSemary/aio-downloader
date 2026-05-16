---
name: aio-downloader-testing
description: >-
  Runs and maintains tests for both backend (pytest) and frontend (vitest)
  in AIO Downloader. Use when writing new tests, fixing test failures,
  or when the user mentions testing, CI, or coverage.
---

# AIO Downloader — Testing

## Backend (pytest)

- Tests live in `backend/apps/*/tests/`
- Uses **pytest** (not Django's built-in test runner)
- Run with `cd backend && python -m pytest`
- Django's `settings.development` is used (SQLite in-memory for tests)
- Test patterns:
  - **API tests**: use `django.test.Client` or DRF's `APITestCase` / `APIClient`
  - **Model tests**: plain pytest functions with `@pytest.mark.django_db`
  - **Task tests**: test Celery task logic directly (call the underlying function)
- Factories: custom factory functions (no factory_boy dependency detected)

## Frontend (vitest)

- Tests live in `frontend/src/**/__tests__/`
- Run with `cd frontend && npm run test` (vitest)
- **Component tests**: use `@testing-library/react` with `vitest`
- **Store tests**: test Zustand stores directly (no rendering needed)
- **Locale tests**: verify translation files have matching keys
- Test file naming: `*.test.jsx` (components) or `*.test.js` (pure logic/stores)

## Commands

```bash
cd backend && python -m pytest                           # All backend tests
cd backend && python -m pytest -x                         # Fail fast
cd backend && python -m pytest apps/downloader/tests/     # Single app
cd backend && python -m pytest -k "test_name"             # Single test

cd frontend && npm run test                               # All frontend tests
cd frontend && npm run test -- --run                       # Single run (no watch)
cd frontend && npm run test -- src/pages/__tests__/Login.test.jsx  # Single file
```

## Conventions

- Backend: each app's `tests/` dir contains `__init__.py`
- Frontend: test files mirror the source tree under `__tests__/`
- Do not commit `.pytest_cache/` or `__pycache__/` dirs
- When adding a new feature, add tests in the same PR/commit
- Run linter after test changes: `cd frontend && npm run lint`
