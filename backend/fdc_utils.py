"""
fdc_utils.py
-------------------
Handles nutrient lookup via FDA’s FoodData Central API.
"""

import os
import requests
import logging
from dotenv import load_dotenv

load_dotenv()

FDA_API_KEY = os.getenv("FDA_API_KEY", "")
BASE_URL = "https://api.nal.usda.gov/fdc/v1"

logger = logging.getLogger("fdc_utils")

# ---------------- SEARCH ----------------
def search_food(query, page_size=3):
    """Search food items by name and return a shortlist."""
    if not FDA_API_KEY:
        logger.warning("FDA_API_KEY not found in environment.")
        return []
    try:
        resp = requests.get(
            f"{BASE_URL}/foods/search",
            params={"query": query, "pageSize": page_size, "api_key": FDA_API_KEY},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        foods = data.get("foods", [])
        return [
            {
                "fdcId": f.get("fdcId"),
                "description": f.get("description"),
                "brandName": f.get("brandName"),
                "dataType": f.get("dataType"),
            }
            for f in foods
        ]
    except Exception as e:
        logger.error(f"search_food({query}) failed: {e}")
        return []


# ---------------- DETAIL ----------------
def get_food_by_fdcid(fdc_id):
    """Fetch full nutrient data for a specific FDC food item."""
    if not FDA_API_KEY:
        return None
    try:
        resp = requests.get(
            f"{BASE_URL}/food/{fdc_id}",
            params={"api_key": FDA_API_KEY},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data
    except Exception as e:
        logger.error(f"get_food_by_fdcid({fdc_id}) failed: {e}")
        return None


# ---------------- LOOKUP ----------------
def lookup_food_nutrients(item_name):
    """
    Main lookup function.
    Returns (nutrients_dict, provenance)
    """
    if not item_name:
        return None, {"source": "empty_name"}

    results = search_food(item_name, page_size=2)
    if not results:
        return None, {"source": "fdc_search_empty"}

    top = results[0]
    fdc_id = top.get("fdcId")
    details = get_food_by_fdcid(fdc_id)
    if not details:
        return None, {"source": "fdc_no_details", "fdcId": fdc_id}

    # Extract key nutrients
    nutrient_dict = {}
    nutrients = details.get("foodNutrients", [])
    for n in nutrients:
        name = n.get("nutrient", {}).get("name", "").lower()
        amount = n.get("amount")
        unit = n.get("nutrient", {}).get("unitName", "")
        if not name:
            continue

        # Map to friendly keys
        if "energy" in name:
            nutrient_dict["calories_kcal"] = amount
        elif name == "protein":
            nutrient_dict["protein_g"] = amount
        elif "carbohydrate" in name:
            nutrient_dict["total_carbohydrate_g"] = amount
        elif name == "total lipid" in name or name == "fat":
            nutrient_dict["total_fat_g"] = amount
        elif "fiber" in name:
            nutrient_dict["dietary_fiber_g"] = amount
        elif "sugar" in name:
            nutrient_dict["sugars_g"] = amount
        else:
            # generic: store all with name
            nutrient_dict[name.replace(" ", "_")] = amount

    provenance = {
        "source": "fdc_api",
        "fdcId": fdc_id,
        "description": top.get("description"),
        "brandName": top.get("brandName"),
        "dataType": top.get("dataType"),
        "servingSize": details.get("servingSize"),
        "servingSizeUnit": details.get("servingSizeUnit"),
    }

    return nutrient_dict, provenance


if __name__ == "__main__":
    # quick test
    from pprint import pprint
    test = "chicken biryani"
    n, prov = lookup_food_nutrients(test)
    print("TEST:", test)
    pprint(n)
    pprint(prov)
