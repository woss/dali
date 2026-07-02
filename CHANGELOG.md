# Changelog

## [Unreleased]

### Added

- Changesets versioning workflow — `pnpm changeset`, `pnpm version-packages`, `pnpm release` scripts
- End-to-end changesets verification — test changeset creation, version bump, changelog generation, and cleanup validated
- Profile settings page — name and email update form on `/settings` with validation, email uniqueness check, and session cookie resigning on email change
- Name field on registration form — users can now set a display name at signup
- User name displayed in navbar (falls back to email when name is not set)
- `+layout.server.ts` loads user name from database and passes it to all pages
- Settings tests for profile update action (name/email validation, uniqueness, cookie resign)

### Changed

- Publish workflow uses `changesets/action` instead of manual version bump + tag detection
- Changeset changelog config refined to array format with `repo: "woss/dali"` option for correct GitHub release note links
- `users` table schema now includes `name` field
- Settings page reorganized with Profile section above Config and API Keys
