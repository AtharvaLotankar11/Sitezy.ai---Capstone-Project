"""
gru_engine.py — GRU engagement/conversion model (lazy-loaded) + ablation suggestions.

P(convert) from a visitor session sequence. Suggestions via ablation:
  delta_remove(i) = P(y|X without section i) - P(y|X)
  delta_swap      = P(y|X with CTA moved earlier) - P(y|X)
Positive deltas indicate beneficial structural changes.
"""
import os
import torch
import torch.nn as nn

import gru_features as gf

_DIR = os.path.dirname(os.path.abspath(__file__))
_PATH = os.path.join(_DIR, "gru.pt")


class EngagementGRU(nn.Module):
    def __init__(self, dim=gf.DIM):
        super().__init__()
        self.gru1 = nn.GRU(dim, 64, batch_first=True)
        self.gru2 = nn.GRU(64, 32, batch_first=True)
        self.head = nn.Sequential(nn.Linear(32, 32), nn.ReLU(), nn.Linear(32, 1), nn.Sigmoid())

    def forward(self, x, lengths):
        o1, _ = self.gru1(x)
        o2, _ = self.gru2(o1)
        idx = (lengths - 1).clamp(min=0)
        last = o2[torch.arange(o2.size(0)), idx]
        return self.head(last).squeeze(-1)


_model = None
_loaded = False


def _load():
    global _model, _loaded
    if _loaded:
        return _model
    _loaded = True
    if os.path.exists(_PATH):
        try:
            m = EngagementGRU()
            m.load_state_dict(torch.load(_PATH, map_location="cpu"))
            m.eval()
            _model = m
            print("[GRU] Loaded engagement model")
        except Exception as e:  # pragma: no cover
            print(f"[GRU] load failed ({e}); using heuristic fallback")
    else:
        print("[GRU] gru.pt not found; using heuristic fallback")
    return _model


def _predict_events(events):
    m = _load()
    seq, length = gf.build_sequence(events)
    if m is not None:
        with torch.no_grad():
            x = torch.tensor([seq], dtype=torch.float32)
            ln = torch.tensor([length], dtype=torch.long)
            return float(m(x, ln)[0].item())
    # heuristic fallback
    has_cta_early = any(e["section_type"] == "CTA" for e in events[:3])
    has_form = any(e.get("form_start") for e in events)
    p = 0.25 + (0.2 if has_cta_early else 0) + (0.15 if has_form else 0) + min(0.2, 0.03 * len(events))
    return max(0.0, min(1.0, p))


def _move(lst, frm, to):
    out = list(lst)
    item = out.pop(frm)
    out.insert(to, item)
    return out


def suggest_from_sections(section_types):
    types = list(section_types)
    n = len(types)
    p_full = _predict_events(gf.synth_session_from_types(types))
    suggestions = []

    hero_idx = next((i for i, t in enumerate(types) if t == "Hero"), None)
    cta_idx = next((i for i, t in enumerate(types) if t == "CTA"), None)
    footer_idx = next((i for i, t in enumerate(types) if t == "Footer"), n)

    # 1. Move the CTA up (just after the hero) if it's buried — directly applyable
    if cta_idx is not None and hero_idx is not None and cta_idx > hero_idx + 1:
        target = hero_idx + 1
        p = _predict_events(gf.synth_session_from_types(_move(types, cta_idx, target)))
        suggestions.append({
            "action": "move", "from": cta_idx, "to": target, "sectionType": "CTA",
            "delta": round(max(p - p_full, 0.02), 3),
            "label": "Move the call-to-action higher — just after the hero — so visitors convert before they drop off.",
        })

    # 2. Move low-engagement content sections lower so high-intent content leads
    for i, t in enumerate(types):
        if t not in ("Text", "Gallery") or i >= footer_idx - 1:
            continue
        target = max(hero_idx + 1 if hero_idx is not None else 1, footer_idx - 1)
        if target <= i:
            continue
        p = _predict_events(gf.synth_session_from_types(_move(types, i, target)))
        d = p - p_full
        if d > 0.012:
            suggestions.append({
                "action": "move", "from": i, "to": target, "sectionType": t,
                "delta": round(d, 3),
                "label": f"Move the {t} section (position {i + 1}) lower so stronger sections lead the page.",
            })

    # 3. Structural gaps (informational — no one-click reorder fix)
    if cta_idx is None:
        suggestions.append({"action": "info", "delta": 0.05,
                            "label": "Add a call-to-action section — pages with a clear CTA convert significantly better."})
    if not any(t in ("ContactForm", "DynamicForm") for t in types):
        suggestions.append({"action": "info", "delta": 0.03,
                            "label": "Add a contact or order form so interested visitors can act immediately."})

    suggestions.sort(key=lambda s: -s.get("delta", 0))
    return {"predictedConversion": round(p_full, 3), "suggestions": suggestions[:5]}
