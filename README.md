# Spike Creations — Backend API

A real backend for the `spike-creations-tracker.html` frontend. It fixes the
original demo's stated limitations:

- Data now persists to disk (`data/db.json`) instead of living only in
  browser memory — refreshing the page no longer wipes it.
- Login is real: passwords are hashed with bcrypt and sessions are signed
  JWTs, instead of a hardcoded in-page check.
- Multiple people can now share the same data, since it all lives on one
  server instead of a private copy per browser tab.

It's still intentionally simple (JSON-file storage, no ORM) — swap in
Postgres/MySQL later by replacing `src/db.js` if you outgrow it.

## 1. Setup

```bash
npm install
cp .env.example .env     # edit JWT_SECRET before deploying anywhere real
npm start                 # runs on http://localhost:4000
```

The database file is created and seeded automatically on first run at
`data/db.json`. To wipe it back to the original seed data at any time:

```bash
npm run seed:reset
```

## 2. Demo accounts (seeded)

Same as the original frontend's hardcoded list — now with hashed passwords
server-side:

| username     | password          | department   |
|--------------|--------------------|--------------|
| admin        | admin123           | Admin (isAdmin) |
| MD           | Spike Creations    | MD (isAdmin) |
| production1  | pass123            | Production   |
| cutting1     | pass123            | Cutting      |
| quality1     | pass123            | Quality      |
| planning1    | pass123            | Planning     |
| merch1       | pass123            | Merchandise  |
| hr1          | pass123            | HR           |
| accounts1    | pass123            | Accounts     |
| docs1        | pass123            | Documentation|
| fabric1      | pass123            | Fabric       |
| ironing1     | pass123            | Ironing      |
| packaging1   | pass123            | Packaging    |
| store1       | pass123            | Store        |
| feeding1     | pass123            | Feeding      |
| sampling1    | pass123            | Sampling     |
| erp1         | pass123            | ERP Data Entry |

## 3. API reference

All routes except `/api/health` and `/api/auth/login` require:
`Authorization: Bearer <token>`

### Auth

- `POST /api/auth/login` — `{ username, password }` → `{ token, user }`
- `GET /api/auth/me` — current user + which section IDs they can access

### Departments / config

- `GET /api/departments` — department list, exec accounts, which
  departments have no generic log, which use mins/hrs/days, line & unit
  options (everything the frontend needs to render tabs/forms)

### Entries (Factory Feed)

- `GET /api/entries?department=CUTTING&today=true` — list entries,
  optionally filtered
- `POST /api/entries` — create an entry for your own department. Body:
  `{ task, quantity, unit, timeTakenMinutes, line, worker, remarks,
  styleNumber, finishingDate }`. Rejected with 403 if your department is
  one of the "no generic log" departments (Merchandise, HR, Accounts,
  Documentation) — use Sections instead. Admin/MD accounts may pass
  `department` explicitly to log on behalf of any department.

### Sections (cross-department workflows)

- `GET /api/sections` — sections visible to you, each with `canFill`
  telling you whether you're allowed to submit new entries to it
  (Planning can always fill every section; everyone else only the
  section(s) their department owns)
- `GET /api/sections/:id/entries` — entries for one section (403 if you
  can't view that section)
- `POST /api/sections/:id/entries` — `{ values: { fieldKey: value, ... } }`
  (403 if your department isn't allowed to submit to it)

### Admin dashboard

- `GET /api/summary/today` — admin/MD only. Entries today, active
  departments, hours logged, and a per-department breakdown.

## 4. Wiring it into the existing HTML

The frontend currently keeps everything in in-memory JS arrays
(`entries`, `sectionEntries`, hardcoded `USERS`). To connect it to this
backend:

1. Replace `doLogin()` with a `fetch('/api/auth/login', {method:'POST', ...})`
   call, store the returned `token` (e.g. in a JS variable — avoid
   `localStorage` if this ever runs inside an artifact/sandboxed iframe).
2. Replace the local `entries` / `sectionEntries` arrays with `fetch`
   calls to `GET /api/entries` / `GET /api/sections/:id/entries` on load
   and after every submit.
3. Replace `submitEntry()` / `submitSectionEntry()` bodies with `POST`
   calls to the matching endpoint, sending the JWT in the
   `Authorization` header.
4. Point the admin dashboard's `renderAdminDashboard()` data source at
   `GET /api/summary/today`.

Happy to make those edits directly in the HTML file if you'd like a
fully wired version — just say the word.

## 5. The frontend is already wired up

`public/index.html` is the same tracker page you started with, edited so
login, the feed, entry submission, and Sections all call this backend's
API instead of using fake in-memory data. When you run `npm start`, the
whole app — page and API — is available at `http://localhost:4000`, one
URL, nothing else to connect.

## 6. Putting it online (no coding required)

The easiest free way to get a public web address, using **Render**:

1. Go to render.com and sign up (free — you can sign up with GitHub).
2. If you don't already have a GitHub account, make one at github.com
   (also free).
3. On GitHub, click "New repository," give it any name (e.g.
   `spike-tracker`), leave it Public or Private, click "Create repository."
4. On the new repo's page, click "uploading an existing file" and drag
   the entire `spike-backend` folder's contents into the browser (unzip
   the download on your computer first, then drag all the files/folders
   in). Click "Commit changes."
5. Back on Render: click "New" -> "Web Service," connect your GitHub
   account, and pick the repo you just created.
6. Render will ask for a few settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
7. Scroll to "Environment Variables" and add one:
   - Key: `JWT_SECRET`  Value: any long random string (mash the keyboard)
8. Click "Create Web Service." Render will build and start it — after a
   minute or two you'll get a public URL like
   `https://spike-tracker.onrender.com`. That's the link to share with
   your team.

**One important note on the free tier:** Render's free plan uses a disk
that gets wiped on redeploy, so `data/db.json` won't persist long-term.
For real team use, add a Render "Persistent Disk" (a paid add-on, a few
dollars/month) mounted on the `data` folder — or tell me and I can
switch storage to a proper hosted database instead of the JSON file,
which is the sturdier option once this is in real use.
