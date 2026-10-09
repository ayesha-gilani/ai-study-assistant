import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from google import genai
from google.genai import types
from pydantic import BaseModel

# Load the .env file from the project root.
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY is missing from the project root .env file.")

client = genai.Client(api_key=api_key)
GEMINI_MODEL = "gemini-3.5-flash-lite"


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    answer: str


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]

app = Flask(__name__)
CORS(app)


@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True) or {}
    question = data.get("question", "")
    mode = data.get("mode", "simple")

    if not isinstance(question, str) or not question.strip():
        return jsonify({"error": "Please enter a question."}), 400

    instructions = (
        "Explain clearly in detail and include a useful example. Use standard Markdown. "
        "Write inline math as \\(expression\\) and display math as \\[expression\\]."
        if mode == "detailed"
        else "Explain in simple, concise language. Use standard Markdown and wrap math in \\(expression\\)."
    )

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=f"{instructions}\n\nQuestion: {question.strip()}",
            config=types.GenerateContentConfig(
                max_output_tokens=3000 if mode == "detailed" else 1000,
            ),
        )
        if not response.text:
            return jsonify({"error": "Gemini returned an empty response. Please try again."}), 502
        return jsonify({"answer": response.text})
    except Exception:
        app.logger.exception("Gemini request failed")
        return jsonify({"error": "Could not get a Gemini response. Check the API key and quota, then try again."}), 502


@app.route("/quiz", methods=["POST"])
def generate_quiz():
    data = request.get_json(silent=True) or {}
    topic = data.get("question", "")
    mode = data.get("mode", "simple")

    if not isinstance(topic, str) or not topic.strip():
        return jsonify({"error": "Please enter a topic for the quiz."}), 400

    difficulty = "challenging but fair" if mode == "detailed" else "beginner-friendly"
    prompt = (
        f'Create exactly 3 multiple-choice questions about: "{topic.strip()}". '
        f"Make them {difficulty}. Each question must have exactly 4 distinct options, "
        "and the answer field must exactly match one of those options. "
        "Do not include explanations."
    )

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=QuizResponse,
                max_output_tokens=900,
            ),
        )
        quiz = QuizResponse.model_validate_json(response.text or "")
        if len(quiz.questions) != 3 or any(
            len(item.options) != 4 or item.answer not in item.options
            for item in quiz.questions
        ):
            return jsonify({"error": "Gemini returned an invalid quiz. Please try again."}), 502
        return jsonify({"questions": [item.model_dump() for item in quiz.questions]})
    except Exception:
        app.logger.exception("Gemini quiz generation failed")
        return jsonify({"error": "Could not generate a quiz. Check the API key and quota, then try again."}), 502


if __name__ == "__main__":
    app.run(debug=True, port=5000)
