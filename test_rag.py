from rag import search_chunks

queries = [
    "which CVs are on my machine",
    "find any documents mentioning MSME or Udyam",
    "what Infosys prep docs do I have",
    "what files do I have about Picklix",
]

for q in queries:
    print("=" * 70)
    print("QUERY:", q)
    results = search_chunks(q)
    print("RESULTS:", len(results))
    for i, r in enumerate(results[:8], 1):
        st = r.get("source_type", "?")
        title = (r.get("title") or "")[:70]
        print("  [" + str(i) + "]", st, "|", title)
    print()