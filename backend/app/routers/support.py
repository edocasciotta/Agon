import logging
import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from litellm import completion
from app.config import settings
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/support", tags=["support"])

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "docs-site", "docs")
FALLBACK_REPLY = (
    "I'm sorry, I can't answer right now. "
    "Please check the documentation at docs.agonapp.io or try again later."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str


def _load_docs_context(docs_dir: str, max_chars: int = 15000) -> str:
    """Load all .md files from the docs directory and concatenate their content."""
    if not os.path.isdir(docs_dir):
        return ""

    parts = []
    for root, _dirs, files in os.walk(docs_dir):
        for filename in sorted(files):
            if filename.endswith(".md"):
                filepath = os.path.join(root, filename)
                try:
                    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                        parts.append(f.read())
                except Exception as e:
                    logger.warning(f"Could not read docs file {filepath}: {e}")

    combined = "\n\n".join(parts)
    return combined[:max_chars]


@router.post("/chat", response_model=ChatResponse)
async def support_chat(
    request: ChatRequest,
    current_user=Depends(get_current_user),
):
    docs_context = _load_docs_context(DOCS_DIR)

    system_prompt = (
        "You are an AI support agent for Agon, a fitness studio management platform. "
        "Answer questions in the same language the user writes in. "
        "You only answer questions about Agon features. "
        "Use the following documentation as your knowledge base:\n\n"
        + docs_context
    )

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    try:
        response = completion(
            model=settings.LLM_MODEL,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            api_base=settings.LLM_BASE_URL if settings.LLM_PROVIDER == "ollama" else None,
            api_key=settings.LLM_API_KEY if settings.LLM_API_KEY else None,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        logger.warning(f"Support LLM call failed: {e}")
        reply = FALLBACK_REPLY

    return ChatResponse(reply=reply)
