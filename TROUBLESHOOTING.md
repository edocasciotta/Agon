# Troubleshooting Agon

This guide covers the most common problems you might encounter and how to fix them. Each section describes what you will see, what causes it, and the steps to resolve it.

If your problem is not listed here, open an issue on GitHub and include your operating system, what you were doing when the problem occurred, and any error messages you saw.

---

## "Port 8000 is already in use"

### What you see

A dialog box appears when starting Agon that says **"Port 8000 is already in use"** and the application closes.

### Why it happens

Agon's backend server needs to use port 8000 on your computer. Another application — or a previous Agon session that did not close cleanly — is already using that port.

### How to fix it

**On macOS or Linux:**

Open the Terminal application and run:

```bash
lsof -ti:8000 | xargs kill -9
```

This finds whatever is using port 8000 and stops it. Then restart Agon.

**On Windows:**

Open Command Prompt (search for "cmd" in the Start menu) and run:

```
netstat -ano | findstr :8000
```

This shows a list of processes. Look for the number in the last column (the PID). Then run:

```
taskkill /PID <number> /F
```

Replace `<number>` with the PID you found. Then restart Agon.

If you see nothing in the list, try restarting your computer — a previous Agon session may have left the port in a stuck state.

---

## "Backend did not start within 30 seconds"

### What you see

A dialog box appears after starting Agon that says **"The backend service did not start within 30 seconds"** and the application closes.

### Why it happens

The most common causes are:

- Python is not installed or is not accessible from the terminal.
- The Python dependencies were not installed (or installation failed partway through).
- Port 8000 is in use by something else (see the section above).

### How to fix it

**Step 1 — Check that Python is installed:**

Open a terminal and run:

```bash
python3 --version
```

You should see something like `Python 3.11.x`. If you see an error, install Python from [python.org](https://python.org) and try again.

**Step 2 — Reinstall dependencies:**

```bash
cd backend
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Step 3 — Check for port conflicts:**

Follow the port conflict steps in the section above.

**Step 4 — Restart Agon.**

If the problem continues after these steps, open the terminal where you started Agon and look for any red error messages from the backend. Include those in your GitHub issue.

---

## Cloudflare Tunnel is not connecting

### What you see

In the Settings section under Connectivity, the tunnel status shows **"Disconnected"** or **"Error"**. Clients using the mobile app cannot reach your studio.

### Why it happens

- The tunnel token has not been configured.
- Your internet connection is down or interrupted.
- The token has expired or been revoked from your Cloudflare account.

### How to fix it

**Step 1 — Check your internet connection.**

Make sure your computer can access the internet. If other websites work, your connection is fine.

**Step 2 — Check the token in Agon.**

Go to **Settings > Connectivity** in Agon and verify that a tunnel token is entered. If the field is empty, the tunnel cannot start.

**Step 3 — Get a new token if needed.**

Go to [dash.cloudflare.com](https://dash.cloudflare.com), sign in, and navigate to **Zero Trust > Networks > Tunnels**. Find your studio's tunnel (or create a new one), copy the token, and paste it into Agon's Settings > Connectivity page.

**Step 4 — Restart Agon** after saving the new token.

---

## The automatic backup did not run

### What you see

You check the `backend/backups/` folder and find no new file after midnight, or the most recent file is from several days ago.

### Why it happens

- Agon was not running at midnight. Backups only run while the application is open.
- The `backend/backups/` directory does not exist or Agon does not have permission to write to it.

### How to fix it

**Step 1 — Check if Agon was running at midnight.**

Backups are triggered automatically while the app is open. If you close Agon at the end of the day, no backup will run until the next time it is open past midnight.

**Step 2 — Check the backups directory.**

Open the `backend/backups/` folder. If it does not exist, create it:

```bash
mkdir -p backend/backups
```

On macOS or Linux, check that Agon has write permission:

```bash
ls -ld backend/backups
```

The output should show read and write permissions for your user account.

**Step 3 — Take a manual backup now.**

You do not need to wait for the automatic backup. Copy `backend/agon.db` to a safe location at any time while Agon is closed:

```bash
cp backend/agon.db backend/backups/manual-backup-$(date +%Y%m%d).db
```

---

## The mobile app shows "Cannot connect to studio"

### What you see

Clients open the Agon mobile app and see a message saying they cannot connect to the studio. Bookings and the class schedule do not load.

### Why it happens

- The Cloudflare Tunnel is not running on your desktop machine (the most common cause).
- The studio URL configured in the mobile app is wrong or outdated.
- A firewall on your network is blocking the connection.

### How to fix it

**Step 1 — Check the tunnel status on your desktop.**

Open Agon on the studio's computer and go to **Settings > Connectivity**. The tunnel status should show **"Connected"**. If it shows anything else, follow the tunnel troubleshooting steps in the section above.

**Step 2 — Check the studio URL in the mobile app.**

The URL must begin with `https://`. If a client scanned the QR code from an old printout, it may point to an expired URL. Print a new QR code from **Settings > Connectivity** and ask the client to scan it again.

**Step 3 — Check for firewall or network blocks.**

If the tunnel shows Connected on your desktop but clients still cannot reach the studio, the issue may be a firewall rule on your office network. Try connecting from a mobile data connection (not the studio Wi-Fi) to confirm.

---

## Login error: "Invalid credentials"

### What you see

A user tries to log in and receives a message saying their credentials are invalid.

### Why it happens

There are three distinct reasons this message can appear:

- **Wrong password** — the password entered does not match the one on file.
- **Account not active** — the account exists but has been deactivated.
- **Account not found** — no account exists with that email address.

The login screen shows the same generic message in all three cases (this is intentional — it prevents people from discovering which email addresses are registered).

### How to fix it

**If the user forgot their password:**

Log in as a manager and go to **Clients** (or **Staff**, depending on the account type). Find the user's account and use the **Reset Password** option. The user will receive a new temporary password or a reset link.

**If the account is deactivated:**

In the account list, look for a status indicator. Deactivated accounts are shown with a greyed-out status. Open the account and use the **Reactivate** option.

**If the account does not exist:**

The email address may have a typo. Ask the user to confirm their registered email address. If they are a new client, create their account from the **Clients** section.

---

## "Alembic migration failed" on startup

### What you see

When Agon starts, an error appears in the terminal or log output mentioning **Alembic**, **migration**, or **database**. The application may close or start in a broken state.

### Why it happens

- The database file has been corrupted (for example, by a crash during a write).
- A migration was applied partially and left the database in an inconsistent state.
- You are running an older database file with a newer version of Agon that expects schema changes.

### How to fix it

**Step 1 — Back up the current database before doing anything else.**

Even if it is corrupted, copy it now in case you need to recover any data later:

```bash
cp backend/agon.db backend/agon.db.broken-backup
```

**Step 2 — Restore from the most recent clean backup.**

Look in `backend/backups/` and find the most recent file. Copy it over the main database:

```bash
cp backend/backups/<most-recent-backup-file>.db backend/agon.db
```

**Step 3 — Restart Agon.**

The migration should now succeed against the restored database.

**Step 4 — If the problem continues**, open the terminal output and copy the full error message. Include it in a GitHub issue along with the version of Agon you are running.

> Any data recorded between the backup date and the time of corruption cannot be recovered. This is why regular backups — and enabling cloud backup during setup — are important.

---

## The application is slow or not responding

### What you see

The Agon interface takes a long time to load pages, actions like saving a booking feel sluggish, or the application appears frozen for several seconds at a time.

### Why it happens

The most common cause after extended use is that the database has grown large enough that certain queries slow down. This is a known limitation in V1 that will be addressed with additional database indexes in V1.1.

Less commonly, it may be caused by another application on the same computer consuming most of the available memory or CPU.

### Temporary workarounds

**Check for slow API requests:**

Open the Agon developer tools (`Ctrl + Shift + I` on Windows/Linux, `Cmd + Option + I` on macOS) and click the **Network** tab. Reload the slow page and look for any requests that take more than a second to complete. Note the request path and include it in a GitHub issue — this helps identify which queries need optimization.

**Restart the application:**

Closing and reopening Agon releases cached memory and restarts the backend process, which often improves performance temporarily.

**Check available disk space:**

If your computer is nearly out of disk space, database writes can slow down significantly. Make sure you have at least a few gigabytes free.

> Permanent fix: a performance improvement pass with database index optimization is scheduled for V1.1. If your studio has a large number of clients or bookings and performance is significantly impacted, open an issue on GitHub with details about your dataset size.
