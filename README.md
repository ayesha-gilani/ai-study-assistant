# AI Study Assistant

A small study assistant built with React and Flask. It uses the Gemini API to answer study questions and create multiple-choice quizzes.

## Features

- Ask questions in simple or detailed mode.
- Generate a three-question quiz for a topic and check your score.
- Display Markdown formatting and LaTeX math in AI answers.

## Requirements

- Python 3.9 or newer
- Node.js and npm
- A Gemini API key

## Setup

### 1. Configure the Gemini API key

Create a `.env` file in the project root (the same folder as this README) with:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Keep the key private. The root `.gitignore` excludes `.env` from Git.

### 2. Install backend dependencies

In PowerShell, from the project root:

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Start Flask while still in the `backend` folder:

```powershell
python app.py
```

The API runs at `http://127.0.0.1:5000`.

### 3. Install and start the frontend

Open a second terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local address printed by Vite in the terminal.

## API endpoints

- `POST /ask`: accepts a JSON body with `question` and optional `mode` (`simple` or `detailed`); returns an AI answer.
- `POST /quiz`: accepts a JSON body with `question` and optional `mode`; returns three multiple-choice questions with four options each.

Both endpoints are intended for local development. The frontend calls the Flask server at `http://127.0.0.1:5000`.

## Troubleshooting

- If Flask reports that `GEMINI_API_KEY` is missing, check that `.env` is in the project root and the variable is spelled exactly as shown above.
- If Python cannot import `google.genai`, activate the backend virtual environment and install `backend/requirements.txt`.
- If the frontend cannot reach Flask, make sure the backend is running on port `5000`.
