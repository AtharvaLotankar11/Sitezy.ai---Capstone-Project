"""
gru_features.py — builds GRU input sequences for the engagement model.

Each timestep x_t in R^12 = [7-dim section-type one-hot, t_spent, scroll_depth,
cta_click, form_start, form_done]. Sequences are padded/truncated to T_MAX=20.
"""
import numpy as np

SECTION_TYPES_7 = ["Hero", "Text", "Gallery", "CTA", "ContactForm", "Navbar", "Footer"]
TYPE_IDX = {"Hero": 0, "Text": 1, "Gallery": 2, "CTA": 3, "ContactForm": 4,
            "DynamicForm": 4, "Navbar": 5, "Footer": 6}
T_MAX = 20
DIM = 12


def event_to_timestep(ev):
    """ev: {section_type, t_spent(sec), scroll_depth(0-1), cta_click, form_start, form_done}"""
    vec = [0.0] * DIM
    idx = TYPE_IDX.get(ev.get("section_type"), 1)
    vec[idx] = 1.0
    vec[7] = min(1.0, float(ev.get("t_spent", 0)) / 60.0)   # normalize dwell to [0,1] over 60s
    vec[8] = max(0.0, min(1.0, float(ev.get("scroll_depth", 0))))
    vec[9] = 1.0 if ev.get("cta_click") else 0.0
    vec[10] = 1.0 if ev.get("form_start") else 0.0
    vec[11] = 1.0 if ev.get("form_done") else 0.0
    return vec


def build_sequence(events):
    """Returns (padded ndarray [T_MAX,DIM], length)."""
    ts = [event_to_timestep(e) for e in events[:T_MAX]]
    length = len(ts)
    while len(ts) < T_MAX:
        ts.append([0.0] * DIM)
    return np.array(ts, dtype=np.float32), max(1, length)


def synth_session_from_types(section_types):
    """Builds a representative (pre-traffic) session from a page's ordered section types.
    Used in the builder where no real visitor data exists yet."""
    events = []
    n = len(section_types) or 1
    for i, t in enumerate(section_types):
        depth = (i + 1) / n
        events.append({
            "section_type": t,
            "t_spent": 8 + 6 * (1 if t in ("Hero", "Text", "Gallery") else 0),
            "scroll_depth": depth,
            "cta_click": 1 if t == "CTA" else 0,
            "form_start": 1 if t in ("ContactForm", "DynamicForm") else 0,
            "form_done": 0,
        })
    return events
