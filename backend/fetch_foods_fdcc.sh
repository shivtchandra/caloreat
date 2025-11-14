#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export FDC_API_KEY="your_key_here"
#   ./fetch_foods_fdcc.sh
#
# Output:
#   tmp_fdcs.json  -> per-search results
#   fdc_ids.txt    -> list of discovered fdcIds (one per line)
#   foods_data.json -> final array of food detail objects (FDC response)
#
# Requirements: curl, jq, GNU parallel (optional, recommended). If parallel is not installed
# the script will run sequentially.

if [[ -z "${FDC_API_KEY:-}" ]]; then
  echo "ERROR: set FDC_API_KEY in environment first: export FDC_API_KEY=xxxxx"
  exit 2
fi

API_KEY="$FDC_API_KEY"
SEARCH_URL="https://api.nal.usda.gov/fdc/v1/foods/search"
FOODS_BULK_URL="https://api.nal.usda.gov/fdc/v1/foods"

# 200 common dishes (global + Indian + western etc.)
DISHES=(
"Plain Rice"
"Steamed White Rice"
"Brown Rice"
"Veg Biryani"
"Chicken Biryani"
"Paneer Butter Masala"
"Palak Paneer"
"Vegetable Curry"
"Dal Tadka"
"Masoor Dal"
"Chana Masala"
"Aloo Gobi"
"Butter Chicken"
"Tandoori Chicken"
"Chicken Curry"
"Rogan Josh"
"Fish Curry"
"Grilled Salmon"
"Fried Fish"
"Fish and Chips"
"Pizza Margherita"
"Pepperoni Pizza"
"Veg Pizza"
"Cheese Pizza"
"Pasta Alfredo"
"Spaghetti Bolognese"
"Lasagna"
"Carbonara"
"Garlic Bread"
"Caesar Salad"
"Greek Salad"
"Garden Salad"
"Caesar Chicken Salad"
"Chicken Sandwich"
"Veg Sandwich"
"Grilled Cheese Sandwich"
"BLT Sandwich"
"Club Sandwich"
"Hamburger"
"Cheeseburger"
"Veg Burger"
"French Fries"
"Mashed Potatoes"
"Baked Potato"
"Omelette"
"Scrambled Eggs"
"Boiled Egg"
"Fried Egg"
"Egg Bhurji"
"Pancakes"
"Waffles"
"French Toast"
"Idli"
"Dosa"
"Masala Dosa"
"Uttapam"
"Vada"
"Sambar"
"Rasam"
"Chapati"
"Roti (whole wheat)"
"Paratha"
"Poori"
"Naan"
"Raita"
"Curd (yogurt)"
"Greek Yogurt"
"Milk (whole)"
"Milk (skim)"
"Paneer (Indian cottage cheese)"
"Tofu"
"Dal Makhani"
"Rajma (kidney beans curry)"
"Chole (chickpea curry)"
"Fish Tikka"
"Chicken Tikka"
"Seekh Kebab"
"Grilled Chicken Breast"
"Roast Chicken"
"Beef Steak"
"Pork Chop"
"Shrimp Curry"
"Pulled Pork"
"BBQ Ribs"
"Hot Dog"
"Falafel"
"Hummus"
"Shawarma (chicken)"
"Shawarma (beef)"
"Gyro"
"Sushi (tuna)"
"Sushi (salmon)"
"Tempura"
"Ramen"
"Pho (beef noodle soup)"
"Tom Yum Soup"
"Miso Soup"
"Clam Chowder"
"Vegetable Soup"
"Chicken Noodle Soup"
"Spring Rolls"
"Egg Rolls"
"Stir Fry Vegetables"
"Paneer Tikka"
"Butter Naan"
"Chicken Korma"
"Kadai Chicken"
"Fish Fry"
"Baked Salmon"
"Grilled Vegetables"
"Cottage Pie"
"Shepherd's Pie"
"Stuffed Bell Peppers"
"Chili Con Carne"
"Beef Stew"
"Meatballs"
"Ceviche"
"Paella"
"Empanadas"
"Enchiladas"
"Tacos (beef)"
"Tacos (chicken)"
"Burrito"
"Quesadilla"
"Guacamole"
"Salsa"
"Refried Beans"
"Black Beans (cooked)"
"Lentil Soup"
"Vegetable Curry (Thai)"
"Green Curry (Thai)"
"Massaman Curry"
"Pad Thai"
"Chicken Satay"
"Butter Prawns"
"Fish Stew"
"Grilled Pork"
"Stuffed Paratha"
"Sweet Lassi"
"Mango Lassi"
"Ice Cream (vanilla)"
"Ice Cream (chocolate)"
"Brownie"
"Cheesecake"
"Apple Pie"
"Banana"
"Apple"
"Orange"
"Grapes"
"Strawberries"
"Blueberries"
"Avocado Toast"
"Smoothie (fruit)"
"Protein Shake"
)

# ensure we have 200 (if list is shorter you can append more)
COUNT=${#DISHES[@]}
echo "Will try to find FDC entries for $COUNT dishes."

mkdir -p tmp
> tmp_fdcs.json
> fdc_ids.txt

# helper to url-encode in bash (POSIX)
urlencode() {
  python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))" "$1"
}

# Optionally run searches in parallel if GNU parallel is available
if command -v parallel >/dev/null 2>&1; then
  echo "Using parallel for searches..."
  export API_KEY
  printf "%s\n" "${DISHES[@]}" | parallel -j 10 --will-cite '
    q="{1}"
    QE=$(python3 - <<PY
import urllib.parse,sys
print(urllib.parse.quote(sys.argv[1]))
PY
"$q")
    resp=$(curl -s --fail "'"$SEARCH_URL"'"?api_key="'"$API_KEY"'"\&query="$QE")
    # write a line per dish into tmp/{sanitized}.json to avoid race
    fn="tmp/search_$(echo "$q" | tr " /" "__" | tr -cd "[:alnum:]_-").json"
    echo "$resp" > "$fn"
    # try to extract first fdcId
    fdc=$(echo "$resp" | jq -r ".foods[0].fdcId // empty")
    if [[ -n "$fdc" ]]; then
      echo "$fdc" >> fdc_ids.txt
    fi
  ' ::: "${DISHES[@]}"
else
  echo "Parallel not found — running sequential searches (slower)..."
  i=0
  for dish in "${DISHES[@]}"; do
    i=$((i+1))
    echo "[$i/$COUNT] Searching: $dish"
    QE=$(urlencode "$dish")
    # prefer minimal fields to reduce payload
    resp=$(curl -s --fail "${SEARCH_URL}?api_key=${API_KEY}&query=${QE}&pageSize=1")
    echo "$resp" > "tmp/search_${i}.json"
    fdc=$(echo "$resp" | jq -r ".foods[0].fdcId // empty")
    if [[ -n "$fdc" ]]; then
      echo "$fdc" >> fdc_ids.txt
    else
      echo "# no fdcId for: $dish" >> tmp/search_${i}.json
    fi
    # small sleep to be polite (avoid bursting)
    sleep 0.15
  done
fi

# Deduplicate IDs and prepare batches of 20
sort -u fdc_ids.txt -o fdc_ids.txt
IDS=( $(cat fdc_ids.txt) )
echo "Found ${#IDS[@]} unique fdcIds."

if [[ ${#IDS[@]} -eq 0 ]]; then
  echo "No IDs found — aborting."
  exit 0
fi

# batch fetch details (max 20 per request)
BATCH_SIZE=20
> foods_data.json
echo "[" > foods_data.json
first_out=1
for ((i=0; i<${#IDS[@]}; i+=BATCH_SIZE)); do
  chunk=( "${IDS[@]:i:BATCH_SIZE}" )
  echo "Fetching details for IDs ${i}..$((i+${#chunk[@]}-1)) (count ${#chunk[@]})"
  # POST body: {"fdcIds":[...]}
  body=$(jq -n --argjson ids "$(printf '%s\n' "${chunk[@]}" | jq -R . | jq -s .)" '{fdcIds: $ids}')
  # call FDC foods endpoint (bulk)
  resp=$(curl -s -X POST "${FOODS_BULK_URL}?api_key=${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body")
  # ensure valid JSON array response
  if echo "$resp" | jq -e . >/dev/null 2>&1; then
    # append each item to foods_data.json (comma-separated)
    echo "$resp" | jq -c '.[]' | while read -r item; do
      if [[ $first_out -eq 1 ]]; then
        echo "$item" >> foods_data.json
        first_out=0
      else
        echo "," >> foods_data.json
        echo "$item" >> foods_data.json
      fi
    done
  else
    echo "Warning: invalid response for chunk starting at $i"
    echo "$resp" > "tmp/bad_chunk_${i}.txt"
  fi
  # be polite
  sleep 0.5
done
echo "]" >> foods_data.json

echo "Done. Saved food details to foods_data.json (count approx: $(jq 'length' foods_data.json))."
