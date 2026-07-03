import logging
import os
import re

from fastapi import APIRouter, Depends
from litellm import completion
from pydantic import BaseModel, field_validator

from app.auth import get_current_user
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/support", tags=["support"])

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "docs-site", "docs")
_FALLBACK_REPLIES: dict[str, str] = {
    "en": "I'm sorry, I can't answer right now. Please try again later.",
    "it": "Mi dispiace, non riesco a rispondere in questo momento. Riprova tra poco.",
    "fr": "Désolé, je ne peux pas répondre maintenant. Réessayez plus tard.",
    "de": "Es tut mir leid, ich kann gerade nicht antworten. Bitte versuchen Sie es später erneut.",
    "es": "Lo siento, no puedo responder ahora. Por favor, inténtelo de nuevo más tarde.",
    "pt": "Desculpe, não consigo responder agora. Por favor, tente novamente mais tarde.",
    "nl": "Sorry, ik kan nu niet antwoorden. Probeer het later opnieuw.",
    "pl": "Przepraszam, nie mogę teraz odpowiedzieć. Spróbuj ponownie później.",
    "tr": "Özür dilerim, şu anda yanıt veremiyorum. Lütfen daha sonra tekrar deneyin.",
}

_OUT_OF_SCOPE_REPLIES: dict[str, str] = {
    "en": "I don't have information about that in the Agon documentation.",
    "it": "Non ho informazioni su questo nella documentazione di Agon.",
    "fr": "Je n'ai pas d'informations à ce sujet dans la documentation Agon.",
    "de": "Dazu habe ich keine Informationen in der Agon-Dokumentation.",
    "es": "No tengo información sobre eso en la documentación de Agon.",
    "pt": "Não tenho informações sobre isso na documentação do Agon.",
    "nl": "Ik heb geen informatie hierover in de Agon-documentatie.",
    "pl": "Nie mam informacji na ten temat w dokumentacji Agon.",
    "tr": "Agon belgelerinde bu konuda bilgi bulamıyorum.",
}


def _fallback_reply(lang: str) -> str:
    return _FALLBACK_REPLIES.get(lang, _FALLBACK_REPLIES["en"])


def _out_of_scope_reply(lang: str) -> str:
    return _OUT_OF_SCOPE_REPLIES.get(lang, _OUT_OF_SCOPE_REPLIES["en"])


# Greeting word -> language code
_GREETING_LANG: dict[str, str] = {
    "hi": "en",
    "hello": "en",
    "hey": "en",
    "help": "en",
    "good morning": "en",
    "good afternoon": "en",
    "good evening": "en",
    "hi there": "en",
    "hello there": "en",
    "ciao": "it",
    "salve": "it",
    "buongiorno": "it",
    "buonasera": "it",
    "aiuto": "it",
    "bonjour": "fr",
    "bonsoir": "fr",
    "aide": "fr",
    "hallo": "de",
    "guten morgen": "de",
    "guten tag": "de",
    "hilfe": "de",
    "hola": "es",
    "buenos dias": "es",
    "buenas tardes": "es",
    "ayuda": "es",
    "ola": "pt",
    "bom dia": "pt",
    "boa tarde": "pt",
    "ajuda": "pt",
    "hoi": "nl",
    "goedemorgen": "nl",
    "hulp": "nl",
    "czesc": "pl",
    "dzien dobry": "pl",
    "pomoc": "pl",
    "merhaba": "tr",
    "gunaydin": "tr",
    "yardim": "tr",
}

_GREETING_REPLIES: dict[str, str] = {
    "en": "Hello! How can I help you with Agon today? You can ask me about classes, clients, memberships, bookings, check-ins, reports, or settings.",
    "it": "Ciao! Come posso aiutarti con Agon? Puoi chiedermi informazioni su lezioni, clienti, abbonamenti, prenotazioni, check-in, report o impostazioni.",
    "fr": "Bonjour ! Comment puis-je vous aider avec Agon ? Posez-moi des questions sur les cours, clients, abonnements, reservations, check-ins, rapports ou parametres.",
    "de": "Hallo! Wie kann ich Ihnen mit Agon helfen? Fragen Sie mich zu Kursen, Kunden, Mitgliedschaften, Buchungen, Check-ins, Berichten oder Einstellungen.",
    "es": "Hola! Como puedo ayudarte con Agon? Puedes preguntarme sobre clases, clientes, membresias, reservas, check-ins, informes o configuracion.",
    "pt": "Ola! Como posso ajuda-lo com o Agon? Pode perguntar-me sobre aulas, clientes, associacoes, reservas, check-ins, relatorios ou definicoes.",
    "nl": "Hoi! Hoe kan ik u helpen met Agon? U kunt vragen stellen over klassen, klanten, lidmaatschappen, boekingen, check-ins, rapporten of instellingen.",
    "pl": "Czesc! Jak moge ci pomoc w Agon? Mozesz zapytac o zajecia, klientow, czlonkostwa, rezerwacje, check-iny, raporty lub ustawienia.",
    "tr": "Merhaba! Agon ile ilgili size nasil yardimci olabilirim? Dersler, musteriler, uyelikler, rezervasyonlar, check-in, raporlar veya ayarlar hakkinda soru sorabilirsiniz.",
}

# Multilingual question/help words — messages containing these always reach the LLM
_HELP_WORDS: set[str] = {
    # EN
    "how",
    "what",
    "where",
    "when",
    "why",
    "help",
    "explain",
    "want",
    "need",
    "create",
    "add",
    "edit",
    "delete",
    "manage",
    "view",
    "show",
    "find",
    # IT
    "come",
    "cosa",
    "dove",
    "quando",
    "perché",
    "aiuto",
    "aiutami",
    "spiega",
    "voglio",
    "vorrei",
    "devo",
    "posso",
    "puoi",
    "fare",
    "creare",
    "creo",
    "aggiungere",
    "modificare",
    "eliminare",
    "gestire",
    "vedere",
    "trovare",
    # FR
    "comment",
    "quoi",
    "quand",
    "pourquoi",
    "aide",
    "expliquer",
    "veux",
    "voudrais",
    "créer",
    "ajouter",
    "modifier",
    "supprimer",
    "gérer",
    "voir",
    # DE
    "wie",
    "was",
    "wann",
    "warum",
    "hilfe",
    "erklären",
    "möchte",
    "will",
    "erstellen",
    "hinzufügen",
    "bearbeiten",
    "löschen",
    "verwalten",
    "anzeigen",
    # ES
    "cómo",
    "como",
    "dónde",
    "cuándo",
    "ayuda",
    "quiero",
    "quisiera",
    "crear",
    "agregar",
    "editar",
    "eliminar",
    "gestionar",
    "ver",
    # PT
    "onde",
    "quando",
    "ajuda",
    "quero",
    "gostaria",
    "criar",
    "adicionar",
    "editar",
    "excluir",
    "gerenciar",
    "ver",
    # NL
    "hoe",
    "wat",
    "waar",
    "wanneer",
    "waarom",
    "hulp",
    "wil",
    "wilt",
    "maken",
    "toevoegen",
    "bewerken",
    "verwijderen",
    "beheren",
    "bekijken",
    # PL
    "jak",
    "gdzie",
    "kiedy",
    "dlaczego",
    "pomoc",
    "chcę",
    "chciałbym",
    "tworzyć",
    "dodać",
    "edytować",
    "usunąć",
    "zarządzać",
    "zobaczyć",
    # TR
    "nasıl",
    "nerede",
    "neden",
    "yardım",
    "istiyorum",
    "isterim",
    "oluşturmak",
    "eklemek",
    "düzenlemek",
    "silmek",
    "yönetmek",
    "görmek",
}

# Multilingual Agon domain keywords — one set covering all 9 supported UI languages.
# A message containing any of these words is considered in-scope for the LLM.
_AGON_KEYWORDS: set[str] = {
    # ── English ──────────────────────────────────────────────────────────────
    "booking",
    "bookings",
    "book",
    "class",
    "classes",
    "lesson",
    "lessons",
    "membership",
    "memberships",
    "member",
    "client",
    "clients",
    "checkin",
    "check-in",
    "waitlist",
    "schedule",
    "calendar",
    "instructor",
    "instructors",
    "payment",
    "payments",
    "report",
    "reports",
    "settings",
    "setting",
    "credit",
    "credits",
    "cancel",
    "cancellation",
    "dashboard",
    "studio",
    "capacity",
    "attendance",
    "qr",
    "onboarding",
    "stripe",
    "recurring",
    # ── Italian ──────────────────────────────────────────────────────────────
    "prenotazione",
    "prenotazioni",
    "prenota",
    "lezione",
    "lezioni",
    "classe",
    "classi",
    "tipo",
    "tipi",
    "abbonamento",
    "abbonamenti",
    "cliente",
    "clienti",
    "lista",
    "attesa",
    "pianifica",
    "calendario",
    "istruttore",
    "istruttori",
    "pagamento",
    "pagamenti",
    "credito",
    "crediti",
    "annulla",
    "cancella",
    "capacità",
    "presenze",
    "impostazioni",
    "dashboard",
    "studio",
    "ricorrente",
    "checkin",
    "qr",
    "orario",
    "accesso",
    # ── French ───────────────────────────────────────────────────────────────
    "réservation",
    "réservations",
    "réserver",
    "cours",
    "abonnement",
    "abonnements",
    "client",
    "clients",
    "attente",
    "calendrier",
    "instructeur",
    "paiement",
    "paiements",
    "crédit",
    "crédits",
    "annuler",
    "paramètres",
    "présences",
    "planifier",
    "récurrent",
    # ── German ───────────────────────────────────────────────────────────────
    "buchung",
    "buchungen",
    "buchen",
    "kurs",
    "kurse",
    "mitgliedschaft",
    "mitgliedschaften",
    "kunde",
    "kunden",
    "warteliste",
    "kalender",
    "instruktor",
    "zahlung",
    "zahlungen",
    "guthaben",
    "stornieren",
    "einstellungen",
    "anwesenheit",
    "planen",
    "wiederkehrend",
    # ── Spanish ──────────────────────────────────────────────────────────────
    "reserva",
    "reservas",
    "reservar",
    "clase",
    "clases",
    "membresía",
    "membresias",
    "cliente",
    "clientes",
    "espera",
    "calendario",
    "instructor",
    "pago",
    "pagos",
    "crédito",
    "créditos",
    "cancelar",
    "configuración",
    "asistencia",
    "programar",
    "recurrente",
    # ── Portuguese ───────────────────────────────────────────────────────────
    "aula",
    "aulas",
    "associação",
    "sócio",
    "sócios",
    "lista",
    "calendário",
    "instrutor",
    "relatório",
    "relatórios",
    "definições",
    "presença",
    "agendamento",
    "recorrente",
    # ── Dutch ─────────────────────────────────────────────────────────────────
    "boeking",
    "boekingen",
    "boeken",
    "klas",
    "klassen",
    "lidmaatschap",
    "lidmaatschappen",
    "klant",
    "klanten",
    "wachtlijst",
    "kalender",
    "instructeur",
    "betaling",
    "betalingen",
    "krediet",
    "annuleren",
    "instellingen",
    "aanwezigheid",
    "plannen",
    "terugkerend",
    # ── Polish ────────────────────────────────────────────────────────────────
    "rezerwacja",
    "rezerwacje",
    "zarezerwować",
    "zajęcia",
    "lekcja",
    "lekcje",
    "członkostwo",
    "klient",
    "klienci",
    "oczekujących",
    "kalendarz",
    "instruktor",
    "płatność",
    "płatności",
    "kredyt",
    "kredyty",
    "anulować",
    "ustawienia",
    "frekwencja",
    "zaplanować",
    "cykliczny",
    # ── Turkish ───────────────────────────────────────────────────────────────
    "rezervasyon",
    "rezervasyonlar",
    "rezerve",
    "ders",
    "dersler",
    "üyelik",
    "üyelikler",
    "müşteri",
    "müşteriler",
    "bekleme",
    "takvim",
    "eğitmen",
    "ödeme",
    "ödemeler",
    "kredi",
    "iptal",
    "ayarlar",
    "katılım",
    "planla",
    "tekrarlayan",
}


def _greeting_reply(message: str, platform_lang: str = "en") -> str | None:
    """Return a greeting reply in the platform language, or None if not a greeting."""
    normalized = message.strip().lower().rstrip("!.,?")
    lang = _GREETING_LANG.get(normalized)
    if lang is None:
        return None
    reply_lang = platform_lang if platform_lang in _GREETING_REPLIES else "en"
    return _GREETING_REPLIES[reply_lang]


def _is_in_scope(user_message: str) -> bool:
    """
    Return True if the message contains at least one Agon keyword or a
    help/question word in any of the 9 supported languages.
    Falls back to True for very short messages (let the LLM decide).
    """
    words = set(re.findall(r"[\w\-]+", user_message.lower()))

    if words & _HELP_WORDS:
        return True

    if words & _AGON_KEYWORDS:
        return True

    # Short messages (≤3 tokens) are ambiguous — pass to LLM
    if len(words) <= 3:
        return True

    return False


# Cached at import time — docs are static while the server runs
_DOCS_CONTEXT: str | None = None


def _load_docs_context(docs_dir: str, max_chars: int = 32000) -> str:
    global _DOCS_CONTEXT
    if _DOCS_CONTEXT is not None:
        return _DOCS_CONTEXT

    if not os.path.isdir(docs_dir):
        logger.warning(f"Docs directory not found: {docs_dir}")
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
        filename = os.path.basename(filepath)
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                parts.append(f"### {filename}\n{f.read()}")
        except Exception as e:
            logger.warning(f"Could not read docs file {filepath}: {e}")

    combined = "\n\n".join(parts)
    _DOCS_CONTEXT = combined[:max_chars]
    logger.info(f"Loaded {len(parts)} docs files, {len(_DOCS_CONTEXT)} chars of context")
    return _DOCS_CONTEXT


_LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "it": "Italian",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
}

SYSTEM_PROMPT_TEMPLATE = """\
You are the built-in support assistant for Agon, a fitness studio management desktop application.

LANGUAGE RULE - MANDATORY:
You MUST write your entire response in {language_name} only. Never switch to another language. Every word must be in {language_name}.

FORMATTING RULES - MANDATORY:
Do NOT use markdown. Do NOT write bold (**text**), italic (*text*), or headers (# text).
Do NOT use bullet points with asterisks. Use plain text only.
For step-by-step procedures, use numbered steps: 1. 2. 3.

CONTENT RULES:
1. Answer ONLY using the Agon documentation provided below. Never use general knowledge about other software.
2. Use the EXACT section and button names from the documentation. Do not invent names.
3. If the answer is not in the documentation, write a short refusal in {language_name}. Do NOT try to answer from general knowledge.
4. Do not speculate. Do not say "usually" or "typically" based on general knowledge.
5. Be concise. Use numbered steps for procedures.
6. Do NOT proactively mention data deletion, GDPR, or financial topics unless specifically asked.

AGON DOCUMENTATION:
{docs_context}
"""


class ChatMessage(BaseModel):
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


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    language: str = "en"

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v: list) -> list:
        if len(v) > 50:
            raise ValueError("conversation exceeds 50 messages")
        return v


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse)
async def support_chat(
    request: ChatRequest,
    current_user=Depends(get_current_user),
):
    docs_context = _load_docs_context(DOCS_DIR)

    # Find the last user message for pre-screening
    last_user_message = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            last_user_message = msg.content
            break

    # Greeting handler — short-circuit before LLM for common salutations
    if last_user_message:
        greeting = _greeting_reply(last_user_message, request.language)
        if greeting:
            logger.info(f"Greeting detected, returning localised reply: {last_user_message[:80]!r}")
            return ChatResponse(reply=greeting)

    if last_user_message and not _is_in_scope(last_user_message):
        logger.info(f"Pre-screening rejected out-of-scope message: {last_user_message[:80]!r}")
        return ChatResponse(reply=_out_of_scope_reply(request.language))

    lang = request.language if request.language in _LANGUAGE_NAMES else "en"
    language_name = _LANGUAGE_NAMES[lang]
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        docs_context=docs_context, language_name=language_name
    )
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    try:
        response = completion(
            model=settings.LLM_MODEL,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            api_key=settings.LLM_API_KEY if settings.LLM_API_KEY else None,
            api_base="http://localhost:11434" if settings.LLM_MODEL.startswith("ollama") else None,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        if "content filtering" in str(e).lower() or "blocked" in str(e).lower():
            logger.warning(f"LLM content filtering triggered: {e}")
            reply = "I'm unable to process that request. Please rephrase your question about Agon."
        else:
            logger.warning(f"Support LLM call failed: {e}")
            reply = _fallback_reply(request.language)

    return ChatResponse(reply=reply)
