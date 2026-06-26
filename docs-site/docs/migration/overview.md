---
title: Migrating to Agon
sidebar_label: Migration Overview
---

# Migrating to Agon

This guide explains how to move your existing client data, memberships, and class schedule from your current platform into Agon. The migration assistant guides you through each step.

---

## How migration works

Agon's migration assistant does not connect to your old platform directly and does not ask for your login credentials. Instead, it guides you through obtaining your own data from your current platform and importing it.

This approach protects you legally (most platforms prohibit automated credential-based access) and keeps your credentials safe.

Migration happens in four phases:

1. **Get your data** — export it from your old platform
2. **Upload and map columns** — the assistant analyses your files and maps them to Agon's format
3. **Preview and import** — review what will be imported and confirm
4. **Invite clients** — send invitation emails so clients can set up their Agon accounts

---

## Supported file formats

The migration assistant accepts any CSV file. Excel files (.xlsx) are also supported. JSON exports from some platforms are accepted as well.

Agon also provides standard CSV templates if you want to prepare your data manually. See [Standard CSV templates](#standard-csv-templates) below.

---

## Step 1 — Download the CSV template (optional)

If you want to prepare your data manually, or if your platform's export doesn't match Agon's format:

1. Go to **Settings → Migration** in the desktop app.
2. Click **Download template** and choose the entity type:
   - **Clients template** — `full_name, email, phone, date_of_birth`
   - **Memberships template** — `client_email, membership_type_name, starts_at, expires_at, credits_remaining`
   - **Classes template** — `class_name, starts_at, ends_at, capacity, instructor_name`
3. Open the template in Excel or Google Sheets, fill in your data, and save as CSV.

---

## Step 2 — Export data from your current platform

Most platforms provide a data export option. The migration assistant will guide you based on which platform you're migrating from.

**General approach:**
- Check your current platform's **Settings** or **Admin** area for a data export or download option
- Look for export options in the **Clients**, **Members**, or **Contacts** section
- If no self-service export is available, contact the platform's support team and request a **GDPR data portability export** — under GDPR Article 20, they are legally required to provide this

**Import priority — do these in order:**
1. **Clients** (name, email, phone) — required first; everything else depends on this
2. **Active memberships** (type, expiry, credits) — determines who can book on day one
3. **Upcoming classes** — avoids disruption in the first weeks after switching
4. **Historical attendance and payments** — useful but not urgent; you can keep this as archive in your old system

---

## Step 3 — Upload your file

1. Go to **Settings → Migration** in the Agon desktop app.
2. Click **Upload file**.
3. Select the CSV or Excel file from your computer.
4. The assistant analyses the file and shows you a **column mapping preview**.

The assistant uses AI to automatically match your column names to Agon's fields. For example, a column called "Customer Name" is automatically mapped to **full_name**, and "Email Address" is mapped to **email**.

See [Column mapping](column-mapping) for details on how this works and how to correct mappings manually.

---

## Step 4 — Review the column mapping

After upload, the assistant shows you a table of your columns and how each one has been mapped to an Agon field.

- **Green** — confidently mapped
- **Yellow** — mapped with low confidence — review and confirm
- **Red** — could not be mapped — either map it manually or leave it unmapped (that data won't be imported)

To change a mapping:
1. Click the dropdown next to the column name.
2. Select the correct Agon field from the list.
3. Click **Save mapping**.

When you are satisfied with the mapping, click **Preview import**.

---

## Step 5 — Preview and confirm the import

The preview shows a sample of the records that will be imported, along with a summary:
- Number of records ready to import
- Number of records that will be skipped (with reasons)

**Common skip reasons:**
- **Duplicate email** — a client with this email already exists in Agon; the record is skipped to avoid overwriting existing data
- **Missing required field** — the record is missing a required value (e.g. email address is blank)
- **Unmatched membership type** — the membership type name doesn't match any existing membership type in Agon; create the membership type first, then re-import
- **Past class** — only future classes are imported; past classes are skipped

Review the skipped records. For each one you can:
- **Skip permanently** — exclude it from this import
- **Edit in source file** — fix the data, re-upload, and try again

When ready, click **Confirm import** to run the import.

---

## Step 6 — Send invitation emails to imported clients

Client passwords are never exported by platforms (they are hashed and irreversible). After importing clients, you need to invite them to create their Agon accounts.

After the import completes, you'll see an **Invite clients** button.

**Option A — Send invitations directly from Agon**
Click **Send invitations**. Each imported client receives an email with a personal link to set up their Agon account. Their membership and booking history will already be loaded when they sign in.

Invitation links expire after **7 days**. You can resend them at any time.

**Option B — Download invitation list as CSV**
If you prefer to send invitations through your own email tool (e.g. Mailchimp, your personal email):
1. Click **Download invitation list**.
2. The CSV contains each client's name, email address, and personal invitation link.
3. Use your email tool to send the invitations.

---

## Import summary

After the import completes, you'll see a summary:
- Clients imported
- Memberships imported
- Classes imported
- Records skipped (with reasons)

Keep this summary for your records.

---

## Standard CSV templates

Download these templates from **Settings → Migration → Download template**:

**Clients**
Required columns: `full_name`, `email`
Optional columns: `phone`, `date_of_birth`

**Memberships**
Required columns: `client_email`, `membership_type_name`, `starts_at`
Optional columns: `expires_at`, `credits_remaining`
Note: `client_email` must match an email already imported into Agon.

**Classes**
Required columns: `class_name`, `starts_at`, `ends_at`
Optional columns: `capacity`, `instructor_name`
Note: only classes with a future start date are imported.

---

## What if something goes wrong?

**My old platform won't give me a data export**
Under GDPR Article 20 (Right to Data Portability), any platform storing personal data about your clients is legally required to provide that data to you in a structured, machine-readable format upon request. Send a formal written request to their support team. If they refuse or don't respond within 30 days, you can escalate to your national data protection authority (DPA).

**The column mapping got everything wrong**
Correct the mappings manually in the review step — use the dropdown for each column to select the correct Agon field. You can also edit your CSV to rename columns to match Agon's expected names (see the template column names above) and re-upload.

**A client says they didn't receive their invitation**
Go to **Settings → Migration → Invitation history**, find the client, and click **Resend invitation**. Also ask the client to check their spam folder.

## Related pages

- [Column mapping guide](column-mapping)
- [GDPR guide](../gdpr/studio-manager-guide)
