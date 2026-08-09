import os
import logging

from dotenv import load_dotenv

load_dotenv()

from flask import Flask, jsonify, render_template, request

from candidate_data import (
    list_candidate_summaries,
    list_candidate_dashboard_cards,
    load_curriculum_grouped_by_module,
    load_curriculum_raw,
)
from interview_agent import InterviewError, handle_interview_request

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("interview-agent")

app = Flask(__name__)

if not os.environ.get("GEMINI_API_KEY"):
    logger.warning("GEMINI_API_KEY is not set. Requests will fail.")


# --- Pages -------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html", active_page="interview")


@app.route("/curriculum")
def curriculum():
    raw = load_curriculum_raw()
    return render_template(
        "curriculum.html",
        active_page="curriculum",
        cohort=raw.get("cohort", ""),
        modules=load_curriculum_grouped_by_module(),
    )


@app.route("/dashboard")
def dashboard():
    cards = list_candidate_dashboard_cards()
    avg_readiness = round(sum(c["readiness"] for c in cards) / len(cards)) if cards else 0
    return render_template(
        "dashboard.html",
        active_page="dashboard",
        candidates=cards,
        avg_readiness=avg_readiness,
        total_candidates=len(cards),
    )


# --- API used by the page's JS (same contract as technical-spec.md) --------
@app.route("/api/candidates", methods=["GET"])
def api_candidates():
    return jsonify({"candidates": list_candidate_summaries()})


@app.route("/api/interview", methods=["POST"])
def api_interview():
    body = request.get_json(silent=True) or {}
    try:
        payload = handle_interview_request(body)
        return jsonify(payload), 200
    except InterviewError as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        logger.exception("Error handling /api/interview")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
