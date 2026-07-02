"""Entity resolution and execution logic for the AI action agent.

The LLM only extracts natural-language slots (names, dates, times) via
tool calling — it never sees or invents database IDs. This module resolves
those slots deterministically against the database and only executes a
mutation once every required field is unambiguously resolved.

Read tools allow the agent to query live studio data (class types,
instructors, locations, clients, scheduled classes, membership types)
so it can answer data questions with real information instead of hallucinating.
"""

import difflib
import json
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Generic, Optional, TypeVar

from app.models.booking import Booking
from app.models.class_template import ClassTemplate
from app.models.client import Client
from app.models.instructor import Instructor
from app.models.location import Location
from app.models.membership_type import MembershipType
from app.models.scheduled_class import ScheduledClass
from app.models.user import User
from app.utils import utcnow
from sqlalchemy.orm import Session

T = TypeVar("T")

# ─── Localised agent messages ───────────────────────────────────────────────
# Keys: snake_case placeholder names. Values: per-lang strings.
# Only the strings that come from tool handlers (bypassing the LLM) need
# to be translated here — LLM-generated replies are controlled by the
# system-prompt language rule.

_MSG: dict[str, dict[str, str]] = {
    "class_type_ambiguous": {
        "en": "Multiple class types match. Which one do you mean: {options}?",
        "it": "Ci sono più tipi di classe che corrispondono. Quale intendi: {options}?",
        "fr": "Plusieurs types de cours correspondent. Lequel voulez-vous dire : {options} ?",
        "de": "Mehrere Kurstypen stimmen überein. Welchen meinen Sie: {options}?",
        "es": "Varios tipos de clase coinciden. ¿Cuál quiere decir: {options}?",
        "pt": "Vários tipos de aula correspondem. Qual você quer dizer: {options}?",
        "nl": "Meerdere les types komen overeen. Welke bedoelt u: {options}?",
    },
    "class_type_missing": {
        "en": "What type of class do you want to create? Available types: {options}.",
        "it": "Che tipo di classe vuoi creare? Tipi disponibili: {options}.",
        "fr": "Quel type de cours voulez-vous créer ? Types disponibles : {options}.",
        "de": "Welchen Kurstyp möchten Sie erstellen? Verfügbare Typen: {options}.",
        "es": "¿Qué tipo de clase quiere crear? Tipos disponibles: {options}.",
        "pt": "Que tipo de aula você quer criar? Tipos disponíveis: {options}.",
        "nl": "Welk type les wilt u aanmaken? Beschikbare typen: {options}.",
    },
    "location_ambiguous": {
        "en": "Multiple locations match. Which one do you mean: {options}?",
        "it": "Ci sono più sedi che corrispondono. Quale intendi: {options}?",
        "fr": "Plusieurs lieux correspondent. Lequel voulez-vous dire : {options} ?",
        "de": "Mehrere Standorte stimmen überein. Welchen meinen Sie: {options}?",
        "es": "Varias ubicaciones coinciden. ¿Cuál quiere decir: {options}?",
        "pt": "Vários locais correspondem. Qual você quer dizer: {options}?",
        "nl": "Meerdere locaties komen overeen. Welke bedoelt u: {options}?",
    },
    "location_missing": {
        "en": "Which location? Available locations: {options}.",
        "it": "In quale sede? Sedi disponibili: {options}.",
        "fr": "Quel lieu ? Lieux disponibles : {options}.",
        "de": "Welcher Standort? Verfügbare Standorte: {options}.",
        "es": "¿Qué ubicación? Ubicaciones disponibles: {options}.",
        "pt": "Qual local? Locais disponíveis: {options}.",
        "nl": "Welke locatie? Beschikbare locaties: {options}.",
    },
    "instructor_ambiguous": {
        "en": "Multiple instructors match. Which one do you mean: {options}?",
        "it": "Ci sono più istruttori che corrispondono. Quale intendi: {options}?",
        "fr": "Plusieurs instructeurs correspondent. Lequel voulez-vous dire : {options} ?",
        "de": "Mehrere Kursleiter stimmen überein. Welchen meinen Sie: {options}?",
        "es": "Varios instructores coinciden. ¿Cuál quiere decir: {options}?",
        "pt": "Vários instrutores correspondem. Qual você quer dizer: {options}?",
        "nl": "Meerdere instructeurs komen overeen. Welke bedoelt u: {options}?",
    },
    "instructor_not_found": {
        "en": "I can't find an instructor named '{name}'. Can you check the name?",
        "it": "Non trovo un istruttore chiamato '{name}'. Puoi controllare il nome?",
        "fr": "Je ne trouve pas d'instructeur nommé '{name}'. Pouvez-vous vérifier le nom ?",
        "de": "Ich finde keinen Kursleiter namens '{name}'. Können Sie den Namen prüfen?",
        "es": "No encuentro un instructor llamado '{name}'. ¿Puede comprobar el nombre?",
        "pt": "Não encontro um instrutor chamado '{name}'. Pode verificar o nome?",
        "nl": "Ik kan geen instructeur vinden met de naam '{name}'. Kunt u de naam controleren?",
    },
    "date_missing": {
        "en": "What date do you want the class on? (e.g. 'next Wednesday' or an exact date)",
        "it": "Per quale data vuoi creare la classe? (es. 'mercoledì prossimo' o una data precisa)",
        "fr": "Pour quelle date voulez-vous le cours ? (ex. 'mercredi prochain' ou une date précise)",
        "de": "Für welches Datum möchten Sie den Kurs? (z.B. 'nächsten Mittwoch' oder ein genaues Datum)",
        "es": "¿Para qué fecha quiere la clase? (ej. 'el próximo miércoles' o una fecha exacta)",
        "pt": "Para qual data você quer a aula? (ex. 'próxima quarta-feira' ou uma data exata)",
        "nl": "Voor welke datum wilt u de les? (bijv. 'volgende woensdag' of een exacte datum)",
    },
    "time_missing": {
        "en": "What time should the class start?",
        "it": "A che ora deve iniziare la classe?",
        "fr": "À quelle heure le cours doit-il commencer ?",
        "de": "Um wie viel Uhr soll der Kurs beginnen?",
        "es": "¿A qué hora debe empezar la clase?",
        "pt": "A que horas deve começar a aula?",
        "nl": "Hoe laat moet de les beginnen?",
    },
    "date_in_past": {
        "en": "The date/time you specified is in the past. Can you provide a future one?",
        "it": "La data/ora indicata è nel passato. Puoi indicarne una futura?",
        "fr": "La date/heure indiquée est dans le passé. Pouvez-vous en indiquer une future ?",
        "de": "Das angegebene Datum/Uhrzeit liegt in der Vergangenheit. Können Sie ein zukünftiges angeben?",
        "es": "La fecha/hora indicada está en el pasado. ¿Puede indicar una futura?",
        "pt": "A data/hora indicada está no passado. Pode indicar uma futura?",
        "nl": "De opgegeven datum/tijd ligt in het verleden. Kunt u een toekomstige opgeven?",
    },
    "class_created": {
        "en": 'Done. I created "{name}" for {date} at {time}, location {location}{instructor}, capacity {capacity}.',
        "it": 'Fatto. Ho creato "{name}" per {date} alle {time}, sede {location}{instructor}, capienza {capacity}.',
        "fr": 'Fait. J\'ai créé "{name}" pour le {date} à {time}, lieu {location}{instructor}, capacité {capacity}.',
        "de": 'Erledigt. Ich habe "{name}" für {date} um {time} Uhr erstellt, Standort {location}{instructor}, Kapazität {capacity}.',
        "es": 'Listo. He creado "{name}" para el {date} a las {time}, sede {location}{instructor}, capacidad {capacity}.',
        "pt": 'Feito. Criei "{name}" para {date} às {time}, local {location}{instructor}, capacidade {capacity}.',
        "nl": 'Klaar. Ik heb "{name}" aangemaakt voor {date} om {time}, locatie {location}{instructor}, capaciteit {capacity}.',
    },
    "instructor_suffix": {
        "en": ", instructor {name}",
        "it": ", istruttore {name}",
        "fr": ", instructeur {name}",
        "de": ", Kursleiter {name}",
        "es": ", instructor {name}",
        "pt": ", instrutor {name}",
        "nl": ", instructeur {name}",
    },
}


def _m(key: str, lang: str, **kwargs: str) -> str:
    """Look up a localised message and format it with kwargs."""
    translations = _MSG.get(key, {})
    template = translations.get(lang) or translations.get("en", key)
    return template.format(**kwargs) if kwargs else template


_WEEKDAYS_EN = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]
_WEEKDAYS_IT = [
    "lunedì",
    "martedì",
    "mercoledì",
    "giovedì",
    "venerdì",
    "sabato",
    "domenica",
]


@dataclass
class ResolveResult(Generic[T]):
    """Result of resolving a natural-language name against the database."""

    value: Optional[T] = None
    candidates: list[str] = field(default_factory=list)
    status: str = "resolved"  # resolved | not_found | ambiguous | not_specified


CREATE_CLASS_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "create_class",
        "description": (
            "Schedule a new class. Extract each field from the user's message as plain "
            "natural-language text — do NOT invent IDs, do NOT guess a date if unsure. "
            "Leave a field empty/omit it if the user did not mention it."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "class_type": {
                    "type": "string",
                    "description": "The class type/template name mentioned, e.g. 'Yoga Flow'. Omit if not mentioned.",
                },
                "location": {
                    "type": "string",
                    "description": "The studio location name mentioned, e.g. 'Milano'. Omit if not mentioned.",
                },
                "instructor": {
                    "type": "string",
                    "description": "The instructor name mentioned. Omit if not mentioned.",
                },
                "date": {
                    "type": "string",
                    "description": (
                        "The class date normalized to YYYY-MM-DD, computed using the "
                        "current date given in the system prompt. If you cannot compute "
                        "a confident date, leave this empty rather than guessing."
                    ),
                },
                "start_time": {
                    "type": "string",
                    "description": "Start time in 24h HH:MM format, e.g. '18:00'. Omit if not mentioned.",
                },
                "duration_minutes": {
                    "type": "string",
                    "description": "Class duration in minutes as a number, e.g. '60' for '1 hour'. Omit if not mentioned.",
                },
                "capacity": {
                    "type": "string",
                    "description": "Maximum number of clients. Omit if not mentioned.",
                },
            },
            "required": [],
        },
    },
}


def _best_match(text: str, options: dict[str, T]) -> ResolveResult[T]:
    """Match free text against a name -> value map: exact, then substring, then fuzzy."""
    if not options:
        return ResolveResult(status="not_found")

    normalized = text.strip().lower()
    names = list(options.keys())

    exact = [n for n in names if n.lower() == normalized]
    if len(exact) == 1:
        return ResolveResult(value=options[exact[0]], status="resolved")

    substring = [n for n in names if normalized in n.lower()]
    if len(substring) == 1:
        return ResolveResult(value=options[substring[0]], status="resolved")
    if len(substring) > 1:
        return ResolveResult(candidates=substring, status="ambiguous")

    close = difflib.get_close_matches(normalized, [n.lower() for n in names], n=3, cutoff=0.6)
    matched_names = [n for n in names if n.lower() in close]
    if len(matched_names) == 1:
        return ResolveResult(value=options[matched_names[0]], status="resolved")
    if len(matched_names) > 1:
        return ResolveResult(candidates=matched_names, status="ambiguous")

    return ResolveResult(status="not_found", candidates=names[:5])


def resolve_location(db: Session, text: Optional[str]) -> ResolveResult[Location]:
    locations = db.query(Location).filter(Location.is_active.is_(True)).all()
    if not text or not text.strip():
        if len(locations) == 1:
            return ResolveResult(value=locations[0], status="resolved")
        return ResolveResult(status="not_specified", candidates=[loc.name for loc in locations])
    options = {loc.name: loc for loc in locations}
    return _best_match(text, options)


def resolve_instructor(db: Session, text: Optional[str]) -> ResolveResult[Instructor]:
    rows = (
        db.query(Instructor, User)
        .join(User, Instructor.user_id == User.id)
        .filter(User.is_active.is_(True))
        .all()
    )
    if not text or not text.strip():
        return ResolveResult(status="not_specified")
    options = {user.full_name: instructor for instructor, user in rows}
    return _best_match(text, options)


def resolve_class_template(db: Session, text: Optional[str]) -> ResolveResult[ClassTemplate]:
    templates = db.query(ClassTemplate).filter(ClassTemplate.is_active.is_(True)).all()
    if not text or not text.strip():
        if len(templates) == 1:
            return ResolveResult(value=templates[0], status="resolved")
        return ResolveResult(status="not_specified", candidates=[t.name for t in templates])
    options = {t.name: t for t in templates}
    return _best_match(text, options)


_RELATIVE_DAYS = {
    "oggi": 0,
    "today": 0,
    "domani": 1,
    "tomorrow": 1,
    "dopodomani": 2,
    "day after tomorrow": 2,
}


def resolve_date(date_str: Optional[str], today: date) -> Optional[date]:
    """Parse an ISO date (YYYY-MM-DD), a relative day, or a bare weekday name.

    Only trusts the model's arithmetic if it produced a valid ISO date in the
    future. Falls back to deterministic relative-day and weekday math for
    common phrasing the model may not compute reliably. Never guesses beyond
    that — an unparseable value returns None so the caller asks for clarification.
    """
    if not date_str or not date_str.strip():
        return None

    candidate = date_str.strip()

    try:
        parsed = datetime.strptime(candidate, "%Y-%m-%d").date()
        if parsed >= today:
            return parsed
    except ValueError:
        pass

    normalized = candidate.lower()

    # Longest phrase first — "domani" is a substring of "dopodomani" and
    # "tomorrow" a substring of "day after tomorrow", so a shorter phrase
    # must never shadow a more specific longer one.
    for phrase, offset in sorted(_RELATIVE_DAYS.items(), key=lambda item: -len(item[0])):
        if phrase in normalized:
            return today + timedelta(days=offset)

    for idx, name in enumerate(_WEEKDAYS_EN + _WEEKDAYS_IT):
        weekday = idx % 7
        if name in normalized:
            days_ahead = (weekday - today.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7  # "next <weekday>" always means a future occurrence
            return today + timedelta(days=days_ahead)

    return None


def resolve_time(time_str: Optional[str]) -> Optional[tuple[int, int]]:
    if not time_str or not time_str.strip():
        return None
    candidate = time_str.strip()
    for fmt in ("%H:%M", "%H.%M", "%H"):
        try:
            parsed = datetime.strptime(candidate, fmt)
            return parsed.hour, parsed.minute
        except ValueError:
            continue
    return None


@dataclass
class AgentActionResult:
    status: str  # executed | needs_clarification | error
    message: str
    scheduled_class: Optional[ScheduledClass] = None


def handle_create_class(
    db: Session, args: dict, today: Optional[date] = None, lang: str = "en"
) -> AgentActionResult:
    """Resolve every slot for create_class and execute only if unambiguous.

    `today` anchors relative-day resolution ("domani", "mercoledì prossimo")
    and must be the studio's *local* calendar date — not raw UTC — since a
    manager saying "domani" means tomorrow in the studio's timezone. Defaults
    to `utcnow().date()` only as a fallback for callers that don't have a
    studio timezone available (e.g. direct unit tests).
    """
    template_result = resolve_class_template(db, args.get("class_type"))
    if template_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m("class_type_ambiguous", lang, options=", ".join(template_result.candidates)),
        )
    if template_result.status in ("not_found", "not_specified"):
        options = ", ".join(template_result.candidates) if template_result.candidates else "—"
        return AgentActionResult(
            status="needs_clarification",
            message=_m("class_type_missing", lang, options=options),
        )

    location_result = resolve_location(db, args.get("location"))
    if location_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m("location_ambiguous", lang, options=", ".join(location_result.candidates)),
        )
    if location_result.status in ("not_found", "not_specified"):
        options = ", ".join(location_result.candidates) if location_result.candidates else "—"
        return AgentActionResult(
            status="needs_clarification",
            message=_m("location_missing", lang, options=options),
        )

    instructor_result = resolve_instructor(db, args.get("instructor"))
    if instructor_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m(
                "instructor_ambiguous", lang, options=", ".join(instructor_result.candidates)
            ),
        )
    if instructor_result.status == "not_found":
        return AgentActionResult(
            status="needs_clarification",
            message=_m("instructor_not_found", lang, name=args.get("instructor", "?")),
        )

    today = today or utcnow().date()
    resolved_date = resolve_date(args.get("date"), today)
    if resolved_date is None:
        return AgentActionResult(
            status="needs_clarification",
            message=_m("date_missing", lang),
        )

    resolved_time = resolve_time(args.get("start_time"))
    if resolved_time is None:
        return AgentActionResult(
            status="needs_clarification",
            message=_m("time_missing", lang),
        )

    template = template_result.value

    raw_duration = args.get("duration_minutes")
    try:
        duration_minutes = int(raw_duration) if raw_duration else template.duration_minutes
    except (ValueError, TypeError):
        duration_minutes = template.duration_minutes

    raw_capacity = args.get("capacity")
    try:
        capacity = int(raw_capacity) if raw_capacity else template.default_capacity
    except (ValueError, TypeError):
        capacity = template.default_capacity

    starts_at = datetime.combine(resolved_date, datetime.min.time()).replace(
        hour=resolved_time[0], minute=resolved_time[1]
    )
    ends_at = starts_at + timedelta(minutes=duration_minutes)

    if starts_at <= utcnow():
        return AgentActionResult(
            status="error",
            message=_m("date_in_past", lang),
        )

    scheduled_class = ScheduledClass(
        template_id=template.id,
        instructor_id=instructor_result.value.id if instructor_result.value else None,
        location_id=location_result.value.id,
        starts_at=starts_at,
        ends_at=ends_at,
        capacity=capacity,
        status="scheduled",
    )
    db.add(scheduled_class)
    db.flush()  # populate scheduled_class.id without committing — router commits

    instructor_name = (
        db.query(User.full_name)
        .join(Instructor)
        .filter(Instructor.id == scheduled_class.instructor_id)
        .scalar()
        if scheduled_class.instructor_id
        else None
    )
    instr_suffix = (
        _m("instructor_suffix", lang, name=instructor_name) if instructor_name else ""
    )
    summary = _m(
        "class_created",
        lang,
        name=template.name,
        date=resolved_date.strftime("%A %d %B %Y"),
        time=f"{resolved_time[0]:02d}:{resolved_time[1]:02d}",
        location=location_result.value.name,
        instructor=instr_suffix,
        capacity=str(capacity),
    )
    return AgentActionResult(status="executed", message=summary, scheduled_class=scheduled_class)


# ─── Read tool schemas ──────────────────────────────────────────────────────

LIST_CLASS_TYPES_TOOL = {
    "type": "function",
    "function": {
        "name": "list_class_types",
        "description": "List all class types (templates) configured in the studio. Use this to answer questions about available class types.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

LIST_LOCATIONS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_locations",
        "description": "List all active studio locations/establishments.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

LIST_INSTRUCTORS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_instructors",
        "description": "List all active instructors.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

LIST_CLIENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_clients",
        "description": "List clients. Optionally filter by name or email.",
        "parameters": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Search term to filter by name or email. Omit to list all.",
                },
            },
            "required": [],
        },
    },
}

LIST_SCHEDULED_CLASSES_TOOL = {
    "type": "function",
    "function": {
        "name": "list_scheduled_classes",
        "description": "List scheduled classes with their details (type, instructor, location, date/time, capacity, bookings count). Optionally filter by date range.",
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date filter (YYYY-MM-DD). Defaults to today.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date filter (YYYY-MM-DD). Defaults to 7 days from start.",
                },
            },
            "required": [],
        },
    },
}

LIST_MEMBERSHIP_TYPES_TOOL = {
    "type": "function",
    "function": {
        "name": "list_membership_types",
        "description": "List all active membership types/plans available in the studio.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

CANCEL_CLASS_TOOL = {
    "type": "function",
    "function": {
        "name": "cancel_class",
        "description": "Cancel a scheduled class. Identify the class by describing its type, date, and time.",
        "parameters": {
            "type": "object",
            "properties": {
                "class_type": {
                    "type": "string",
                    "description": "The class type/template name.",
                },
                "date": {
                    "type": "string",
                    "description": "The class date (YYYY-MM-DD or relative like 'tomorrow').",
                },
                "start_time": {
                    "type": "string",
                    "description": "Start time in HH:MM format.",
                },
            },
            "required": [],
        },
    },
}

ALL_READ_TOOLS = [
    LIST_CLASS_TYPES_TOOL,
    LIST_LOCATIONS_TOOL,
    LIST_INSTRUCTORS_TOOL,
    LIST_CLIENTS_TOOL,
    LIST_SCHEDULED_CLASSES_TOOL,
    LIST_MEMBERSHIP_TYPES_TOOL,
]

ALL_WRITE_TOOLS = [
    CREATE_CLASS_TOOL_SCHEMA,
    CANCEL_CLASS_TOOL,
]

ALL_TOOLS = ALL_READ_TOOLS + ALL_WRITE_TOOLS

READ_TOOL_NAMES = {t["function"]["name"] for t in ALL_READ_TOOLS}
WRITE_TOOL_NAMES = {t["function"]["name"] for t in ALL_WRITE_TOOLS}


# ─── Read tool handlers ─────────────────────────────────────────────────────


def handle_list_class_types(db: Session) -> str:
    templates = db.query(ClassTemplate).filter(ClassTemplate.is_active.is_(True)).all()
    if not templates:
        return json.dumps({"class_types": [], "note": "No class types configured yet."})
    data = [
        {
            "name": t.name,
            "duration_minutes": t.duration_minutes,
            "default_capacity": t.default_capacity,
            "color": t.color,
            "description": t.description,
        }
        for t in templates
    ]
    return json.dumps({"class_types": data})


def handle_list_locations(db: Session) -> str:
    locations = db.query(Location).filter(Location.is_active.is_(True)).all()
    if not locations:
        return json.dumps({"locations": [], "note": "No locations configured yet."})
    data = [{"name": loc.name, "address": loc.address} for loc in locations]
    return json.dumps({"locations": data})


def handle_list_instructors(db: Session) -> str:
    rows = (
        db.query(Instructor, User)
        .join(User, Instructor.user_id == User.id)
        .filter(User.is_active.is_(True))
        .all()
    )
    if not rows:
        return json.dumps({"instructors": [], "note": "No instructors configured yet."})
    data = [
        {"name": user.full_name, "email": user.email}
        for instructor, user in rows
    ]
    return json.dumps({"instructors": data})


def handle_list_clients(db: Session, args: dict[str, Any]) -> str:
    query = db.query(Client).filter(Client.is_active.is_(True))
    search = args.get("search", "").strip()
    if search:
        query = query.filter(
            Client.full_name.ilike(f"%{search}%") | Client.email.ilike(f"%{search}%")
        )
    clients = query.order_by(Client.full_name).limit(50).all()
    data = [
        {"name": c.full_name, "email": c.email, "phone": c.phone}
        for c in clients
    ]
    return json.dumps({"clients": data, "total": len(data)})


def handle_list_scheduled_classes(db: Session, args: dict[str, Any], today: date) -> str:
    start_str = args.get("start_date", "")
    end_str = args.get("end_date", "")
    try:
        start = datetime.strptime(start_str, "%Y-%m-%d").date() if start_str else today
    except ValueError:
        start = today
    try:
        end = datetime.strptime(end_str, "%Y-%m-%d").date() if end_str else start + timedelta(days=7)
    except ValueError:
        end = start + timedelta(days=7)

    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end, datetime.max.time())

    classes = (
        db.query(ScheduledClass)
        .filter(
            ScheduledClass.starts_at >= start_dt,
            ScheduledClass.starts_at <= end_dt,
            ScheduledClass.status != "cancelled",
        )
        .order_by(ScheduledClass.starts_at)
        .limit(100)
        .all()
    )

    template_ids = {c.template_id for c in classes}
    templates = {t.id: t.name for t in db.query(ClassTemplate).filter(ClassTemplate.id.in_(template_ids)).all()} if template_ids else {}

    instructor_ids = {c.instructor_id for c in classes if c.instructor_id}
    instr_map: dict[int, str] = {}
    if instructor_ids:
        rows = (
            db.query(Instructor.id, User.full_name)
            .join(User, Instructor.user_id == User.id)
            .filter(Instructor.id.in_(instructor_ids))
            .all()
        )
        instr_map = {r[0]: r[1] for r in rows}

    location_ids = {c.location_id for c in classes}
    loc_map: dict[int, str] = {}
    if location_ids:
        locs = db.query(Location).filter(Location.id.in_(location_ids)).all()
        loc_map = {loc.id: loc.name for loc in locs}

    data = []
    for c in classes:
        bookings_count = db.query(Booking).filter(
            Booking.scheduled_class_id == c.id, Booking.status == "confirmed"
        ).count()
        data.append({
            "class_type": templates.get(c.template_id, f"#{c.template_id}"),
            "date": c.starts_at.strftime("%Y-%m-%d"),
            "start_time": c.starts_at.strftime("%H:%M"),
            "end_time": c.ends_at.strftime("%H:%M"),
            "instructor": instr_map.get(c.instructor_id, None) if c.instructor_id else None,
            "location": loc_map.get(c.location_id, f"#{c.location_id}"),
            "capacity": c.capacity,
            "bookings": bookings_count,
            "status": c.status,
        })
    return json.dumps({"scheduled_classes": data, "total": len(data), "from": start.isoformat(), "to": end.isoformat()})


def handle_list_membership_types(db: Session) -> str:
    types = db.query(MembershipType).filter(MembershipType.is_active.is_(True)).all()
    if not types:
        return json.dumps({"membership_types": [], "note": "No membership types configured yet."})
    data = [
        {
            "name": mt.name,
            "type": mt.type,
            "price": mt.price,
            "currency": mt.currency,
            "billing_interval": mt.billing_interval,
            "credits_included": mt.credits_included,
            "unlimited": mt.unlimited,
            "validity_days": mt.validity_days,
            "description": mt.description,
        }
        for mt in types
    ]
    return json.dumps({"membership_types": data})


def handle_cancel_class(
    db: Session, args: dict[str, Any], today: date, lang: str = "en"
) -> AgentActionResult:
    template_result = resolve_class_template(db, args.get("class_type"))
    if template_result.status != "resolved":
        options = ", ".join(template_result.candidates) if template_result.candidates else "?"
        return AgentActionResult(
            status="needs_clarification",
            message=f"Which class type? Options: {options}.",
        )

    resolved_date = resolve_date(args.get("date"), today)
    if resolved_date is None:
        return AgentActionResult(
            status="needs_clarification",
            message="Which date is this class on?",
        )

    resolved_time = resolve_time(args.get("start_time"))

    query = db.query(ScheduledClass).filter(
        ScheduledClass.template_id == template_result.value.id,
        ScheduledClass.status == "scheduled",
    )

    start_dt = datetime.combine(resolved_date, datetime.min.time())
    end_dt = datetime.combine(resolved_date, datetime.max.time())
    query = query.filter(
        ScheduledClass.starts_at >= start_dt,
        ScheduledClass.starts_at <= end_dt,
    )

    if resolved_time:
        exact_dt = datetime.combine(resolved_date, datetime.min.time()).replace(
            hour=resolved_time[0], minute=resolved_time[1]
        )
        query = query.filter(ScheduledClass.starts_at == exact_dt)

    matches = query.all()

    if len(matches) == 0:
        return AgentActionResult(
            status="needs_clarification",
            message=f"No scheduled {template_result.value.name} class found on {resolved_date.isoformat()}.",
        )
    if len(matches) > 1:
        times = ", ".join(m.starts_at.strftime("%H:%M") for m in matches)
        return AgentActionResult(
            status="needs_clarification",
            message=f"Multiple {template_result.value.name} classes on that date at: {times}. Which one?",
        )

    sc = matches[0]
    sc.status = "cancelled"

    return AgentActionResult(
        status="executed",
        message=(
            f"Cancelled {template_result.value.name} on "
            f"{resolved_date.strftime('%A %d %B %Y')} at {sc.starts_at.strftime('%H:%M')}."
        ),
        scheduled_class=sc,
    )


def load_studio_data_summary(db: Session, today: date) -> str:
    """Build a compact plain-text summary of studio data for the system prompt.

    Clients are intentionally excluded — they can be large (500+) and are not
    needed for create/cancel class actions. The LLM can request client data
    separately if the user asks about a specific client.
    Scheduled classes are limited to the next 3 days to keep tokens low.
    """
    from datetime import timedelta

    parts = []

    parts.append("CLASS TYPES:")
    parts.append(handle_list_class_types(db))

    parts.append("\nLOCATIONS:")
    parts.append(handle_list_locations(db))

    parts.append("\nINSTRUCTORS:")
    parts.append(handle_list_instructors(db))

    parts.append("\nSCHEDULED CLASSES (next 3 days):")
    end_date = (today + timedelta(days=3)).isoformat()
    parts.append(handle_list_scheduled_classes(db, {"end_date": end_date}, today))

    parts.append("\nMEMBERSHIP TYPES:")
    parts.append(handle_list_membership_types(db))

    return "\n".join(parts)


def dispatch_read_tool(db: Session, tool_name: str, args: dict[str, Any], today: date) -> str:
    handlers: dict[str, Any] = {
        "list_class_types": lambda: handle_list_class_types(db),
        "list_locations": lambda: handle_list_locations(db),
        "list_instructors": lambda: handle_list_instructors(db),
        "list_clients": lambda: handle_list_clients(db, args),
        "list_scheduled_classes": lambda: handle_list_scheduled_classes(db, args, today),
        "list_membership_types": lambda: handle_list_membership_types(db),
    }
    handler = handlers.get(tool_name)
    if handler:
        return handler()
    return json.dumps({"error": f"Unknown tool: {tool_name}"})
