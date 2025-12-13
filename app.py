from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from datetime import datetime, timedelta
from sentence_transformers import SentenceTransformer, util
from googletrans import Translator
import uuid
import threading
import re
import torch
import numpy as np
import random
import os

app = Flask(__name__)
CORS(app)

# ---------------------------
# Config
# ---------------------------
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
FAQ_PATH = "faqs.json"
UNKNOWN_LOG = "unknown_questions.log"
HIGH_CONF = 0.60
LOW_CONF = 0.30
SESSION_TTL_MIN = 30
MAX_SUGGESTIONS_DEFAULT = 2

# follow-up prompt text and inactivity timeout (seconds)
FOLLOW_UP_PROMPT = "Do you have any other question?"
END_CONVO_TIMEOUT_SECONDS = 20  # 1 minute

# ---------------------------
# Load model + translator + data
# ---------------------------
model = SentenceTransformer(MODEL_NAME)
translator = Translator()

if not os.path.exists(FAQ_PATH):
    raise FileNotFoundError(f"{FAQ_PATH} not found. Place your faqs.json next to app.py")

with open(FAQ_PATH, "r", encoding="utf-8") as f:
    faqs = json.load(f)

questions = [item.get("question", "") for item in faqs]
question_embeddings = model.encode(questions, convert_to_tensor=True)

# Precompute related FAQ indices matrix for recommendations
cos_scores_matrix = util.cos_sim(question_embeddings, question_embeddings).cpu().numpy()
related_faqs = []
for i in range(len(faqs)):
    idxs = np.argsort(-cos_scores_matrix[i])
    related = [j for j in idxs if j != i][:5]
    related_faqs.append(related)

# ---------------------------
# Session memory (in-memory)
# ---------------------------
session_lock = threading.Lock()
session_memory = {}  # { session_id: { "history": [...], "last_faq": int, "expires": datetime } }

def touch_session(session_id):
    with session_lock:
        mem = session_memory.get(session_id, {"history": [], "last_faq": None})
        mem["expires"] = datetime.utcnow() + timedelta(minutes=SESSION_TTL_MIN)
        session_memory[session_id] = mem

def cleanup_sessions():
    with session_lock:
        now = datetime.utcnow()
        for k in list(session_memory.keys()):
            if session_memory[k].get("expires") and session_memory[k]["expires"] < now:
                del session_memory[k]

# ---------------------------
# Utilities
# ---------------------------
def log_unknown(q):
    try:
        with open(UNKNOWN_LOG, "a", encoding="utf-8") as f:
            f.write(f"{datetime.utcnow().isoformat()} | {q}\n")
    except Exception:
        pass

def normalize_text(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = s.lower().strip()
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    return s

# Follow-up detection patterns (simple)
FOLLOW_UP_PATTERNS = re.compile(
    r"\b(when does|what time|what are the opening|open|close|closing time|hours|time does it open|when does the|when is it open|when is it closed)\b",
    flags=re.I
)
PRONOUNS_PATTERN = re.compile(r"\b(it|that|they|them|this|those)\b", flags=re.I)

# ---------------------------
# Suggestions + related helpers
# ---------------------------
def did_you_mean_suggestions(query_embedding, max_items=2, min_score=0.08, relative_ratio=0.65, k=8):
    scores = util.cos_sim(query_embedding, question_embeddings)[0]
    k = min(k, scores.shape[0])
    topk = torch.topk(scores, k)
    indices = topk.indices.tolist()
    values = topk.values.tolist()

    if not indices:
        return []

    best_score = float(values[0])
    suggestions = []
    seen_norms = set()

    for idx, raw_score in zip(indices, values):
        score = float(raw_score)
        # absolute threshold
        if score < min_score:
            continue
        # relative threshold vs best
        if best_score > 0 and score < best_score * relative_ratio:
            continue

        idx = int(idx)
        q_text = faqs[idx].get("question", "").strip()
        if not q_text:
            continue
        q_norm = normalize_text(q_text)
        if q_norm in seen_norms:
            continue
        seen_norms.add(q_norm)

        item = {"question": q_text, "faq_idx": idx, "score": score}

        # include resources if present
        if "file" in faqs[idx]:
            item["file"] = faqs[idx]["file"]
        if "link" in faqs[idx]:
            item["link"] = faqs[idx]["link"]
        if "image" in faqs[idx]:
            item["image"] = faqs[idx]["image"]

        suggestions.append(item)
        if len(suggestions) >= max_items:
            break

    return suggestions

def build_related(faq_idx, k=3):
    related_idxs = related_faqs[faq_idx][:k]
    items = []
    for i in related_idxs:
        it = {"question": faqs[i].get("question"), "faq_idx": int(i)}
        if "file" in faqs[i]:
            it["file"] = faqs[i]["file"]
        if "link" in faqs[i]:
            it["link"] = faqs[i]["link"]
        if "image" in faqs[i]:
            it["image"] = faqs[i]["image"]
        items.append(it)
    return items

# ---------------------------
# Main /ask endpoint
# ---------------------------
GREETINGS = {"hi", "hello", "hey", "hii", "hiya", "good", "morning", "afternoon", "evening"}
GOODBYES = {"bye", "goodbye", "see", "you", "cya", "farewell", "night"}

GREETING_RESPONSES = [
    "👋 Hi! I’m the Campus Chatbot. How can I help you today?",
    "Hello! 😊 What can I help you with?",
    "Hey there ask me about library hours, timetables, or registration."
]

GOODBYE_RESPONSES = [
    "👋 Goodbye! Come back anytime.",
    "See you! Reach out if you need anything else.",
    "Take care! Happy studying."
]

@app.route("/ask", methods=["POST"])
def ask():
    cleanup_sessions()
    data = request.get_json() or {}
    user_query = (data.get("query") or "").strip()
    session_id = data.get("session_id") or str(uuid.uuid4())
    touch_session(session_id)

    if not user_query:
        return jsonify({"answer": "Please type something so I can help 😊", "session_id": session_id}), 200

    # detect language (best-effort)
    try:
        detected = translator.detect(user_query)
        user_lang = detected.lang
    except Exception:
        user_lang = "en"

    # translate to English for semantic matching
    try:
        user_query_en = translator.translate(user_query, src=user_lang, dest="en").text if user_lang != "en" else user_query
    except Exception:
        user_query_en = user_query

    q_lower = user_query_en.lower()
    words = q_lower.split()

    # quick greeting / goodbye
    if len(words) <= 3 and any(w in words for w in GREETINGS):
        resp = random.choice(GREETING_RESPONSES)
        if user_lang != "en":
            try:
                resp = translator.translate(resp, dest=user_lang).text
            except Exception:
                pass
        return jsonify({
            "answer": resp,
            "quick_replies": ["Library Hours", "Campus Map", "Exam Info"],
            "confidence": "1.0",
            "session_id": session_id
        })

    if len(words) <= 3 and any(w in words for w in GOODBYES):
        resp = random.choice(GOODBYE_RESPONSES)
        if user_lang != "en":
            try:
                resp = translator.translate(resp, dest=user_lang).text
            except Exception:
                pass
        return jsonify({
            "answer": resp,
            "quick_replies": ["Library Hours", "Admissions FAQ", "Campus Services"],
            "confidence": "1.0",
            "session_id": session_id
        })

    # short guard
    if len(user_query_en) < 3:
        resp = "Can you please provide a complete question? 😊"
        if user_lang != "en":
            try:
                resp = translator.translate(resp, dest=user_lang).text
            except Exception:
                pass
        return jsonify({"answer": resp, "session_id": session_id})

    # get session memory
    mem = session_memory.get(session_id, {"history": [], "last_faq": None})

    # ---------- PRIORITIZED FOLLOW-UP HANDLING ----------
    is_follow_up_style = bool(FOLLOW_UP_PATTERNS.search(q_lower) or PRONOUNS_PATTERN.search(q_lower))
    if is_follow_up_style and mem.get("last_faq") is not None:
        last_idx = mem.get("last_faq")
        if last_idx is not None and 0 <= last_idx < len(faqs):
            faq = faqs[last_idx]
            answer = faq.get("answer", "")
            if user_lang != "en":
                try:
                    answer = translator.translate(answer, src="en", dest=user_lang).text
                except Exception:
                    pass
            response = {"answer": answer, "confidence": "1.00", "session_id": session_id}
            # include resources if present
            if "file" in faq:
                response["file"] = faq["file"]
            if "link" in faq:
                response["link"] = faq["link"]
            if "image" in faq:
                response["image"] = faq["image"]
            # include related suggestions
            response["related"] = build_related(last_idx)
            # add follow-up prompt + timeout for frontend
            response["follow_up_text"] = FOLLOW_UP_PROMPT
            response["end_convo_timeout"] = END_CONVO_TIMEOUT_SECONDS
            # update memory
            with session_lock:
                mem["history"].append(user_query_en)
                mem["last_faq"] = last_idx
                session_memory[session_id] = mem
            return jsonify(response)

    # ---------- semantic matching ----------
    query_emb = model.encode(user_query_en, convert_to_tensor=True)
    scores = util.cos_sim(query_emb, question_embeddings)[0]
    best_index = int(scores.argmax())
    best_score = float(scores[best_index])

    # HIGH CONFIDENCE: return matched FAQ and resources; update memory
    if best_score >= HIGH_CONF:
        faq = faqs[best_index]
        answer = faq.get("answer", "")
        if user_lang != "en":
            try:
                answer = translator.translate(answer, src="en", dest=user_lang).text
            except Exception:
                pass
        response = {"answer": answer, "confidence": f"{best_score:.2f}", "session_id": session_id}
        if "file" in faq:
            response["file"] = faq["file"]
        if "link" in faq:
            response["link"] = faq["link"]
        if "image" in faq:
            response["image"] = faq["image"]
        # add follow-up prompt + timeout for frontend
        response["follow_up_text"] = FOLLOW_UP_PROMPT
        response["end_convo_timeout"] = END_CONVO_TIMEOUT_SECONDS
        # update memory
        with session_lock:
            mem = session_memory.get(session_id, {"history": [], "last_faq": None})
            mem["history"].append(user_query_en)
            mem["last_faq"] = best_index
            session_memory[session_id] = mem
        # include related recommendations
        return jsonify(response)

    # MID CONFIDENCE: provide "did you mean?" suggestions (short list), related
    if best_score >= LOW_CONF:
        suggestions = did_you_mean_suggestions(query_emb, max_items=MAX_SUGGESTIONS_DEFAULT, min_score=0.06, relative_ratio=0.65, k=8)
        if user_lang != "en":
            for s in suggestions:
                try:
                    s["question"] = translator.translate(s["question"], src="en", dest=user_lang).text
                except Exception:
                    pass
        log_unknown(user_query)
        top_related = build_related(suggestions[0]["faq_idx"]) if suggestions else []
        return jsonify({
            "answer": "I’m not fully sure did you mean one of these?",
            "suggestions": suggestions,
            "related": top_related,
            "confidence": f"{best_score:.2f}",
            "session_id": session_id
        })

    # LOW CONFIDENCE fallback: give suggestions (short list) and log unknown
    suggestions = did_you_mean_suggestions(query_emb, max_items=MAX_SUGGESTIONS_DEFAULT, min_score=0.05, relative_ratio=0.6, k=10)
    if user_lang != "en":
        for s in suggestions:
            try:
                s["question"] = translator.translate(s["question"], src="en", dest=user_lang).text
            except Exception:
                pass
    log_unknown(user_query)
    return jsonify({
        "answer": "I’m not sure could you rephrase? Here are some suggestions.",
        "suggestions": suggestions,
        "confidence": f"{best_score:.2f}",
        "session_id": session_id
    })

# ---------------------------
# Health
# ---------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "faq_count": len(faqs),
        "model": MODEL_NAME
    })

# ---------------------------
# Run
# ---------------------------
if __name__ == "__main__":
    app.run(port=5000, debug=True)