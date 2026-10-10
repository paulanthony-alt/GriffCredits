# Setting up Firebase and going live

This takes about 20 minutes, all in a web browser. When you're done, the app
lives at `https://<your-project-id>.web.app`, and every change merged into
`main` on GitHub goes live by itself.

Everything here fits in Firebase's free **Spark** plan. No credit card is needed.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with the Google
   account that should own the app (ideally a shared Griff account rather than
   someone's personal one).
2. Click **Create a project** (or **Add project**).
3. Name it, e.g. `griff-credits`. Firebase shows the **project ID** underneath,
   e.g. `griff-credits-a1b2c`. Note it down, because it becomes the web address.
4. Turn **Google Analytics off** (not needed), then **Create project**.

## 2. Turn on PIN login (Authentication)

1. In the left menu: **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, click **Email/Password**.
3. Switch on the **first** toggle (Email/Password). Leave "Email link
   (passwordless sign-in)" off. Click **Save**.

Staff never see an email address. The app turns each username and PIN into a
hidden email/password login behind the scenes.

## 3. Create the database (Firestore)

1. Left menu: **Build → Firestore Database → Create database**.
2. **Location**: pick the one closest to the Griff (e.g. `europe-west2 (London)`
   in the UK). **This can't be changed later.**
3. Choose **Start in production mode** and click **Create**.

"Production mode" locks everything down. The app's own security rules replace
that on the first deploy.

## 4. Turn on Hosting

Left menu: **Build → Hosting → Get started**. Click through the steps and skip
the command-line instructions, because GitHub handles deploying.

## 5. Register the web app and send over its settings

1. Click the **gear icon → Project settings**. On the **General** tab, scroll to
   **Your apps** and click the **`</>`** (Web) icon.
2. Nickname: `Griff Credits`. Leave "Also set up Firebase Hosting" unticked.
   Click **Register app**.
3. Firebase shows a block of code containing `const firebaseConfig = { ... }`.
   You need these six values:

   ```js
   apiKey: "...",
   authDomain: "....firebaseapp.com",
   projectId: "...",
   storageBucket: "....firebasestorage.app",
   messagingSenderId: "...",
   appId: "1:...:web:..."
   ```

4. **Either** paste that `firebaseConfig` block to Claude and ask for it to be
   added, **or** add it yourself on GitHub: open the repository, click
   **Add file → Create new file**, name it `.env.production`, and fill it in:

   ```
   VITE_FIREBASE_API_KEY=<apiKey>
   VITE_FIREBASE_AUTH_DOMAIN=<authDomain>
   VITE_FIREBASE_PROJECT_ID=<projectId>
   VITE_FIREBASE_STORAGE_BUCKET=<storageBucket>
   VITE_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>
   VITE_FIREBASE_APP_ID=<appId>
   ```

   These values are **not secret**. Every Firebase web app ships them to the
   browser. What protects your data is the login plus the security rules.

## 6. Let GitHub deploy to Firebase (one secret key)

GitHub needs a key that allows it to publish to your Firebase project.

> ⚠️ This key **is** secret. Only ever paste it into GitHub's Secrets page as
> described below. Don't send it in a chat, an email, or a file in the repo.

1. Open <https://console.cloud.google.com/iam-admin/serviceaccounts> and pick
   your Firebase project in the project picker at the top.
2. Click **+ Create service account**.
   - Name: `github-deploy` → **Create and continue**.
   - **Grant this service account access to project**: add these two roles:
     - **Firebase Admin**
     - **Service Usage Consumer**
   - **Continue → Done**.
3. Click the new `github-deploy@…` account → **Keys** tab → **Add key → Create
   new key → JSON → Create**. A `.json` file downloads.
4. On GitHub, open the repository → **Settings → Secrets and variables →
   Actions → New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: open the downloaded `.json` file in a text editor, copy **all** of
     it, and paste it here. Click **Add secret**.
5. Delete the downloaded `.json` file from your computer.

## 7. Go live

Deploys run whenever code lands on the `main` branch:

1. Merge the app's pull request into `main` (or, if it's already merged, open
   the **Actions** tab → **Deploy to Firebase** → **Run workflow**).
2. Watch the **Actions** tab. The run tests the security rules, builds the app,
   and deploys it. It takes a few minutes.
3. When it's green, the app is live at **`https://<project-id>.web.app`**. The
   address is also shown in the run's summary.

## 8. Create the admin account straight away

Open the live address. The first visit shows **Griff Credits setup**. Whoever
completes it becomes the admin, so do it right away:

1. Enter your name, a username and a 4–6 digit PIN → **Create admin account**.
2. Go to the **Staff** tab and add each member of staff with a starting PIN.
   They can change it themselves with **Change my PIN**.
3. Go to the **Customers** tab and start adding customers and loading credits.

**Tip for the bar tablet/phone:** open the site, then use **Add to Home Screen**
(Safari share menu, or the Chrome ⋮ menu). It then opens like an app.

## 9. Turn on backups and weekly checks

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

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Deploy fails: `.env.production is missing` | Do step 5. |
| Deploy fails: `FIREBASE_SERVICE_ACCOUNT ... missing` | Do step 6. Check the secret name is spelled exactly. |
| Deploy fails with `403`, `permission denied` or `PERMISSION_DENIED` | Check the service account has **both** roles from step 6, then re-run the workflow. |
| Deploy fails: `... API has not been used in project ...` | Open the link in the error, click **Enable**, wait a minute, re-run. |
| Deploy fails on Firestore rules | Make sure step 3 was completed (database created). |
| Site says "Griff Credits isn't connected yet" | `.env.production` is missing or incomplete. Check the six values from step 5. |
| Sign-in says "Wrong username or PIN" for everyone | Check Email/Password is enabled (step 2). |
| Backup or weekly check fails: `BACKUP_PASSWORD ... missing` | Do the backup password steps in section 9. |
| Restore fails: `Couldn't decrypt the backup` | `BACKUP_PASSWORD` was changed after that backup was made. Put the old password back temporarily. |
| A staff member forgot their PIN | For now, an admin removes them in the Staff tab, deletes their login under **Authentication → Users** in the Firebase console, and adds them again. |

## Custom domain (optional)

To use something like `credits.thegriff.co.uk`: Firebase console → **Hosting →
Add custom domain**, then follow the DNS instructions for wherever the domain
is registered.

## Deploying from your own computer instead (optional)

If you'd rather not use GitHub Actions, you need Node.js 20+:

```bash
npm install
npx firebase login
npm run build
npx firebase deploy --only hosting,firestore:rules --project <project-id>
```
