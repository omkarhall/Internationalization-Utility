# Internationalization Utility Web App

## Features

- Drag-and-drop upload for multiple JSON files
- JSON -> CSV export
- CSV -> ZIP of JSON files export
- FastAPI backend
- Static frontend served by FastAPI

## Project structure

```
translation_webapp/
├── app.py
├── requirements.txt
├── static/
│   ├── app.js
│   └── styles.css
└── templates/
    └── index.html
```

## Run locally

```bash
cd translation_webapp
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Then open `http://127.0.0.1:8000`.

## Run with Docker

Build and run the app in Docker:

```bash
docker compose up --build
```

Then open:

```text
http://127.0.0.1:8000
```

To stop it:

```bash
docker compose down
```
