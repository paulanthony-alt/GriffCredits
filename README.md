# Griff Credits

Track members' credits at the Griff. Members sign in with a **username + PIN**
to see their balance and history; admins add credits, record spending, and
create member accounts.

Built with React + TypeScript (Vite) and Firebase (Auth + Firestore).

## How PIN login works

Firebase Auth has no built-in PIN sign-in, so each username/PIN pair maps onto
a hidden email/password account (`src/pin.ts`):

| What the member types | What Firebase sees |
| --- | --- |
| username `dave` | `dave@members.griffcredits.local` |
| PIN `1234` | password `griff-pin:1234` |

Firebase Auth's built-in rate limiting slows down PIN guessing. A 4–6 digit
PIN is still a short secret, so see **Hardening** below before real money is
involved.

## Data model & security

```
meta/setup                        exists once the first admin is created
users/{uid}                       username, name, role (member|admin), balance, lastTxId
users/{uid}/transactions/{txId}   amount (+ added / − spent), balanceAfter, note, createdBy, createdAt
```

`firestore.rules` enforces:

- Members can read only their own profile and history.
- Only admins can create members or change balances.
- Every balance change must be written together with a new ledger entry whose
  amount matches the change, so the balance always adds up.
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
members from the admin screen.

### 2. Connect a real Firebase project

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method →** enable **Email/Password**.
3. **Firestore Database →** create a database.
4. **Project settings → Your apps →** add a Web app and copy its config.
5. `cp .env.example .env.local` and fill in the `VITE_FIREBASE_*` values.
6. Deploy the security rules (and optionally host the app):
   ```bash
   npx firebase login
   npx firebase use --add          # pick your project
   npx firebase deploy --only firestore:rules
   npm run build && npx firebase deploy --only hosting
   ```
7. Open the app and complete first-time setup **straight away**, since whoever
   does it first becomes admin.

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
  services.ts        sign in, setup, create member, adjust credits, live queries
  AuthContext.tsx    current user + profile
  components/        Login (PIN pad + first-time setup), MemberDashboard, AdminDashboard, …
firestore.rules      security rules
tests/               rules tests
```

## Hardening / next steps

- **Admin PIN reset**: the browser can't change another user's password. Add a
  Cloud Function using the Admin SDK (`admin.auth().updateUser`).
- **Stronger PIN protection**: move sign-in into a Cloud Function that checks
  the PIN, locks out after N failures, and returns a custom token. Turn on
  Firebase App Check.
- **Staff role**: a role that can record spending but not manage members.
- **Account clean-up**: if creating a member's profile fails after their login
  was created, the orphaned login has no access but still holds the username.
  Remove it in the Firebase console.
