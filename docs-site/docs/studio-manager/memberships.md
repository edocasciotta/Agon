---
title: Memberships
sidebar_label: Memberships
---

# Memberships

This page explains how to create membership types, assign them to clients, and manage the full membership lifecycle.

**Navigation label — Memberships:**
EN: Memberships · IT: Abbonamenti · FR: Abonnements · DE: Mitgliedschaften · ES: Membresías · PT: Associações · NL: Lidmaatschappen · PL: Członkostwa · TR: Üyelikler

---

## Overview

Memberships come in two forms:

- **Recurring subscription** (IT: *Ricorrente*) — the client pays on a regular billing interval. Each interval grants a set number of credits, or unlimited access.
- **Credit pack** (IT: *Pacchetto crediti*) — the client pays once and receives a fixed number of credits that expire after a set period.

A **credit** (IT: *credito*) is used when a client books a class. If a client cancels early enough, the credit is refunded.

---

## Creating a membership type

1. Go to **Memberships** (IT: *Abbonamenti*) in the left sidebar.
2. Click **+ Create type** (IT: *+ Crea tipo*).
3. Fill in the details:
   - **Name** (IT: *Nome*) — e.g. "Monthly Unlimited", "10-Class Pack"
   - **Type** (IT: *Tipo*) — Recurring (IT: *Ricorrente*) or Credit pack (IT: *Pacchetto crediti*)
   - **Price** (IT: *Prezzo*)
   - **Credits** (IT: *Crediti*) — number of credits per interval, or leave blank for unlimited
   - **Unlimited classes** (IT: *Lezioni illimitate*) — toggle for unlimited access
4. Click **Create** (IT: *Crea*).

**Membership type button labels:**

| Action | EN | IT | FR | DE | ES | PT | NL | PL | TR |
|---|---|---|---|---|---|---|---|---|---|
| Create type | + Create type | + Crea tipo | + Créer type | + Typ erstellen | + Crear tipo | + Criar tipo | + Type maken | + Utwórz typ | + Tür oluştur |
| Cancel | Cancel | Annulla | Annuler | Abbrechen | Cancelar | Cancelar | Annuleren | Anuluj | İptal |

---

## Fee overrides

Every membership type creation/editing form has a **Fees** (locale key `membershipTypes.sectionFees`) section:

| Setting | EN | IT | FR | DE | ES | PT | NL |
|---|---|---|---|---|---|---|---|
| Late cancel fee | Late cancel fee | Penale cancellazione tardiva | Frais d'annulation tardive | Gebühr für späte Stornierung | Tarifa de cancelación tardía | Taxa de cancelamento tardio | Vergoeding late annulering |
| No-show fee | No-show fee | Penale mancata presentazione | Frais d'absence | No-Show-Gebühr | Tarifa por inasistencia | Taxa de não comparecimento | No-show vergoeding |

(Locale keys: `membershipTypes.lateCancelFeeOverride` / `membershipTypes.noShowFeeOverride`. Hint text: `membershipTypes.feeOverrideHint` — "Leave empty to use studio defaults.")

Leave either field empty to fall back to the studio-wide default configured in
[Settings](settings#late-cancellation-and-no-show-fees). The resolution order, applied per client at
the moment a fee would be charged, is:

1. **This membership type's override** (if set)
2. **The studio default** (Settings → Bookings & Cancellations)
3. **No fee** — if neither is set, nothing is charged

A fee is only ever charged when a late cancellation (inside the cancellation window, with "cancellation deducts credit" enabled) or an explicit no-show mark actually happens — setting a fee here does not charge anyone by itself.

**How the fee is recorded:** it appears as a `Payment` row on the client (`provider: "system"`,
with a note of `no_show_fee` or `late_cancel_fee`), so it shows up in the client's payment history
and in Reports revenue — but it is **not** an automatic card charge. Your studio still has to
actually collect it (cash, card terminal, next invoice, etc.).

---

## Credit rollover

Also in the membership type form:

| Setting | EN | IT | FR | DE | ES | PT | NL |
|---|---|---|---|---|---|---|---|
| Enable credit rollover | Enable credit rollover | Abilita riporto crediti | Activer le report de crédits | Guthabenübertrag aktivieren | Activar acumulación de créditos | Ativar transferência de créditos | Creditoverdracht inschakelen |
| Max rollover credits | Max rollover credits | Crediti massimi riportabili | Crédits de report max | Max. übertragbare Guthaben | Créditos máximos acumulables | Créditos máximos transferíveis | Max. overdraagbare credits |

(Locale keys: `membershipTypes.rolloverEnabled` / `membershipTypes.maxRolloverCredits`. Hint text: `membershipTypes.rolloverHint` — "Leave empty for unlimited rollover".)

When **Enable credit rollover** is on for a recurring membership type, any credits a client hasn't
used by the end of a billing period carry over into the next period instead of being lost. Leave
**Max rollover credits** empty for unlimited rollover, or set a cap — only unused credits up to that
cap carry over; anything beyond the cap is still lost at renewal.

*Example: a client on a 10-credit/month plan with rollover enabled and a max of 5 finishes the month
with 4 unused credits. All 4 roll over, so their new period starts with 14 credits. If they had 8
unused, only 5 would roll over (the cap), giving them 15 for the new period — the other 3 are lost.*

---

## Intro offers

Also in the membership type form:

| Setting | EN | IT | FR | DE | ES | PT | NL |
|---|---|---|---|---|---|---|---|
| Intro offer | Intro offer | Offerta di benvenuto | Offre de bienvenue | Einführungsangebot | Oferta de bienvenida | Oferta de boas-vindas | Introductieaanbieding |
| Intro price | Intro price | Prezzo di benvenuto | Prix de bienvenue | Einführungspreis | Precio de bienvenida | Preço de boas-vindas | Introductieprijs |
| Intro validity (days) | Intro validity (days) | Validità offerta (giorni) | Validité de l'offre (jours) | Gültigkeit (Tage) | Validez de la oferta (días) | Validade da oferta (dias) | Geldigheid (dagen) |

(Locale keys: `membershipTypes.introOffer` / `membershipTypes.introPrice` / `membershipTypes.introValidityDays`. Hint text: `membershipTypes.introPriceHint` — "Leave empty to use regular price".)

Toggling **Intro offer** on lets you set a discounted **first-purchase-only** price and/or a shorter
validity window for new clients. Leave **Intro price** empty to keep the regular price (an intro
offer with no discounted price is effectively just a shorter/longer trial window). A client is only
ever eligible for the intro price **once per membership type family** — after their first purchase
of that type (or any other intro-offer type at your studio), later purchases always use the regular
price.

---

## Assigning a membership to a client

1. Go to **Clients** (IT: *Clienti*) and open the client's profile.
2. Go to the **Memberships** tab (IT: *Abbonamenti*).
3. Click **+ Assign membership** (IT: *+ Assegna abbonamento*).
4. Select the **Membership type** (IT: *Tipo abbonamento*).
5. Set the **Start date** (IT: *Data di inizio*).
6. Click **Assign** (IT: *Assegna*).

---

## How credits work

- Each **booking** deducts one credit. IT: *prenotazione*
- **Cancelling before the cancellation window** — credit is refunded. IT: *annulla*
- **Late cancellation** (inside the cancellation window) — credit may be lost depending on your cancellation policy in Settings.
- When credits reach zero, the client cannot book until the membership renews or they purchase a new pack.

---

## Membership statuses

| Status | EN | IT | FR | DE | ES | PT | NL | PL | TR |
|---|---|---|---|---|---|---|---|---|---|
| Active | Active | Attivo | Actif | Aktiv | Activo | Ativo | Actief | Aktywny | Aktif |
| Expired | Expired | Scaduto | Expiré | Abgelaufen | Expirado | Expirado | Verlopen | Wygasły | Süresi dolmuş |
| Cancelled | Cancelled | Cancellato | Annulé | Storniert | Cancelado | Cancelado | Geannuleerd | Anulowany | İptal edildi |

---

## Cancelling a membership

1. Open the client's profile.
2. Go to the **Memberships** tab (IT: *Abbonamenti*).
3. Find the active membership and click **Cancel membership** (IT: *Cancella abbonamento*).
4. Confirm.

The membership is immediately marked as Cancelled (IT: *Cancellato*). The client can no longer book classes.

---

## What if something goes wrong?

**A client can't book even though they have an active membership**
Check the membership in their profile. Common causes: the membership has expired, all credits are used, or the membership type doesn't apply to the class type they're trying to book.

**I assigned the wrong membership type to a client**
Cancel the incorrect membership and assign the correct one.

## Related pages

- [Payments](payments)
- [Settings — cancellation policy and fee defaults](settings)
- [Client view of memberships](../clients/memberships)
- [Promo Codes](promo-codes)
- [Gift Cards](gift-cards)
