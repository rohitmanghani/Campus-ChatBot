# Campus Chatbot

The Campus Chatbot is a simple and intelligent assistant designed to help students find university-related information easily. It answers questions such as library timings, module registration steps, timetable guidance, and other basic campus queries.

The goal of this project is to improve student support by providing quick and clear answers without requiring students to search multiple pages or contact help desks.

---

## Features

- Understands natural language questions (NLP-based)
- Responds using information stored in a FAQ knowledge base
- Easy-to-use chat interface (HTML/CSS/JS)
- Flask backend API processes messages
- Works locally and can be integrated into any website

---

## Technologies Used

- Python (Flask)
- JavaScript (Frontend)
- Sentence Transformers (all-MiniLM-L6-v2 NLP model)
- PyTorch (CPU version)
- Flask-CORS

---

## Folder Structure

Campus-ChatBot/
│ app.py              → Backend logic (Flask + NLP)
│ faqs.json           → Question/Answer knowledge base
│ index.html          → Chat UI page
│ script.js           → Handles UI chat logic + server requests
│ venv/               → Virtual Python environment (optional)

---

## How to Run

1. Open project folder in terminal:
   cd Campus-ChatBot

2. Create and activate virtual environment:
   python -m venv venv
   venv\Scripts\activate

3. Install required packages:
   pip install torch --index-url https://download.pytorch.org/whl/cpu
   pip install sentence-transformers
   pip install flask flask_cors

4. Start backend server:
   python app.py

   It runs at:
   http://127.0.0.1:5000

5. Open the chat UI:
   Double click on index.html to open in browser.

---

## How It Works

- The user types a message in the chat.
- The browser sends the message to Flask backend (`/ask` endpoint).
- NLP converts the message into vector representation.
- The chatbot compares it with stored questions in faqs.json.
- It returns the most relevant answer if confidence is high.
- If confidence is low, the bot asks the user to rephrase.

---

## Editing FAQ Responses

Open faqs.json and add new Q&A in the following format:

[
  {
    "question": "How do I register for modules?",
    "answer": "Go to VPIS → Module Registration → Select Semester → Submit."
  }
]

Save the file and restart `app.py`.

---

## Example User Questions to Try

- "What are the library timings?"
- "How do I register for modules?"
- "Where can I see my timetable?"
- "How do I contact admin office?"

---

## Team Members

- Rohit
- Tejas
- Karan

---

## Status

- NLP chatbot working ✅
- Web chat UI connected ✅
- FAQ knowledge base editable ✅

Future improvements (optional):
- Add quick reply buttons
- Add voice input
- Deploy on web / campus portal

