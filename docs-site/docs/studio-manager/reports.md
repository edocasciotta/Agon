---
title: Reports
sidebar_label: Reports
---

# Reports

This page explains the four reports available in Agon, what each one shows, and how to export the data as a CSV file.

All reports are available from the **Reports** section in the left sidebar. Only studio managers can access reports.

---

## Attendance report

The attendance report shows how many clients are booking and showing up to your classes over a selected time period.

**What it shows:**
- Total classes scheduled in the period
- Total confirmed bookings
- Total check-ins (clients who actually attended)
- **Check-in rate** — the percentage of bookings that resulted in a check-in (e.g. 82%)
- **No-show rate** — the percentage of bookings where the client did not check in
- **Busiest day of the week** — which day had the most check-ins
- **Breakdown by class template** — for each class type, the number of sessions, total bookings, total check-ins, and average occupancy

**How to run it:**
1. Go to **Reports → Attendance**.
2. Set the **start date** and **end date**.
3. The report updates automatically.

---

## Revenue report

The revenue report shows total income recorded in Agon over a selected time period.

**What it shows:**
- Total revenue for the period
- **Breakdown by payment method** — how much came from Stripe vs manual payments
- **Breakdown by membership type** — how much each membership type contributed to revenue

**Important note:** The revenue report only includes payments recorded in Agon. If you collect payments outside of Agon without recording them, they will not appear here.

**How to run it:**
1. Go to **Reports → Revenue**.
2. Set the **start date** and **end date**.
3. The report updates automatically.

---

## Membership report

The membership report shows the state of your memberships at a glance.

**What it shows:**
- Total **active memberships** (broken down by membership type)
- Total **expired memberships** in the period
- Total **cancelled memberships** in the period
- **New memberships** started in the period
- Total **revenue from memberships** in the period

**How to run it:**
1. Go to **Reports → Memberships**.
2. Set the **start date** and **end date**.
3. The report updates automatically.

---

## Retention report

The retention report helps you spot clients who are at risk of churning — clients who have not attended a class recently.

**What it shows:**
- Total **active clients** (have attended at least once in the past 30 days)
- **New clients** who joined in the selected period
- **Churned clients** — clients who were active before the period but have not attended in the last 30 days
- **Retention rate** — percentage of previously active clients who are still attending

The 30-day activity window is based on check-in history, not booking history. A client who books but never shows up is not counted as active.

**How to run it:**
1. Go to **Reports → Retention**.
2. Set the **date range** for the report period.
3. The report updates automatically.

You can click on the list of churned clients to see their profiles and decide whether to reach out to them.

---

## Exporting reports as CSV

Every report can be exported as a CSV file, which you can open in Excel, Google Sheets, or any spreadsheet application.

1. Run the report you want with the date range you need.
2. Click **Export CSV** in the top-right corner of the report.
3. The CSV file downloads to your computer.

The CSV includes all the data shown in the report, with one row per class (for the attendance report) or one row per payment (for the revenue report).

---

## What if something goes wrong?

**The report shows no data for a period**
Check that you have classes and bookings in the selected date range. If you are new to Agon, your history may be limited.

**The revenue numbers don't match my Stripe dashboard**
Agon only records payments that were processed through its integration. Check that all relevant Stripe payments are linked to memberships in Agon. Payments made directly in Stripe without going through Agon will not appear here.

**The CSV export is empty**
Try running the report first and verifying it shows data on screen, then export.

## Related pages

- [Payments](payments)
- [Memberships](memberships)
- [Clients](clients)
