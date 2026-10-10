# Griff Credits

A staff tool for tracking customers' credits at the Griff. Staff sign in with a
**username + PIN**, look up a customer, load credits onto their balance, and
take credits off as they spend. Customers don't sign in (yet). See
`src/future/CustomerSelfView.tsx` for a parked "check my own balance" screen.

**Roles**

- **Staff**: add customers, edit their details, load and spend credits.
- **Admin**: everything staff can do, plus add and remove staff accounts.

The Customers screen shows the **total credits out there** (the sum of every
customer's balance), which updates live on every device as credits are loaded,
spent or undone (`src/totals.ts`).

Built with React + TypeScript (Vite) and Firebase (Auth + Firestore).

## How PIN login works

Firebase Auth has no built-in PIN sign-in, so each username/PIN pair maps onto
a hidden email/password account (`src/pin.ts`):

| What staff type | What Firebase sees |
| --- | --- |
| username `sam` | `sam@staff.griffcredits.local` |
| PIN `1234` | password `griff-pin:1234` |

Firebase Auth's built-in rate limiting slows down PIN guessing. A 4–6 digit
PIN is still a short secret, so see **Hardening** below before real money is
involved.

## Data model & security

```
meta/setup                            exists once the first admin is created
staff/{uid}                           username, name, role (staff|admin)       people who sign in
customers/{id}                        name, notes, balanceCents, lastTxId, createdBy
customers/{id}/transactions/{txId}    amountCents (+ loaded / − spent), balanceAfterCents, note, createdBy (staff uid), createdAt
```

Credits work like dollars, with up to two decimal places. They're stored as
whole **cents** (15.65 credits = `1565`) so there's no floating-point rounding
(`src/money.ts`). Records from before cents were added hold whole credits in
`balance` / `amount` / `balanceAfter`; the app reads both, and a legacy
customer's balance is converted the first time it changes.

`firestore.rules` enforces:

- Only staff can read or change anything; removing a staff record revokes access.
- Only admins can add, change or remove staff (and can't remove themselves).
- New customers start at zero. Every balance change must be written together
  with a new ledger entry whose amount matches the change, so the balance
  always adds up, and each entry records which staff member made it.
- Balances can't go below zero; ledger entries can't be edited or deleted.
- **Undo** appends a reversing entry with id `undo-<original id>` and the exact
  opposite amount, so each entry can be undone once and an undo can't be undone.
- First-time setup (the first admin) can only happen once.

## Backups and weekly checks

GitHub Actions back up the database daily (encrypted, kept 90 days) and run a
weekly check: tests, a dependency security audit, a live-site check, and a
data health check that every balance matches its history. Failures open a
GitHub issue. Restoring is a one-click workflow that first backs up the current
data. Every week a password-protected **PDF report** (who has what, the week's
activity, and each customer's full history) is saved too, and admins can
download the same report from the app at any time (`src/report/`). Setup,
restore and download steps: [SETUP.md, section 9](SETUP.md#9-turn-on-backups-weekly-checks-and-weekly-reports).

## Getting started

### 1. Run locally with the Firebase emulators (no Firebase project needed)

Requires Node 20+ and Java (for the emulators).

```bash
npm install
npm run emulators                     # terminal 1: Auth + Firestore emulators (UI at http://localhost:4000)
VITE_USE_EMULATORS=true npm run dev   # terminal 2: app at http://localhost:5173
```

The first visit shows **first-time setup**: create the admin account, then add
staff from the **Staff** tab and customers from the **Customers** tab.

### 2. Connect a real Firebase project and go live

Follow **[SETUP.md](SETUP.md)**: create the project, add its settings to
`.env.production`, add one GitHub secret, and every push to `main` deploys
automatically via `.github/workflows/deploy.yml`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run emulators` | Local Auth + Firestore emulators |
| `npm run test:rules` | All tests (rules, backup/restore, health check) against the Firestore emulator |
| `npm run backup -- <file>` | Back up the live database to a JSON file (needs a service-account key) |
| `npm run restore -- <file> --yes-replace-everything` | Replace ALL live data with a backup |
| `npm run check:data -- [report.md]` | Check every balance against its history |
| `npm run report -- <file.pdf>` | Write the PDF report (set `REPORT_PASSWORD` to lock it, `REPORT_TIMEZONE` for dates) |

## Project layout

```
src/
  firebase.ts        Firebase init (+ emulator wiring)
  pin.ts             username/PIN ↔ Firebase credential mapping
  services.ts        sign in, setup, staff + customer management, credits, live queries
  AuthContext.tsx    current user + profile
  components/        Login (PIN pad + first-time setup), Dashboard, CustomersView, StaffView, …
  future/            parked, unused code (customer self-view)
scripts/             backup, restore, data health check and PDF report (run by GitHub Actions)
firestore.rules      security rules
tests/               tests
```

## Hardening / next steps

- **Admin PIN reset**: the browser can't change another user's password. Add a
  Cloud Function using the Admin SDK (`admin.auth().updateUser`).
- **Stronger PIN protection**: move sign-in into a Cloud Function that checks
  the PIN, locks out after N failures, and returns a custom token. Turn on
  Firebase App Check.
- **Customer self-view**: let customers sign in to check their balance; the
  steps are in `src/future/CustomerSelfView.tsx`.
- **Account clean-up**: removing a staff member revokes their access but leaves
  their Firebase login holding the username; delete it in the Firebase console
  if you want to reuse the name.
