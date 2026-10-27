"""Form-schema conformance of model output after the production normalisation in
postProcessAIOutput (which renames keys but never adds missing fields), per field type. A DynamicForm field conforms if it has a non-empty name, a non-empty label and an
allowed type; a 'select' field must also list >= 2 string options. ContactForm 'fields'
must be a flat array of strings (as the production prompt demands)."""
import sys, os, re, json, glob, statistics
ALLOWED = ["text", "email", "tel", "number", "select", "textarea", "date"]
# field names used in the production prompt's two worked examples (Juice Bar, Salon)
EXAMPLE_NAMES = {"customer_name", "phone", "juice_type", "size", "quantity", "add_ons", "delivery_time",
                 "special_instructions", "name", "service", "stylist", "appointment_date", "notes"}

def load(fp):
    t = open(fp, encoding="utf-8").read()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", t)
    js = m.group(1) if m else (re.search(r"\{[\s\S]*\}", t).group(0) if re.search(r"\{[\s\S]*\}", t) else t)
    try: return json.loads(js)
    except Exception: return None

def analyse(files):
    per = {}; forms = []; contact = {"forms": 0, "flat_strings": 0}
    sites = 0; sites_with_dyn_home = 0
    for fp in files:
        site = load(fp)
        if not isinstance(site, dict) or not isinstance(site.get("pages"), list): continue
        sites += 1
        for pi, pg in enumerate(site["pages"]):
            if not isinstance(pg, dict): continue
            secs = [s for s in (pg.get("sections") or []) if isinstance(s, dict)]
            if pi == 0 and any(s.get("type") == "DynamicForm" for s in secs): sites_with_dyn_home += 1
            for s in secs:
                p = s.get("props") or {}
                if s.get("type") == "ContactForm":
                    contact["forms"] += 1
                    f = p.get("fields")
                    if isinstance(f, list) and f and all(isinstance(x, str) for x in f): contact["flat_strings"] += 1
                if s.get("type") != "DynamicForm": continue
                # mirror production postProcessAIOutput: accept 'fields' as an alias, turn bare
                # strings into text fields, default a missing type to 'text' (no fields are added)
                raw = p.get("dynamicFields") or p.get("fields")
                if not isinstance(raw, list) or not raw:
                    forms.append({"n": 0, "ok": False, "empty": True}); continue
                fields = []
                for f in raw:
                    if isinstance(f, str): fields.append({"name": f, "label": f.capitalize(), "type": "text"})
                    elif isinstance(f, dict): fields.append({**f, "type": f.get("type") or "text"})
                names = []; n_ok = 0; has_contact = False
                for fld in fields:
                    if not isinstance(fld, dict): continue
                    ty = fld.get("type") if fld.get("type") in ALLOWED else "invalid"
                    d = per.setdefault(ty, {"n": 0, "ok": 0, "req": 0, "opts": []})
                    d["n"] += 1
                    ok = bool(str(fld.get("name") or "").strip()) and bool(str(fld.get("label") or "").strip()) and ty != "invalid"
                    if ty == "select":
                        opts = fld.get("options")
                        good = isinstance(opts, list) and len([o for o in opts if isinstance(o, str) and o.strip()]) >= 2
                        d["opts"].append(len(opts) if isinstance(opts, list) else 0); ok = ok and good
                    if fld.get("required") is True: d["req"] += 1
                    if ok: d["ok"] += 1; n_ok += 1
                    names.append(str(fld.get("name") or "").strip().lower())
                    if ty in ("email", "tel"): has_contact = True
                forms.append({"n": len(fields), "ok": n_ok == len(fields) and len(fields) > 0,
                              "in_range": 5 <= len(fields) <= 8, "dup_names": len(names) != len(set(names)),
                              "has_contact": has_contact, "empty": False,
                              "example_overlap": sum(nm in EXAMPLE_NAMES for nm in names) / max(1, len(names))})
    tot = sum(d["n"] for d in per.values()); ok = sum(d["ok"] for d in per.values())
    return {"sites": sites, "sites_with_dynamicform_on_home": sites_with_dyn_home, "dynamic_forms": len(forms),
            "fields_total": tot, "fields_conformant": ok,
            "forms_all_fields_conformant": sum(f["ok"] for f in forms),
            "forms_5_to_8_fields": sum(f.get("in_range", False) for f in forms),
            "forms_with_duplicate_names": sum(f.get("dup_names", False) for f in forms),
            "forms_with_email_or_tel": sum(f.get("has_contact", False) for f in forms),
            "forms_empty_or_missing_fields": sum(f.get("empty", False) for f in forms),
            "mean_example_name_overlap_nonempty": (statistics.mean([f["example_overlap"] for f in forms if not f.get("empty")])
                                                   if any(not f.get("empty") for f in forms) else None),
            "median_fields_per_form": statistics.median([f["n"] for f in forms]) if forms else None,
            "contact_forms": contact,
            "per_type": {k: {"n": v["n"], "ok": v["ok"], "required": v["req"],
                             "median_options": statistics.median(v["opts"]) if v["opts"] else None}
                         for k, v in sorted(per.items(), key=lambda kv: -kv[1]["n"])}}

if __name__ == "__main__":
    raw_dir, pattern, out = sys.argv[1], sys.argv[2], sys.argv[3]
    files = sorted(glob.glob(os.path.join(raw_dir, pattern)))
    res = analyse(files); res["files"] = len(files)
    json.dump(res, open(out, "w"), indent=1); print(json.dumps(res, indent=1))
