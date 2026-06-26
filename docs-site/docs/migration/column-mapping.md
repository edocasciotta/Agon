---
title: Column Mapping Guide
sidebar_label: Column Mapping
---

# Column mapping guide

When you upload a CSV file from your old platform, Agon's migration assistant automatically tries to match your column names to Agon's data fields. This page explains how that process works, what to do when a column can't be mapped, and the most common column name variations.

---

## How automatic mapping works

The mapping process happens in two stages:

**Stage 1 — Heuristic matching**
Agon compares your column names against a library of known variations for each field. For example, columns named "First Name", "firstname", "name", and "customer name" are all recognised as likely matches for **full_name**. This stage handles most standard exports from common platforms.

**Stage 2 — AI fallback**
If a column name isn't recognised by the heuristic matcher, the migration assistant uses an AI model to interpret it based on the column's name and a sample of its values. For example, if you have a column called "Member ID" that contains values like "m-1234", the AI will recognise this as an internal identifier and suggest leaving it unmapped.

---

## Reviewing and editing mappings

After upload, the column mapping table shows each column from your file and the Agon field it has been mapped to.

Each mapping is colour-coded:
- **Green** — high-confidence match; safe to proceed
- **Yellow** — lower confidence — check the mapping and adjust if needed
- **Red** — no mapping found; this column's data will not be imported unless you map it manually

**To change a mapping:**
1. Click the dropdown in the **Agon field** column next to the row you want to change.
2. Select the correct field from the list of available Agon fields.
3. The mapping updates immediately.

**To leave a column unmapped:**
Select **Do not import** from the dropdown. The column's data will be ignored during import. This is fine for columns that contain internal IDs, platform-specific codes, or data that Agon doesn't need.

---

## Common column name variations

### Client fields

| Your column name | Maps to Agon field |
|---|---|
| Name, Full name, Customer name, Member name, Firstname + Lastname | `full_name` |
| Email, Email address, Customer email, Login | `email` |
| Phone, Mobile, Phone number, Tel, Telephone | `phone` |
| DOB, Date of birth, Birthday, Birth date | `date_of_birth` |

> If your file has separate first name and last name columns, the assistant will combine them into `full_name` automatically.

### Membership fields

| Your column name | Maps to Agon field |
|---|---|
| Email, Member email, Customer email | `client_email` |
| Membership, Plan, Subscription, Package | `membership_type_name` |
| Start date, Member since, Activation date | `starts_at` |
| Expiry, Expiry date, Valid until, Renewal date | `expires_at` |
| Credits, Classes remaining, Sessions left | `credits_remaining` |

### Class fields

| Your column name | Maps to Agon field |
|---|---|
| Class, Class name, Session name, Title | `class_name` |
| Start, Start time, Starts at, Date/Time | `starts_at` |
| End, End time, Ends at, Finish | `ends_at` |
| Capacity, Max participants, Spots, Max | `capacity` |
| Instructor, Teacher, Coach, Staff | `instructor_name` |

---

## Date and time formats

Agon accepts dates in most common formats:

- `2026-06-15` (ISO 8601 — preferred)
- `15/06/2026` or `06/15/2026`
- `June 15 2026` or `15 June 2026`
- `2026-06-15T10:00:00` (date + time for classes)

If your dates are in an unusual format, convert them in Excel or Google Sheets before uploading: select the column, format as a standard date, and save.

---

## What to do when a column can't be mapped

If a column is shown in red (no mapping found):

1. **Check if the data is needed.** If it's an internal ID, platform-specific reference, or data Agon doesn't use, select **Do not import** and move on.

2. **Rename the column and re-upload.** If the data is important but the column name is unusual, edit your CSV file to rename the column to match one of the standard names in the table above, then re-upload the file.

3. **Map it manually.** If the data maps to an Agon field but wasn't recognised, select the correct field from the dropdown.

---

## Columns that are always ignored

Some columns are never imported into Agon, regardless of mapping:

- **Passwords** — passwords are never imported (they are hashed by your old platform and cannot be read). Clients are invited to set a new password via the invitation link.
- **Internal IDs** — platform-specific numeric or string IDs have no meaning in Agon
- **Platform-specific status codes** — statuses from other platforms are translated during import based on the data values, not imported as-is

---

## What if something goes wrong?

**The AI mapped a column completely wrong**
Use the dropdown to select the correct Agon field manually. The AI fallback is a best-effort guess — it is not always right, especially for unusual column names or platform-specific terminology.

**Dates are importing in the wrong format**
If dates are being parsed incorrectly, open your CSV in a spreadsheet app, select the date column, and format it as `YYYY-MM-DD` (ISO 8601). Save the file and re-upload.

**My file has merged cells or headers that span multiple rows**
The migration assistant expects a single header row followed by one row per record. Clean up merged cells and extra header rows in your spreadsheet before uploading.

## Related pages

- [Migration overview](overview)
- [GDPR guide](../gdpr/studio-manager-guide)
