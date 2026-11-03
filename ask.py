from rag import search_chunks
from groq_client import chat, has_key
from config import ASK_TOP_K


SYSTEM_PROMPT = """You are Context, answering questions about the user's OWN personal data.

RULES:
1. Use ONLY the context below. For sums/counts, do arithmetic from the structured data.
2. If a "YOUR SPENDING DATA" or "DETECTED PATTERNS" block is provided, THOSE are the authoritative answers. Use them directly.
3. For "list" questions, output items as bullets. Max 10.
4. Cite sources as [1], [2]. For structured data blocks, no citation needed.
5. Never invent facts. If nothing relevant, say "I couldn't find that in your data."
6. Be concise. No preamble."""


MONEY_KEYWORDS = {"spend", "spent", "money", "cost", "budget", "expense",
                  "rupee", "rupees", "paid", "buy", "bought", "shopping",
                  "food", "transport", "leak", "leaking"}
PATTERN_KEYWORDS = {"pattern", "patterns", "stuck", "mistake", "mistakes",
                    "doing wrong", "repeat", "habit", "habits", "trap",
                    "wrong", "stop doing"}


def _money_block():
    try:
        from spends import spend_brief, summary
        sb = spend_brief()
        week = summary("week")
        month = summary("month")
        lines = [
            "=== YOUR SPENDING DATA ===",
            f"This week total: ₹{sb['week_total']:.0f}",
            f"This month total: ₹{sb['month_total']:.0f}",
        ]
        if week["by_category"]:
            lines.append("This week by category:")
            for c in week["by_category"]:
                lines.append(f"  - {c['category']}: ₹{c['total']:.0f} ({c['count']} entries)")
        if month["by_category"]:
            lines.append("This month by category:")
            for c in month["by_category"]:
                lines.append(f"  - {c['category']}: ₹{c['total']:.0f} ({c['count']} entries)")
        if sb["budgets"]:
            lines.append("Budgets:")
            for b in sb["budgets"]:
                lines.append(f"  - {b['category']}: ₹{b['spent']:.0f} / ₹{b['budget']:.0f} ({b['percent']}%)")
        if sb["compare"]["last_total"] > 0:
            lines.append(f"Vs last week: {sb['compare']['change_pct']:+}%")
        if sb["leaks"]:
            lines.append("Leaks:")
            for l in sb["leaks"]:
                lines.append(f"  - {l['detail']}")
        return "\n".join(lines)
    except Exception as e:
        return f"(money data unavailable: {e})"


def _patterns_block():
    try:
        from patterns import get_patterns
        ps = get_patterns(15)
        if not ps:
            return "=== DETECTED PATTERNS ===\n(No patterns detected yet — try 'refresh patterns' on the homepage.)"
        lines = ["=== DETECTED PATTERNS ==="]
        for p in ps:
            lines.append(f"[{p['severity']}] {p['title']}")
            lines.append(f"   {p['detail']}")
        return "\n".join(lines)
    except Exception as e:
        return f"(patterns unavailable: {e})"


def _person_block(name):
    try:
        from people import get_person
        p = get_person(name)
        if not p:
            return None
        lines = [f"=== PERSON: {p['name']} ==="]
        if p.get("birthday"):
            lines.append(f"Birthday: {p['birthday']}")
        if p.get("last_contacted"):
            lines.append(f"Last contacted: {p['last_contacted']}")
        if p.get("facts"):
            lines.append("Facts:")
            for f in p["facts"]:
                lines.append(f"  - [{f['category']}] {f['fact']}")
        return "\n".join(lines)
    except Exception:
        return None


def _detect_person_name(question):
    """If the question is about a specific person, find their name."""
    try:
        from people import people_brief, get_person
        from db import get_conn
        conn = get_conn()
        names = [r["name"] for r in conn.execute("SELECT name FROM people").fetchall()]
        conn.close()
        ql = question.lower()
        for n in names:
            if n.lower() in ql:
                return n
    except Exception:
        pass
    return None


def ask(question, top_k=None):
    if not has_key():
        return "Connect your Groq API key first (see the card on the page).", []
    if not question or not question.strip():
        return "Ask something.", []

    q_lower = question.lower()
    context_blocks = []
    sources = []

    # ---------- Intent-based structured retrieval ----------
    if any(k in q_lower for k in MONEY_KEYWORDS):
        context_blocks.append(_money_block())

    if any(k in q_lower for k in PATTERN_KEYWORDS):
        context_blocks.append(_patterns_block())

    person_name = _detect_person_name(question)
    if person_name:
        pb = _person_block(person_name)
        if pb:
            context_blocks.append(pb)

    # ---------- RAG retrieval (files/emails/events/manual) ----------
    results = search_chunks(question, limit=top_k or ASK_TOP_K)

    # If we already have structured context, use fewer RAG chunks
    if context_blocks and len(results) > 5:
        results = results[:5]

    # If we have no structured context but RAG found nothing → empty answer
    if not context_blocks and not results:
        return "I couldn't find anything in your data matching that.", []

    rag_parts = []
    for i, r in enumerate(results, 1):
        content = (r.get("content") or "")[:1200]
        rag_parts.append(f"[{i}] {r['source_type'].upper()}: {r['title']}\n{content}")
        sources.append({
            "type": r["source_type"],
            "title": r["title"],
            "id": r["source_id"],
        })

    # Dedupe sources by title
    seen_titles = set()
    deduped_sources = []
    for s in sources:
        key = (s["type"], s["title"])
        if key in seen_titles:
            continue
        seen_titles.add(key)
        deduped_sources.append(s)

    # ---------- Build prompt ----------
    prompt_parts = []
    if context_blocks:
        prompt_parts.append("\n\n".join(context_blocks))
    if rag_parts:
        prompt_parts.append("=== RELEVANT ITEMS FROM YOUR DATA ===\n" + "\n\n".join(rag_parts))

    user_msg = (
        "\n\n".join(prompt_parts)
        + f"\n\nQuestion: {question}\n\n"
        "Answer using ONLY the data above. Cite RAG items as [1], [2]. "
        "Structured blocks (SPENDING/PATTERNS/PERSON) are authoritative — answer directly from them."
    )

    try:
        answer = chat(SYSTEM_PROMPT, user_msg, temperature=0.1, max_tokens=800)
    except Exception as e:
        return f"Error: {e}", deduped_sources
    if context_blocks:
        return answer, []
    return answer, deduped_sources