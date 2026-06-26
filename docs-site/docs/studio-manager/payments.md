---
title: Payments
sidebar_label: Payments
---

# Payments

This page explains how to record manual payments, issue refunds, connect Stripe for online payments, and view your payment history.

---

## How payments work in Agon

Agon does not process payments itself. It records payments and, if you use Stripe, it connects to your Stripe account so clients can pay online. All money flows directly between your clients and your bank account — Agon is never in the middle.

You can use:
- **Stripe** — for online card payments (clients pay from the mobile app)
- **Manual payments** — for cash, bank transfers, or any payment collected in person

---

## Recording a manual payment

When a client pays you in cash or by bank transfer, record it in Agon so your payment history stays accurate.

1. Open the client's profile from the **Clients** section.
2. Click **Record payment**.
3. Fill in the details:
   - **Amount**
   - **Currency** (defaults to your studio's currency)
   - **Payment date** (defaults to today)
   - **Associated membership** (optional — link the payment to a specific membership)
   - **Notes** (optional — e.g. "Cash payment at reception")
4. Click **Save payment**.

The payment appears in the client's payment history and in your revenue reports.

---

## Issuing a refund

**For a manual payment:**
1. Open the client's profile and go to **Payment history**.
2. Find the payment and click **Refund**.
3. Enter the refund amount (partial or full refund).
4. Add a note explaining the reason.
5. Click **Confirm refund**.

This records the refund in Agon's records. The actual money transfer is handled by you outside of Agon (e.g. handing back cash or making a bank transfer).

**For a Stripe payment:**
1. Open the client's profile and go to **Payment history**.
2. Find the Stripe payment and click **Refund**.
3. Enter the refund amount.
4. Click **Confirm refund**.

Agon calls the Stripe API and the refund is processed automatically. The client receives the refund to their original payment method within a few business days. Stripe's standard refund processing times apply.

---

## Stripe integration

### Connecting Stripe

You can connect Stripe during the [onboarding wizard](../getting-started/onboarding) or at any time from **Settings → Payments → Connect Stripe**.

1. Click **Connect Stripe**.
2. You are redirected to Stripe's website.
3. Log in to your existing Stripe account, or create a new one.
4. Authorise Agon to access your account.
5. You are redirected back to Agon. A green **Connected** indicator confirms the connection.

Once connected, clients with the Agon mobile app can purchase memberships directly from their phone (if **self-service purchases** are enabled in [Settings](settings)).

### How online payments work

When a client purchases a membership from the mobile app:

1. The client selects a membership and taps **Purchase**.
2. Agon creates a Stripe Checkout session and opens the Stripe payment screen on the client's phone.
3. The client enters their card details on Stripe's secure page.
4. Stripe processes the payment and sends a confirmation to Agon.
5. Agon activates the membership immediately.

The client never enters card details inside the Agon app — all card handling is done by Stripe on their secure page.

### Stripe webhook

Agon receives payment confirmations from Stripe via a webhook. The following Stripe events are handled:

| Stripe event | What Agon does |
|---|---|
| `checkout.session.completed` | Activates the purchased membership |
| `invoice.payment_succeeded` | Renews a recurring subscription and resets credits |
| `invoice.payment_failed` | Marks the membership as **Payment overdue** and notifies you |
| `customer.subscription.deleted` | Marks the membership as **Cancelled** |

**Important:** Stripe retries failed webhook deliveries for up to 72 hours. If your Agon server is offline when a payment is made, the webhook will be delivered when the server comes back online. You do not need to do anything.

### Disconnecting Stripe

Go to **Settings → Payments → Disconnect Stripe**. Existing payment records are kept. Active Stripe subscriptions will no longer be managed automatically — contact Stripe directly to cancel them.

---

## Viewing payment history

To see all payments for your studio:

1. Go to **Reports → Revenue** to see an overview by date range and membership type.
2. To see all payments for a specific client, open their profile and scroll to **Payment history**.

Each payment record shows:
- Amount and currency
- Date
- Payment method (Stripe or manual)
- Status (Completed, Pending, Refunded, Failed)
- Associated membership (if linked)

---

## What if something goes wrong?

**A Stripe payment shows as Pending but the client says they paid**
Wait a few minutes — Stripe webhooks can occasionally be delayed. If the membership is still not active after 10 minutes, check your Stripe dashboard to confirm the payment succeeded. If it did, you can manually assign the membership to the client from their profile.

**The Stripe connection shows as disconnected**
Go to **Settings → Payments** and reconnect Stripe. This can happen if Stripe's OAuth token expired or was revoked.

**A refund failed**
If a Stripe refund fails, Agon shows an error message with the reason from Stripe (e.g. "The charge has already been fully refunded"). Check your Stripe dashboard for more details.

## Related pages

- [Memberships](memberships)
- [Settings](settings)
- [Revenue report](reports)
