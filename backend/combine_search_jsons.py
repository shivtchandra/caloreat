# combine_search_jsons.py
import json, glob, os, sys

PATTERN = "tmp/search_*.json"
out_file = "foods_data.json"

files = sorted(glob.glob(PATTERN))
if not files:
    print("No files found matching", PATTERN)
    sys.exit(1)

good = []
bad = []

for p in files:
    try:
        with open(p, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        # we expect the FDC search shape with a "foods" array
        if isinstance(data, dict) and isinstance(data.get("foods"), list) and len(data["foods"]) > 0:
            # take first food item
            first = data["foods"][0]
            if first:
                good.append((p, first))
            else:
                bad.append((p, "no food entry"))
        else:
            bad.append((p, "missing or invalid 'foods' array"))
    except Exception as e:
        bad.append((p, f"json parse error: {e}"))

# report bad files (do not abort)
if bad:
    print("Some files could not be parsed or were missing expected structure:")
    for p, reason in bad:
        print("  BAD:", p, "->", reason)
else:
    print("All files parsed OK.")

# Deduplicate by fdcId if present, otherwise by normalized description
def norm_key(obj):
    if isinstance(obj, dict):
        if obj.get("fdcId"):
            return str(obj.get("fdcId"))
        return (obj.get("description") or "").strip().lower()
    return None

seen = {}
for p, obj in good:
    key = norm_key(obj)
    if not key:
        # fallback to JSON string
        key = json.dumps(obj, sort_keys=True)
    if key not in seen:
        seen[key] = obj

combined = list(seen.values())
print(f"Collected {len(combined)} unique food items from {len(good)} parsed files.")

# write output
with open(out_file, "w", encoding="utf-8") as f:
    json.dump(combined, f, ensure_ascii=False, indent=2)

print("Wrote", out_file)
