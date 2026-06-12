from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# DL SEO / design-flaw / engagement engines. These import cheaply — the trained model
# files are lazy-loaded on first request, so the service still boots fast (and works
# even before the train_*.py scripts have been run).
import seo_engine
import design_engine
import gru_engine


app = Flask(__name__)
CORS(app)


############################################
# LOAD TRAINED MODEL + ENCODERS (optional)
# layout_model.pkl is ~467MB and is NOT committed to git (exceeds GitHub's limit).
# If it's absent, the layout recommender degrades to a sensible default set while the
# SEO / design / engagement DL engines keep working.
############################################

try:
    model = joblib.load("layout_model.pkl")
    encoders = joblib.load("label_encoders.pkl")
    print("[LAYOUT] Loaded RandomForest layout recommender")
except Exception as e:
    print(f"[LAYOUT] layout_model.pkl not available ({e}); /generate-layout will use defaults")
    model = None
    encoders = None


############################################
# LOAD MINI LM ZERO-SHOT MODEL (optional; downloads from HuggingFace on first run)
############################################

model_name = "cross-encoder/nli-MiniLM2-L6-H768"

try:
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    nli_model = AutoModelForSequenceClassification.from_pretrained(model_name)
except Exception as e:
    print(f"[NLP] zero-shot model unavailable ({e}); layout recommender will use defaults")
    tokenizer = None
    nli_model = None

# Default block set when the layout recommender can't run.
DEFAULT_COMPONENTS = ["hero_banner", "service_cards", "gallery", "testimonials", "contact_form", "call_to_action"]


############################################
# FEATURE COLUMN ORDER
############################################

input_columns = [
    "business_type",
    "content_type",
    "goal",
    "target_audience",
    "experience_level"
]


############################################
# FRONTEND COMPONENT LIST
############################################

components = [
    "hero_banner",
    "service_cards",
    "team_section",
    "gallery",
    "testimonials",
    "faq",
    "pricing_table",
    "contact_form",
    "newsletter",
    "blog_preview",
    "stats_counter",
    "call_to_action"
]


############################################
# ZERO-SHOT LABEL LISTS
############################################

business_types = [
    "ecommerce","blog","portfolio","startup","education",
    "restaurant","healthcare","real_estate","saas",
    "event","nonprofit","news","personal_brand"
]

content_types = [
    "products","articles","services","courses","gallery",
    "menu","booking","portfolio_items","events",
    "news_updates","downloads"
]

goals = [
    "sales","lead_generation","branding","education",
    "booking","awareness","portfolio_showcase",
    "community_building","content_delivery"
]

target_audience = [
    "general_public","students","business_clients",
    "recruiters","investors","patients",
    "local_customers","online_shoppers",
    "members","developers"
]

experience_levels = [
    "beginner","intermediate","advanced"
]


############################################
# ZERO-SHOT CLASSIFICATION FUNCTION
############################################

def zero_shot_classify(prompt, candidate_labels):

    scores = []

    for label in candidate_labels:

        hypothesis = f"This website is about {label}"

        inputs = tokenizer(
            prompt,
            hypothesis,
            return_tensors="pt",
            truncation=True
        )

        with torch.no_grad():

            logits = nli_model(**inputs).logits
            probs = torch.softmax(logits, dim=1)

            entailment_score = probs[0][2].item()

        scores.append(entailment_score)

    return candidate_labels[scores.index(max(scores))]


############################################
# FEATURE EXTRACTION FROM PROMPT
############################################

def extract_features(prompt):

    business = zero_shot_classify(prompt, business_types)

    content = zero_shot_classify(prompt, content_types)

    goal = zero_shot_classify(prompt, goals)

    audience = zero_shot_classify(prompt, target_audience)

    experience = "beginner"

    return [
        business,
        content,
        goal,
        audience,
        experience
    ]


############################################
# ENCODE FEATURES USING LABELENCODERS
############################################

def encode_features(features):

    encoded = []

    for i in range(len(features)):
        encoded_value = encoders[i].transform([features[i]])[0]
        encoded.append(encoded_value)

    return encoded


############################################
# MAIN API ROUTE
############################################

@app.route("/generate-layout", methods=["POST"])
def generate_layout():

    data = request.json


    ########################################
    # SUPPORT BOTH INPUT FORMATS
    ########################################

    # Always read businessType — used later for domain overrides
    businessType = data.get("businessType", "").lower().strip()

    if "prompt" in data:
        # legacy: single natural-language string
        prompt = data["prompt"]

    elif "concept" in data:
        # structured payload from frontend mappings
        # use concept as the NLP prompt; structured fields are passed
        # directly to override zero-shot extraction where available
        prompt = data["concept"]

    else:
        tone     = data.get("tone", "")
        audience = data.get("targetAudience", "")
        prompt = f"{businessType} {tone} {audience}".strip()


    if not prompt:

        return jsonify({"error": "No prompt provided"}), 400


    ########################################
    # If the trained model/NLP aren't available (e.g. layout_model.pkl not present
    # on a fresh clone), return a sensible default block set so the AI generator works.
    ########################################

    if model is None or encoders is None or tokenizer is None:
        return jsonify({"success": True, "components": DEFAULT_COMPONENTS})


    ########################################
    # EXTRACT FEATURES FROM PROMPT
    ########################################

    features = extract_features(prompt)


    ########################################
    # ENCODE FEATURES
    ########################################

    encoded = encode_features(features)

    encoded_df = pd.DataFrame(
        [encoded],
        columns=input_columns
    )


    ########################################
    # PREDICT COMPONENTS — PROBABILITY BASED
    ########################################

    # predict_proba returns one array per label: [[prob_0, prob_1], ...]
    prediction_proba = model.predict_proba(encoded_df)

    if businessType == "restaurant":
        THRESHOLD = 0.45
    elif businessType == "portfolio":
        THRESHOLD = 0.50
    elif businessType == "ecommerce":
        THRESHOLD = 0.55
    elif businessType == "saas":
        THRESHOLD = 0.60
    else:
        THRESHOLD = 0.50

    selected_components = []

    for i, comp in enumerate(components):
        prob = prediction_proba[i][0][1]   # [sample 0][class 1 = present]
        if prob > THRESHOLD:
            selected_components.append(comp)


    ########################################
    # KEYWORD BOOST (applied before cap)
    ########################################

    prompt_lower = prompt.lower()

    keyword_map = {
        "pricing": "pricing_table",
        "price":   "pricing_table",
        "team":    "team_section",
        "faq":     "faq",
        "newsletter": "newsletter",
        "blog":    "blog_preview",
        "stats":   "stats_counter",
        "gallery": "gallery",
        "contact": "contact_form"
    }

    for word, component in keyword_map.items():
        if word in prompt_lower and component not in selected_components:
            selected_components.append(component)


     ########################################
    # MINIMUM BLOCK FALLBACK
    # If threshold filtering yields fewer than
    # 4 components, pad with the next-highest
    # probability components until we reach 4.
    ########################################

    if len(selected_components) < 4:
        # Build (component, probability) pairs sorted by confidence desc
        sorted_blocks = sorted(
            [(comp, prediction_proba[i][0][1]) for i, comp in enumerate(components)],
            key=lambda x: x[1],
            reverse=True
        )
        for block, score in sorted_blocks:
            if block not in selected_components:
                selected_components.append(block)
            if len(selected_components) >= 4:
                break


    ########################################
    # GOAL-BASED SMART OVERRIDES
    ########################################

    # features[2] is the goal extracted by zero-shot classifier
    goal = features[2]

    if goal in ("booking", "lead_generation"):
        if "contact_form" not in selected_components:
            selected_components.append("contact_form")


    ########################################
    # ALWAYS INCLUDE CORE SECTIONS
    ########################################

    core_sections = ["hero_banner", "call_to_action"]

    for section in core_sections:
        if section not in selected_components:
            selected_components.append(section)


    ########################################
    # BUSINESS-TYPE DOMAIN OVERRIDES
    # Runs after core sections so dedup guard
    # covers both ML picks and guaranteed blocks.
    ########################################

    BUSINESS_TYPE_OVERRIDES = {
        "restaurant": ["gallery", "service_cards"],
        "saas":       ["pricing_table", "service_cards", "testimonials"],
        "portfolio":  ["gallery", "testimonials"],
        "ecommerce":  ["pricing_table", "service_cards"],
    }

    for block in BUSINESS_TYPE_OVERRIDES.get(businessType, []):
        if block not in selected_components:
            selected_components.append(block)


    ########################################
    # RETURN RESPONSE
    ########################################

    return jsonify({
        "success": True,
        "components": selected_components
    })


############################################
# DEEP-LEARNING SEO / DESIGN / ENGAGEMENT
############################################

@app.route("/seo-score", methods=["POST"])
def seo_score():
    try:
        data = request.json or {}
        content = data.get("content") or {}
        keyword = data.get("keyword", "")
        result = seo_engine.score_page(content, keyword)
        result["success"] = True
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/design-health", methods=["POST"])
def design_health():
    try:
        data = request.json or {}
        content = data.get("content") or {}
        result = design_engine.analyze_page(content)
        result["success"] = True
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/engagement-suggest", methods=["POST"])
def engagement_suggest():
    try:
        data = request.json or {}
        section_types = data.get("sectionTypes")
        if not section_types:
            section_types = [s.get("type") for s in (data.get("sections") or [])]
        section_types = [t for t in section_types if t]
        result = gru_engine.suggest_from_sections(section_types)
        result["success"] = True
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


############################################
# RUN SERVER
############################################

if __name__ == "__main__":

    app.run(port=5050)