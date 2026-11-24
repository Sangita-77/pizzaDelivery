"""Fornello Pizza API regression tests (Node backend via /api proxy)."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
CREDS = {"email": "testy@fornello.com", "password": "forno123"}


def r2(n):
    return round(n + 1e-9, 2)


@pytest.fixture(scope="session")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="session")
def token(s):
    r = s.post(f"{API}/auth/login", json=CREDS)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def other_user(s):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"name": "TEST_Other", "email": email, "password": "secret12"})
    assert r.status_code == 201, r.text
    return {"email": email, "token": r.json()["token"], "user": r.json()["user"]}


# --- Auth ---
class TestAuth:
    def test_login_and_me(self, s, auth):
        r = s.get(f"{API}/auth/me", headers=auth)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["email"] == CREDS["email"]
        assert "passwordHash" not in u and "_id" not in u
        assert len(u["addresses"]) >= 1

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": CREDS["email"], "password": "nope123"})
        assert r.status_code == 401

    def test_login_no_hash_leak(self, s):
        r = s.post(f"{API}/auth/login", json=CREDS)
        assert r.status_code == 200 and "passwordHash" not in r.text and "$__parent" not in r.text
        assert set(r.json()["user"]["addresses"][0]) >= {"id", "line1", "city", "zip"}

    def test_register_validation(self, s, other_user):
        assert s.post(f"{API}/auth/register", json={"name": "TEST_X", "email": "bad", "password": "secret12"}).status_code == 400
        assert s.post(f"{API}/auth/register", json={"name": "TEST_X", "email": "a@b.co", "password": "123"}).status_code == 400
        d = s.post(f"{API}/auth/register", json={"name": "TEST_X", "email": other_user["email"].upper(), "password": "secret12"})
        assert d.status_code == 409

    def test_put_me_and_addresses(self, s, other_user):
        h = {"Authorization": f"Bearer {other_user['token']}"}
        r = s.put(f"{API}/auth/me", headers=h, json={"name": "TEST_Renamed", "phone": "555"})
        assert r.status_code == 200 and r.json()["user"]["name"] == "TEST_Renamed"
        assert s.put(f"{API}/auth/me", headers=h, json={"name": "a"}).status_code == 400
        assert s.post(f"{API}/auth/addresses", headers=h, json={"line1": "x"}).status_code == 400
        r = s.post(f"{API}/auth/addresses", headers=h, json={"label": "Home", "line1": "TEST_1 Main", "city": "Rome", "zip": "00100"})
        assert r.status_code == 201
        aid = r.json()["user"]["addresses"][-1]["id"]
        r = s.delete(f"{API}/auth/addresses/{aid}", headers=h)
        assert r.status_code == 200 and all(a["id"] != aid for a in r.json()["user"]["addresses"])
        assert s.get(f"{API}/auth/me", headers=h).json()["user"]["name"] == "TEST_Renamed"

    def test_me_bad_token(self, s):
        assert s.get(f"{API}/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401


# --- Menu / builder / images / promo ---
class TestCatalog:
    def test_menu(self, s):
        r = s.get(f"{API}/menu")
        assert r.status_code == 200
        body = r.json()
        items = body["items"] if isinstance(body, dict) else body
        assert len(items) == 13
        assert all("_id" not in i for i in items)
        TestCatalog.first = items[0]

    def test_menu_key(self, s):
        k = TestCatalog.first["key"]
        r = s.get(f"{API}/menu/{k}")
        assert r.status_code == 200
        assert s.get(f"{API}/menu/does-not-exist").status_code == 404

    def test_builder_config(self, s):
        r = s.get(f"{API}/builder-config")
        assert r.status_code == 200 and r.json()["basePrice"] == 9.9

    def test_image(self, s):
        r = s.get(f"{API}/images/menu/margherita.jpg")
        assert r.status_code == 200 and r.headers["content-type"].startswith("image/jpeg")

    def test_promo(self, s):
        r = s.post(f"{API}/promo/validate", json={"code": "welcome10", "subtotal": 25})
        assert r.status_code == 200 and r.json()["pct"] == 10 and r.json()["discount"] == 2.5
        r = s.post(f"{API}/promo/validate", json={"code": "FREEDEL", "subtotal": 10})
        assert r.status_code == 200 and r.json()["freeDelivery"] is True
        assert s.post(f"{API}/promo/validate", json={"code": "BOGUS"}).status_code == 400


# --- Orders ---
class TestOrders:
    def test_requires_auth(self, s):
        assert s.get(f"{API}/orders").status_code == 401
        assert s.post(f"{API}/orders", json={}).status_code == 401

    def test_menu_order_pricing(self, s, auth):
        menu = s.get(f"{API}/menu").json()
        items = menu["items"] if isinstance(menu, dict) else menu
        it = items[0]
        me = s.get(f"{API}/auth/me", headers=auth).json()["user"]
        r = s.post(f"{API}/orders", headers=auth, json={
            "items": [{"type": "menu", "key": it["key"], "size": "small", "qty": 1}],
            "addressId": me["addresses"][0]["id"], "promoCode": "WELCOME10", "notes": "TEST_order"})
        assert r.status_code == 201, r.text
        o = r.json()["order"]
        sub = r2(it["basePrice"] - 3)
        disc = r2(sub * 0.10)
        fee = 0 if sub >= 30 else 2.99
        tax = r2((sub - disc) * 0.05)
        p = o["pricing"]
        assert p["subtotal"] == sub and p["discount"] == disc and p["deliveryFee"] == fee
        assert abs(p["total"] - r2(sub - disc + fee + tax)) < 0.011
        assert o["status"] == "placed" and o["paymentMethod"] == "cod"
        TestOrders.oid = o["id"] if "id" in o else o.get("_id")
        assert TestOrders.oid

    def test_custom_order_inline_address_freedel(self, s, other_user):
        h = {"Authorization": f"Bearer {other_user['token']}"}
        details = {"size": "large", "crust": "sourdough", "sauce": "pesto", "cheese": "extra", "toppings": ["pepperoni", "olives", "olives"]}
        r = s.post(f"{API}/orders", headers=h, json={
            "items": [{"type": "custom", "qty": 2, "details": details}],
            "address": {"line1": "TEST_9 Via Roma", "city": "Rome", "zip": "00100"}, "saveAddress": True, "promoCode": "FREEDEL"})
        assert r.status_code == 201, r.text
        o = r.json()["order"]
        unit = r2(9.9 + 6 + 2 + 1.25 + 2 + 1.75 + 1)
        assert o["items"][0]["unitPrice"] == unit
        assert o["pricing"]["subtotal"] == r2(unit * 2) and o["pricing"]["deliveryFee"] == 0
        me = s.get(f"{API}/auth/me", headers=h).json()["user"]
        assert any(a["line1"] == "TEST_9 Via Roma" for a in me["addresses"])
        TestOrders.other_oid = o["id"]

    def test_order_validation(self, s, auth):
        assert s.post(f"{API}/orders", headers=auth, json={"items": []}).status_code == 400
        bad = {"items": [{"type": "custom", "qty": 1, "details": {"size": "huge"}}], "address": {"line1": "a", "city": "b", "zip": "c"}}
        assert s.post(f"{API}/orders", headers=auth, json=bad).status_code == 400
        noaddr = {"items": [{"type": "menu", "key": "margherita", "qty": 1}]}
        assert s.post(f"{API}/orders", headers=auth, json=noaddr).status_code == 400
        badpromo = {**noaddr, "address": {"line1": "a", "city": "b", "zip": "c"}, "promoCode": "BOGUS"}
        assert s.post(f"{API}/orders", headers=auth, json=badpromo).status_code == 400

    def test_list_and_get_own(self, s, auth):
        r = s.get(f"{API}/orders", headers=auth)
        assert r.status_code == 200 and any(o["id"] == TestOrders.oid for o in r.json()["orders"])
        r = s.get(f"{API}/orders?active=1", headers=auth)
        assert all(o["status"] != "delivered" for o in r.json()["orders"])
        assert s.get(f"{API}/orders/{TestOrders.oid}", headers=auth).status_code == 200

    def test_other_users_order_404(self, s, auth):
        assert s.get(f"{API}/orders/{TestOrders.other_oid}", headers=auth).status_code == 404

    def test_invalid_order_id(self, s, auth):
        r = s.get(f"{API}/orders/not-an-objectid", headers=auth)
        assert r.status_code in (400, 404), f"got {r.status_code} {r.text}"

    def test_status_progresses(self, s, auth):
        time.sleep(14)
        o = s.get(f"{API}/orders/{TestOrders.oid}", headers=auth).json()["order"]
        assert o["status"] in ("confirmed", "baking"), o["status"]
        assert [h["status"] for h in o["statusHistory"]][:2] == ["placed", "confirmed"]
