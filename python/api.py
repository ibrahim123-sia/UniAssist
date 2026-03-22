"""
========================================================
API.PY - FastAPI Server for the RAG System
========================================================

This exposes the RAG system as an HTTP API so the Node.js
backend (or any other client) can send questions and get answers.

ENDPOINT:
  POST /ask
  Body: { "question": "What is the admission fee?" }
  Response: { "answer": "The admission fee is..." }

TO RUN:
  python api.py
  OR: python run.py server
"""

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

import rag


# =============================================================
# APP SETUP
# =============================================================

# Create the FastAPI application
app = FastAPI(
    title="University RAG API",
    description="Ask questions about Muhammad Ali Jinnah University",
)


# =============================================================
# REQUEST/RESPONSE MODELS
# =============================================================
# These define the shape of the JSON that the API accepts and returns.
# Pydantic automatically validates incoming requests against these.

class QuestionRequest(BaseModel):
    """The JSON body that the client sends."""
    question: str   # The student's question


class AnswerResponse(BaseModel):
    """The JSON body that the API returns."""
    answer: str     # The generated answer


# =============================================================
# ENDPOINTS
# =============================================================

@app.post("/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    """
    Answer a student's question using the RAG pipeline.

    The Node.js backend calls this endpoint. It:
      1. Receives the question from the request body
      2. Passes it through the RAG pipeline (search → LLM → answer)
      3. Returns the answer as JSON
    """
    answer = rag.ask(request.question)
    return AnswerResponse(answer=answer)


# =============================================================
# SERVER STARTUP
# =============================================================

if __name__ == "__main__":
    # Start the server on port 8000, accessible from any network interface
    uvicorn.run(app, host="0.0.0.0", port=8000)
