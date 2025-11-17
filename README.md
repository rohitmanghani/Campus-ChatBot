# <img src="images/logo.png" width="80" height="80" alt="Logo"> Campus Chatbot 


The Campus Chatbot is an intelligent virtual assistant designed to help students quickly access important university-related information.
Powered by Natural Language Processing (NLP) and multilingual support, it allows students to ask questions naturally and receive instant, accurate answers.

This chatbot improves student support by making information easily accessible without browsing multiple pages or contacting administrative offices.

---

## Features

- 🤖 NLP-based question understanding (semantic similarity using MiniLM)
- 🌍 Multi-language support (German, Hindi, Spanish, etc.)
- 🧠 FAQ-driven knowledge base
- 📄 PDF support (exam timetables, forms)
- 🖼️ Image support (campus map, location images)
- 🔗 Clickable link buttons (student portal, VPIS)
- 💬 Modern floating chat UI
- ⚡ Flask backend API
- 📝 Logs unknown questions for continuous improvement

---

## 🛠️ Technologies Used

### **Backend**
- Python (Flask)
- Sentence Transformers (`all-MiniLM-L6-v2`)
- PyTorch (CPU)
- GoogleTrans (auto-translation)
- Flask-CORS

### **Frontend**
- HTML / CSS / JavaScript
- Floating chatbot widget
- Quick reply buttons
- Rich rendering for links, images, PDFs

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
   pip install googletrans==4.0.0-rc1
   If googletrans does not work:
      pip install deep-translator

4. Start backend server:
   python app.py

   It runs at:
   http://127.0.0.1:5000

5. Open the chat UI:
   Double click on index.html to open in browser.
   The chatbot will appear as a floating widget.

---

## How It Works

- The user types a message in the chat.
- Backend detects language
- If non-English → translates to English
- NLP model finds closest FAQ
- If confidence is high → return answer
- If low → ask user to rephrase
- Answer translated back to user’s language
- UI displays text, images, PDFs, and link buttons

---

## Editing FAQ Responses

Open faqs.json and add new Q&A in the following format:

[
  {
    "question": "How do I register for modules?",
    "answer": "Go to VPIS → Module Registration → Select Semester → Submit."
  },
  {
    "question": "Where can I see the campus map?",
    "answer": "Here is the campus map.",
    "image": "static/map.png"
  },
  {
    "question": "Where is the student portal?",
    "answer": "You can access it below.",
    "link": "https://vpis.fh-swf.de"
  }
]

Save the file and restart `app.py`.

---

## Example User Questions to Try

- "What are the library timings?"
- "How do I register for modules?"
- "Where can I see my timetable?"
- "How do I contact admin office?"
- Wo ist die Bibliothek?” 🇩🇪
- “कैंपस मैप कहाँ है?” 🇮🇳
- “Dónde está mi horario?” 🇪🇸

---

## Team Members

- Rohit
- Tejas
- Karan
- Ahmed
- Sonika

---

## Status

- NLP chatbot working ✅
- Web chat UI connected ✅
- FAQ knowledge base editable ✅
- Multi-language Support ✅

