import os, hmac, hashlib, json, urllib.parse, secrets
from datetime import datetime, timezone, date
from flask import Flask, request, jsonify, render_template, abort
import requests

app = Flask(__name__)

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BASE_URL = os.environ.get("BASE_URL", "").rstrip("/")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "change-me")

CATEGORIES = [
    "Продукты", "Молочка", "Мясо и рыба", "Овощи и фрукты", "Хлеб и выпечка",
    "Бакалея", "Напитки", "Сладости", "Заморозка", "Бумажные товары",
    "Гигиена", "Бытовая химия", "Уборка", "Животные", "Другое"
]

def sb(path, method="GET", payload=None, params=None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Supabase environment variables are not set")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    r = requests.request(method, SUPABASE_URL + "/rest/v1/" + path,
                         headers=headers, json=payload, params=params, timeout=20)
    r.raise_for_status()
    return r.json() if r.text else None

def tg(method, payload):
    r = requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/{method}",
                      json=payload, timeout=20)
    r.raise_for_status()
    return r.json()

def tg_user(update):
    return ((update.get("message") or update.get("callback_query") or {})
            .get("from") or {})

def ensure_user(tg_id, name):
    rows = sb("users", params={"telegram_id": f"eq.{tg_id}", "select": "*"})
    if rows:
        return rows[0]
    return sb("users", "POST", {"telegram_id": tg_id, "name": name})[0]

def ensure_home(user):
    members = sb("home_members", params={"user_id": f"eq.{user['id']}", "select": "*"})
    if members:
        return sb("homes", params={"id": f"eq.{members[0]['home_id']}", "select": "*"})[0]
    code = secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8].upper()
    home = sb("homes", "POST", {"name": "Наш дом", "invite_code": code})[0]
    sb("home_members", "POST", {"home_id": home["id"], "user_id": user["id"]})
    return home

def keyboard():
    return {
        "inline_keyboard": [
            [{"text": "🏠 Открыть наш дом", "web_app": {"url": f"{BASE_URL}/app"}}],
            [{"text": "🛒 Список покупок", "callback_data": "shopping"}],
            [{"text": "👥 Пригласить", "callback_data": "invite"}]
        ]
    }

@app.get("/")
def health():
    return "Our Home is running"

@app.get("/app")
def mini_app():
    return render_template("index.html", categories=CATEGORIES)

@app.get("/api/state")
def state():
    tg_id = request.args.get("telegram_id", type=int)
    if not tg_id:
        abort(400)
    user = ensure_user(tg_id, "Пользователь")
    home = ensure_home(user)
    products = sb("products", params={
        "home_id": f"eq.{home['id']}", "order": "category.asc,name.asc", "select": "*"
    })
    shopping = sb("shopping_list", params={
        "home_id": f"eq.{home['id']}", "order": "is_bought.asc,created_at.desc", "select": "*"
    })
    return jsonify({"user": user, "home": home, "products": products, "shopping": shopping})

@app.post("/api/product")
def add_product():
    d = request.json or {}
    tg_id = int(d.get("telegram_id", 0))
    user = ensure_user(tg_id, d.get("user_name", "Пользователь"))
    home = ensure_home(user)
    row = {
        "home_id": home["id"], "name": d["name"].strip(),
        "category": d.get("category", "Другое"),
        "quantity": float(d.get("quantity", 1)),
        "unit": d.get("unit", "шт."),
        "min_quantity": float(d.get("min_quantity", 0)),
        "expiration_date": d.get("expiration_date") or None,
        "location": d.get("location") or None,
        "created_by": user["id"]
    }
    return jsonify(sb("products", "POST", row)[0])

@app.patch("/api/product/<int:pid>")
def update_product(pid):
    d = request.json or {}
    allowed = {k: d[k] for k in ["quantity","min_quantity","expiration_date","name","category","unit"] if k in d}
    row = sb("products", "PATCH", allowed, params={"id": f"eq.{pid}", "select": "*" })
    return jsonify(row[0] if row else {})

@app.delete("/api/product/<int:pid>")
def delete_product(pid):
    sb("products", "DELETE", params={"id": f"eq.{pid}"})
    return jsonify({"ok": True})

@app.post("/api/shopping")
def add_shopping():
    d = request.json or {}
    tg_id = int(d.get("telegram_id", 0))
    user = ensure_user(tg_id, d.get("user_name", "Пользователь"))
    home = ensure_home(user)
    row = {"home_id": home["id"], "name": d["name"].strip(),
           "quantity": float(d.get("quantity", 1)), "unit": d.get("unit","шт."),
           "added_by": user["id"]}
    return jsonify(sb("shopping_list", "POST", row)[0])

@app.patch("/api/shopping/<int:sid>")
def update_shopping(sid):
    d = request.json or {}
    row = sb("shopping_list", "PATCH", {"is_bought": bool(d.get("is_bought", False))},
             params={"id": f"eq.{sid}", "select": "*"})
    return jsonify(row[0] if row else {})

@app.delete("/api/shopping/<int:sid>")
def delete_shopping(sid):
    sb("shopping_list", "DELETE", params={"id": f"eq.{sid}"})
    return jsonify({"ok": True})

@app.post("/api/invite")
def invite():
    tg_id = int((request.json or {}).get("telegram_id", 0))
    user = ensure_user(tg_id, "Пользователь")
    home = ensure_home(user)
    return jsonify({"code": home["invite_code"]})

def validate_webapp_data(init_data):
    # Telegram Web App initData validation.
    if not BOT_TOKEN or not init_data:
        return None
    data = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
    received = data.pop("hash", None)
    if not received:
        return None
    check = "\n".join(f"{k}={data[k]}" for k in sorted(data))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received):
        return None
    return json.loads(data["user"]) if "user" in data else None

@app.post("/telegram/webhook/<secret>")
def webhook(secret):
    if secret != WEBHOOK_SECRET:
        return abort(404)
    update = request.json or {}
    user = tg_user(update)
    if not user:
        return jsonify({"ok": True})
    tg_id = user.get("id")
    name = user.get("first_name", "Пользователь")
    db_user = ensure_user(tg_id, name)
    ensure_home(db_user)

    if "message" in update:
        msg = update["message"]
        chat_id = msg["chat"]["id"]
        text = msg.get("text", "")
        if text.startswith("/start"):
            tg("sendMessage", {
                "chat_id": chat_id,
                "text": "🏠 Добро пожаловать в «Наш дом»!\n\nЗдесь можно хранить продукты и бытовые вещи, отмечать остатки, сроки и покупки.",
                "reply_markup": keyboard()
            })
        elif text.startswith("/invite"):
            home = ensure_home(db_user)
            tg("sendMessage", {"chat_id": chat_id,
                "text": f"👥 Код приглашения в ваш дом: {home['invite_code']}\n\nПередай его второму человеку."})
    if "callback_query" in update:
        cq = update["callback_query"]
        chat_id = cq["message"]["chat"]["id"]
        if cq["data"] == "invite":
            home = ensure_home(db_user)
            tg("sendMessage", {"chat_id": chat_id,
                "text": f"👥 Код приглашения: {home['invite_code']}"})
        elif cq["data"] == "shopping":
            home = ensure_home(db_user)
            items = sb("shopping_list", params={"home_id": f"eq.{home['id']}",
                                                "is_bought": "eq.false", "select": "*"})
            text = "🛒 Список покупок\n\n" + ("\n".join(f"• {x['name']} — {x['quantity']} {x['unit']}" for x in items)
                                                 if items else "Пока пусто.")
            tg("sendMessage", {"chat_id": chat_id, "text": text, "reply_markup": keyboard()})
        tg("answerCallbackQuery", {"callback_query_id": cq["id"]})
    return jsonify({"ok": True})

def setup_webhook():
    if BOT_TOKEN and BASE_URL and WEBHOOK_SECRET:
        url = f"{BASE_URL}/telegram/webhook/{WEBHOOK_SECRET}"
        try:
            tg("setWebhook", {"url": url, "drop_pending_updates": True})
        except Exception as e:
            print("Webhook setup failed:", e)

if __name__ == "__main__":
    setup_webhook()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
