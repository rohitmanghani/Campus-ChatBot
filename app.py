from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer, util
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)

##########################################################
# 1) Load NLP Model
##########################################################
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

##########################################################
# 2) Load FAQ Data
##########################################################
with open("faqs.json", "r", encoding="utf-8") as f:
    faqs = json.load(f)

questions = [item["question"] for item in faqs]
answers = [item["answer"] for item in faqs]

# Pre-encode FAQ questions into embeddings (fast lookup)
question_embeddings = model.encode(questions, convert_to_tensor=True)

##########################################################
# 3) Chatbot Response Route
##########################################################
@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json()
    user_query = data.get("query", "").strip()

    # Handle empty input
    if len(user_query) < 2:
        return jsonify({"answer": "Can you please type a complete question? 😊"})

    # Encode user message
    query_embedding = model.encode(user_query, convert_to_tensor=True)

    # Compute similarity
    scores = util.cos_sim(query_embedding, question_embeddings)[0]
    best_index = int(scores.argmax())
    best_score = float(scores[best_index])

    ##########################################################
    # 4) Confidence Based Answer
    ##########################################################
    if best_score < 0.50:
        return jsonify({
            "answer": "I'm not fully sure about that yet 🤔. Could you rephrase your question?"
        })

    # Return matched answer
    return jsonify({
        "answer": answers[best_index],
        "confidence": f"{best_score * 100:.1f}%"
    })

##########################################################
# 5) Run Server
##########################################################
if __name__ == "__main__":
    app.run(debug=True)
