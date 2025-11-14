"""
image_utils.py

EasyOCR-first OCR extraction + item mapping and quantity parsing.
Fallback to pytesseract if EasyOCR is not available.

Designed to be robust to OCR quirks from screenshots/receipts.
"""

import io
import os
import re
import time
import json
from collections import defaultdict

from PIL import Image, ImageOps
import numpy as np
import pandas as pd

# fuzzy matching
try:
    from rapidfuzz import process, fuzz
    RAPIDFUZZ_AVAILABLE = True
except Exception:
    process = None
    fuzz = None
    RAPIDFUZZ_AVAILABLE = False

# semantic model optional
try:
    from sentence_transformers import SentenceTransformer, util
    SEMANTIC_AVAILABLE = True
    _semantic_model = SentenceTransformer("all-MiniLM-L6-v2")
except Exception:
    SEMANTIC_AVAILABLE = False
    _semantic_model = None
    util = None

# OCR engines
OCR_ENGINE = None
try:
    import easyocr
    OCR_ENGINE = "easyocr"
except Exception:
    try:
        import pytesseract
        from pytesseract import Output
        OCR_ENGINE = "pytesseract"
    except Exception:
        OCR_ENGINE = None

# cached easyocr reader to avoid re-init cost
_easyocr_reader = None

# Optional classifier artifacts (not required)
MODEL_DIR = "line_model_artifacts"
TFIDF_PATH = os.path.join(MODEL_DIR, "tfidf_vectorizer.joblib")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.joblib")
CLF_PATH = os.path.join(MODEL_DIR, "line_model_rf.joblib")
try:
    import joblib
    from scipy.sparse import hstack
    HAVE_JOBLIB = True
except Exception:
    HAVE_JOBLIB = False
    joblib = None
    hstack = None

# small config
MIN_ALPHA_RATIO = 0.45
MIN_WORD_CONF = 8
AUTO_ACCEPT_SCORE = 90
PRICE_COL_MIN_COUNT = 1
FILTER_LOG_PATH = "filtered_lines.log"

# load local DB if present
FOOD_DB_PATH = "indian_food_db.csv"
if os.path.exists(FOOD_DB_PATH):
    food_db = pd.read_csv(FOOD_DB_PATH)
    if 'item' not in food_db.columns:
        raise RuntimeError(f"{FOOD_DB_PATH} must have an 'item' column")
    food_items = food_db['item'].astype(str).tolist()
else:
    food_db = pd.DataFrame(columns=['item','calories','protein','carbs','fat','fiber','sugar','source','restaurant'])
    food_items = []

# small spelling fixes & triggers
SPELL_FIXES = {
    'biryoni': 'biryani',
    'birya ni': 'biryani',
    'biryaoni': 'biryani',
    'birya': 'biryani',
    'chickpet': 'chicken',
    'chickenx': 'chicken',
    'bonelesschicken': 'chicken',
    'spcl': 'special',
    'chkn': 'chicken',
}

FOOD_TRIGGERS = set([
    'biryani','curry','dosa','naan','rice','burger','salad','paneer','chicken','egg','fries',
    'thali','pulao','masala','tikka','kebab','idli','vada','samosa','momos','pakora','pizza'
])

noise_patterns = re.compile(
    r'\b(order|subtotal|total|gst|tax|delivered|delivery|time|date|phone|your orders|search|serves?|order placed|served|order id|rating|reviews|contact|address|track|expected|dispatch|ready|mins|min|hrs|hour|mess|bucket|combo|special)\b',
    re.I
)
garble_pattern = re.compile(r'^[^A-Za-z0-9]{1,6}$')
currency_pattern = re.compile(r'[₹₹₹€$£]\s*\d+|\d+([.,]\d{2})?')

def log_filtered_line(reason, text, extra=None):
    try:
        entry = {'ts': time.time(), 'reason': reason, 'text': text}
        if extra:
            entry['extra'] = extra
        with open(FILTER_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass

def safe_int(val, default=0):
    try:
        return int(val)
    except Exception:
        try:
            if isinstance(val, str) and val.isdigit():
                return int(val)
        except Exception:
            pass
    return default

def normalize_text(s):
    if not s:
        return ''
    t = s.lower()
    t = t.replace('@ x', 'x ').replace('@', ' ')
    t = re.sub(r'[^0-9a-z\u0900-\u097F\(\)\sx×X\.-]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    words = []
    for w in t.split():
        words.append(SPELL_FIXES.get(w, w))
    return ' '.join(words)

def alpha_token_ratio(s):
    tokens = s.split()
    if not tokens:
        return 0.0
    alpha = sum(1 for t in tokens if re.search(r'[A-Za-z\u0900-\u097F]', t))
    return alpha / len(tokens)

# ---------------- OCR helpers ----------------
def _get_easyocr_reader(lang_list=None):
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            langs = lang_list if lang_list else ['en']
            _easyocr_reader = easyocr.Reader(langs, gpu=False)
        except Exception:
            _easyocr_reader = None
    return _easyocr_reader

def preprocess_image_bytes(image_bytes):
    pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    max_dim = 1600
    if max(pil.size) > max_dim:
        scale = max_dim / max(pil.size)
        pil = pil.resize((int(pil.width * scale), int(pil.height * scale)))
    gray = ImageOps.grayscale(pil)
    arr = np.array(gray)
    try:
        import cv2
        arr = cv2.bilateralFilter(arr, d=9, sigmaColor=75, sigmaSpace=75)
        _, th = cv2.threshold(arr, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        pil = Image.fromarray(th)
    except Exception:
        pil = Image.fromarray(arr)
    return pil

def easyocr_extract_lines(pil_image):
    reader = _get_easyocr_reader(['en'])
    if reader is None:
        raise RuntimeError("easyocr not available")
    img = np.array(pil_image)[:, :, ::-1]  # RGB -> BGR
    results = reader.readtext(img, detail=1)  # (bbox, text, prob)
    lines = []
    for bbox, text, prob in results:
        if not text or not str(text).strip():
            continue
        xs = [int(p[0]) for p in bbox]
        ys = [int(p[1]) for p in bbox]
        left, right, top, bottom = min(xs), max(xs), min(ys), max(ys)
        # build per-word approximate boxes (EasyOCR often gives full line)
        words = []
        toks = str(text).split()
        if toks:
            approx_w = max(1, int((right - left) / max(1, len(toks))))
            for i, w in enumerate(toks):
                words.append({'text': w, 'left': left + i * approx_w, 'top': top, 'width': approx_w, 'height': (bottom - top), 'conf': int(round(prob*100))})
        lines.append({'text': str(text).strip(), 'left': left, 'right': right, 'top': top, 'bottom': bottom, 'words': words, 'conf': int(round(prob*100))})
    lines = sorted(lines, key=lambda x: x['top'])
    return lines

def pytesseract_extract_lines(pil_image):
    try:
        import pytesseract
        from pytesseract import Output
    except Exception:
        raise RuntimeError("pytesseract not available")
    data = pytesseract.image_to_data(np.array(pil_image), output_type=Output.DICT)
    n = len(data.get('text', []))
    groups = defaultdict(list)
    for i in range(n):
        txt = str(data.get('text', [''])[i]).strip()
        if not txt:
            continue
        key = (data.get('block_num', [0]*n)[i], data.get('par_num', [0]*n)[i], data.get('line_num', [0]*n)[i])
        left = safe_int(data.get('left', [0]*n)[i], 0)
        top = safe_int(data.get('top', [0]*n)[i], 0)
        width = safe_int(data.get('width', [0]*n)[i], 0)
        height = safe_int(data.get('height', [0]*n)[i], 0)
        conf_raw = data.get('conf', ['-1']*n)[i]
        try:
            conf = int(float(conf_raw))
        except Exception:
            conf = -1
        groups[key].append({'text': txt, 'left': left, 'top': top, 'width': width, 'height': height, 'conf': conf})
    extracted = []
    for k, words in groups.items():
        words_sorted = sorted(words, key=lambda w: w['left'])
        texts = [w['text'] for w in words_sorted]
        lefts = [w['left'] for w in words_sorted] if words_sorted else [0]
        rights = [w['left'] + w['width'] for w in words_sorted] if words_sorted else [0]
        avg_conf = int(sum([max(0, w.get('conf', -1)) for w in words_sorted]) / max(1, len(words_sorted)))
        extracted.append({
            'text': ' '.join(texts),
            'words': words_sorted,
            'left': min(lefts),
            'right': max(rights),
            'top': min(w['top'] for w in words_sorted),
            'bottom': max(w['top'] + w['height'] for w in words_sorted),
            'conf': avg_conf
        })
    extracted = sorted(extracted, key=lambda x: x['top'])
    return extracted

# ---------------- matching helpers ----------------
def fuzzy_match_item(item_text, limit=8, restaurant=None):
    if not item_text:
        return []
    choices = None
    try:
        if restaurant and not food_db.empty:
            mask = food_db['restaurant'].fillna('').str.lower() == (restaurant or '').lower()
            filtered = food_db[mask]
            if len(filtered) > 0:
                choices = filtered['item'].astype(str).tolist()
    except Exception:
        choices = None
    if not choices:
        choices = food_items
    if not choices:
        return []
    if not RAPIDFUZZ_AVAILABLE:
        # simple fallback
        out = []
        for c in choices[:limit]:
            score = 100 if item_text.lower() in c.lower() else 50
            out.append({'db_item': c, 'score': score, 'nutrition': None})
        return out
    candidates = process.extract(item_text, choices, scorer=fuzz.token_set_ratio, limit=limit)
    formatted = []
    for name, score, idx in candidates:
        nut = None
        try:
            row = food_db[food_db['item'].astype(str).str.lower() == name.lower()].iloc[0].to_dict()
            nut = row
        except Exception:
            nut = None
        formatted.append({'db_item': name, 'score': int(score), 'nutrition': nut})
    return formatted

def semantic_match_item(item_text, top_k=5):
    if not SEMANTIC_AVAILABLE or not _semantic_model or not food_items:
        return []
    q_emb = _semantic_model.encode(item_text, convert_to_tensor=True)
    db_emb = _semantic_model.encode(food_items, convert_to_tensor=True)
    cos_scores = util.cos_sim(q_emb, db_emb)[0]
    import torch
    vals, idxs = torch.topk(cos_scores, k=min(top_k, len(food_items)))
    formatted = []
    for val, idx in zip(vals, idxs):
        name = food_items[int(idx)]
        score = float(val.item())
        scaled = int((score + 1) / 2 * 100)
        row = food_db[food_db['item'] == name].iloc[0].to_dict()
        formatted.append({'db_item': name, 'score': scaled, 'nutrition': row})
    return formatted

# ---------------- quantity parsing (robust) ----------------
def has_quantity_marker(text: str) -> bool:
    if not text:
        return False
    s = text.strip().lower()
    # normalize common OCR mistakes
    s = s.replace(' i ', ' x ').replace(' l ', ' x ').replace('×', 'x')
    s = re.sub(r'\s+', ' ', s)
    patterns = [
        r'^\s*\(?\s*\d+\s*[xX×]\s*.*$',   # 1x or (1x)
        r'^\s*\(?\s*\d+\s*[\.\-\)]\s*.*$', # (1), 1. item, 1- item
        r'^\s*\d+\s+[a-z].*$',             # "1 paneer"
    ]
    for p in patterns:
        if re.match(p, s):
            return True
    return False

def parse_quantity_from_line(text: str):
    if not text:
        return 1.0, ""
    s = text.strip().lower()
    s = s.replace(' i ', ' x ').replace(' l ', ' x ').replace('×', 'x')
    s = re.sub(r'\s+', ' ', s).strip()
    # try to capture '1x foo', '1 x foo', '1. foo', '(1x) foo', '1 Foo'
    m = re.match(r'^\s*\(?\s*(\d+)\s*(?:[xX×]|[.\-:)]|\b)\s*(.*)$', s)
    if m:
        try:
            qty = float(int(m.group(1)))
            rest = (m.group(2) or "").strip()
            return qty, rest or s
        except Exception:
            pass
    # fallback: no quantity found
    return 1.0, s

# ---------------- main mapping ----------------
def map_items_from_image_bytes(image_bytes, confidence_threshold=AUTO_ACCEPT_SCORE):
    pil = preprocess_image_bytes(image_bytes)
    lines = []
    if OCR_ENGINE == "easyocr":
        try:
            lines = easyocr_extract_lines(pil)
        except Exception as e:
            log_filtered_line('easyocr_failed', str(e))
            try:
                lines = pytesseract_extract_lines(pil)
            except Exception as e2:
                log_filtered_line('pytesseract_failed', str(e2))
                lines = []
    elif OCR_ENGINE == "pytesseract":
        try:
            lines = pytesseract_extract_lines(pil)
        except Exception as e:
            log_filtered_line('pytesseract_failed', str(e))
            lines = []
    else:
        log_filtered_line('no_ocr_engine', 'Install easyocr or pytesseract')
        lines = []

    # detect restaurant candidate (first plausible line)
    detected_restaurant = None
    for ln in (lines or [])[:8]:
        txt = ln.get('text','').strip()
        if not txt:
            continue
        if re.search(r'\d', txt) and len(re.sub(r'\D', '', txt)) > 3:
            continue
        if len(txt) < 3:
            continue
        if noise_patterns.search(txt):
            continue
        detected_restaurant = normalize_text(txt)
        break

    # detect numeric right columns heuristically
    right_numeric_counts = {}
    for ln in lines:
        last_word = ln['words'][-1]['text'] if ln.get('words') else ''
        is_num = bool(re.search(r'^[₹€$£]?[0-9]', last_word))
        key = ln.get('right', ln.get('left', 0))
        right_numeric_counts[key] = right_numeric_counts.get(key, 0) + (1 if is_num else 0)
    numeric_cols = {k for k,v in right_numeric_counts.items() if v >= PRICE_COL_MIN_COUNT}

    candidate_lines = []
    for ln in lines:
        raw = ln.get('text','').strip()
        if not raw:
            log_filtered_line('empty', raw)
            continue
        if garble_pattern.match(raw):
            log_filtered_line('garble', raw)
            continue
        if noise_patterns.search(raw):
            log_filtered_line('noise_pattern', raw)
            continue

        # strip tokens that appear in numeric_cols
        tokens = ln.get('words', [])
        kept_tokens = []
        for w in tokens:
            token_right = w.get('left', 0) + w.get('width', 0)
            if token_right in numeric_cols:
                continue
            kept_tokens.append(w['text'])
        text_no_price = " ".join(kept_tokens).strip()
        if not text_no_price:
            log_filtered_line('price_only', raw, extra={'text_no_price': text_no_price})
            continue

        if alpha_token_ratio(text_no_price) < MIN_ALPHA_RATIO:
            if any(t in text_no_price.lower() for t in FOOD_TRIGGERS):
                pass
            else:
                log_filtered_line('alpha_ratio_low', raw, extra={'text_no_price': text_no_price})
                continue

        word_conf_vals = [w.get('conf', -1) for w in ln.get('words', [])]
        if word_conf_vals and max(word_conf_vals) < MIN_WORD_CONF:
            if any(t in text_no_price.lower() for t in FOOD_TRIGGERS):
                pass
            else:
                log_filtered_line('low_confidence', raw, extra={'max_conf': max(word_conf_vals)})
                continue

        ln_clean = dict(ln)
        ln_clean['text'] = normalize_text(text_no_price)
        plain = ln_clean['text'].strip()
        if len(plain) <= 3 and plain.lower() not in FOOD_TRIGGERS:
            log_filtered_line('too_short_token', raw, extra={'cleaned': plain})
            continue

        # optional ML classifier (if provided)
        if HAVE_JOBLIB:
            try:
                # try load but ignore heavy failures
                model = None
                if os.path.exists(TFIDF_PATH) and os.path.exists(SCALER_PATH) and os.path.exists(CLF_PATH):
                    tfidf = joblib.load(TFIDF_PATH)
                    scaler = joblib.load(SCALER_PATH)
                    model = joblib.load(CLF_PATH)
                    tf = tfidf.transform([ln_clean['text']])
                    num_df = pd.DataFrame([[
                        alpha_token_ratio(ln_clean['text']),
                        sum(1 for t in ln_clean['text'].split() if re.search(r'\d', t)) / max(1, len(ln_clean['text'].split())),
                        len(ln_clean['text'].split()),
                        int(bool(re.search(r'[₹$€£]', ln_clean['text']))),
                        max(word_conf_vals) if word_conf_vals else 0,
                        ln_clean.get('left', 0)
                    ]], columns=['alpha_ratio','pct_numeric','token_count','has_currency','max_conf','left'])
                    ns = scaler.transform(num_df)
                    X = hstack([tf, ns])
                    prob = float(model.predict_proba(X)[0,1])
                else:
                    prob = 0.6
            except Exception as e:
                log_filtered_line('line_model_error', ln_clean.get('text',''), extra={'error': str(e)})
                prob = 0.6
        else:
            prob = 0.6

        ln_clean['model_prob'] = prob
        candidate_lines.append(ln_clean)

    mapped = []
    rows = []
    for ln in candidate_lines:
        extracted = (ln.get('text') or '').strip()
        if not extracted:
            log_filtered_line('empty_after_normalize', ln.get('text',''))
            continue

        qty = 1
        # look for markers inside extracted and raw text too
        m = re.search(r'(?:^|\s)(\d+)\s*[xX×]\b', extracted) or re.search(r'(?:^|\s)(\d+)\s*[xX×]\b', ln.get('text',''))
        if m:
            try:
                qty = int(m.group(1))
                extracted = re.sub(r'(?:\(?\s*\d+\s*[xX×]\s*\)?)', '', extracted).strip()
            except Exception:
                qty = 1

        # portion multiplier heuristics
        portion_mult = 1.0
        for token, mult in {'mini':0.6,'small':0.8,'large':1.5,'bucket':2.0,'serves 2':2.0}.items():
            if token in ln.get('text','').lower():
                portion_mult = mult
                break

        candidates = fuzzy_match_item(extracted, limit=6, restaurant=(None if not detected_restaurant else detected_restaurant))

        # semantic fallback
        if (not candidates or (candidates and candidates[0]['score'] < 80)) and SEMANTIC_AVAILABLE:
            sem = semantic_match_item(extracted, top_k=5)
            combined = {c['db_item']: c for c in candidates}
            for s in sem:
                if s['db_item'] not in combined or s['score'] > combined[s['db_item']]['score']:
                    combined[s['db_item']] = s
            candidates = sorted(combined.values(), key=lambda x: x['score'], reverse=True)

        best = candidates[0] if candidates else None

        mapped_item = {
            'raw_text': ln.get('text',''),
            'extracted_text': extracted,
            'quantity': qty,
            'portion_mult': portion_mult,
            'best_match': best['db_item'] if best else None,
            'best_score': best['score'] if best else 0,
            'candidates': candidates,
            'model_prob': ln.get('model_prob', None)
        }
        mapped.append(mapped_item)

        MODEL_PROB_MIN = 0.75
        FUZZY_SCORE_MIN = AUTO_ACCEPT_SCORE

        model_prob = ln.get('model_prob', 0)
        fuzzy_ok = best and best.get('score', 0) >= FUZZY_SCORE_MIN
        model_ok = model_prob >= MODEL_PROB_MIN

        if best and fuzzy_ok and model_ok:
            nut = best.get('nutrition') or {}
            rows.append({
                'item': best['db_item'],
                'quantity': qty * portion_mult,
                'calories': nut.get('calories', 0) if isinstance(nut, dict) else 0,
                'protein': nut.get('protein', 0) if isinstance(nut, dict) else 0,
                'carbs': nut.get('carbs', 0) if isinstance(nut, dict) else 0,
                'fat': nut.get('fat', 0) if isinstance(nut, dict) else 0,
                'fiber': nut.get('fiber', 0) if isinstance(nut, dict) else 0,
                'sugar': nut.get('sugar', 0) if isinstance(nut, dict) else 0,
                'confidence': best['score'],
                'model_prob': model_prob
            })
        else:
            rows.append({
                'item': extracted,
                'quantity': qty * portion_mult,
                'calories': 0,
                'protein': 0,
                'carbs': 0,
                'fat': 0,
                'fiber': 0,
                'sugar': 0,
                'confidence': best['score'] if best else 0,
                'model_prob': model_prob
            })

    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=['item','quantity','calories','protein','carbs','fat','fiber','sugar','confidence','model_prob'])
    for col in ['calories','protein','carbs','fat','fiber','sugar','quantity']:
        if col not in df.columns:
            df[col] = 0
    numeric_cols = ['calories','protein','carbs','fat','fiber','sugar','quantity']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    # fix inf/nans
    df[numeric_cols] = df[numeric_cols].replace([np.inf, -np.inf], np.nan)
    df[numeric_cols] = df[numeric_cols].fillna(0)

    agg = {
        'total_calories': int((df['calories'] * df['quantity']).sum()),
        'total_protein': int((df['protein'] * df['quantity']).sum()),
        'total_carbs': int((df['carbs'] * df['quantity']).sum()),
        'total_fat': int((df['fat'] * df['quantity']).sum()),
        'total_fiber': int((df['fiber'] * df['quantity']).sum()),
        'total_sugar': int((df['sugar'] * df['quantity']).sum()),
    }

    insights = []
    if agg['total_fiber'] < 30:
        insights.append('Your diet seems low in fiber. Add more vegetables/whole grains.')
    if (agg['total_protein'] * 4) / max(agg['total_calories'], 1) < 0.15:
        insights.append('Your protein intake is below recommended levels.')
    if agg['total_sugar'] > 200:
        insights.append('Your sugar intake is quite high. Consider reducing sugary drinks.')

    ocr_text = '\n'.join([ln.get('text','').strip() for ln in lines if ln.get('text','').strip()])

    return {
        'ocr_lines_count': len(lines),
        'candidate_lines_count': len(candidate_lines),
        'detected_restaurant': detected_restaurant,
        'restaurant_menu_count': 0,
        'mapped_items': mapped,
        'rows': rows,
        'summary': agg,
        'insights': insights,
        'ocr_text': ocr_text,
        'ocr_text_preview': ocr_text[:500] + '...' if len(ocr_text) > 500 else ocr_text
    }

