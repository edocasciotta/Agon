# Deploying Agon

This guide explains how to install and run Agon on your computer. No technical background is required for the standard installation path.

---

## Prerequisites

These requirements only apply if you are running Agon from source code (Option B). If you download a pre-built executable in the future, you will not need any of these.

- **Python 3.11 or newer** — check with `python3 --version`
- **Node.js 20 or newer** — check with `node --version`
- **npm** (comes bundled with Node.js)
- **Git** — for cloning the repository and updating

---

## Option A: Pre-built Executable

> **Note: Not yet available.** A downloadable installer for Windows, macOS, and Linux is planned for release V1.1. When it is ready, it will appear on the [GitHub Releases page](https://github.com/your-org/agon/releases).
>
> Once available, installation will be:
> 1. Download the installer for your operating system from the Releases page.
> 2. Extract or run the installer.
> 3. Launch the Agon application.
>
> The pre-built version bundles everything — no Python or Node.js installation needed.

---

## Option B: Run from Source

Follow these steps in order. Each step must complete without errors before moving to the next.

### 1. Clone the repository

```bash
git clone https://github.com/your-org/agon.git
cd agon
```

### 2. Set up the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

> **Windows:** use `.venv\Scripts\activate` instead of `source .venv/bin/activate`

Install the required Python packages:

```bash
pip install -r requirements.txt
```

Initialize the database:

```bash
alembic upgrade head
```

This creates the `agon.db` database file in the `backend/` directory.

### 3. Set up environment variables (optional)

Copy or create a file called `.env` inside the `backend/` directory. Most variables are auto-generated on first run, but if you want to configure the AI assistant or Stripe payments, fill them in here:

```
DATABASE_URL=sqlite:///./agon.db
AGON_JWT_SECRET=          # auto-generated on first run
AGON_SECRET_KEY=          # auto-generated on first run
LLM_PROVIDER=groq
LLM_MODEL=groq/llama-3.3-70b-versatile
LLM_API_KEY=              # free at console.groq.com — enables the AI assistant
STRIPE_SECRET_KEY=        # optional — required for online payments
STRIPE_WEBHOOK_SECRET=    # optional
```

### 4. Launch the application

**For development (with hot reload):**

```bash
cd ../frontend
npm install
npm run dev
```

**For production (built app):**

```bash
cd ../frontend
npm install
npm run build
npm run start
```

The Electron window will open automatically. When running in production mode, the backend starts automatically in the background — you do not need to start it separately.

---

## First Run

The first time you open Agon, a setup wizard will walk you through five steps:

1. **Studio details** — your studio name, address, and timezone.
2. **Admin account** — create the manager account (email and password).
3. **Connectivity** — Agon sets up a secure public URL for your studio in the background. This allows your clients' mobile app to connect to your studio. No router configuration is needed.
4. **Payments** *(optional)* — connect your Stripe account if you want to accept online payments. You can skip this and set it up later from Settings.
5. **Cloud backup** *(optional but strongly recommended)* — link a Google Drive or Dropbox account for automatic off-site backups.

At the end of setup, Agon generates a QR code. Print it and place it at your reception desk — clients scan it once with the Agon mobile app to connect to your studio.

---

## Updating Agon

To update to the latest version:

```bash
git pull
```

Then update dependencies and apply any database changes:

```bash
cd backend
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head

cd ../frontend
npm install
npm run build
```

Database migrations run automatically and are safe to apply — they never delete existing data.

---

## Where Logs Are Written

Agon writes log output to the console (the terminal window you used to start it) and to the Electron developer tools.

- **Backend logs** appear in the terminal where you ran `npm run dev` (or are piped through Electron when running in production mode).
- **Frontend and Electron logs** appear in the browser developer tools, which you can open with:
  - **Windows / Linux:** `Ctrl + Shift + I`
  - **macOS:** `Cmd + Option + I`

Logs are not currently written to a file on disk. If you need to capture logs for troubleshooting, redirect the terminal output or copy from DevTools.

---

## Database Location

Agon stores all studio data in a single file:

```
backend/agon.db
```

To make a manual backup, simply copy this file to a safe location while Agon is not running. That copy contains everything — clients, classes, bookings, memberships, and settings.

---

## Backup and Restore

### Automatic backups

Agon creates a backup of the database every night at midnight. Backups are saved in:

```
backend/backups/
```

Up to 30 days of backups are kept. Older files are deleted automatically.

If you configured cloud backup during setup, copies are also sent to your Google Drive or Dropbox.

### Manual restore

If you need to restore from a backup:

1. **Stop Agon** completely (close the application window).
2. Find the backup file you want to restore from inside `backend/backups/`.
3. Copy that file to `backend/agon.db`, replacing the existing file.
4. Restart Agon.

> Any activity recorded between the backup date and now will be lost after a restore. Always restore from the most recent backup available unless you are deliberately rolling back to an earlier state.

---

## Running on a VPS

It is possible to run Agon on a Linux virtual private server (a rented cloud machine) so that the studio management interface is accessible from a web browser rather than a desktop application. This setup requires manually configuring a process manager such as **systemd**, **screen**, or **pm2** to keep the backend running after you close your terminal session, along with a reverse proxy (such as Nginx) to serve the frontend.

This configuration is possible but not officially documented yet. Full VPS deployment documentation is planned for V1.1. If you are comfortable with Linux server administration, the setup follows a standard FastAPI + static files deployment pattern.
