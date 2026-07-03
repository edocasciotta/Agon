#!/usr/bin/env python3
"""
Agon Phase L fine-tuning dataset generator.

Generates ~200 examples covering all 9 tools, with targeted fixes for 3
behavioral regressions:
  1. cancel_booking — multi-turn confirmation before calling tool
  2. get_class_roster — Italian phrasings (chi ha prenotato, mostrami i
     prenotati, etc.) correctly mapped to get_class_roster
  3. get_report — Italian keyword → correct type field
     (entrate/fatturato → revenue, presenze → attendance,
      abbonamenti → membership)

Usage (from repo root):
    python training/scripts/generate_phase_l_dataset.py

Output:
    training/data/phase_l_tools.jsonl   (~200 examples)
"""

import json
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(99)

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
OUT_FILE = DATA_DIR / "phase_l_tools.jsonl"

# ── Studio fixtures ───────────────────────────────────────────────────────────

LOCATIONS = [
    "Main Studio", "Agon Milano", "Agon Roma",
    "Agon Bologna", "Agon Firenze", "Agon Napoli",
]
CLASS_TYPES = [
    {"name": "Yoga Flow",    "capacity": 20},
    {"name": "Pilates Mat",  "capacity": 15},
    {"name": "HIIT",         "capacity": 25},
    {"name": "Spinning",     "capacity": 20},
    {"name": "Zumba",        "capacity": 30},
    {"name": "Boxing",       "capacity": 12},
    {"name": "Stretching",   "capacity": 20},
]
CT_BY_NAME = {ct["name"]: ct for ct in CLASS_TYPES}
INSTRUCTORS = [
    "Sara Bianchi", "Marco Rossi", "Elena Verdi", "Luca Neri", "Giulia Ferrari",
]
CLIENTS = [
    "Maria Rossi", "Luca Bianchi", "Elena Ferrari",
    "Marco Verdi", "Sara Neri", "Giulia Romano",
]
MEMBERSHIP_TYPES = ["Monthly Unlimited", "10-Class Pack", "Drop-in"]
ANCHOR_DATES = [
    date(2026, 7, 2),   # Thursday
    date(2026, 7, 6),   # Monday
    date(2026, 7, 8),   # Wednesday
    date(2026, 7, 10),  # Friday
    date(2026, 7, 13),  # Monday
    date(2026, 7, 15),  # Wednesday
    date(2026, 7, 17),  # Friday
]
TIMES = [
    "07:00", "08:00", "09:00", "09:30", "10:00", "11:00",
    "12:00", "17:00", "18:00", "18:30", "19:00", "20:00",
]

# ── System prompt ─────────────────────────────────────────────────────────────

def _week_calendar(today: date) -> str:
    monday = today - timedelta(days=today.weekday())
    lines = []
    for i in range(7):
        d = monday + timedelta(days=i)
        marker = " <- today" if d == today else ""
        lines.append(f"  {d.strftime('%A')}: {d.isoformat()}{marker}")
    return "\n".join(lines)


def build_system_prompt(lang_name: str, today: date) -> str:
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)
    ct_list = ", ".join(ct["name"] for ct in CLASS_TYPES)
    instr_list = ", ".join(INSTRUCTORS)
    client_list = ", ".join(CLIENTS)
    loc_list = ", ".join(LOCATIONS)
    mem_list = ", ".join(MEMBERSHIP_TYPES)
    week_cal = _week_calendar(today)
    return (
        f"=== LANGUAGE RULE — ABSOLUTE PRIORITY ===\n"
        f"You MUST respond ONLY in {lang_name}. This rule overrides everything else.\n"
        f"Even if the user writes in another language, your reply must ALWAYS be in {lang_name}.\n"
        f"=========================================\n\n"
        f"You are the built-in AI assistant for Agon, a fitness studio management application.\n\n"
        f"DATE REFERENCE (do not compute — use these exact values):\n"
        f"  Today      : {today.isoformat()} ({today.strftime('%A')})\n"
        f"  Tomorrow   : {tomorrow.isoformat()} ({tomorrow.strftime('%A')})\n"
        f"  In 2 days  : {day_after.isoformat()} ({day_after.strftime('%A')})\n"
        f"  This week  :\n{week_cal}\n\n"
        f"FORMATTING RULES: Do NOT use markdown. Plain text only.\n\n"
        f"STUDIO DATA:\n"
        f"Locations: {loc_list}\n"
        f"Class types: {ct_list}\n"
        f"Instructors: {instr_list}\n"
        f"Clients: {client_list}\n"
        f"Membership types: {mem_list}\n\n"
        f"Available actions (call the tool when the user requests an action):\n"
        f"- create_class: class_type, location, date (YYYY-MM-DD), start_time (HH:MM)\n"
        f"- cancel_class: class_type, date, start_time\n"
        f"- book_client: client (name or email), class_type, date, start_time\n"
        f"- cancel_booking: client, class_type, date, start_time\n"
        f"- get_class_roster: class_type, date, start_time\n"
        f"- check_in_client: client, class_type, date, start_time\n"
        f"- create_client: full_name, email, phone (optional)\n"
        f"- assign_membership: client, membership_type, starts_at (YYYY-MM-DD, optional)\n"
        f"- get_report: type (attendance|revenue|membership|retention), start_date, end_date\n\n"
        f"CONFIRMATION RULE: Before calling cancel_booking, describe what you are about to "
        f"cancel in natural language and ask \"Shall I proceed?\" (in the current language). "
        f"Only call the tool AFTER the user explicitly confirms with \"yes\", \"sì\", \"oui\", "
        f"\"ja\", \"sí\", \"sim\", \"ja\" or equivalent.\n\n"
        f"=== REMINDER: respond ONLY in {lang_name} ==="
    )


# ── Message helpers ───────────────────────────────────────────────────────────

def tc(name: str, args: dict, call_id: str = "call_0") -> dict:
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [{
            "id": call_id,
            "type": "function",
            "function": {"name": name, "arguments": json.dumps(args)},
        }],
    }


def tr(content: str, call_id: str = "call_0") -> dict:
    return {"role": "tool", "tool_call_id": call_id, "content": content}


def u(text: str) -> dict:
    return {"role": "user", "content": text}


def a(text: str) -> dict:
    return {"role": "assistant", "content": text}


def ex(system: str, turns: list[dict]) -> dict:
    return {"messages": [{"role": "system", "content": system}] + turns}


# ── Date helpers ──────────────────────────────────────────────────────────────

def tomorrow_iso(today: date) -> str:
    return (today + timedelta(days=1)).isoformat()


def next_weekday_iso(today: date, wd: int) -> str:
    days = (wd - today.weekday()) % 7 or 7
    return (today + timedelta(days=days)).isoformat()


def last_n_days(today: date, n: int) -> tuple[str, str]:
    return (today - timedelta(days=n)).isoformat(), today.isoformat()


def this_month(today: date) -> tuple[str, str]:
    first = today.replace(day=1)
    return first.isoformat(), today.isoformat()


# ── 1. create_class carry-over (20 examples) ─────────────────────────────────

CREATE_EN = [
    "Schedule {ct} for tomorrow at {time} at {loc}",
    "Create a {ct} class {date_expr} at {time} in {loc}",
    "Add {ct} to the calendar for {date_expr} at {time} at {loc}",
    "I need a {ct} session on {date_expr} at {time} ({loc})",
    "Book a {ct} {date_expr} at {time} at {loc}",
    "Can you schedule {ct} for {date_expr} at {time}? Location: {loc}",
]
CREATE_IT = [
    "Crea una classe di {ct} domani alle {time} a {loc}",
    "Puoi programmare {ct} per domani alle {time} presso {loc}?",
    "Aggiungi {ct} al calendario per {date_expr} alle {time}, sede {loc}",
    "Organizza {ct} per {date_expr} alle {time} a {loc}",
]

DATE_EXPRS_EN = {
    "tomorrow":       lambda t: (t + timedelta(days=1)).isoformat(),
    "next Monday":    lambda t: next_weekday_iso(t, 0),
    "next Wednesday": lambda t: next_weekday_iso(t, 2),
    "next Friday":    lambda t: next_weekday_iso(t, 4),
    "in 3 days":      lambda t: (t + timedelta(days=3)).isoformat(),
}
DATE_EXPRS_IT = {
    "dopodomani":        lambda t: (t + timedelta(days=2)).isoformat(),
    "venerdì prossimo":  lambda t: next_weekday_iso(t, 4),
    "lunedì prossimo":   lambda t: next_weekday_iso(t, 0),
    "mercoledì prossimo": lambda t: next_weekday_iso(t, 2),
}


def gen_create_class(n: int) -> list[dict]:
    out = []
    for i in range(n):
        today = random.choice(ANCHOR_DATES)
        ct = random.choice(CLASS_TYPES)
        loc = random.choice(LOCATIONS)
        time_str = random.choice(TIMES)
        lang = "Italian" if i % 3 == 0 else "English"

        if lang == "English":
            date_label, date_fn = random.choice(list(DATE_EXPRS_EN.items()))
            date_iso = date_fn(today)
            intent = random.choice(CREATE_EN).format(
                ct=ct["name"], loc=loc, time=time_str, date_expr=date_label
            )
        else:
            date_label, date_fn = random.choice(list(DATE_EXPRS_IT.items()))
            date_iso = date_fn(today)
            intent = random.choice(CREATE_IT).format(
                ct=ct["name"], loc=loc, time=time_str, date_expr=date_label
            )

        sys = build_system_prompt(lang, today)
        turns = [
            u(intent),
            tc("create_class", {
                "class_type": ct["name"], "location": loc,
                "date": date_iso, "start_time": time_str,
            }),
            tr(f"Class created: {ct['name']} on {date_iso} at {time_str} at {loc}."),
            a(f"Done! {ct['name']} scheduled for {date_iso} at {time_str} at {loc}.")
            if lang == "English"
            else a(f"Fatto! {ct['name']} programmato per {date_iso} alle {time_str} presso {loc}."),
        ]
        out.append(ex(sys, turns))
    return out


# ── 2. cancel_class carry-over (15 examples) ─────────────────────────────────

CANCEL_EN = [
    "Cancel the {ct} class {date_expr} at {time}",
    "Please remove the {ct} session on {date_expr} at {time}",
    "I need to cancel {ct} scheduled for {date_expr} at {time}",
    "Can you cancel {ct} on {date_expr} at {time}?",
]
CANCEL_IT = [
    "Cancella la classe di {ct} {date_expr} alle {time}",
    "Rimuovi la sessione di {ct} {date_expr} alle {time}",
    "Devo cancellare {ct} previsto per {date_expr} alle {time}",
]


def gen_cancel_class(n: int) -> list[dict]:
    out = []
    for i in range(n):
        today = random.choice(ANCHOR_DATES)
        ct = random.choice(CLASS_TYPES)
        time_str = random.choice(TIMES)
        lang = "Italian" if i % 3 == 0 else "English"

        if lang == "English":
            date_label, date_fn = random.choice(list(DATE_EXPRS_EN.items()))
            date_iso = date_fn(today)
            intent = random.choice(CANCEL_EN).format(
                ct=ct["name"], time=time_str, date_expr=date_label
            )
            confirm_msg = f"Done. {ct['name']} on {date_iso} at {time_str} has been cancelled."
        else:
            date_label, date_fn = random.choice(list(DATE_EXPRS_IT.items()))
            date_iso = date_fn(today)
            intent = random.choice(CANCEL_IT).format(
                ct=ct["name"], time=time_str, date_expr=date_label
            )
            confirm_msg = f"Fatto. {ct['name']} del {date_iso} alle {time_str} è stata cancellata."

        sys = build_system_prompt(lang, today)
        turns = [
            u(intent),
            tc("cancel_class", {
                "class_type": ct["name"], "date": date_iso, "start_time": time_str,
            }),
            tr(f"Class {ct['name']} on {date_iso} at {time_str} has been cancelled."),
            a(confirm_msg),
        ]
        out.append(ex(sys, turns))
    return out


# ── 3. book_client (20 examples) ─────────────────────────────────────────────

BOOK_EN = [
    "Book {client} for {ct} tomorrow at {time}",
    "Reserve a spot for {client} in {ct} on {date_expr} at {time}",
    "Add {client} to the {ct} class {date_expr} at {time}",
    "Sign up {client} for {ct} this {date_expr} at {time}",
    "Please book {client} into {ct} {date_expr} at {time}",
]
BOOK_IT = [
    "Prenota {client} per {ct} domani alle {time}",
    "Aggiungi {client} alla classe di {ct} {date_expr} alle {time}",
    "Iscivi {client} a {ct} {date_expr} alle {time}",
    "Riserva un posto per {client} nel {ct} di {date_expr} alle {time}",
    "Metti {client} nella classe di {ct} di {date_expr} alle {time}",
]
BOOK_RESULTS = [
    "Booking created.",
    "Booking confirmed for {client} in {ct} on {date_iso} at {time}.",
    "Class full — {client} added to waitlist.",
]


def gen_book_client(n: int) -> list[dict]:
    out = []
    for i in range(n):
        today = random.choice(ANCHOR_DATES)
        client = random.choice(CLIENTS)
        ct = random.choice(CLASS_TYPES)
        time_str = random.choice(TIMES)
        lang = "Italian" if i % 2 == 0 else "English"

        if lang == "English":
            date_label, date_fn = random.choice(list(DATE_EXPRS_EN.items()))
            date_iso = date_fn(today)
            # Slot-fill: 4 out of 20 examples ask for missing class/time
            if i < 4:
                sys = build_system_prompt(lang, today)
                turns = [
                    u(f"Book {client} for a class"),
                    a(f"Which class would you like to book {client} into?"),
                    u(ct["name"]),
                    a("What date and time?"),
                    u(f"{date_label} at {time_str}"),
                    tc("book_client", {
                        "client": client, "class_type": ct["name"],
                        "date": date_iso, "start_time": time_str,
                    }),
                    tr("Booking created."),
                    a(f"Done! {client} is booked for {ct['name']} on {date_iso} at {time_str}."),
                ]
                out.append(ex(sys, turns))
                continue
            intent = random.choice(BOOK_EN).format(
                client=client, ct=ct["name"], time=time_str, date_expr=date_label
            )
            result_raw = random.choice(BOOK_RESULTS).format(
                client=client, ct=ct["name"], date_iso=date_iso, time=time_str
            )
            if "waitlist" in result_raw:
                reply = f"{client} has been added to the waitlist for {ct['name']} on {date_iso} at {time_str}."
            else:
                reply = f"Done! {client} is booked for {ct['name']} on {date_iso} at {time_str}."
        else:
            date_label, date_fn = random.choice(list(DATE_EXPRS_IT.items()))
            date_iso = date_fn(today)
            intent = random.choice(BOOK_IT).format(
                client=client, ct=ct["name"], time=time_str, date_expr=date_label
            )
            result_raw = "Booking created."
            reply = f"Fatto! {client} è stato prenotato per {ct['name']} il {date_iso} alle {time_str}."

        sys = build_system_prompt(lang, today)
        turns = [
            u(intent),
            tc("book_client", {
                "client": client, "class_type": ct["name"],
                "date": date_iso, "start_time": time_str,
            }),
            tr(result_raw),
            a(reply),
        ]
        out.append(ex(sys, turns))
    return out


# ── 4. cancel_booking — CRITICAL: multi-turn confirmation (25 examples) ──────

CANCEL_BOOKING_EN = [
    "Cancel {client}'s booking for {ct} tomorrow at {time}",
    "Remove {client}'s reservation for {ct} on {date_expr} at {time}",
    "Please cancel the booking for {client} in {ct} {date_expr} at {time}",
    "I need to cancel {client}'s spot in {ct} on {date_expr} at {time}",
    "Unbook {client} from {ct} {date_expr} at {time}",
]
CANCEL_BOOKING_IT = [
    "Cancella la prenotazione di {client} per {ct} domani alle {time}",
    "Rimuovi la prenotazione di {client} per {ct} {date_expr} alle {time}",
    "Devo cancellare la prenotazione di {client} a {ct} il {date_expr} alle {time}",
    "Elimina la prenotazione di {client} per {ct} di {date_expr} alle {time}",
    "Togli {client} dalla classe di {ct} {date_expr} alle {time}",
]

CONFIRM_WORDS_EN = ["Yes", "Go ahead", "Confirm", "Proceed", "Do it", "OK sure"]
CONFIRM_WORDS_IT = ["Sì", "Conferma", "Vai", "Procedi", "Sì, vai avanti", "Ok sì"]
DENY_WORDS_EN = ["No", "Cancel", "Never mind", "Stop", "Don't do it", "Abort"]
DENY_WORDS_IT = ["No", "Annulla", "Fermati", "Non farlo", "No grazie", "Lascia perdere"]


def gen_cancel_booking(n_confirm: int = 20, n_deny: int = 5) -> list[dict]:
    out = []
    # Confirmation cases
    for i in range(n_confirm):
        today = random.choice(ANCHOR_DATES)
        client = random.choice(CLIENTS)
        ct = random.choice(CLASS_TYPES)
        time_str = random.choice(TIMES)
        lang = "Italian" if i % 2 == 0 else "English"

        if lang == "English":
            date_label, date_fn = random.choice(list(DATE_EXPRS_EN.items()))
            date_iso = date_fn(today)
            intent = random.choice(CANCEL_BOOKING_EN).format(
                client=client, ct=ct["name"], time=time_str, date_expr=date_label
            )
            ask_confirm = (
                f"I'm about to cancel {client}'s booking for {ct['name']} on {date_iso} "
                f"at {time_str}. Shall I proceed?"
            )
            confirm_word = random.choice(CONFIRM_WORDS_EN)
            final_reply = (
                f"Done. {client}'s booking for {ct['name']} on {date_iso} at {time_str} "
                f"has been cancelled."
            )
        else:
            date_label, date_fn = random.choice(list(DATE_EXPRS_IT.items()))
            date_iso = date_fn(today)
            intent = random.choice(CANCEL_BOOKING_IT).format(
                client=client, ct=ct["name"], time=time_str, date_expr=date_label
            )
            ask_confirm = (
                f"Sto per cancellare la prenotazione di {client} per {ct['name']} "
                f"il {date_iso} alle {time_str}. Procedo?"
            )
            confirm_word = random.choice(CONFIRM_WORDS_IT)
            final_reply = (
                f"Fatto. La prenotazione di {client} per {ct['name']} "
                f"il {date_iso} alle {time_str} è stata cancellata."
            )

        sys = build_system_prompt(lang, today)
        turns = [
            u(intent),
            a(ask_confirm),
            u(confirm_word),
            tc("cancel_booking", {
                "client": client, "class_type": ct["name"],
                "date": date_iso, "start_time": time_str,
            }),
            tr("Booking cancelled."),
            a(final_reply),
        ]
        out.append(ex(sys, turns))

    # Denial cases — model must NOT call the tool
    for i in range(n_deny):
        today = random.choice(ANCHOR_DATES)
        client = random.choice(CLIENTS)
        ct = random.choice(CLASS_TYPES)
        time_str = random.choice(TIMES)
        lang = "Italian" if i % 2 == 0 else "English"

        if lang == "English":
            date_label, date_fn = random.choice(list(DATE_EXPRS_EN.items()))
            date_iso = date_fn(today)
            intent = random.choice(CANCEL_BOOKING_EN).format(
                client=client, ct=ct["name"], time=time_str, date_expr=date_label
            )
            ask_confirm = (
                f"I'm about to cancel {client}'s booking for {ct['name']} on {date_iso} "
                f"at {time_str}. Shall I proceed?"
            )
            deny_word = random.choice(DENY_WORDS_EN)
            abort_msg = f"OK, cancellation aborted. {client}'s booking for {ct['name']} on {date_iso} at {time_str} has been kept."
        else:
            date_label, date_fn = random.choice(list(DATE_EXPRS_IT.items()))
            date_iso = date_fn(today)
            intent = random.choice(CANCEL_BOOKING_IT).format(
                client=client, ct=ct["name"], time=time_str, date_expr=date_label
            )
            ask_confirm = (
                f"Sto per cancellare la prenotazione di {client} per {ct['name']} "
                f"il {date_iso} alle {time_str}. Procedo?"
            )
            deny_word = random.choice(DENY_WORDS_IT)
            abort_msg = f"OK, operazione annullata. La prenotazione di {client} per {ct['name']} il {date_iso} alle {time_str} è stata mantenuta."

        sys = build_system_prompt(lang, today)
        # No tool call here — the denial path ends with a plain assistant message
        turns = [
            u(intent),
            a(ask_confirm),
            u(deny_word),
            a(abort_msg),
        ]
        out.append(ex(sys, turns))

    return out


# ── 5. get_class_roster — CRITICAL: Italian phrasings (25 examples) ──────────

ROSTER_EN = [
    "Who is booked for {ct} tomorrow at {time}?",
    "Show me the roster for {ct} on {date_expr} at {time}",
    "Who signed up for {ct} {date_expr} at {time}?",
    "List the participants for {ct} {date_expr} at {time}",
    "How many people booked {ct} {date_expr} at {time}?",
    "Who's coming to {ct} on {date_expr} at {time}?",
    "Get the attendee list for {ct} {date_expr} at {time}",
]

# Italian phrasings — these are the critical regression fixes
ROSTER_IT = [
    "Chi ha prenotato {ct} {date_expr} alle {time}?",
    "Mostrami i prenotati per {ct} di {date_expr} alle {time}",
    "Chi è iscritto alla lezione di {ct} {date_expr} alle {time}?",
    "Lista presenti per {ct} domani alle {time}",
    "Quanti si sono prenotati per {ct} {date_expr}?",
    "Dammi l'elenco di chi ha prenotato {ct} {date_expr} alle {time}",
    "Chi viene a {ct} {date_expr} alle {time}?",
    "Partecipanti alla {ct} di {date_expr} alle {time}?",
    "Chi si è iscritto a {ct} domani alle {time}?",
    "Mostrami chi ha prenotato {ct} per {date_expr}",
    "Quante persone hanno prenotato {ct} {date_expr}?",
    "Fammi vedere i partecipanti a {ct} {date_expr} alle {time}",
]

ROSTER_RESULTS = [
    ("Maria Rossi, Luca Bianchi (2 booked, 18 spots remaining).",
     "2", "Maria Rossi e Luca Bianchi", "18"),
    ("No bookings yet.", "0", None, None),
    ("Elena Ferrari, Marco Verdi, Sara Neri (3 booked, 17 spots remaining).",
     "3", "Elena Ferrari, Marco Verdi e Sara Neri", "17"),
    ("Maria Rossi (1 booked, 19 spots remaining).",
     "1", "Maria Rossi", "19"),
    ("Maria Rossi, Luca Bianchi, Elena Ferrari, Marco Verdi (4 booked, 16 spots remaining).",
     "4", "Maria Rossi, Luca Bianchi, Elena Ferrari e Marco Verdi", "16"),
]


def gen_get_class_roster(n: int) -> list[dict]:
    out = []
    it_count = 0
    for i in range(n):
        today = random.choice(ANCHOR_DATES)
        ct = random.choice(CLASS_TYPES)
        time_str = random.choice(TIMES)
        # Ensure at least 8 Italian examples in 25 total
        use_italian = it_count < 8 or (i % 2 == 0 and it_count < 15)
        lang = "Italian" if use_italian else "English"

        roster_result, count, names_it, remaining = random.choice(ROSTER_RESULTS)

        if lang == "English":
            date_label, date_fn = random.choice(list(DATE_EXPRS_EN.items()))
            date_iso = date_fn(today)
            intent = random.choice(ROSTER_EN).format(
                ct=ct["name"], time=time_str, date_expr=date_label
            )
            if count == "0":
                reply = f"No one has booked {ct['name']} on {date_iso} at {time_str} yet."
            else:
                names_en = roster_result.split(" (")[0]
                rem_str = roster_result.split("spots remaining")[0].split(", ")[-1].strip()
                reply = (
                    f"{count} client(s) booked for {ct['name']} on {date_iso} at {time_str}: "
                    f"{names_en}. {rem_str} spots remaining."
                )
        else:
            it_count += 1
            date_label, date_fn = random.choice(list(DATE_EXPRS_IT.items()))
            date_iso = date_fn(today)
            intent = random.choice(ROSTER_IT).format(
                ct=ct["name"], time=time_str, date_expr=date_label
            )
            if count == "0":
                reply = f"Non ci sono ancora prenotazioni per {ct['name']} il {date_iso} alle {time_str}."
            else:
                reply = (
                    f"Ci sono {count} prenotati per {ct['name']} il {date_iso} alle {time_str}: "
                    f"{names_it}. Restano {remaining} posti."
                )

        sys = build_system_prompt(lang, today)
        turns = [
            u(intent),
            tc("get_class_roster", {
                "class_type": ct["name"], "date": date_iso, "start_time": time_str,
            }),
            tr(roster_result),
            a(reply),
        ]
        out.append(ex(sys, turns))
    return out


# ── 6. check_in_client (15 examples) ─────────────────────────────────────────

CHECKIN_EN = [
    "Check in {client} for {ct} at {time}",
    "Mark {client} as checked in for {ct} now",
    "Record check-in for {client}, {ct} class at {time}",
    "Check {client} in for the {ct} session at {time}",
    "{client} has arrived for {ct} at {time}, check them in",
]
CHECKIN_IT = [
    "Fai il check-in di {client} per {ct} delle {time}",
    "Segna {client} come presente per {ct} alle {time}",
    "Registra l'entrata di {client} per {ct} alle {time}",
    "{client} è arrivato per {ct} alle {time}, fai il check-in",
    "Check-in di {client} per il {ct} delle {time}",
]
CHECKIN_RESULTS = [
    "Check-in recorded.",
    "Client not booked for this class.",
]


def gen_check_in_client(n: int) -> list[dict]:
    out = []
    for i in range(n):
        today = random.choice(ANCHOR_DATES)
        client = random.choice(CLIENTS)
        ct = random.choice(CLASS_TYPES)
        time_str = random.choice(TIMES)
        lang = "Italian" if i % 2 == 0 else "English"
        result = random.choice(CHECKIN_RESULTS)

        if lang == "English":
            intent = random.choice(CHECKIN_EN).format(
                client=client, ct=ct["name"], time=time_str
            )
            if "not booked" in result:
                reply = f"{client} is not booked for {ct['name']} at {time_str}. Check-in was not recorded."
            else:
                reply = f"Check-in recorded for {client} at {ct['name']} at {time_str}."
        else:
            intent = random.choice(CHECKIN_IT).format(
                client=client, ct=ct["name"], time=time_str
            )
            if "not booked" in result:
                reply = f"{client} non risulta prenotato per {ct['name']} alle {time_str}. Check-in non registrato."
            else:
                reply = f"Check-in registrato per {client} al {ct['name']} delle {time_str}."

        date_iso = today.isoformat()
        sys = build_system_prompt(lang, today)
        turns = [
            u(intent),
            tc("check_in_client", {
                "client": client, "class_type": ct["name"],
                "date": date_iso, "start_time": time_str,
            }),
            tr(result),
            a(reply),
        ]
        out.append(ex(sys, turns))
    return out


# ── 7. create_client (15 examples) ────────────────────────────────────────────

NEW_CLIENTS_EN = [
    ("Marco Bianchi", "marco.bianchi@example.com", "+39 333 1234567"),
    ("Sara Ferrari",  "sara.ferrari@test.it",      None),
    ("Luca Verdi",    "luca.v@studio.com",          "+39 347 9876543"),
    ("Elena Romano",  "elena.romano@mail.it",       None),
    ("Giulia Neri",   "giulia.neri@gym.com",        "+39 338 5555555"),
]
CREATE_CLIENT_EN = [
    "Add a new client: {name}, {email}",
    "Create a client record for {name}, email {email}, phone {phone}",
    "Register {name} as a new client — email: {email}",
    "New client: {name}, {email}, {phone}",
    "Please add {name} to the client list. Email: {email}",
]
CREATE_CLIENT_IT = [
    "Aggiungi un nuovo cliente: {name}, {email}",
    "Crea il profilo cliente per {name}, email {email}, telefono {phone}",
    "Registra {name} come nuovo cliente — email: {email}",
    "Nuovo cliente: {name}, {email}, {phone}",
    "Inserisci {name} nell'elenco clienti. Email: {email}",
]


def gen_create_client(n: int) -> list[dict]:
    out = []
    for i in range(n):
        today = random.choice(ANCHOR_DATES)
        name, email, phone = random.choice(NEW_CLIENTS_EN)
        lang = "Italian" if i % 2 == 0 else "English"
        has_phone = phone is not None

        if lang == "English":
            if i < 3:
                # Slot-filling: user gives name only
                sys = build_system_prompt(lang, today)
                turns = [
                    u(f"Add a new client called {name}"),
                    a(f"What is {name}'s email address?"),
                    u(email),
                    tc("create_client", {"full_name": name, "email": email}),
                    tr("Client created."),
                    a(f"Done! {name} has been added as a new client with email {email}."),
                ]
                out.append(ex(sys, turns))
                continue
            if has_phone:
                intent = random.choice(CREATE_CLIENT_EN).format(
                    name=name, email=email, phone=phone
                )
                args = {"full_name": name, "email": email, "phone": phone}
            else:
                intent = random.choice(CREATE_CLIENT_EN[:2]).format(
                    name=name, email=email, phone=""
                ).strip(", ")
                args = {"full_name": name, "email": email}
            reply = f"Done! {name} has been added as a new client."
        else:
            if i < 3:
                sys = build_system_prompt(lang, today)
                turns = [
                    u(f"Aggiungi un nuovo cliente di nome {name}"),
                    a(f"Qual è l'email di {name}?"),
                    u(email),
                    tc("create_client", {"full_name": name, "email": email}),
                    tr("Client created."),
                    a(f"Fatto! {name} è stato aggiunto come nuovo cliente con email {email}."),
                ]
                out.append(ex(sys, turns))
                continue
            if has_phone:
                intent = random.choice(CREATE_CLIENT_IT).format(
                    name=name, email=email, phone=phone
                )
                args = {"full_name": name, "email": email, "phone": phone}
            else:
                intent = random.choice(CREATE_CLIENT_IT[:2]).format(
                    name=name, email=email, phone=""
                ).strip(", ")
                args = {"full_name": name, "email": email}
            reply = f"Fatto! {name} è stato aggiunto come nuovo cliente."

        sys = build_system_prompt(lang, today)
        turns = [
            u(intent),
            tc("create_client", args),
            tr("Client created."),
            a(reply),
        ]
        out.append(ex(sys, turns))
    return out


# ── 8. assign_membership (15 examples) ───────────────────────────────────────

ASSIGN_EN = [
    "Assign the {mem} membership to {client}",
    "Give {client} a {mem} membership starting today",
    "Sign {client} up for the {mem} plan",
    "Activate a {mem} membership for {client}",
    "{client} wants to join with the {mem} option",
]
ASSIGN_IT = [
    "Assegna l'abbonamento {mem_it} a {client}",
    "Dai il {mem_it} a {client}",
    "Attiva un {mem_it} per {client}",
    "Iscivi {client} con il pacchetto {mem_it}",
    "{client} vuole abbonarsi con il piano {mem_it}",
]
MEM_IT_MAP = {
    "Monthly Unlimited": "abbonamento mensile illimitato",
    "10-Class Pack":     "pacchetto 10 lezioni",
    "Drop-in":           "drop-in",
}
MEM_ALIASES_IT = {
    "abbonamento mensile": "Monthly Unlimited",
    "mensile illimitato":  "Monthly Unlimited",
    "pacchetto 10":        "10-Class Pack",
    "10 lezioni":          "10-Class Pack",
    "drop in":             "Drop-in",
}


def gen_assign_membership(n: int) -> list[dict]:
    out = []
    for i in range(n):
        today = random.choice(ANCHOR_DATES)
        client = random.choice(CLIENTS)
        mem = random.choice(MEMBERSHIP_TYPES)
        lang = "Italian" if i % 2 == 0 else "English"

        if lang == "English":
            intent = random.choice(ASSIGN_EN).format(client=client, mem=mem)
            reply = f"Done! {mem} membership has been assigned to {client}."
        else:
            mem_it = MEM_IT_MAP[mem]
            intent = random.choice(ASSIGN_IT).format(client=client, mem_it=mem_it)
            reply = f"Fatto! Abbonamento {mem_it} assegnato a {client}."

        args = {"client": client, "membership_type": mem}
        if i % 5 == 0:
            args["starts_at"] = today.isoformat()

        sys = build_system_prompt(lang, today)
        turns = [
            u(intent),
            tc("assign_membership", args),
            tr(f"Membership {mem} assigned to {client}."),
            a(reply),
        ]
        out.append(ex(sys, turns))
    return out


# ── 9. get_report — CRITICAL: Italian keyword mapping (25 examples) ──────────

# Italian trigger phrases → report type
REPORT_TRIGGERS_IT = {
    "revenue": [
        "Mostrami le entrate dell'ultimo mese",
        "Quanto abbiamo guadagnato questo mese?",
        "Dammi il fatturato degli ultimi 30 giorni",
        "Qual è stato l'incasso della settimana scorsa?",
        "Voglio vedere le entrate di questo mese",
        "Mostrami il fatturato dell'ultima settimana",
        "Quanto abbiamo incassato negli ultimi 7 giorni?",
    ],
    "attendance": [
        "Quante persone sono venute alle lezioni questa settimana?",
        "Mostrami le presenze del mese scorso",
        "Dammi le affluenze dell'ultimo mese",
        "Quante presenze abbiamo avuto negli ultimi 30 giorni?",
        "Voglio vedere il report presenze di questo mese",
        "Quante persone hanno partecipato alle classi questa settimana?",
        "Mostrami l'affluenza degli ultimi 7 giorni",
    ],
    "membership": [
        "Quanti abbonamenti attivi abbiamo questo mese?",
        "Mostrami le iscrizioni dell'ultimo mese",
        "Quanti abbonati abbiamo avuto negli ultimi 30 giorni?",
        "Dammi il report abbonamenti di questo mese",
        "Quante iscrizioni nuove abbiamo avuto questa settimana?",
        "Voglio vedere le iscrizioni degli ultimi 7 giorni",
    ],
    "retention": [
        "Mostrami la retention dei clienti dell'ultimo mese",
        "Quanti clienti tornano regolarmente? Report degli ultimi 30 giorni",
        "Voglio vedere la fidelizzazione dei clienti di questo mese",
        "Quanti clienti fedeli abbiamo? Ultimi 30 giorni",
    ],
}

REPORT_TRIGGERS_EN = {
    "revenue": [
        "Show me the revenue for last month",
        "What were our total earnings this month?",
        "Give me the revenue report for the last 30 days",
        "How much did we make last week?",
        "Pull up the revenue for the past 7 days",
    ],
    "attendance": [
        "How many people attended classes this week?",
        "Show me the attendance report for last month",
        "How many check-ins did we have in the last 30 days?",
        "Give me an attendance summary for this month",
        "What's the attendance like for the past 7 days?",
    ],
    "membership": [
        "How many active memberships do we have this month?",
        "Show me the membership report for the last 30 days",
        "How many new memberships were sold this week?",
        "Give me a membership summary for this month",
    ],
    "retention": [
        "What is our client retention rate this month?",
        "Show me the retention report for the last 30 days",
        "How many clients came back in the past month?",
    ],
}

REPORT_REPLIES_EN = {
    "revenue":    "Revenue report for {start} to {end}: €12,450 total revenue.",
    "attendance": "Attendance report for {start} to {end}: 342 check-ins across all classes.",
    "membership": "Membership report for {start} to {end}: 87 active memberships, 12 new sign-ups.",
    "retention":  "Retention report for {start} to {end}: 68% of clients returned within 30 days.",
}
REPORT_REPLIES_IT = {
    "revenue":    "Report entrate dal {start} al {end}: €12.450 di fatturato totale.",
    "attendance": "Report presenze dal {start} al {end}: 342 check-in in tutte le classi.",
    "membership": "Report abbonamenti dal {start} al {end}: 87 abbonamenti attivi, 12 nuovi iscritti.",
    "retention":  "Report fidelizzazione dal {start} al {end}: il 68% dei clienti è tornato negli ultimi 30 giorni.",
}


def _date_range_for_phrase(phrase: str, today: date) -> tuple[str, str]:
    """Return (start_date, end_date) based on phrase keywords."""
    if "settimana" in phrase.lower() or "week" in phrase.lower() or "7 day" in phrase.lower() or "7 giorni" in phrase.lower():
        return last_n_days(today, 7)
    if "mese scorso" in phrase.lower() or "last month" in phrase.lower():
        return last_n_days(today, 30)
    return this_month(today)


def gen_get_report(n: int) -> list[dict]:
    out = []
    report_types = list(REPORT_TRIGGERS_IT.keys())  # revenue, attendance, membership, retention
    it_count = 0
    en_count = 0

    for i in range(n):
        today = random.choice(ANCHOR_DATES)
        # Cycle through types to ensure good coverage
        rtype = report_types[i % len(report_types)]
        # Alternate IT/EN, ensure at least 12 IT examples
        use_it = it_count < 12 or (i % 2 == 0 and it_count < 16)
        lang = "Italian" if use_it else "English"

        if lang == "Italian":
            it_count += 1
            phrases = REPORT_TRIGGERS_IT[rtype]
            phrase = random.choice(phrases)
            start, end = _date_range_for_phrase(phrase, today)
            reply_tpl = REPORT_REPLIES_IT[rtype]
        else:
            en_count += 1
            phrases = REPORT_TRIGGERS_EN[rtype]
            phrase = random.choice(phrases)
            start, end = _date_range_for_phrase(phrase, today)
            reply_tpl = REPORT_REPLIES_EN[rtype]

        reply = reply_tpl.format(start=start, end=end)
        sys = build_system_prompt(lang, today)
        turns = [
            u(phrase),
            tc("get_report", {"type": rtype, "start_date": start, "end_date": end}),
            tr(f"Report generated: {rtype} from {start} to {end}."),
            a(reply),
        ]
        out.append(ex(sys, turns))
    return out


# ── Main ──────────────────────────────────────────────────────────────────────

def generate_all() -> list[dict]:
    examples: list[dict] = []

    examples += gen_create_class(24)
    examples += gen_cancel_class(18)
    examples += gen_book_client(24)
    examples += gen_cancel_booking(n_confirm=24, n_deny=6)
    examples += gen_get_class_roster(30)
    examples += gen_check_in_client(18)
    examples += gen_create_client(18)
    examples += gen_assign_membership(18)
    examples += gen_get_report(30)

    random.shuffle(examples)
    return examples


if __name__ == "__main__":
    print("Generating Phase L fine-tuning dataset...")
    examples = generate_all()
    print(f"Total examples: {len(examples)}")

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        for ex_item in examples:
            f.write(json.dumps(ex_item, ensure_ascii=False) + "\n")

    print(f"Written to: {OUT_FILE}")

    # Quick validation
    with open(OUT_FILE, encoding="utf-8") as f:
        lines = f.readlines()
    print(f"Lines in file: {len(lines)}")

    errors = 0
    for i, line in enumerate(lines):
        try:
            obj = json.loads(line)
            assert "messages" in obj
            assert isinstance(obj["messages"], list)
            assert len(obj["messages"]) >= 2
        except Exception as exc:
            print(f"  ERROR line {i+1}: {exc}")
            errors += 1

    if errors == 0:
        print("All lines are valid JSON with messages array.")
    else:
        print(f"{errors} validation error(s) found.")
