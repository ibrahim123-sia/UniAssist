from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from rag_query import ask_university_rag

app = FastAPI()

class QuestionRequest(BaseModel):
    question: str

@app.post("/ask")
async def ask_question(request: QuestionRequest):
    answer = ask_university_rag(request.question, provider="groq")
    return {"answer": answer}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)