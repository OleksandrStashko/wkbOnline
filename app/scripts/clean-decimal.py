import re
from pathlib import Path

root = Path(r"C:\Users\Oleksandr\Desktop\CODEX\Projects\wkbOnline")
src = root / "app" / "vendor" / "decimal.min.raw.js"
dst = root / "app" / "vendor" / "decimal.js"
text = src.read_text(encoding="utf-8")
while text.lstrip().startswith("/**"):
    offset = len(text) - len(text.lstrip())
    text = text[offset:]
    end = text.find("*/")
    if end == -1:
        break
    text = text[end + 2 :]
text = re.sub(r"/\*![\s\S]*?\*/", "", text)
text = "\n".join(line for line in text.splitlines() if not line.startswith("//# sourceMappingURL"))
dst.write_text(text.strip() + "\n", encoding="utf-8")
