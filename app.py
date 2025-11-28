from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from datetime import datetime
from sentence_transformers import SentenceTransformer, util
from googletrans import Translator
import random

app = Flask(__name__)
CORS(app)

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
translator = Translator()
FAQ_PATH = "faqs.json"
UNKNOWN_LOG = "unknown_questions.log"

with open(FAQ_PATH, "r", encoding="utf-8") as f:
    faqs = json.load(f)

questions = [item["question"] for item in faqs]
answers = [item["answer"] for item in faqs]

# Pre-compute embeddings
question_embeddings = model.encode(questions, convert_to_tensor=True)

GREETINGS = {"hi", "hello", "hey", "yo", "hii", "good", "morning", "afternoon", "evening"}
GOODBYES = {"bye", "goodbye", "see", "you", "cya", "chao", "take", "care", "farewell", "night"}

# Multiple greeting responses (randomized)
GREETING_RESPONSES = [
    "👋 Hi! I’m the Campus Chatbot. How can I help you today?",
    "Hello there! 😊 What can I do for you?",
    "Hey! Need help with campus info?",
    "Hi! I'm here to assist you with anything about the campus.",
    "Welcome! 👋 Ask me anything about library hours, modules, or campus services."
]

GOODBYE_RESPONSES = [
    "👋 Goodbye! Feel free to ask again anytime.",
    "See you! If you need anything later, just ask.",
    "Take care! I'm here when you need help.",
    "Bye! Hope that helped come back if you need more info."
]

def log_unknown(query):
    with open(UNKNOWN_LOG, "a", encoding="utf-8") as f:
        f.write(f"{datetime.utcnow().isoformat()} | {query}\n")

@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json()
    user_query = data.get("query", "").strip()

    # A) Empty check (before translation)
    if not user_query:
        return jsonify({"answer": "Please type something so I can help 😊"}), 200

    # Detect language
    try:
        detected = translator.detect(user_query)
        user_lang = detected.lang
    except Exception:
        user_lang = "en"

    # translate input to English for processing
    if user_lang != "en":
        try:
            user_query_en = translator.translate(user_query, src=user_lang, dest="en").text
        except Exception:
            user_query_en = user_query
    else:
        user_query_en = user_query

    q_lower = user_query_en.lower()
    words = q_lower.split()

    # Greeting detection (randomized reply)
    if len(words) <= 3 and any(w in GREETINGS for w in words):
        response_text = random.choice(GREETING_RESPONSES)
        if user_lang != "en":
            try:
                response_text = translator.translate(response_text, dest=user_lang).text
            except Exception:
                pass

        return jsonify({
            "answer": response_text,
            "quick_replies": ["Library Hours", "Campus Map", "Exam Info"],
            "confidence": "1.0"
        })

    # Goodbye detection (randomized)
    if len(words) <= 3 and any(w in GOODBYES for w in words):
        response_text = random.choice(GOODBYE_RESPONSES)
        if user_lang != "en":
            try:
                response_text = translator.translate(response_text, dest=user_lang).text
            except Exception:
                pass

        return jsonify({
            "answer": response_text,
            "quick_replies": ["Library Hours", "Admissions FAQ", "Campus Services"],
            "confidence": "1.0"
        })

    # Too short
    if len(user_query_en) < 3:
        response_text = "Can you please provide a complete question? 😊"
        if user_lang != "en":
            try:
                response_text = translator.translate(response_text, dest=user_lang).text
            except Exception:
                pass
        return jsonify({"answer": response_text})

    # Semantic matching
    query_emb = model.encode(user_query_en, convert_to_tensor=True)
    scores = util.cos_sim(query_emb, question_embeddings)[0]

    best_index = int(scores.argmax())
    best_score = float(scores[best_index])

    if best_score < 0.50:
        log_unknown(user_query)
        reply_text = "I'm not fully sure about that 🤔. Could you rephrase your question?"
        if user_lang != "en":
            try:
                reply_text = translator.translate(reply_text, dest=user_lang).text
            except Exception:
                pass
        return jsonify({
            "answer": reply_text,
            "quick_replies": ["Library Hours", "Semester Dates", "Student Portal"],
            "confidence": f"{best_score:.2f}"
        })

    faq_item = faqs[best_index]
    final_answer = faq_item.get("answer", "")

    # Translate answer back to user's language
    if user_lang != "en":
        try:
            final_answer = translator.translate(final_answer, src="en", dest=user_lang).text
        except Exception:
            pass

    response = {
        "answer": final_answer,
        "confidence": f"{best_score:.2f}"
    }

    # Rich content (PDF, image, link)
    if "image" in faq_item:
        response["image"] = faq_item["image"]
    if "file" in faq_item:
        response["file"] = faq_item["file"]
    if "link" in faq_item:
        response["link"] = faq_item["link"]

    return jsonify(response)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "running",
        "faq_count": len(questions),
        "model": "MiniLM-L6-v2 loaded",
        "translation": "GoogleTrans active"
    })

if __name__ == "__main__":
    app.run(port=5000, debug=True)