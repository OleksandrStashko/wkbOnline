from pathlib import Path

root = Path(r"C:\Users\Oleksandr\Desktop\CODEX\Projects\wkbOnline")
raw_path = root / "app" / "data" / "wkb-raw.json"
js_path = root / "app" / "data" / "wkb-data.js"
data = raw_path.read_text(encoding="utf-8")
js_path.write_text("self.QNMApp = self.QNMApp || {};\nself.QNMApp.WKBData = " + data + ";\n", encoding="utf-8")
