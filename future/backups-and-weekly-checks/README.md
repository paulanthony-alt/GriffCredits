# Backups and weekly checks (parked: not running)

Saved for later. **Nothing in this folder runs** while it's here: GitHub only
runs workflows from the repository's own `.github/workflows/` folder.

What's here:
- **Daily encrypted backup** of the whole database, kept 90 days
  (`.github/workflows/backup.yml`)
- **One-click restore**, which saves the current data first
  (`.github/workflows/restore.yml`)
- **Weekly check**: tests, a security check of the app's libraries, a live-site
  check, and a check that every customer's balance matches their history
  (`.github/workflows/weekly-check.yml`)
- The scripts they use (`scripts/`) and their tests (`tests/backup.test.ts`)

The tests still run with the rest of the app's tests, so this keeps working
while it waits.

## Switching it on

1. Move this folder's contents back to the top of the repository, keeping the
   same layout:
   - `.github/workflows/backup.yml`, `restore.yml`, `weekly-check.yml` → `.github/workflows/`
   - `scripts/` → `scripts/`
   - `tests/backup.test.ts` → `tests/backup.test.ts`

   Then delete this folder. (Or ask Claude to "switch on the parked backups".)
2. Optionally add these to `package.json` → `"scripts"`:
   ```json
   "backup": "tsx scripts/backup.ts",
   "restore": "tsx scripts/restore.ts",
   "check:data": "tsx scripts/check.ts"
   ```
3. Add the `BACKUP_PASSWORD` secret and do a first run, as described below.

## What it does, and how to use it

**Daily backup:** every morning (07:17 UTC) GitHub copies the whole database
(customers, their full history, staff records) into a file, **encrypts it with
a password**, and keeps it for 90 days. The encryption matters because the
repository is public, so anyone could otherwise download the file.

**Weekly check:** every Monday (07:47 UTC) GitHub:
- runs all the app's tests;
- looks for known security problems in the app's libraries;
- checks the live site is up;
- checks every customer's balance adds up to their history.

If anything fails, it opens a GitHub **issue**, which emails you, and closes
it again by itself once things are fixed. Reports only ever show random record
IDs, never names or balances.

### One-time setup: the backup password

1. Make up a long password, e.g. four random words. **Write it down and keep it
   somewhere safe outside GitHub.** Without it, the backups can't be opened.
2. On GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**. Name: `BACKUP_PASSWORD`, Secret: your password → **Add secret**.
3. Check it works: **Actions → Daily backup → Run workflow**. After a minute
   it should show a green tick and a file under **Artifacts**.
4. Optionally, do the same for **Actions → Weekly check → Run workflow**.

Never change `BACKUP_PASSWORD` once backups exist: older backups need the
password they were made with.

### Restoring a backup

Only do this if the data has actually gone wrong. It replaces **all** current
customers, history and staff records with the backup's.

1. Go to **Actions → Daily backup** and click the run from the day you want to
   go back to. Its address ends in a number, e.g.
   `.../actions/runs/37137614900`. That number is the **run ID**.
2. Go to **Actions → Restore from backup → Run workflow**. Enter the run ID and
   type `RESTORE` in the confirm box, then click **Run workflow**.
3. Before restoring, it saves a backup of the current data. If you restored the
   wrong one, the run's summary gives the run ID to undo it.

Staff logins (usernames and PINs) aren't affected by a restore.

### Recommended: make the repository private

GitHub **pauses scheduled jobs (backups and weekly checks) in public
repositories after 60 days without any changes**. A private repository doesn't
have that limit, and keeps the code and job logs private too. Make it private
under **Settings → General → Danger Zone → Change repository visibility**.
Private repositories get 2,000 free minutes of GitHub Actions a month, and
these jobs use well under 100.
