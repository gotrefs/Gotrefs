import base64
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
html = (root / "public" / "gotrefs-hype.html").read_text(encoding="utf-8")
m = re.search(r'id="logo-scene".*?<img src="(data:image/[^"]+)"', html, re.S)
if not m:
    raise SystemExit("logo not found")
_, b64 = m.group(1).split(",", 1)
out = root / "public" / "gotrefs-logo.png"
out.write_bytes(base64.b64decode(b64))
print(f"wrote {out} ({out.stat().st_size} bytes)")
