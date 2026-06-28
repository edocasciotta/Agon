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
- [Settings — cancellation policy](settings)
- [Client view of memberships](../clients/memberships)
