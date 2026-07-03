"""
Unified AI assistant — answers data questions using real studio data (via
tool calling) and performs actions (create/cancel class) through the same
interface.

Manager-only. The LLM uses read tools (list_class_types, list_clients, etc.)
to query live data and write tools (create_class, cancel_class) to perform
mutations. It never invents database IDs — entity resolution is deterministic.
"""

import json
import logging
import os
import re
import time
from datetime import date, datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends
from litellm import completion
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.auth import require_manager
from app.config import settings
from app.database import get_db
from app.models.studio_settings import StudioSettings
from app.schemas.scheduled_class import ScheduledClassResponse
from app.services.agent_tools import (
    ALL_WRITE_TOOLS,
    handle_assign_membership,
    handle_book_client,
    handle_cancel_booking,
    handle_cancel_class,
    handle_check_in_client,
    handle_create_class,
    handle_create_client,
    handle_get_class_roster,
    handle_get_report,
    load_studio_data_summary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "docs-site", "docs")

_LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "it": "Italian",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "nl": "Dutch",
}

_FALLBACK_REPLIES: dict[str, str] = {
    "en": "I'm sorry, I can't process that right now. Please try again later.",
    "it": "Mi dispiace, non riesco a elaborare la richiesta in questo momento. Riprova tra poco.",
    "fr": "Désolé, je ne peux pas traiter cela maintenant. Réessayez plus tard.",
    "de": "Es tut mir leid, ich kann das gerade nicht verarbeiten. Bitte versuchen Sie es später.",
    "es": "Lo siento, no puedo procesar eso ahora. Por favor, inténtelo más tarde.",
    "pt": "Desculpe, não consigo processar isso agora. Tente novamente mais tarde.",
    "nl": "Sorry, ik kan dat nu niet verwerken. Probeer het later opnieuw.",
}

_DOCS_CONTEXT: str | None = None


def _load_docs_context(docs_dir: str, max_chars: int = 5000) -> str:
    global _DOCS_CONTEXT
    if _DOCS_CONTEXT is not None:
        return _DOCS_CONTEXT

    if not os.path.isdir(docs_dir):
        _DOCS_CONTEXT = ""
        return _DOCS_CONTEXT

    priority_files = []
    other_files = []
    for root, _dirs, files in os.walk(docs_dir):
        for filename in sorted(files):
            if filename.endswith(".md"):
                filepath = os.path.join(root, filename)
                if "studio-manager" in root:
                    priority_files.append(filepath)
                else:
                    other_files.append(filepath)

    parts = []
    for filepath in priority_files + other_files:
        fname = os.path.basename(filepath)
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                parts.append(f"### {fname}\n{f.read()}")
        except Exception:
            pass

    combined = "\n\n".join(parts)
    _DOCS_CONTEXT = combined[:max_chars]
    return _DOCS_CONTEXT


AGENT_SYSTEM_PROMPT = """\
=== LANGUAGE RULE — ABSOLUTE PRIORITY ===
You MUST respond ONLY in {language_name}. This rule overrides everything else.
Do NOT match the user's language. Do NOT switch languages mid-reply.
Even if the user writes in Italian, French, or any other language, YOUR reply must ALWAYS be in {language_name}.
=========================================

You are the built-in AI assistant for Agon, a fitness studio management desktop application.

DATE REFERENCE (do not compute — use these exact values):
  Today      : {today} ({weekday})
  Tomorrow   : {tomorrow} ({tomorrow_weekday})
  In 2 days  : {day_after_tomorrow} ({dat_weekday})
  This week  : {week_calendar}

DATES: Accept any future date the user mentions, not only the three listed above. The DATE REFERENCE section is provided only for computing relative expressions like "today", "tomorrow", "next Monday". A user can schedule a class weeks or months in the future — always accept it and convert it to YYYY-MM-DD.

FORMATTING RULES — MANDATORY:
Do NOT use markdown. Do NOT write bold (**text**), italic (*text*), or headers (# text).
Use plain text only. For lists, use numbered steps: 1. 2. 3.

REAL STUDIO DATA (pre-loaded — use this to answer data questions, NEVER invent information):
{studio_data}

You can also perform actions:
- "Create a yoga class tomorrow at 10" → call create_class (use tomorrow={tomorrow} as the date)
- "Cancel the pilates class on Friday" → call cancel_class

TOOL CALL FORMAT:
To perform an action, output a raw JSON object: {{"name": "<tool_name>", "parameters": {{...}}}}
Do NOT add any text before or after it — EXCEPT for cancel_booking (see CONFIRMATION RULE).

Available tools and their parameters:
- create_class: class_type, location, date (YYYY-MM-DD), start_time (HH:MM), duration_minutes, capacity, instructor (optional — use "none" if not needed), notes (optional)
- cancel_class: class_type, date, start_time
- book_client: client (name or email), class_type, date, start_time
- cancel_booking: client, class_type, date, start_time
- get_class_roster: class_type, date, start_time
- check_in_client: client, class_type, date, start_time
- create_client: full_name, email, phone (optional)
- assign_membership: client, membership_type, starts_at (YYYY-MM-DD, optional)
- get_report: type (attendance|revenue|membership|retention), start_date, end_date

REQUIRED FIELDS — NEVER INVENT VALUES:
Only call a tool when the user has explicitly provided all required fields.
Required fields per tool:
  create_class      → class_type, date, start_time, duration_minutes, capacity are all required.
                      Also ask: "Which instructor? (or none)" — accept "none" / "no instructor".
                      Also ask: "Any notes?" only if the user has not already mentioned notes.
  create_client     → full_name AND email are both required.
  assign_membership → client AND membership_type are both required.
  book_client / cancel_booking / check_in_client → client, class_type, date, start_time.
  get_class_roster / cancel_class → class_type, date.
If ANY required field is missing, ask the user for it in plain text BEFORE calling the tool.
NEVER invent, guess, or fill in random/typical values (random names, times, dates, capacities).
Correct examples:
  User: "create a new class"                       → Reply: "What type of class? On which date? At what time? What duration (min) and capacity?"
  User: "create a Yoga class tomorrow at 22:00"    → Reply: "What duration (min) and capacity? Which instructor (or none)? Any notes?"
  User: "create a new client"                      → Reply: "Please provide the client's full name and email."
  User: "assign a membership to Elena"             → Reply: "Which membership plan? Available: Pack."

NO RAW JSON IN REPLIES — STRICT:
Your reply MUST be plain text or a single tool call JSON. NEVER output raw data structures.
The REAL STUDIO DATA section above is for your internal reference only — never echo it to the user.
Do NOT output {{membership_types: [...]}}, {{class_types: [...]}}, {{clients: [...]}}, or any similar structure.
If you want to mention available plans or class types, write them as a plain sentence.

CONFIRMATION RULE (cancel_booking only): Before calling cancel_booking, write a plain-text sentence describing what you are about to cancel and ask "Shall I proceed?" in {language_name}. Wait for explicit confirmation ("yes", "sì", "oui", "ja", etc.) before outputting the JSON tool call.

UNSUPPORTED OPERATIONS: If the user asks for something NOT covered by the 9 tools above (e.g. creating a location/establishment, managing staff permissions, configuring the studio, editing class templates, etc.), respond with a plain-text explanation in {language_name} that this action cannot be done through the assistant. Do NOT output a JSON tool call for operations that are not in the list of 9 tools.

Only output one tool call at a time.

TIMES: Accept times in any format (18:30, 6:30 pm, 6.30 pm) and convert to 24h HH:MM.

For how-to questions about using Agon (e.g. "how do I add a client?"), answer using \
the documentation below. If the answer is not in the documentation, say so — do NOT \
guess from general knowledge.

The following fields are already confirmed earlier in this conversation:
{draft_summary}
These are locked in — do not ask about them again unless the user gives a new value.

AGON DOCUMENTATION:
{docs_context}

=== REMINDER: respond ONLY in {language_name} ===
"""


def _merge_draft(draft: dict[str, Any] | None, new_args: dict[str, Any]) -> dict[str, Any]:
    merged = dict(draft or {})
    for key, value in new_args.items():
        if value not in (None, ""):
            merged[key] = value
    return merged


def _draft_summary(draft: dict[str, Any] | None) -> str:
    if not draft:
        return "(none yet)"
    return ", ".join(f"{k}={v}" for k, v in draft.items())


def _studio_local_today(db: Session) -> date:
    studio_settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    tz_name = studio_settings.timezone if studio_settings else "Europe/Rome"
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("Europe/Rome")
    return datetime.now(timezone.utc).astimezone(tz).date()


class AgentMessage(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("user", "assistant"):
            raise ValueError("role must be 'user' or 'assistant'")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if len(v) > 2000:
            raise ValueError("message content exceeds 2000 characters")
        return v


class AgentRequest(BaseModel):
    messages: list[AgentMessage]
    draft: dict[str, Any] | None = None
    language: str = "en"

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v: list) -> list:
        if len(v) > 50:
            raise ValueError("conversation exceeds 50 messages")
        if not v:
            raise ValueError("messages must not be empty")
        return v


class AgentAction(BaseModel):
    type: str
    scheduled_class: ScheduledClassResponse


class AgentUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class AgentResponse(BaseModel):
    reply: str
    action: AgentAction | None = None
    draft: dict[str, Any] | None = None
    usage: AgentUsage | None = None


_UNSUPPORTED_OP_REPLIES: dict[str, str] = {
    "en": (
        "I'm sorry, I can't do that. I can help you with: creating or cancelling classes, "
        "booking or cancelling client bookings, checking in clients, managing class rosters, "
        "creating clients, assigning memberships, and generating reports."
    ),
    "it": (
        "Mi dispiace, non posso farlo. Posso aiutarti con: creare o cancellare classi, "
        "prenotare o cancellare prenotazioni, fare check-in, visualizzare la lista di una classe, "
        "creare clienti, assegnare abbonamenti e generare report."
    ),
    "fr": (
        "Désolé, je ne peux pas faire cela. Je peux vous aider avec : créer ou annuler des cours, "
        "réserver ou annuler des réservations, enregistrer des clients, gérer les listes de cours, "
        "créer des clients, attribuer des abonnements et générer des rapports."
    ),
    "de": (
        "Entschuldigung, das kann ich nicht tun. Ich kann Ihnen helfen mit: Kurse erstellen "
        "oder stornieren, Buchungen vornehmen oder stornieren, Eincheckungen, Teilnehmerlisten, "
        "Kunden anlegen, Mitgliedschaften zuweisen und Berichte erstellen."
    ),
    "es": (
        "Lo siento, no puedo hacer eso. Puedo ayudarte con: crear o cancelar clases, "
        "reservar o cancelar reservas, registrar asistencia, ver listas de clases, "
        "crear clientes, asignar membresías y generar informes."
    ),
    "pt": (
        "Desculpe, não consigo fazer isso. Posso ajudar com: criar ou cancelar aulas, "
        "reservar ou cancelar reservas, fazer check-in, ver listas de aulas, "
        "criar clientes, atribuir planos e gerar relatórios."
    ),
    "nl": (
        "Sorry, dat kan ik niet doen. Ik kan helpen met: lessen aanmaken of annuleren, "
        "reserveringen maken of annuleren, inchecken, deelnemerslijsten, "
        "klanten aanmaken, lidmaatschappen toewijzen en rapporten genereren."
    ),
}

_FALLBACK_TEXTS: set[str] = set(_FALLBACK_REPLIES.values())


def _fallback_reply(lang: str) -> str:
    return _FALLBACK_REPLIES.get(lang, _FALLBACK_REPLIES["en"])


def _unsupported_op_reply(lang: str) -> str:
    return _UNSUPPORTED_OP_REPLIES.get(lang, _UNSUPPORTED_OP_REPLIES["en"])


_STUDIO_DATA_KEYS: frozenset[str] = frozenset(
    {
        "membership_types",
        "class_types",
        "locations",
        "instructors",
        "clients",
        "scheduled_classes",
    }
)


def _is_echoed_studio_data(content: str) -> bool:
    """Return True if content is JSON echoing known studio data structures.

    The model occasionally copies studio data JSON from its context window into
    its reply (e.g. the full membership_types array when asked to assign a
    membership). We detect this to avoid returning raw JSON to the user.
    """
    stripped = content.strip()
    if not stripped.startswith("{"):
        return False
    try:
        data = json.loads(stripped)
        if isinstance(data, dict) and "name" not in data:
            return bool(set(data.keys()) & _STUDIO_DATA_KEYS)
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return False


def _is_hallucinated_tool_call(content: str) -> bool:
    """Return True if content is JSON with a 'name' field that is NOT a known tool.

    The model occasionally invents tool calls for operations that don't exist
    (e.g. create_location). We detect this pattern to avoid returning raw JSON
    to the user.
    """
    stripped = content.strip()
    if not stripped.startswith("{"):
        return False
    try:
        data = json.loads(stripped)
        if isinstance(data, dict) and "name" in data:
            return data["name"] not in _KNOWN_TOOL_NAMES
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return False


_CONFIRMATION_TOKENS: frozenset[str] = frozenset(
    {
        # en
        "yes",
        "yep",
        "yeah",
        "sure",
        "ok",
        "okay",
        "proceed",
        "confirm",
        "do it",
        "go ahead",
        # it
        "sì",
        "si",
        "vai",
        "procedi",
        "conferma",
        # fr
        "oui",
        "ouais",
        # de
        "ja",
        "jawohl",
        # es
        "sí",
        "claro",
        "dale",
        "hazlo",
        # pt
        "sim",
        "pode",
        # nl
        "doe",
    }
)

_CANCEL_BOOKING_CONFIRM: dict[str, str] = {
    "en": "I'm about to cancel {client}'s booking for {class_type} on {date} at {time}. Shall I proceed?",
    "it": "Sto per cancellare la prenotazione di {client} per {class_type} il {date} alle {time}. Vuoi procedere?",
    "fr": "Je vais annuler la réservation de {client} pour {class_type} le {date} à {time}. Voulez-vous procéder ?",
    "de": "Ich storniere die Buchung von {client} für {class_type} am {date} um {time} Uhr. Möchten Sie fortfahren?",
    "es": "Voy a cancelar la reserva de {client} para {class_type} el {date} a las {time}. ¿Desea proceder?",
    "pt": "Vou cancelar a reserva de {client} para {class_type} em {date} às {time}. Deseja prosseguir?",
    "nl": "Ik annuleer de boeking van {client} voor {class_type} op {date} om {time}. Wilt u doorgaan?",
}


def _is_user_confirming(messages: list[dict]) -> bool:
    """Return True if the last user message is an explicit confirmation."""
    for msg in reversed(messages):
        if msg["role"] == "user":
            words = set((msg.get("content") or "").lower().strip(".,!? ").split())
            return bool(words & _CONFIRMATION_TOKENS)
    return False


def _cancel_booking_confirm_prompt(tool_args: dict, lang: str) -> str:
    tpl = _CANCEL_BOOKING_CONFIRM.get(lang, _CANCEL_BOOKING_CONFIRM["en"])
    return tpl.format(
        client=tool_args.get("client", "?"),
        class_type=tool_args.get("class_type", "?"),
        date=tool_args.get("date", "?"),
        time=tool_args.get("start_time", "?"),
    )


def _filter_fallbacks(messages: list[dict]) -> list[dict]:
    """Strip assistant fallback messages from conversation history.

    Fallbacks are error artifacts (empty LLM response, parse failure) — the
    model never actually generated them. Including them in the next turn's
    history makes the model believe it said something it didn't, corrupting
    the conversation state and causing confused replies.
    """
    return [
        m for m in messages if not (m["role"] == "assistant" and m["content"] in _FALLBACK_TEXTS)
    ]


def _build_week_calendar(today: date) -> str:
    from datetime import timedelta

    monday = today - timedelta(days=today.weekday())
    days = []
    for i in range(7):
        d = monday + timedelta(days=i)
        marker = " ← today" if d == today else ""
        days.append(f"  {d.strftime('%A')}: {d.isoformat()}{marker}")
    return "\n".join(days)


# Matches llama-style inline tool calls that land in content instead of tool_calls:
#   <function/tool_name {"arg": "val"}</function>
#   <function=tool_name>{"arg": "val"}</function>
_INLINE_TOOL_RE = re.compile(
    r"<function[/=](\w+)[>\s]+(.*?)</function>",
    re.DOTALL | re.IGNORECASE,
)


def _parse_inline_tool_call(content: str) -> tuple[str, dict] | None:
    """Extract a tool name + args from llama's text-mode tool call syntax."""
    match = _INLINE_TOOL_RE.search(content)
    if not match:
        return None
    tool_name = match.group(1)
    raw_args = match.group(2).strip()
    try:
        args = json.loads(raw_args)
        if isinstance(args, dict):
            return tool_name, args
    except (json.JSONDecodeError, ValueError):
        pass
    return None


_KNOWN_TOOL_NAMES = {
    "create_class",
    "cancel_class",
    "book_client",
    "cancel_booking",
    "get_class_roster",
    "check_in_client",
    "create_client",
    "assign_membership",
    "get_report",
}


def _parse_llama_json_tool_call(content: str) -> tuple[str, dict] | None:
    """Parse Llama 3.2's native tool call format: {"name": "...", "parameters": {...}}

    Only matches known tool names to avoid treating studio data JSON (which also
    has a "name" field, e.g. class type records) as tool calls.
    """
    try:
        data = json.loads(content.strip())
        if isinstance(data, dict) and "name" in data:
            tool_name = data["name"]
            if tool_name not in _KNOWN_TOOL_NAMES:
                return None
            # Llama uses "parameters", litellm uses "arguments" — normalise
            args = data.get("parameters") or data.get("arguments") or {}
            if isinstance(args, str):
                args = json.loads(args)
            return tool_name, args
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return None


def _call_llm_with_retry(
    model: str,
    messages: list[dict],
    tools: list[dict],
    api_key: str | None,
    max_retries: int = 3,
):
    """Call litellm with exponential backoff on rate-limit (429) errors.

    For Ollama models, tools are omitted from the API call to avoid litellm
    injecting `format: json`, which causes Ollama to reject non-JSON replies.
    The fine-tuned model emits tool calls as JSON in the content field instead.
    """
    is_ollama = model.startswith("ollama")
    delay = 2.0
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            kwargs: dict = dict(
                model=model,
                messages=messages,
                api_key=api_key or None,
                api_base="http://localhost:11434" if is_ollama else None,
            )
            if not is_ollama:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"
            return completion(**kwargs)
        except Exception as exc:
            last_exc = exc
            exc_str = str(exc).lower()
            is_rate_limit = "rate limit" in exc_str or "429" in exc_str or "too many" in exc_str
            if is_rate_limit and attempt < max_retries - 1:
                logger.warning(
                    "Groq rate limit hit (attempt %d/%d), retrying in %.1fs: %s",
                    attempt + 1,
                    max_retries,
                    delay,
                    exc,
                )
                time.sleep(delay)
                delay *= 2
            else:
                logger.warning(
                    "Agent LLM call failed (attempt %d/%d): %s", attempt + 1, max_retries, exc
                )
                break
    raise last_exc  # type: ignore[misc]


def _extract_usage(response) -> AgentUsage | None:
    try:
        u = response.usage
        return AgentUsage(
            prompt_tokens=u.prompt_tokens,
            completion_tokens=u.completion_tokens,
            total_tokens=u.total_tokens,
        )
    except Exception:
        return None


@router.post("/act", response_model=AgentResponse)
def agent_act(
    request: AgentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager),
):
    from datetime import timedelta

    today = _studio_local_today(db)
    tomorrow = today + timedelta(days=1)
    day_after_tomorrow = today + timedelta(days=2)

    lang = request.language if request.language in _LANGUAGE_NAMES else "en"
    language_name = _LANGUAGE_NAMES[lang]
    docs_context = _load_docs_context(DOCS_DIR)
    studio_data = load_studio_data_summary(db, today)

    system_prompt = AGENT_SYSTEM_PROMPT.format(
        today=today.isoformat(),
        weekday=today.strftime("%A"),
        tomorrow=tomorrow.isoformat(),
        tomorrow_weekday=tomorrow.strftime("%A"),
        day_after_tomorrow=day_after_tomorrow.isoformat(),
        dat_weekday=day_after_tomorrow.strftime("%A"),
        week_calendar=_build_week_calendar(today),
        language_name=language_name,
        studio_data=studio_data,
        draft_summary=_draft_summary(request.draft),
        docs_context=docs_context,
    )
    messages = _filter_fallbacks([{"role": m.role, "content": m.content} for m in request.messages])

    try:
        response = _call_llm_with_retry(
            model=settings.LLM_MODEL,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            tools=ALL_WRITE_TOOLS,
            api_key=settings.LLM_API_KEY if settings.LLM_API_KEY else None,
        )
    except Exception as e:
        logger.warning("Agent LLM call failed after retries: %s", e)
        return AgentResponse(reply=_fallback_reply(lang), draft=request.draft)

    usage = _extract_usage(response)
    choice = response.choices[0].message
    tool_calls = getattr(choice, "tool_calls", None)

    # Some llama builds emit tool calls as inline text rather than structured tool_calls.
    # Detect and parse them so the user never sees raw XML function syntax.
    tool_name: str | None = None
    tool_args: dict = {}

    if tool_calls:
        call = tool_calls[0]
        tool_name = call.function.name
        try:
            tool_args = json.loads(call.function.arguments)
        except (json.JSONDecodeError, TypeError):
            tool_args = {}
    elif choice.content:
        parsed = _parse_inline_tool_call(choice.content) or _parse_llama_json_tool_call(
            choice.content
        )
        if parsed:
            tool_name, tool_args = parsed
        else:
            stripped = choice.content.strip()
            if stripped.startswith("{"):
                # Any JSON we couldn't parse as a valid tool call must never
                # be shown raw to the user — this catches:
                #   • hallucinated tools (create_location, etc.)
                #   • echoed studio data (membership_types, etc.)
                #   • known tool calls with malformed/double-encoded parameters
                if _is_hallucinated_tool_call(stripped):
                    return AgentResponse(
                        reply=_unsupported_op_reply(lang),
                        draft=request.draft,
                        usage=usage,
                    )
                return AgentResponse(
                    reply=_fallback_reply(lang),
                    draft=request.draft,
                    usage=usage,
                )
            return AgentResponse(
                reply=choice.content,
                draft=request.draft,
                usage=usage,
            )
    else:
        return AgentResponse(
            reply=_fallback_reply(lang),
            draft=request.draft,
            usage=usage,
        )

    # ── Write tool: create_class
    if tool_name == "create_class":
        merged_args = _merge_draft(request.draft, tool_args)
        result = handle_create_class(db, merged_args, today=today, lang=lang)

        if result.status == "executed":
            db.commit()
            db.refresh(result.scheduled_class)
            return AgentResponse(
                reply=result.message,
                action=AgentAction(type="created_class", scheduled_class=result.scheduled_class),
                usage=usage,
            )
        return AgentResponse(reply=result.message, draft=merged_args, usage=usage)

    # ── Write tool: cancel_class
    if tool_name == "cancel_class":
        result = handle_cancel_class(db, tool_args, today=today, lang=lang)

        if result.status == "executed":
            db.commit()
            return AgentResponse(reply=result.message, usage=usage)
        return AgentResponse(reply=result.message, draft=request.draft, usage=usage)

    # ── Write tool: book_client
    if tool_name == "book_client":
        merged_args = _merge_draft(request.draft, tool_args)
        result = handle_book_client(db, merged_args, today=today, lang=lang)

        if result.status == "executed":
            db.commit()
            return AgentResponse(reply=result.message, usage=usage)
        return AgentResponse(reply=result.message, draft=merged_args, usage=usage)

    # ── Write tool: cancel_booking  (requires explicit user confirmation)
    if tool_name == "cancel_booking":
        if not _is_user_confirming(messages):
            # Model skipped the confirmation step — intercept and ask deterministically.
            return AgentResponse(
                reply=_cancel_booking_confirm_prompt(tool_args, lang),
                draft=tool_args,
                usage=usage,
            )
        result = handle_cancel_booking(db, tool_args, today=today, lang=lang)
        if result.status == "executed":
            db.commit()
            return AgentResponse(reply=result.message, usage=usage)
        return AgentResponse(reply=result.message, draft=request.draft, usage=usage)

    # ── Read tool: get_class_roster
    if tool_name == "get_class_roster":
        result = handle_get_class_roster(db, tool_args, today=today, lang=lang)
        return AgentResponse(reply=result.message, draft=request.draft, usage=usage)

    # ── Write tool: check_in_client
    if tool_name == "check_in_client":
        result = handle_check_in_client(db, tool_args, today=today, lang=lang)

        if result.status == "executed":
            db.commit()
            return AgentResponse(reply=result.message, usage=usage)
        return AgentResponse(reply=result.message, draft=request.draft, usage=usage)

    # ── Write tool: create_client
    if tool_name == "create_client":
        merged_args = _merge_draft(request.draft, tool_args)
        result = handle_create_client(db, merged_args, lang=lang)

        if result.status == "executed":
            db.commit()
            return AgentResponse(reply=result.message, usage=usage)
        return AgentResponse(reply=result.message, draft=merged_args, usage=usage)

    # ── Write tool: assign_membership
    if tool_name == "assign_membership":
        merged_args = _merge_draft(request.draft, tool_args)
        result = handle_assign_membership(db, merged_args, today=today, lang=lang)

        if result.status == "executed":
            db.commit()
            return AgentResponse(reply=result.message, usage=usage)
        return AgentResponse(reply=result.message, draft=merged_args, usage=usage)

    # ── Read tool: get_report
    if tool_name == "get_report":
        result = handle_get_report(db, tool_args, today=today, lang=lang)
        return AgentResponse(reply=result.message, draft=request.draft, usage=usage)

    return AgentResponse(
        reply=_fallback_reply(lang),
        draft=request.draft,
        usage=usage,
    )
