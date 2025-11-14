# seed_foods.py — lightweight CSV loader to populate foods table
import csv, json, os
from db import SessionLocal, engine, Base
from models import Food
Base.metadata.create_all(bind=engine)

def load_csv(path):
    s = SessionLocal()
    with open(path, newline='', encoding='utf-8') as fh:
        r = csv.DictReader(fh)
        count = 0
        for row in r:
            name = row.get("item") or row.get("name") or row.get("description")
            if not name:
                continue
            # you should standardize your CSV to include calories, protein_g, carbs_g, fat_g, fiber_g, and optional micronutrients
            nutrients = {}
            for k in ["calories","calories_kcal","protein_g","total_carbohydrate_g","total_fat_g","dietary_fiber_g","sugars_g"]:
                if row.get(k):
                    try:
                        nutrients[k] = float(row[k])
                    except Exception:
                        pass
            variants = []
            if row.get("variants"):
                try:
                    variants = json.loads(row["variants"])
                except Exception:
                    pass
            f = Food(
                name=name.strip(),
                canonical=row.get("canonical") or name.strip(),
                brand=row.get("brand"),
                nutrients=nutrients,
                serving_size=float(row["serving_size"]) if row.get("serving_size") else None,
                serving_unit=row.get("serving_unit"),
                tags=row.get("tags"),
                variants=variants,
                source=row.get("source","local_csv")
            )
            s.add(f)
            count += 1
        s.commit()
    s.close()
    print("Loaded", count)

if __name__ == "__main__":
    path = os.environ.get("FOOD_CSV_PATH","./data/indian_food_db_seed.csv")
    if os.path.exists(path):
        load_csv(path)
    else:
        print("Place a CSV at", path)
