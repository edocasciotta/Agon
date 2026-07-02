#!/usr/bin/env python3
"""
Agon fine-tuning dataset generator.

Generates ~1500 synthetic multi-turn conversations for fine-tuning Llama 3.2
on Agon-specific tasks: create_class, cancel_class, documentation Q&A, and
multi-language support.

All examples are template-based (no external API calls required).

Usage (from repo root):
    python training/scripts/generate_dataset.py

Output:
    training/dataset/train.jsonl   (~1200 examples)
    training/dataset/valid.jsonl   (~150 examples)
    training/dataset/test.jsonl    (~150 examples)
"""

import json
import random
from datetime import date, timedelta
from pathlib import Path

# ── Reproducibility ──────────────────────────────────────────────────────────
random.seed(42)

ROOT = Path(__file__).parent.parent
DATASET_DIR = ROOT / "dataset"
DATASET_DIR.mkdir(exist_ok=True)

# ── Studio fixtures ───────────────────────────────────────────────────────────
with open(ROOT / "config" / "studio_fixtures.json") as f:
    FIXTURES = json.load(f)

LOCATIONS = FIXTURES["locations"]
CLASS_TYPES = FIXTURES["class_types"]
INSTRUCTORS = FIXTURES["instructors"]

CT_BY_NAME = {ct["name"]: ct for ct in CLASS_TYPES}

# ── Supported languages ───────────────────────────────────────────────────────
LANGUAGES = {
    "en": "English",
    "it": "Italian",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "nl": "Dutch",
}

# ── Training anchor dates (rotate across weekdays for generalisation) ─────────
# The model must learn the PATTERN ("tomorrow = today+1"), not a specific date.
ANCHOR_DATES = [
    date(2026, 7, 2),   # Thursday
    date(2026, 7, 6),   # Monday
    date(2026, 7, 8),   # Wednesday
    date(2026, 7, 10),  # Friday
    date(2026, 7, 13),  # Monday
    date(2026, 7, 15),  # Wednesday
    date(2026, 7, 17),  # Friday
]


# ── System prompt builder (mirrors runtime prompt structure) ──────────────────

def _week_calendar(today: date) -> str:
    monday = today - timedelta(days=today.weekday())
    lines = []
    for i in range(7):
        d = monday + timedelta(days=i)
        marker = " <- today" if d == today else ""
        lines.append(f"  {d.strftime('%A')}: {d.isoformat()}{marker}")
    return "\n".join(lines)


def _studio_data_block(loc_override: str | None = None) -> str:
    locs = [loc_override] if loc_override else LOCATIONS
    loc_list = ", ".join(locs)
    ct_list = ", ".join(ct["name"] for ct in CLASS_TYPES)
    instr_list = ", ".join(INSTRUCTORS)
    return (
        f"Locations: {loc_list}\n"
        f"Class types: {ct_list}\n"
        f"Instructors: {instr_list}"
    )


def build_system_prompt(lang: str, today: date, single_location: str | None = None) -> str:
    language_name = LANGUAGES[lang]
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)
    studio_data = _studio_data_block(single_location)
    return (
        f"=== LANGUAGE RULE — ABSOLUTE PRIORITY ===\n"
        f"You MUST respond ONLY in {language_name}. This rule overrides everything else.\n"
        f"Even if the user writes in another language, your reply must ALWAYS be in {language_name}.\n"
        f"=========================================\n\n"
        f"You are the built-in AI assistant for Agon, a fitness studio management application.\n\n"
        f"DATE REFERENCE (do not compute — use these exact values):\n"
        f"  Today      : {today.isoformat()} ({today.strftime('%A')})\n"
        f"  Tomorrow   : {tomorrow.isoformat()} ({tomorrow.strftime('%A')})\n"
        f"  In 2 days  : {day_after.isoformat()} ({day_after.strftime('%A')})\n"
        f"  This week  :\n{_week_calendar(today)}\n\n"
        f"FORMATTING RULES: Do NOT use markdown. Plain text only.\n\n"
        f"STUDIO DATA:\n{studio_data}\n\n"
        f"You can perform actions:\n"
        f"- Create a class  → call create_class\n"
        f"- Cancel a class  → call cancel_class\n\n"
        f"=== REMINDER: respond ONLY in {language_name} ==="
    )


# ── Tool call helpers ─────────────────────────────────────────────────────────

def tool_call(name: str, args: dict, call_id: str = "call_0") -> dict:
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [{
            "id": call_id,
            "type": "function",
            "function": {"name": name, "arguments": json.dumps(args)},
        }],
    }


def tool_result(content: str, call_id: str = "call_0") -> dict:
    return {"role": "tool", "tool_call_id": call_id, "content": content}


def assistant(text: str) -> dict:
    return {"role": "assistant", "content": text}


def user(text: str) -> dict:
    return {"role": "user", "content": text}


def make_example(system: str, turns: list[dict]) -> dict:
    return {"messages": [{"role": "system", "content": system}] + turns}


# ── Localised strings ─────────────────────────────────────────────────────────

# Confirmation messages after a successful create_class (one per language).
def confirm_created(lang: str, ct_name: str, date_str: str, time_str: str, location: str, capacity: int) -> str:
    d = date.fromisoformat(date_str)
    date_display = d.strftime("%A %d %B %Y")
    templates = {
        "en": f"Done! I've scheduled {ct_name} for {date_display} at {time_str} at {location}, capacity {capacity}.",
        "it": f"Fatto! Ho programmato {ct_name} per {date_display} alle {time_str} presso {location}, capienza {capacity}.",
        "fr": f"C'est fait ! J'ai programmé {ct_name} pour le {date_display} à {time_str} au lieu {location}, capacité {capacity}.",
        "de": f"Erledigt! Ich habe {ct_name} für {date_display} um {time_str} Uhr im {location} geplant, Kapazität {capacity}.",
        "es": f"¡Listo! He programado {ct_name} para el {date_display} a las {time_str} en {location}, capacidad {capacity}.",
        "pt": f"Pronto! Agendei {ct_name} para {date_display} às {time_str} no {location}, capacidade {capacity}.",
        "nl": f"Klaar! Ik heb {ct_name} ingepland voor {date_display} om {time_str} in {location}, capaciteit {capacity}.",
    }
    return templates.get(lang, templates["en"])


def confirm_cancelled(lang: str, ct_name: str, date_str: str, time_str: str) -> str:
    d = date.fromisoformat(date_str)
    date_display = d.strftime("%A %d %B %Y")
    templates = {
        "en": f"Done. I've cancelled {ct_name} on {date_display} at {time_str}.",
        "it": f"Fatto. Ho cancellato {ct_name} del {date_display} alle {time_str}.",
        "fr": f"C'est fait. J'ai annulé {ct_name} du {date_display} à {time_str}.",
        "de": f"Erledigt. Ich habe {ct_name} am {date_display} um {time_str} Uhr storniert.",
        "es": f"Listo. He cancelado {ct_name} del {date_display} a las {time_str}.",
        "pt": f"Feito. Cancelei {ct_name} de {date_display} às {time_str}.",
        "nl": f"Klaar. Ik heb {ct_name} op {date_display} om {time_str} geannuleerd.",
    }
    return templates.get(lang, templates["en"])


# Ask-for-missing-field prompts (when user doesn't provide a required field).
ASK_CLASS_TYPE = {
    "en": lambda opts: f"What type of class would you like to create? Available: {opts}.",
    "it": lambda opts: f"Che tipo di classe vuoi creare? Disponibili: {opts}.",
    "fr": lambda opts: f"Quel type de cours souhaitez-vous créer ? Disponibles : {opts}.",
    "de": lambda opts: f"Welchen Kurstyp möchten Sie erstellen? Verfügbar: {opts}.",
    "es": lambda opts: f"¿Qué tipo de clase quiere crear? Disponibles: {opts}.",
    "pt": lambda opts: f"Que tipo de aula você quer criar? Disponíveis: {opts}.",
    "nl": lambda opts: f"Welk type les wilt u aanmaken? Beschikbaar: {opts}.",
}
ASK_LOCATION = {
    "en": lambda opts: f"Which location? Available: {opts}.",
    "it": lambda opts: f"In quale sede? Disponibili: {opts}.",
    "fr": lambda opts: f"Quel lieu ? Disponibles : {opts}.",
    "de": lambda opts: f"Welcher Standort? Verfügbar: {opts}.",
    "es": lambda opts: f"¿Qué ubicación? Disponibles: {opts}.",
    "pt": lambda opts: f"Qual local? Disponíveis: {opts}.",
    "nl": lambda opts: f"Welke locatie? Beschikbaar: {opts}.",
}
ASK_DATE = {
    "en": "What date should the class be on? (e.g. 'next Wednesday' or an exact date)",
    "it": "Per quale data vuoi creare la classe? (es. 'mercoledì prossimo' o una data precisa)",
    "fr": "Pour quelle date voulez-vous le cours ? (ex. 'mercredi prochain' ou une date précise)",
    "de": "Für welches Datum möchten Sie den Kurs? (z.B. 'nächsten Mittwoch' oder ein genaues Datum)",
    "es": "¿Para qué fecha quiere la clase? (ej. 'el próximo miércoles' o una fecha exacta)",
    "pt": "Para qual data você quer a aula? (ex. 'próxima quarta-feira' ou uma data exata)",
    "nl": "Voor welke datum wilt u de les? (bijv. 'volgende woensdag' of een exacte datum)",
}
ASK_TIME = {
    "en": "What time should the class start?",
    "it": "A che ora deve iniziare la classe?",
    "fr": "À quelle heure le cours doit-il commencer ?",
    "de": "Um wie viel Uhr soll der Kurs beginnen?",
    "es": "¿A qué hora debe empezar la clase?",
    "pt": "A que horas deve começar a aula?",
    "nl": "Hoe laat moet de les beginnen?",
}

# User intents expressed in different ways (English only — translated examples
# are generated separately in the multi-language section).
CREATE_INTENTS = [
    "I'd like to schedule a {ct} class {date_expr} at {time} at {loc}",
    "Can you create a {ct} session {date_expr} at {time} in {loc}?",
    "Please add a {ct} class on {date_expr} at {time}, location {loc}",
    "Schedule {ct} for {date_expr} at {time} — {loc}",
    "I need a {ct} class {date_expr} at {time} ({loc})",
    "Book a {ct} {date_expr} at {time} at {loc}",
    "Add {ct} to the calendar for {date_expr} at {time} at {loc}",
    "Create {ct} {date_expr} {time} {loc}",
]

CREATE_VAGUE_INTENTS = [
    "I want to create a new class",
    "I'd like to add a class to the schedule",
    "Can you schedule a class for me?",
    "I need to add a session",
    "Please create a new class",
    "Add a class to the timetable",
]

DATE_EXPRS = {
    "tomorrow":           lambda today: (today + timedelta(days=1)).isoformat(),
    "the day after tomorrow": lambda today: (today + timedelta(days=2)).isoformat(),
    "next Monday":        lambda today: _next_weekday(today, 0),
    "next Wednesday":     lambda today: _next_weekday(today, 2),
    "next Friday":        lambda today: _next_weekday(today, 4),
    "next Saturday":      lambda today: _next_weekday(today, 5),
    "in 3 days":          lambda today: (today + timedelta(days=3)).isoformat(),
}

TIMES = ["07:00", "08:00", "09:00", "09:30", "10:00", "11:00", "12:00",
         "17:00", "18:00", "18:30", "19:00", "20:00", "21:00"]


def _next_weekday(today: date, weekday: int) -> str:
    days_ahead = (weekday - today.weekday()) % 7 or 7
    return (today + timedelta(days=days_ahead)).isoformat()


# ── Generator functions ───────────────────────────────────────────────────────

def gen_create_happy_path(today: date, lang: str = "en") -> list[dict]:
    """One-shot create_class: user provides all info, model calls tool immediately."""
    examples = []
    ct = random.choice(CLASS_TYPES)
    loc = random.choice(LOCATIONS)
    date_expr, date_fn = random.choice(list(DATE_EXPRS.items()))
    date_iso = date_fn(today)
    time_str = random.choice(TIMES)
    include_instructor = random.random() < 0.3
    instructor = random.choice(INSTRUCTORS) if include_instructor else None

    intent_tpl = random.choice(CREATE_INTENTS)
    user_text = intent_tpl.format(
        ct=ct["name"], date_expr=date_expr, time=time_str, loc=loc
    )
    if instructor:
        user_text += f" with {instructor}"

    args = {
        "class_type": ct["name"],
        "location": loc,
        "date": date_iso,
        "start_time": time_str,
    }
    if instructor:
        args["instructor"] = instructor

    tool_result_text = (
        f"Class created: {ct['name']} on {date_iso} at {time_str} "
        f"at {loc}, capacity {ct['capacity']}."
    )
    confirm = confirm_created(lang, ct["name"], date_iso, time_str, loc, ct["capacity"])

    system = build_system_prompt(lang, today)
    turns = [
        user(user_text),
        tool_call("create_class", args),
        tool_result(tool_result_text),
        assistant(confirm),
    ]
    examples.append(make_example(system, turns))
    return examples


def gen_create_slot_filling(today: date, lang: str = "en") -> list[dict]:
    """Multi-turn create_class: user starts vague, model asks for missing fields one by one."""
    ct = random.choice(CLASS_TYPES)
    loc = random.choice(LOCATIONS)
    date_expr, date_fn = random.choice(list(DATE_EXPRS.items()))
    date_iso = date_fn(today)
    time_str = random.choice(TIMES)
    opts_ct = ", ".join(c["name"] for c in CLASS_TYPES)
    opts_loc = ", ".join(LOCATIONS)

    system = build_system_prompt(lang, today)

    # Pattern A: user gives nothing → model asks type → user answers → model asks location → ...
    turns_a = [
        user(random.choice(CREATE_VAGUE_INTENTS)),
        assistant(ASK_CLASS_TYPE[lang](opts_ct)),
        user(ct["name"]),
        assistant(ASK_LOCATION[lang](opts_loc)),
        user(loc),
        assistant(ASK_DATE[lang]),
        user(date_expr),
        assistant(ASK_TIME[lang]),
        user(f"at {time_str}"),
        tool_call("create_class", {
            "class_type": ct["name"], "location": loc,
            "date": date_iso, "start_time": time_str,
        }),
        tool_result(f"Class created: {ct['name']} on {date_iso} at {time_str} at {loc}."),
        assistant(confirm_created(lang, ct["name"], date_iso, time_str, loc, ct["capacity"])),
    ]

    # Pattern B: user gives class type + date but not location or time
    turns_b = [
        user(f"I'd like to schedule {ct['name']} on {date_expr}"),
        assistant(ASK_LOCATION[lang](opts_loc)),
        user(loc),
        assistant(ASK_TIME[lang]),
        user(f"{time_str}"),
        tool_call("create_class", {
            "class_type": ct["name"], "location": loc,
            "date": date_iso, "start_time": time_str,
        }),
        tool_result(f"Class created."),
        assistant(confirm_created(lang, ct["name"], date_iso, time_str, loc, ct["capacity"])),
    ]

    # Pattern C: user gives everything except time
    turns_c = [
        user(f"Create a {ct['name']} class {date_expr} at {loc}"),
        assistant(ASK_TIME[lang]),
        user(f"at {time_str}"),
        tool_call("create_class", {
            "class_type": ct["name"], "location": loc,
            "date": date_iso, "start_time": time_str,
        }),
        tool_result(f"Class created."),
        assistant(confirm_created(lang, ct["name"], date_iso, time_str, loc, ct["capacity"])),
    ]

    pattern = random.choice([turns_a, turns_b, turns_c])
    return [make_example(system, pattern)]


def gen_create_single_location(today: date, lang: str = "en") -> list[dict]:
    """When there is only one location, the model should not ask for it."""
    ct = random.choice(CLASS_TYPES)
    loc = LOCATIONS[0]  # only one
    date_expr, date_fn = random.choice(list(DATE_EXPRS.items()))
    date_iso = date_fn(today)
    time_str = random.choice(TIMES)

    system = build_system_prompt(lang, today, single_location=loc)
    turns = [
        user(f"Schedule a {ct['name']} class {date_expr} at {time_str}"),
        tool_call("create_class", {
            "class_type": ct["name"], "location": loc,
            "date": date_iso, "start_time": time_str,
        }),
        tool_result(f"Class created."),
        assistant(confirm_created(lang, ct["name"], date_iso, time_str, loc, ct["capacity"])),
    ]
    return [make_example(system, turns)]


def gen_cancel_happy_path(today: date, lang: str = "en") -> list[dict]:
    """Cancel a class that exists."""
    ct = random.choice(CLASS_TYPES)
    date_expr, date_fn = random.choice(list(DATE_EXPRS.items()))
    date_iso = date_fn(today)
    time_str = random.choice(TIMES)

    CANCEL_INTENTS = [
        f"Cancel the {ct['name']} class {date_expr} at {time_str}",
        f"Please remove the {ct['name']} session on {date_expr} at {time_str}",
        f"I need to cancel {ct['name']} scheduled for {date_expr} at {time_str}",
        f"Can you cancel {ct['name']} on {date_expr} at {time_str}?",
        f"Delete the {ct['name']} class for {date_expr} at {time_str}",
    ]

    system = build_system_prompt(lang, today)
    turns = [
        user(random.choice(CANCEL_INTENTS)),
        tool_call("cancel_class", {
            "class_type": ct["name"], "date": date_iso, "start_time": time_str,
        }),
        tool_result(f"Class {ct['name']} on {date_iso} at {time_str} has been cancelled."),
        assistant(confirm_cancelled(lang, ct["name"], date_iso, time_str)),
    ]
    return [make_example(system, turns)]


def gen_cancel_not_found(today: date, lang: str = "en") -> list[dict]:
    """Cancel a class that doesn't exist — model should communicate the error."""
    ct = random.choice(CLASS_TYPES)
    date_expr, date_fn = random.choice(list(DATE_EXPRS.items()))
    date_iso = date_fn(today)
    time_str = random.choice(TIMES)

    NOT_FOUND = {
        "en": f"I couldn't find a {ct['name']} class on {date.fromisoformat(date_iso).strftime('%A %d %B')} at {time_str}. Please check the date and time.",
        "it": f"Non ho trovato una classe {ct['name']} il {date.fromisoformat(date_iso).strftime('%A %d %B')} alle {time_str}. Controlla la data e l'orario.",
        "fr": f"Je n'ai pas trouvé de cours {ct['name']} le {date.fromisoformat(date_iso).strftime('%A %d %B')} à {time_str}. Vérifiez la date et l'heure.",
        "de": f"Ich habe keinen {ct['name']}-Kurs am {date.fromisoformat(date_iso).strftime('%A %d. %B')} um {time_str} Uhr gefunden. Bitte Datum und Uhrzeit prüfen.",
        "es": f"No encontré una clase de {ct['name']} el {date.fromisoformat(date_iso).strftime('%A %d de %B')} a las {time_str}. Comprueba la fecha y la hora.",
        "pt": f"Não encontrei uma aula de {ct['name']} em {date.fromisoformat(date_iso).strftime('%A %d de %B')} às {time_str}. Verifique a data e o horário.",
        "nl": f"Ik heb geen {ct['name']}-les gevonden op {date.fromisoformat(date_iso).strftime('%A %d %B')} om {time_str}. Controleer datum en tijdstip.",
    }

    system = build_system_prompt(lang, today)
    turns = [
        user(f"Cancel the {ct['name']} class {date_expr} at {time_str}"),
        tool_call("cancel_class", {
            "class_type": ct["name"], "date": date_iso, "start_time": time_str,
        }),
        tool_result(f"No {ct['name']} class found on {date_iso} at {time_str}."),
        assistant(NOT_FOUND[lang]),
    ]
    return [make_example(system, turns)]


# ── Documentation Q&A ─────────────────────────────────────────────────────────

QA_PAIRS = {
    "en": [
        ("How do I add a new client?",
         "Go to the Clients section from the left menu, then click 'Add Client'. Fill in the client's name, email, and phone number. You can also assign a membership right away or do it later."),
        ("How do I create a membership type?",
         "In the Memberships section, click 'Add Membership Type'. You can choose between a recurring subscription (billed monthly or yearly) or a credit pack. Set the price, number of credits, and validity period."),
        ("What is QR check-in?",
         "QR check-in lets clients check in to a class by scanning a QR code. Each client has a unique QR code in the mobile app. The instructor can scan it at the door, or the client can scan the studio's QR code."),
        ("How does the waitlist work?",
         "When a class is full, clients can join the waitlist. If a spot opens (due to a cancellation), the first client on the waitlist is automatically promoted and notified."),
        ("Can I export client data for GDPR?",
         "Yes. Go to Settings > GDPR. You can export all data for a specific client as a ZIP file, or permanently delete their account and all associated data."),
        ("How do I view attendance reports?",
         "Go to Reports > Attendance. You can filter by date range, class type, instructor, or location. The report shows attendance counts and fill rates per class."),
        ("How do I connect Stripe for payments?",
         "During onboarding (or in Settings > Payments), click 'Connect Stripe'. You'll be redirected to Stripe to authorise the connection. Once connected, you can sell memberships online directly from the client portal."),
        ("What languages does Agon support?",
         "Agon supports 7 languages: English, Italian, French, German, Spanish, Portuguese, and Dutch. The language is set in Settings > General."),
        ("How do I cancel a class?",
         "You can cancel a class from the Calendar by clicking on it and selecting 'Cancel Class'. Clients with bookings will be automatically notified. You can also ask me to cancel it for you."),
        ("How does the booking system work?",
         "Clients can book classes through the Agon mobile app. Each booking deducts one credit from their membership (or checks they have an active unlimited plan). Managers can also create bookings manually from the client's profile."),
        ("What is a credit pack?",
         "A credit pack is a membership type where the client buys a fixed number of class credits (e.g. 10 classes). Each booking deducts one credit. Credits have an expiry date set when the membership is activated."),
        ("How do I set up the studio tunnel for remote access?",
         "During onboarding (Step 3), Agon sets up a Cloudflare Tunnel automatically. This gives your studio a secure public URL so clients can book online without you needing to open ports on your router."),
        ("Can I have multiple locations?",
         "Yes. Go to Establishments in the left menu to add and manage locations. Each class is tied to a specific location, and reports can be filtered by location."),
        ("How do I assign an instructor to a class?",
         "When creating a class on the Calendar (or asking me to create one), you can specify an instructor. Each instructor must first be added in the Instructors section with their name and email."),
        ("What happens when a membership expires?",
         "The system automatically marks the membership as expired. The client can no longer book classes. A reminder notification is sent 7 days before expiry so they have time to renew."),
    ],
    "it": [
        ("Come aggiungo un nuovo cliente?",
         "Vai nella sezione Clienti dal menu a sinistra, poi clicca 'Aggiungi Cliente'. Inserisci nome, email e telefono. Puoi assegnare subito un abbonamento o farlo in un secondo momento."),
        ("Come funziona il check-in con QR?",
         "Il check-in QR permette ai clienti di registrarsi a una classe scansionando un codice QR. Ogni cliente ha un QR unico nell'app mobile. L'istruttore può scansionarlo all'ingresso."),
        ("Come creo un tipo di abbonamento?",
         "Nella sezione Abbonamenti, clicca 'Aggiungi Tipo Abbonamento'. Puoi scegliere tra abbonamento ricorrente o pacchetto crediti. Imposta prezzo, numero di crediti e validità."),
        ("Come vedo i report di presenze?",
         "Vai in Report > Presenze. Puoi filtrare per periodo, tipo di classe, istruttore o sede. Il report mostra il numero di presenze e il tasso di riempimento per ogni classe."),
        ("Come cancello una classe?",
         "Puoi cancellare una classe dal Calendario cliccandoci sopra e selezionando 'Cancella Classe'. I clienti con prenotazioni riceveranno una notifica automatica. Puoi anche chiederlo a me."),
    ],
    "fr": [
        ("Comment ajouter un nouveau client ?",
         "Allez dans la section Clients depuis le menu de gauche, puis cliquez sur 'Ajouter un client'. Renseignez le nom, l'email et le téléphone. Vous pouvez attribuer un abonnement immédiatement."),
        ("Comment fonctionne la liste d'attente ?",
         "Quand un cours est complet, les clients peuvent rejoindre la liste d'attente. Si une place se libère, le premier client de la liste est automatiquement promu et notifié."),
        ("Comment annuler un cours ?",
         "Vous pouvez annuler un cours depuis le Calendrier en cliquant dessus et en sélectionnant 'Annuler le cours'. Les clients réservés seront automatiquement notifiés."),
    ],
    "de": [
        ("Wie füge ich einen neuen Kunden hinzu?",
         "Gehen Sie zum Abschnitt Kunden im linken Menü und klicken Sie auf 'Kunde hinzufügen'. Geben Sie Name, E-Mail und Telefon ein. Sie können sofort eine Mitgliedschaft zuweisen."),
        ("Wie storniere ich einen Kurs?",
         "Sie können einen Kurs im Kalender stornieren, indem Sie darauf klicken und 'Kurs stornieren' auswählen. Kunden mit Buchungen werden automatisch benachrichtigt."),
        ("Wie funktioniert der QR-Check-in?",
         "Der QR-Check-in ermöglicht Kunden, sich per QR-Code-Scan für einen Kurs einzuchecken. Jeder Kunde hat einen einzigartigen QR-Code in der mobilen App."),
    ],
    "es": [
        ("¿Cómo añado un nuevo cliente?",
         "Ve a la sección Clientes en el menú izquierdo y haz clic en 'Añadir Cliente'. Introduce nombre, email y teléfono. Puedes asignar una membresía inmediatamente."),
        ("¿Cómo funciona la lista de espera?",
         "Cuando una clase está llena, los clientes pueden unirse a la lista de espera. Si se libera un lugar, el primer cliente de la lista es promovido automáticamente y notificado."),
        ("¿Cómo cancelo una clase?",
         "Puedes cancelar una clase desde el Calendario haciendo clic en ella y seleccionando 'Cancelar Clase'. Los clientes con reservas serán notificados automáticamente."),
    ],
    "pt": [
        ("Como adiciono um novo cliente?",
         "Vá à seção Clientes no menu esquerdo e clique em 'Adicionar Cliente'. Insira nome, email e telefone. Pode atribuir uma assinatura imediatamente."),
        ("Como funciona a lista de espera?",
         "Quando uma aula está cheia, os clientes podem entrar na lista de espera. Se uma vaga abrir, o primeiro cliente da lista é promovido automaticamente e notificado."),
    ],
    "nl": [
        ("Hoe voeg ik een nieuwe klant toe?",
         "Ga naar het gedeelte Klanten in het linkermenu en klik op 'Klant toevoegen'. Voer naam, e-mail en telefoon in. U kunt direct een lidmaatschap toewijzen."),
        ("Hoe werkt de wachtlijst?",
         "Als een les vol is, kunnen klanten op de wachtlijst. Als er een plek vrijkomt, wordt de eerste klant op de lijst automatisch gepromoveerd en geïnformeerd."),
    ],
}


def gen_qa(lang: str, today: date) -> list[dict]:
    pairs = QA_PAIRS.get(lang, QA_PAIRS["en"])
    q, a = random.choice(pairs)
    system = build_system_prompt(lang, today)
    turns = [user(q), assistant(a)]
    return [make_example(system, turns)]


# ── Out-of-scope handling ─────────────────────────────────────────────────────

OOS_EXAMPLES = {
    "en": [
        ("What's the weather like today?",
         "I'm the Agon studio assistant — I can help with classes, clients, memberships, and bookings, but I don't have access to weather information."),
        ("Can you send an email to all clients?",
         "I can't send bulk emails directly, but Agon can send automated notifications for class reminders and membership expiry. For custom emails you'd need to use an external email tool."),
        ("Write me a Python script",
         "That's outside my area. I'm here to help you manage your fitness studio — ask me about classes, clients, memberships, or bookings."),
    ],
    "it": [
        ("Che tempo fa oggi?",
         "Sono l'assistente Agon — posso aiutarti con classi, clienti, abbonamenti e prenotazioni, ma non ho accesso alle previsioni meteo."),
    ],
}


def gen_out_of_scope(lang: str, today: date) -> list[dict]:
    pairs = OOS_EXAMPLES.get(lang, OOS_EXAMPLES["en"])
    q, a = random.choice(pairs)
    system = build_system_prompt(lang, today)
    turns = [user(q), assistant(a)]
    return [make_example(system, turns)]


# ── Multi-language create/cancel (same scenario, different language) ───────────

MULTILANG_CREATE = {
    "it": [
        "Voglio creare una classe di {ct} domani alle {time} a {loc}",
        "Puoi programmare {ct} per domani alle {time} a {loc}?",
        "Aggiungi {ct} al calendario per domani alle {time}, sede {loc}",
        "Crea una sessione di {ct} domani alle {time} presso {loc}",
    ],
    "fr": [
        "Je voudrais créer un cours de {ct} demain à {time} au {loc}",
        "Pouvez-vous planifier {ct} pour demain à {time} au {loc} ?",
        "Ajoutez {ct} au calendrier pour demain à {time}, lieu {loc}",
    ],
    "de": [
        "Ich möchte morgen um {time} Uhr einen {ct}-Kurs im {loc} erstellen",
        "Können Sie {ct} für morgen um {time} Uhr im {loc} einplanen?",
        "Fügen Sie {ct} morgen um {time} Uhr im {loc} zum Kalender hinzu",
    ],
    "es": [
        "Quiero crear una clase de {ct} mañana a las {time} en {loc}",
        "¿Puede programar {ct} para mañana a las {time} en {loc}?",
        "Crea una sesión de {ct} mañana a las {time} en {loc}",
    ],
    "pt": [
        "Quero criar uma aula de {ct} amanhã às {time} no {loc}",
        "Pode agendar {ct} para amanhã às {time} no {loc}?",
    ],
    "nl": [
        "Ik wil morgen om {time} een {ct}-les aanmaken in {loc}",
        "Kunt u {ct} voor morgen om {time} in {loc} inplannen?",
    ],
}


def gen_multilang_create(lang: str, today: date) -> list[dict]:
    templates = MULTILANG_CREATE.get(lang)
    if not templates:
        return []
    ct = random.choice(CLASS_TYPES)
    loc = random.choice(LOCATIONS)
    time_str = random.choice(TIMES)
    tomorrow = (today + timedelta(days=1)).isoformat()

    user_text = random.choice(templates).format(ct=ct["name"], time=time_str, loc=loc)
    system = build_system_prompt(lang, today)
    turns = [
        user(user_text),
        tool_call("create_class", {
            "class_type": ct["name"], "location": loc,
            "date": tomorrow, "start_time": time_str,
        }),
        tool_result(f"Class created."),
        assistant(confirm_created(lang, ct["name"], tomorrow, time_str, loc, ct["capacity"])),
    ]
    return [make_example(system, turns)]


# ── Main generation loop ──────────────────────────────────────────────────────

def generate_all() -> list[dict]:
    examples: list[dict] = []

    for _ in range(35):
        today = random.choice(ANCHOR_DATES)
        examples += gen_create_happy_path(today, "en")

    for _ in range(30):
        today = random.choice(ANCHOR_DATES)
        examples += gen_create_slot_filling(today, "en")

    for _ in range(15):
        today = random.choice(ANCHOR_DATES)
        examples += gen_create_single_location(today, "en")

    for _ in range(25):
        today = random.choice(ANCHOR_DATES)
        examples += gen_cancel_happy_path(today, "en")

    for _ in range(10):
        today = random.choice(ANCHOR_DATES)
        examples += gen_cancel_not_found(today, "en")

    # Q&A — English (covers all 15 pairs)
    for _ in range(45):
        today = random.choice(ANCHOR_DATES)
        examples += gen_qa("en", today)

    # Out-of-scope — English
    for _ in range(15):
        today = random.choice(ANCHOR_DATES)
        examples += gen_out_of_scope("en", today)

    # Multi-language — create class
    for lang in ["it", "fr", "de", "es", "pt", "nl"]:
        reps = {"it": 30, "fr": 20, "de": 20, "es": 20, "pt": 15, "nl": 15}[lang]
        for _ in range(reps):
            today = random.choice(ANCHOR_DATES)
            examples += gen_multilang_create(lang, today)

    # Multi-language — slot filling
    for lang in ["it", "fr", "de", "es", "pt", "nl"]:
        reps = {"it": 20, "fr": 15, "de": 15, "es": 15, "pt": 10, "nl": 10}[lang]
        for _ in range(reps):
            today = random.choice(ANCHOR_DATES)
            examples += gen_create_slot_filling(today, lang)

    # Multi-language — cancel
    for lang in ["it", "fr", "de", "es", "pt", "nl"]:
        reps = {"it": 15, "fr": 10, "de": 10, "es": 10, "pt": 8, "nl": 8}[lang]
        for _ in range(reps):
            today = random.choice(ANCHOR_DATES)
            examples += gen_cancel_happy_path(today, lang)

    # Multi-language — Q&A
    for lang in ["it", "fr", "de", "es", "pt", "nl"]:
        reps = {"it": 20, "fr": 15, "de": 10, "es": 10, "pt": 8, "nl": 8}[lang]
        for _ in range(reps):
            today = random.choice(ANCHOR_DATES)
            examples += gen_qa(lang, today)

    # Multi-language — out-of-scope
    for lang in ["it"]:
        for _ in range(5):
            today = random.choice(ANCHOR_DATES)
            examples += gen_out_of_scope(lang, today)

    random.shuffle(examples)
    return examples


def split_and_write(examples: list[dict]) -> None:
    n = len(examples)
    n_test = max(50, n // 10)
    n_valid = max(50, n // 10)
    n_train = n - n_test - n_valid

    train = examples[:n_train]
    valid = examples[n_train:n_train + n_valid]
    test = examples[n_train + n_valid:]

    for split_name, split_data in [("train", train), ("valid", valid), ("test", test)]:
        out = DATASET_DIR / f"{split_name}.jsonl"
        with open(out, "w", encoding="utf-8") as f:
            for ex in split_data:
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")
        print(f"  {split_name}.jsonl  — {len(split_data)} examples")


if __name__ == "__main__":
    print("Generating Agon fine-tuning dataset...")
    examples = generate_all()
    print(f"Total examples generated: {len(examples)}")
    print("Writing splits:")
    split_and_write(examples)
    print("Done.")
