# Agon — Operations Runbook

This document covers day-to-day operations for a studio manager running an Agon instance.

---

## 1. Updating Agon

Agon is distributed as a self-contained Electron application. Updates are applied as follows:

1. **Back up your database first** (see section 2).
2. Download the new installer from the Agon releases page (GitHub → Releases).
3. Run the installer — it replaces the previous version without touching your data.
4. Launch Agon. The application runs database migrations automatically on startup. You will see a brief "Migrating database…" message in the status bar.
5. Verify the application opens and your data is intact.

> **If the migration fails:** Do not restart the app. Close it, restore your backup (section 3), and open a GitHub issue with the error log from `~/Library/Application Support/Agon/logs/main.log` (macOS) or `%APPDATA%\Agon\logs\main.log` (Windows).

---

## 2. Manual Database Backup

The database is a single SQLite file. Automated backups run nightly at 02:00 local time and are stored in the `backups/` folder next to the application data directory.

### Locate the database

| Platform | Default path |
|----------|-------------|
| macOS    | `~/Library/Application Support/Agon/agon.db` |
| Windows  | `%APPDATA%\Agon\agon.db` |
| Linux    | `~/.config/Agon/agon.db` |

### Create a manual backup

```bash
# macOS / Linux
cp ~/Library/Application\ Support/Agon/agon.db \
   ~/Agon-backup-$(date +%Y%m%d).db

# Windows (PowerShell)
Copy-Item "$env:APPDATA\Agon\agon.db" `
          "$env:USERPROFILE\Agon-backup-$(Get-Date -Format yyyyMMdd).db"
```

Automated backups are in `backups/` in the same directory as `agon.db`, named `agon_backup_YYYYMMDD_HHMMSS.db`.

---

## 3. Restore from Backup

1. **Quit Agon completely** — the database must not be in use.
2. Copy the backup file over `agon.db`:

   ```bash
   # macOS / Linux
   cp ~/Agon-backup-20260101.db \
      ~/Library/Application\ Support/Agon/agon.db

   # Windows (PowerShell)
   Copy-Item "$env:USERPROFILE\Agon-backup-20260101.db" `
             "$env:APPDATA\Agon\agon.db"
   ```

3. Launch Agon and verify data is correct.

> **Note:** Restoring to an older backup means losing any data created after that backup. If you need to recover specific records rather than roll back entirely, open the backup file with any SQLite browser (e.g. [DB Browser for SQLite](https://sqlitebrowser.org)) and copy the rows manually.

---

## 4. Finding Logs

| Log type | Location |
|----------|----------|
| Backend (FastAPI) | Printed to the Electron terminal output during dev; in production: `~/Library/Application Support/Agon/logs/backend.log` |
| Electron main process | `~/Library/Application Support/Agon/logs/main.log` |
| Background tasks (backup, reminders) | Same `backend.log` — search for `[scheduler]` |

**What to look for:**

- `ERROR` lines indicate unhandled failures.
- `WARNING` lines indicate recoverable issues (e.g. backup created but cleanup failed).
- `[scheduler]` lines show background task activity.
- `uvicorn` access log shows every HTTP request with status code and latency.

---

## 5. Cloudflare Tunnel

The Cloudflare Tunnel gives your clients a public HTTPS URL to connect the mobile app. It requires a free Cloudflare account.

### Initial setup

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com) → Access → Tunnels → Create tunnel.
2. Name the tunnel (e.g. `my-studio`).
3. Copy the tunnel token.
4. In Agon Settings → Connectivity, paste the token and click **Connect**.
5. Agon starts `cloudflared` in the background. The public URL appears in the settings page (e.g. `https://my-studio.trycloudflare.com`).
6. Print the QR code (Settings → Connectivity → Print QR Code) and give it to your clients.

### If the tunnel goes down

1. Open Agon Settings → Connectivity.
2. Click **Disconnect**, wait 5 seconds, click **Connect** again.
3. If the URL changes, reprint and redistribute the QR code.
4. If the tunnel fails to start, check that `cloudflared` is installed (`cloudflared --version` in a terminal). If not, download it from [developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

---

## 6. Stripe Configuration

Stripe is optional. Skip this section if you handle payments outside Agon.

### Test mode vs live mode

- Use **test mode** keys during setup to verify the integration without real charges.
- Switch to **live mode** keys when ready to accept real payments.
- Keys are in the Stripe dashboard under Developers → API keys.

### Configure in Agon

1. Agon Settings → Payments → Stripe.
2. Paste your **Secret key** (`sk_live_...` or `sk_test_...`).
3. For webhooks, paste your **Webhook signing secret** (`whsec_...`). The webhook endpoint URL to register in Stripe is shown in the settings page.
4. Click **Save** and then **Test connection** to verify.

### What Stripe processes

- Membership purchases via the client mobile app.
- Recurring subscription renewals (Stripe handles the schedule).
- Refunds (initiated from Agon → Payments → Refund).

Agon never stores card numbers. Stripe handles all PCI-DSS scope.

---

## 7. Monitoring Checklist

Run these checks weekly or after any update:

- [ ] Backend responds: visit `http://localhost:8000/health` in a browser — should return `{"status": "ok"}`.
- [ ] Nightly backup file exists: check the `backups/` folder for a file dated today.
- [ ] Cloudflare tunnel is connected: green indicator in Settings → Connectivity.
- [ ] No ERROR lines in `backend.log` from the last 24 hours.
- [ ] Test a booking end-to-end with your own client account.
