---
title: GDPR Guide for Studio Managers
sidebar_label: GDPR Guide
---

# GDPR guide for studio managers

This page explains how Agon helps you comply with GDPR, what data is stored, how to respond to client data requests, and your responsibilities as the data controller.

---

## Your role under GDPR

As the studio manager using Agon, you are the **data controller** — the person or organisation responsible for how your clients' personal data is collected, stored, and used.

Agon is the **data processor** — it provides the tools to manage that data, but the data belongs to you and your clients. Agon never has access to your studio's data.

Because Agon stores all data locally on your computer, your clients' data never passes through Agon's servers or any third-party infrastructure (except where you explicitly configure it — for example, Stripe for payments, or Google Drive for backups).

---

## What data Agon stores

Agon stores the following personal data for each client:

| Data | Where it is used |
|---|---|
| Full name | Booking roster, client profile, notifications |
| Email address | Login, push notifications |
| Phone number | Optional — staff reference only |
| Date of birth | Optional — staff reference only |
| Profile photo | Optional — shown in client profile |
| Booking history | Attendance records, reports |
| Check-in history | Attendance records, reports |
| Payment history | Revenue reports, financial records |
| GDPR consent log | Compliance record |

All data is stored in an encrypted SQLite database on your computer. It never leaves your machine unless you explicitly configure cloud backup (Google Drive or Dropbox) or use Stripe for payments.

---

## Legal basis for processing

You must have a valid legal basis to store and process client data. The most common bases for fitness studios:

- **Contract** — processing is necessary to manage bookings, memberships, and payments (GDPR Art. 6(1)(b))
- **Consent** — where you process optional data (e.g. marketing communications) — not applicable in Agon V1 as there are no marketing features
- **Legal obligation** — retaining financial records is required by tax law in most countries (GDPR Art. 6(1)(c))

Agon records consent automatically when a client accepts the privacy policy and terms of service during account creation.

---

## Client data export

Under GDPR Article 15 (right of access) and Article 20 (right to data portability), a client can request a full copy of their personal data.

**To export a client's data:**
1. Open the client's profile in the **Clients** section.
2. Click **Export data**.
3. A JSON file is generated containing all data held about that client:
   - Personal information (name, email, phone, date of birth)
   - All bookings and check-ins
   - All payments
   - GDPR consent log
4. Download the file and send it to the client.

You have 30 days from the date of request to provide the export.

---

## Client deletion (anonymisation)

Under GDPR Article 17 (right to erasure), a client can request deletion of their personal data.

In Agon, "deletion" means **anonymisation** — personal identifiers are replaced with anonymous placeholders, while booking records and payment history are retained for financial and statistical purposes. This is the legally correct approach: GDPR allows retention of data for legitimate business purposes such as tax and financial record-keeping.

**What is anonymised (removed):**
- Full name → replaced with "Deleted Client"
- Email address → replaced with an anonymous placeholder
- Phone number → removed
- Date of birth → removed
- Profile photo → removed

**What is retained (anonymised, not identifiable):**
- Booking and attendance records (statistical value; no personal identifiers)
- Payment records (required by financial regulations)

**To anonymise a client:**
1. Open the client's profile.
2. Click **Delete client**.
3. Read the summary of what will be removed and what will be kept.
4. Click **Confirm deletion**.

This action is permanent and cannot be undone.

> Clients can also initiate deletion themselves from the mobile app: **Profile → Privacy → Delete my account**.

---

## The consent log

Every time a client accepts the privacy policy or terms of service — at account creation, or when a new version is published — Agon records:

- Which document they accepted (privacy policy or terms of service)
- The version of the document
- The date and time of acceptance
- The client's IP address

**To view a client's consent log:**
1. Open the client's profile.
2. Scroll to **Consent log**.

The consent log is also included in the data export.

---

## Privacy policy

Agon includes a template privacy policy that you must customise with your studio's details before going live. The template is available in the onboarding wizard and in **Settings → Privacy Policy**.

You are responsible for ensuring your privacy policy is legally adequate for your jurisdiction. The template is a starting point only — Agon is not responsible for its legal accuracy.

---

## Data retention

Since all data is stored on your machine, you control how long it is retained. Agon does not delete data automatically (except as part of the anonymisation process described above).

**Recommended practices:**
- Keep client data for as long as you have a relationship with the client
- After a client requests deletion, anonymise their data as described above
- Financial records (payments, invoices) should be retained for the period required by your local tax law (typically 7–10 years)
- Regular backups ensure you have a recoverable copy of your data

---

## Data breach procedure

If you discover that your Agon database has been accessed by an unauthorised party (for example, your computer was stolen or hacked):

1. Disconnect the computer from the internet immediately
2. Assess what data may have been accessed
3. Notify your national data protection authority within 72 hours of discovering the breach (if the breach is likely to result in a risk to individuals' rights)
4. Notify affected clients if there is a high risk to their rights and freedoms
5. Contact Agon support for guidance on securing your installation

---

## What if something goes wrong?

**A client says they never consented to data processing**
Check their consent log in the client profile. The log records every consent event. If they created an account in Agon, they accepted the terms at that point — the log will confirm it.

**A client is requesting data that I can't find in Agon**
The data export covers all data stored in Agon. If the client is asking about data from a previous platform, that data is outside Agon's scope.

**I need to delete all data (e.g. closing the studio)**
Agon does not have a bulk deletion tool in V1. You can delete the database file from your computer to remove all data. Make sure you have resolved all outstanding financial obligations first.

## Related pages

- [Client management](../studio-manager/clients)
- [Migration guide](../migration/overview)
