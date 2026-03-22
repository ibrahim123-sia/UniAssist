"""
========================================================
RAG.PY - Retrieval-Augmented Generation Pipeline
========================================================

This is the brain of the system. It connects everything together:
  1. Takes a student's question
  2. Searches the vector database for relevant info
  3. Builds a prompt with that info as context
  4. Sends it to the LLM (Groq/Llama) for a natural answer

WHAT IS RAG?
  RAG = Retrieval-Augmented Generation
  Instead of the AI making up answers, we first RETRIEVE real
  information from our database, then the AI GENERATES an answer
  based only on that real information. This prevents hallucination.

FLOW:
  Question → Vector Search → Relevant Chunks → LLM Prompt → Answer
"""

import re
import os
from groq import Groq

import config
import database


# =============================================================
# PROMPT CREATION - Building the instruction for the LLM
# =============================================================

def create_prompt(question, relevant_chunks):
    """
    Build a prompt that tells the LLM how to answer.

    The prompt has three parts:
      1. Role: "You are a university assistant"
      2. Context: The relevant chunks from our database
      3. Instructions: How to format the answer

    WHY SO MANY INSTRUCTIONS?
    LLMs tend to add citations like [1], [2] and source lists.
    We explicitly tell it not to, because the student just wants
    a clean, natural answer.

    Args:
        question:         The student's question
        relevant_chunks:  List of text strings from the database

    Returns:
        The complete prompt string ready for the LLM
    """
    # Join all chunks with separators to form the context
    context = "\n\n---\n\n".join(relevant_chunks)

    prompt = f"""You are a helpful assistant for Muhammad Ali Jinnah University (MAJU).
Your task is to answer student questions using ONLY the provided context from the university website.
If the context doesn't contain the answer, say "I don't have information about that in my database."

CONTEXT FROM UNIVERSITY WEBSITE:
{context}

STUDENT'S QUESTION: {question}

INSTRUCTIONS:
1. Answer clearly and concisely
2. Use ONLY information from the context above
3. DO NOT mention sources or citations in your answer
4. DO NOT include any numbers in brackets like [1] or [2]
5. DO NOT add a sources section at the end
6. Provide a clean, natural answer as if you're a university representative
7. If the context has contact info (emails, phones), include them naturally
8. If the context has fees or numbers, be precise

ANSWER:"""

    return prompt


# =============================================================
# LLM INTEGRATION - Getting answers from the AI model
# =============================================================

def get_llm_response(prompt):
    """
    Send a prompt to the Groq LLM and get the response.

    We use Groq's API because it provides very fast inference
    for the Llama 3.3 70B model. The temperature is set low (0.3)
    so answers are focused and consistent rather than creative.

    Args:
        prompt: The complete prompt string

    Returns:
        The LLM's answer as a string
    """
    # Check that we have an API key
    api_key = config.GROQ_API_KEY
    if not api_key:
        return "Error: GROQ_API_KEY not found in .env file. Get one at console.groq.com"

    # Create the Groq client and send the request
    client = Groq(api_key=api_key)

    response = client.chat.completions.create(
        model=config.LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a helpful university assistant. "
                           "Provide answers without citations or source references.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=config.LLM_TEMPERATURE,
        max_tokens=config.LLM_MAX_TOKENS,
    )

    return response.choices[0].message.content


def clean_answer(answer):
    """
    Post-process the LLM's answer to remove any citations.

    Even with explicit instructions, LLMs sometimes add citation
    markers like [1] or "Sources:" sections. This function removes
    any that slip through.

    Args:
        answer: Raw answer from the LLM

    Returns:
        Clean answer with no citations or source references
    """
    # Remove [1], [2], etc.
    answer = re.sub(r"\[\d+\]", "", answer)

    # Remove "Source:" or "Sources:" sections
    answer = re.sub(r"(?i)(sources?:.*?)(?=\n\n|\Z)", "", answer, flags=re.DOTALL)

    # Remove trailing source/reference lists
    answer = re.sub(
        r"(?i)\n\n(?:📎\s*)?(?:source|references?):.*", "", answer, flags=re.DOTALL
    )

    return answer.strip()


# =============================================================
# MAIN RAG PIPELINE - The complete question-answering flow
# =============================================================

# Cache the database connection and model so we don't reload them
# every time a question is asked. This makes repeated queries fast.
_collection = None
_model = None


def _initialize():
    """
    Load the database and embedding model (once).

    This is called automatically on the first question.
    After that, the connection is reused for all subsequent questions.
    """
    global _collection, _model

    if _collection is None:
        print("Initializing RAG system...")
        client = database.get_chroma_client()
        _collection = database.get_collection(client)
        print(f"  Database loaded: {_collection.count()} documents")

    if _model is None:
        _model = database.get_embedding_model()
        print(f"  Embedding model loaded: {config.EMBEDDING_MODEL}")


def ask(question):
    """
    Answer a student's question using the RAG pipeline.

    This is the main function that the API calls. It:
      1. Initializes the system (if not already done)
      2. Searches for relevant chunks
      3. Creates a prompt with context
      4. Gets an LLM response
      5. Cleans up the answer

    Args:
        question: The student's question (natural language string)

    Returns:
        A clean, natural language answer based on university data
    """
    # Step 1: Make sure the system is initialized
    _initialize()

    # Step 2: Search the database for relevant chunks
    chunks, sources, scores = database.search(
        question=question,
        collection=_collection,
        model=_model,
        top_k=config.TOP_K_RESULTS,
    )

    # If nothing relevant was found, say so
    if not chunks:
        return "I don't have information about that in my database."

    # Step 3: Build the prompt with retrieved context
    prompt = create_prompt(question, chunks)

    # Step 4: Get the LLM's answer
    answer = get_llm_response(prompt)

    # Step 5: Clean up any citations that slipped through
    answer = clean_answer(answer)

    return answer
