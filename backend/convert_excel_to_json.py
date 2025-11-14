import pandas as pd
import json
import os

# Path to your Excel file
EXCEL_PATH = "Anuvaad_INDB_2024.11.xlsx"

# Output path
OUT_JSON = "food_data.json"

def clean_key(k):
    return (
        k.strip()
        .lower()
        .replace(" ", "_")
        .replace("(", "")
        .replace(")", "")
        .replace("/", "_")
    )

def main():
    if not os.path.exists(EXCEL_PATH):
        print(f"❌ File not found: {EXCEL_PATH}")
        return

    # Read Excel
    print(f"📖 Reading {EXCEL_PATH} ...")
    df = pd.read_excel(EXCEL_PATH)

    # Normalize columns
    df.columns = [clean_key(c) for c in df.columns]

    # Try to guess main columns
    candidate_cols = [
        "food_name", "item_name", "food", "description"
    ]
    name_col = next((c for c in df.columns if c in candidate_cols), df.columns[0])

    # Clean NaNs
    df = df.fillna(0)

    # Build output dictionary
    records = []
    for _, row in df.iterrows():
        rec = {k: (float(v) if isinstance(v, (int, float)) else str(v)) for k, v in row.items()}
        rec["food_name"] = str(row[name_col]).strip()
        records.append(rec)

    # Write to JSON
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print(f"✅ Saved {len(records)} foods to {OUT_JSON}")

if __name__ == "__main__":
    main()
