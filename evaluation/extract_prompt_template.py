r"""Regenerate prompt_template.txt from the production generateLayout prompt.

Finds the `const prompt = \`` template literal inside generateLayout, evaluates its
conditional blocks as a plain request would (no base template, no brand facts), and
writes the result with LF line endings, so decoding_exp.mjs and gemini_baseline.mjs send
the production prompt byte-for-byte. Remaining ${...} placeholders are filled per
business by those scripts.
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CTRL = os.path.join(HERE, "..", "backend", "src", "modules", "ai", "ai.controller.js")

src = open(CTRL, encoding="utf-8").read().replace("\r\n", "\n")
fn = src.index("export const generateLayout")
start = src.index("const prompt = `", fn) + len("const prompt = `")
end = src.index("`.trim();", start)
body = src[start:end].split("\n")

def blank(prefix, until=None):
    """Replace the line starting with `prefix` (through the line starting with `until`) by ''."""
    i = next(k for k, l in enumerate(body) if l.strip().startswith(prefix))
    j = i if until is None else next(k for k in range(i, len(body)) if body[k].strip().startswith(until))
    body[i:j + 1] = [""]

blank("${baseTemplateSections ?", '` : ""}')
blank("${brandFactsBlock}")
blank("${brandDetails?.reviews ?")
blank("${brandFactsBlock ?")

text = "\n".join(body)
out = os.path.join(HERE, "prompt_template.txt")
with open(out, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)
print("wrote", out, "| chars:", len(text), "| placeholders:", sorted(set(re.findall(r"\$\{[^}]*\}", text))))
