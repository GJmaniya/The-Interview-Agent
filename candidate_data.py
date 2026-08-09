"""
Loads the bootcamp's candidates.json and curriculum.json (bundled in data/)
and builds the per-candidate performance summary that gets fed into the
interview system prompt.

candidates.json shape (per entry):
{
  "member": {"id", "name", "jobRole", "yearsExperience", "education", "status"},
  "missions": [{"day", "title", "passed"?, "attempts"?, "skipped"?}, ...],
  "signals": {"commitDays", "missionsCompleted", "missionsFirstTry"}
}

curriculum.json shape:
{
  "cohort": "...",
  "modules": [...],
  "days": [{"day", "title", "type", "tools": [...], "objectives": [...]}, ...]
}
"""

import json
import os
from typing import Any, Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CANDIDATES_PATH = os.path.join(DATA_DIR, "candidates.json")
CURRICULUM_PATH = os.path.join(DATA_DIR, "curriculum.json")

_candidates_cache: Optional[Dict[str, Dict[str, Any]]] = None
_curriculum_cache: Optional[Dict[int, Dict[str, Any]]] = None
_curriculum_raw_cache: Optional[Dict[str, Any]] = None


def _load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_curriculum_raw() -> Dict[str, Any]:
    """Returns the full curriculum.json (cohort, modules, days), cached."""
    global _curriculum_raw_cache
    if _curriculum_raw_cache is None:
        _curriculum_raw_cache = _load_json(CURRICULUM_PATH)
    return _curriculum_raw_cache


def load_curriculum_grouped_by_module() -> List[Dict[str, Any]]:
    """Returns modules with their day entries inlined, in day order, for
    rendering a curriculum page: [{n, title, days: [day_entry, ...]}, ...]."""
    raw = load_curriculum_raw()
    days_by_number = load_curriculum_by_day()
    grouped = []
    for module in raw.get("modules", []):
        start, end = module["days"][0], module["days"][-1]
        module_days = [days_by_number[d] for d in range(start, end + 1) if d in days_by_number]
        grouped.append({"n": module["n"], "title": module["title"], "days": module_days})
    return grouped


def load_candidates() -> Dict[str, Dict[str, Any]]:
    """Returns {candidateId: candidate_entry}, cached after first read."""
    global _candidates_cache
    if _candidates_cache is None:
        raw = _load_json(CANDIDATES_PATH)
        _candidates_cache = {c["member"]["id"]: c for c in raw["candidates"]}
    return _candidates_cache


def load_curriculum_by_day() -> Dict[int, Dict[str, Any]]:
    """Returns {day_number: day_entry}, cached after first read."""
    global _curriculum_cache
    if _curriculum_cache is None:
        raw = _load_json(CURRICULUM_PATH)
        _curriculum_cache = {d["day"]: d for d in raw["days"]}
    return _curriculum_cache


def list_candidate_summaries() -> List[Dict[str, Any]]:
    """Lightweight list for a picker / test client - id, name, role only."""
    return [
        {
            "id": c["member"]["id"],
            "name": c["member"]["name"],
            "jobRole": c["member"]["jobRole"],
        }
        for c in load_candidates().values()
    ]


def list_candidate_dashboard_cards() -> List[Dict[str, Any]]:
    """Richer per-candidate summary for the Candidate Dashboard page:
    readiness %, mission counts, and flagged struggle areas."""
    total_days = len(load_curriculum_by_day())
    cards = []
    for c in load_candidates().values():
        member = c["member"]
        signals = c.get("signals", {})
        missions = c.get("missions", [])

        completed = signals.get("missionsCompleted", 0)
        readiness = round((completed / total_days) * 100) if total_days else 0

        struggled = sum(
            1 for m in missions if m.get("passed") is True and m.get("attempts", 1) >= 3
        )
        failed = sum(1 for m in missions if m.get("passed") is False)
        skipped = sum(1 for m in missions if m.get("skipped"))

        cards.append({
            "id": member["id"],
            "name": member["name"],
            "jobRole": member["jobRole"],
            "status": member.get("status", "Unknown"),
            "readiness": readiness,
            "missionsCompleted": completed,
            "totalDays": total_days,
            "missionsFirstTry": signals.get("missionsFirstTry", 0),
            "commitDays": signals.get("commitDays", 0),
            "struggled": struggled,
            "failed": failed,
            "skipped": skipped,
        })
    return sorted(cards, key=lambda x: x["id"])


def get_candidate(candidate_id: str) -> Optional[Dict[str, Any]]:
    return load_candidates().get(candidate_id)


def build_candidate_context(candidate: Dict[str, Any]) -> str:
    """
    Turns a raw candidate entry (member/missions/signals) into a readable
    briefing for the interviewer model: who they are, how they performed,
    and specifically which topics they struggled with or skipped (so the
    model can probe those) versus aced on the first try (so the model can
    go deeper / verify real understanding vs. luck).
    """
    curriculum = load_curriculum_by_day()
    member = candidate.get("member", {})
    missions = candidate.get("missions", [])
    signals = candidate.get("signals", {})

    def enrich(day: int) -> Dict[str, Any]:
        info = curriculum.get(day, {})
        return {
            "title": info.get("title", f"Day {day}"),
            "type": info.get("type"),
            "tools": info.get("tools", []),
            "objectives": info.get("objectives", []),
        }

    strong: List[str] = []
    struggled: List[str] = []
    skipped: List[str] = []
    failed: List[str] = []

    for m in missions:
        day = m.get("day")
        info = enrich(day)
        label = f"Day {day} - {info['title']}"
        if info.get("tools"):
            label += f" (tools: {', '.join(info['tools'])})"

        if m.get("skipped"):
            skipped.append(label)
        elif m.get("passed") is False:
            failed.append(f"{label} - not passed after {m.get('attempts', '?')} attempt(s)")
        elif m.get("passed") is True:
            attempts = m.get("attempts", 1)
            if attempts == 1:
                strong.append(label)
            elif attempts >= 3:
                objs = info.get("objectives", [])[:2]
                obj_text = f" | key objectives: {'; '.join(objs)}" if objs else ""
                struggled.append(f"{label} - passed on attempt {attempts}{obj_text}")

    lines = [
        f"Name: {member.get('name', 'Unknown')}",
        f"Target role: {member.get('jobRole', 'Unknown')}",
        f"Years of experience: {member.get('yearsExperience', 'Unknown')}",
        f"Education: {member.get('education', 'Unknown')}",
        f"Program status: {member.get('status', 'Unknown')}",
        "",
        f"Program signals: {signals.get('commitDays', '?')} active days, "
        f"{signals.get('missionsCompleted', '?')} missions completed, "
        f"{signals.get('missionsFirstTry', '?')} passed on the first try.",
        "",
    ]

    if strong:
        lines.append("Topics passed cleanly on the first try (safe to go deeper / verify real depth):")
        lines.extend(f"  - {s}" for s in strong)
        lines.append("")

    if struggled:
        lines.append("Topics that took multiple attempts (worth probing - check if the gap remains):")
        lines.extend(f"  - {s}" for s in struggled)
        lines.append("")

    if failed:
        lines.append("Topics never passed (should be addressed directly and diplomatically):")
        lines.extend(f"  - {s}" for s in failed)
        lines.append("")

    if skipped:
        lines.append("Topics skipped entirely (candidate may have zero exposure here):")
        lines.extend(f"  - {s}" for s in skipped)
        lines.append("")

    return "\n".join(lines)
