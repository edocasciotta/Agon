---
title: Payments
sidebar_label: Payments
---

# Payments

This page explains how to record manual payments, issue refunds, and connect Stripe for online payments.

**Navigation label — Payments:**
EN: Payments · IT: Pagamenti · FR: Paiements · DE: Zahlungen · ES: Pagos · PT: Pagamentos · NL: Betalingen · PL: Płatności · TR: Ödemeler

---

## How payments work in Agon

Agon records payments and, if you use Stripe, connects to your Stripe account so clients can pay online. Money flows directly between your clients and your bank account.

You can use:
- **Stripe** — for online card payments (clients pay from the mobile app)
- **Manual payments** (IT: *pagamento manuale*) — for cash, bank transfers, or any in-person payment

---

## Recording a manual payment

1. Go to **Clients** (IT: *Clienti*) and open the client's profile.
2. Go to the **Memberships** tab (IT: *Abbonamenti*).
3. Record the payment with the amount and notes.

**Payment action labels:**

| Action | EN | IT | FR | DE | ES | PT | NL | PL | TR |
|---|---|---|---|---|---|---|---|---|---|
| Record payment | Record payment | Registra pagamento | Enregistrer paiement | Zahlung erfassen | Registrar pago | Registrar pagamento | Betaling registreren | Zarejestruj płatność | Ödeme kaydet |
| Refund | Refund | Rimborso | Rembourser | Erstatten | Reembolsar | Reembolsar | Terugbetalen | Zwrot | İade et |

---

## Issuing a refund

**For a manual payment:**
1. Open the client's profile.
2. Find the payment and click **Refund** (IT: *Rimborso*).
3. Enter the refund amount and a reason.
4. Click **Confirm refund**.

The actual money transfer is handled outside of Agon (e.g. handing back cash).

**For a Stripe payment:**
Same steps — Agon calls the Stripe API and the refund is processed automatically within a few business days.

---

## Stripe integration

### Connecting Stripe

1. Go to **Settings** (IT: *Impostazioni*) → **Payments** (IT: *Pagamenti*).
2. Click **Connect Stripe** (IT: *Collega Stripe*).
3. Log in to your Stripe account or create a new one.
4. Authorise Agon to access your account.
5. You are redirected back to Agon with a green **Connected** indicator.

### Disconnecting Stripe

Go to **Settings → Payments → Disconnect Stripe** (IT: *Scollega Stripe*).

---

## Payment statuses

| Status | EN | IT | FR | DE | ES | PT | NL | PL | TR |
|---|---|---|---|---|---|---|---|---|---|
| Completed | Completed | Completato | Complété | Abgeschlossen | Completado | Concluído | Voltooid | Zakończony | Tamamlandı |
| Refunded | Refunded | Rimborsato | Remboursé | Erstattet | Reembolsado | Reembolsado | Terugbetaald | Zwrócony | İade edildi |
| Failed | Failed | Fallito | Échoué | Fehlgeschlagen | Fallido | Falhou | Mislukt | Nieudany | Başarısız |

---

## Viewing payment history

1. Go to **Reports → Revenue** (IT: *Ricavi*) for an overview by date range.
2. To see payments for a specific client, open their profile.

---

## What if something goes wrong?

**A Stripe payment shows as Pending**
Wait a few minutes — Stripe webhooks can be delayed. If still pending after 10 minutes, check your Stripe dashboard.

**The Stripe connection shows as disconnected**
Go to **Settings → Payments** and reconnect Stripe.

## Related pages

- [Memberships](memberships)
- [Settings](settings)
- [Revenue report](reports)
