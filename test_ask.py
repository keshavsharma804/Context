from ask import ask

questions = [
    "how much did I spend this week?",
    "what did I spend on food?",
    "what patterns am I stuck in?",
    "what do I know about Priya?",
    "what did I promise Tom?",
]

for q in questions:
    print("=" * 70)
    print("Q:", q)
    answer, sources = ask(q)
    print("A:", answer)
    if sources:
        print("Sources:")
        for s in sources[:5]:
            print(f"  - {s['type']}: {s['title'][:60]}")
    print()