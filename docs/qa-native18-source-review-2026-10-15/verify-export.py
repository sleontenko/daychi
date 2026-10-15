"""Verify the byte-exact exported subset; no private source inputs needed."""
import hashlib
import json
from pathlib import Path

review = Path(__file__).resolve().parent
root = review.parent.parent
manifest = json.loads((review / "export-manifest.json").read_text())
mismatches = [name for name, expected in manifest["exported_files"].items()
              if not (root / name).is_file()
              or hashlib.sha256((root / name).read_bytes()).hexdigest() != expected]
print(json.dumps({"exported_files": len(manifest["exported_files"]), "mismatches": mismatches}))
raise SystemExit(bool(mismatches))
