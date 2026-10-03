# Griff Credits

A staff tool for tracking customers' credits at the Griff. Staff sign in with a
**username + PIN**, look up a customer, load credits onto their balance, and
take credits off as they spend. Customers don't sign in (yet). See
`src/future/CustomerSelfView.tsx` for a parked "check my own balance" screen.

**Roles**

- **Staff**: add customers, edit their details, load and spend credits.
- **Admin**: everything staff can do, plus add and remove staff accounts.

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
customers/{id}                        name, notes, balance, lastTxId, createdBy
customers/{id}/transactions/{txId}    amount (+ loaded / − spent), balanceAfter, note, createdBy (staff uid), createdAt
```

`firestore.rules` enforces:

- Only staff can read or change anything; removing a staff record revokes access.
- Only admins can add, change or remove staff (and can't remove themselves).
- New customers start at zero. Every balance change must be written together
  with a new ledger entry whose amount matches the change, so the balance
  always adds up, and each entry records which staff member made it.
- Balances can't go below zero; ledger entries can't be edited or deleted.
- First-time setup (the first admin) can only happen once.

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
| `npm run test:rules` | Security-rules tests against the Firestore emulator |

## Project layout

```
src/
  firebase.ts        Firebase init (+ emulator wiring)
  pin.ts             username/PIN ↔ Firebase credential mapping
  services.ts        sign in, setup, staff + customer management, credits, live queries
  AuthContext.tsx    current user + profile
  components/        Login (PIN pad + first-time setup), Dashboard, CustomersView, StaffView, …
  future/            parked, unused code (customer self-view)
firestore.rules      security rules
tests/               rules tests
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
