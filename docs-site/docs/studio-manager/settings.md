---
title: Settings
sidebar_label: Settings
---

# Settings

This page explains every setting available in Agon and what each one does.

**Navigation label — Settings:**
EN: Settings · IT: Impostazioni · FR: Paramètres · DE: Einstellungen · ES: Configuración · PT: Definições · NL: Instellingen · PL: Ustawienia · TR: Ayarlar

Go to **Settings** (IT: *Impostazioni*) in the left sidebar. Only studio managers can access Settings.

---

## Studio profile

IT: *Studio* · FR: *Studio* · DE: *Studio* · ES: *Estudio* · PT: *Estúdio*

| Setting | EN | IT | FR | DE | ES |
|---|---|---|---|---|---|
| Studio name | Studio name | Nome studio | Nom du studio | Studioname | Nombre del estudio |
| Address | Address | Indirizzo | Adresse | Adresse | Dirección |
| Timezone | Timezone | Fuso orario | Fuseau horaire | Zeitzone | Zona horaria |

---

## Booking policy

IT: *Prenotazioni e cancellazioni* · FR: *Réservations* · DE: *Buchungsrichtlinie*

### Cancellation window

| Setting | EN | IT | FR | DE | ES |
|---|---|---|---|---|---|
| Cancellation window (hours) | Cancellation window | Finestra di cancellazione (ore) | Délai d'annulation (heures) | Stornierungsfenster (Stunden) | Ventana de cancelación (horas) |
| Late cancellation deducts credit | Late cancellation deducts credit | La cancellazione scala un credito | L'annulation tardive déduit un crédit | Späte Stornierung zieht Guthaben ab | La cancelación tardía deduce crédito |

**Example:** With cancellation window set to 2 hours, a client who cancels a 10:00 AM class before 8:00 AM gets their credit back. Cancelling at 9:30 AM loses the credit (if late cancellation deducts credit is enabled).

### Check-in window

| Setting | EN | IT | FR | DE | ES |
|---|---|---|---|---|---|
| Opens before class (minutes) | Check-in opens before | Apertura minuti prima | Ouverture avant le cours | Öffnet vor Kurs (Min.) | Apertura antes de clase (min) |
| Closes after class (minutes) | Check-in closes after | Chiusura minuti dopo | Fermeture après le cours | Schließt nach Kurs (Min.) | Cierre después de clase (min) |

### Waitlist

| Setting | EN | IT | FR | DE | ES |
|---|---|---|---|---|---|
| Waitlist confirmation window (minutes) | Waitlist confirmation window | Finestra conferma lista attesa | Délai de confirmation liste d'attente | Wartelistenbestätigungsfenster | Ventana de confirmación lista de espera |

### Late cancellation and no-show fees

| Setting | EN | IT | FR | DE | ES |
|---|---|---|---|---|---|
| Late cancellation fee | Late cancellation fee | Penale cancellazione tardiva | Frais d'annulation tardive | Gebühr für späte Stornierung | Tarifa de cancelación tardía |
| No-show fee | No-show fee | Penale mancata presentazione | Frais d'absence | No-Show-Gebühr | Tarifa por inasistencia |

(Locale keys: `settings.lateCancelFee` / `settings.noShowFee`.)

These are the studio-wide **default** fee amounts. They apply automatically only when:
- A client cancels a booking inside the cancellation window (a "late cancellation") **and** your
  **Late cancellation deducts credit** setting is enabled, or
- A studio manager or instructor explicitly marks a booking as a **no-show** at check-in.

A fee never triggers on its own just because it's set here — it always requires one of the two
triggers above to actually fire.

Each membership type can override either fee for its own members (see
[Memberships — fee overrides](memberships#fee-overrides)). The resolution order is: **membership
type override → studio default (this section) → no fee** if neither is set.

**How the fee is recorded:** a fee is not an automatic card charge. It's recorded as a `Payment` row
(`provider: "system"`, `notes: "no_show_fee"` or `"late_cancel_fee"`) so it appears in the client's
payment history and in your Reports revenue figures — but your studio still needs to actually
collect it from the client (cash, card terminal, added to their next invoice, etc.) through your own
process.

---

## Client access

| Setting | EN | IT | FR | DE | ES |
|---|---|---|---|---|---|
| Guest bookings | Guest bookings enabled | Prenotazioni ospiti abilitate | Réservations invités activées | Gastbuchungen aktiviert | Reservas de invitados habilitadas |

---

## Notifications

| Setting | EN | IT | FR | DE | ES |
|---|---|---|---|---|---|
| Class reminder | Reminder hours before | Ore di promemoria prima della lezione | Heures de rappel avant le cours | Erinnerungsstunden vor dem Kurs | Horas de recordatorio antes de la clase |

---

## Save settings

Click **Save settings** to apply your changes.

| Action | EN | IT | FR | DE | ES | PT | NL | PL | TR |
|---|---|---|---|---|---|---|---|---|---|
| Save | Save settings | Salva impostazioni | Enregistrer paramètres | Einstellungen speichern | Guardar configuración | Guardar definições | Instellingen opslaan | Zapisz ustawienia | Ayarları kaydet |

---

## What if something goes wrong?

**I changed the timezone and now class times look wrong**
Change the timezone back to its previous value and restart the backend.

**Backups show "Last backup: Never"**
Click **Back up now** to run an immediate backup.

**The tunnel shows as Inactive**
Click **Restart tunnel**. If it remains inactive, check your internet connection.

## Related pages

- [Payments](payments)
- [Check-in](check-in)
- [Classes](classes)
- [Memberships — fee overrides](memberships#fee-overrides)
