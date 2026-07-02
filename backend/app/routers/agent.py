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

from app.auth import require_manager
from app.config import settings
from app.database import get_db
from app.models.studio_settings import StudioSettings
from app.schemas.scheduled_class import ScheduledClassResponse
from app.services.agent_tools import (
    ALL_WRITE_TOOLS,
    handle_cancel_class,
    handle_create_class,
    load_studio_data_summary,
)
from fastapi import APIRouter, Depends
from litellm import completion
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

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

FORMATTING RULES — MANDATORY:
Do NOT use markdown. Do NOT write bold (**text**), italic (*text*), or headers (# text).
Use plain text only. For lists, use numbered steps: 1. 2. 3.

REAL STUDIO DATA (pre-loaded — use this to answer data questions, NEVER invent information):
{studio_data}

You can also perform actions:
- "Create a yoga class tomorrow at 10" → call create_class (use tomorrow={tomorrow} as the date)
- "Cancel the pilates class on Friday" → call cancel_class

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


def _fallback_reply(lang: str) -> str:
    return _FALLBACK_REPLIES.get(lang, _FALLBACK_REPLIES["en"])


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


def _call_llm_with_retry(
    model: str,
    messages: list[dict],
    tools: list[dict],
    api_key: str | None,
    max_retries: int = 3,
):
    """Call litellm with exponential backoff on rate-limit (429) errors."""
    delay = 2.0
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            return completion(
                model=model,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                api_key=api_key or None,
            )
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
                logger.warning("Agent LLM call failed (attempt %d/%d): %s", attempt + 1, max_retries, exc)
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
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

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
        parsed = _parse_inline_tool_call(choice.content)
        if parsed:
            tool_name, tool_args = parsed
        else:
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

    return AgentResponse(
        reply=_fallback_reply(lang),
        draft=request.draft,
        usage=usage,
    )
