import database

client = database.get_chroma_client()
collection = database.get_collection(client)
model = database.get_embedding_model()

query = "what program maju"
print(f"Retrieving chunks for: '{query}'")
chunks, sources, scores = database.search(query, collection, model, top_k=5)

for i, (chunk, source, score) in enumerate(zip(chunks, sources, scores)):
    print(f"\nResult {i} (Score: {score}):")
    print(f"Source: {source}")
    print(f"Text Preview:\n{chunk}")
    print("-" * 50)
