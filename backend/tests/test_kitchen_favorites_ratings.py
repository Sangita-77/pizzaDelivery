"""Iteration 2: kitchen dashboard (owner), favourites, order ratings, no-auto-timer."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
CUSTOMER = {"email": "testy@fornello.com", "password": "forno123"}
OWNER = {"email": "owner@fornello.com", "password": "FornoKitchen2026"}
ADDR = {"label": "TEST_Home", "line1": "TEST_1 Test St", "city": "Testville", "zip": "11111"}
FLOW = ["placed", "confirmed", "baking", "quality_check", "out_for_delivery", "delivered"]


@pytest.fixture(scope="session")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


@pytest.fixture(scope="session")
def owner(s):
    return _login(s, OWNER)


@pytest.fixture(scope="session")
def cust(s):
    return _login(s, CUSTOMER)


@pytest.fixture(scope="session")
def newcust(s):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"name": "TEST_Kitchen", "email": email, "password": "secret12"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


def place(s, h, items=None):
    items = items or [{"type": "menu", "key": "margherita", "size": "large", "qty": 1}]
    r = s.post(f"{API}/orders", json={"items": items, "address": ADDR, "notes": "TEST_order"}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()["order"]


# --- Owner auth & role ---
class TestOwnerAuth:
    def test_owner_me_role(self, s, owner):
        h, u = owner
        assert u["role"] == "owner" and "passwordHash" not in u
        me = s.get(f"{API}/auth/me", headers=h).json()["user"]
        assert me["role"] == "owner" and "passwordHash" not in me and "favorites" in me

    def test_customer_me_role(self, s, cust):
        h, _ = cust
        me = s.get(f"{API}/auth/me", headers=h).json()["user"]
        assert me["role"] == "customer" and isinstance(me["favorites"], list)

    def test_kitchen_requires_auth(self, s):
        for p in ["orders", "stats"]:
            assert s.get(f"{API}/kitchen/{p}").status_code == 401
        assert s.post(f"{API}/kitchen/orders/abc/advance").status_code == 401

    def test_kitchen_customer_forbidden(self, s, cust, newcust):
        for h, _ in (cust, newcust):
            assert s.get(f"{API}/kitchen/orders", headers=h).status_code == 403
            assert s.get(f"{API}/kitchen/stats", headers=h).status_code == 403
            assert s.post(f"{API}/kitchen/orders/{'0'*24}/advance", headers=h).status_code == 403

    def test_register_cannot_set_owner_role(self, s):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"name": "TEST_Hack", "email": email, "password": "secret12", "role": "owner"})
        assert r.status_code == 201
        assert r.json()["user"]["role"] == "customer"


# --- Kitchen lifecycle ---
class TestKitchenFlow:
    def test_no_auto_timer_and_full_advance(self, s, owner, newcust):
        oh, _ = owner
        ch, cu = newcust
        o = place(s, ch)
        assert o["status"] == "placed"
        time.sleep(20)
        assert s.get(f"{API}/orders/{o['id']}", headers=ch).json()["order"]["status"] == "placed"
        new = s.get(f"{API}/kitchen/orders?filter=new", headers=oh).json()["orders"]
        mine = [x for x in new if x["id"] == o["id"]]
        assert mine and mine[0]["customer"]["email"] == cu["email"] and "name" in mine[0]["customer"]
        assert "passwordHash" not in str(new)
        for expected in FLOW[1:]:
            r = s.post(f"{API}/kitchen/orders/{o['id']}/advance", headers=oh)
            assert r.status_code == 200, r.text
            assert r.json()["order"]["status"] == expected
            got = s.get(f"{API}/orders/{o['id']}", headers=ch).json()["order"]["status"]
            assert got == expected
            if expected == "baking":
                act = s.get(f"{API}/kitchen/orders?filter=active", headers=oh).json()["orders"]
                assert any(x["id"] == o["id"] for x in act)
        assert s.post(f"{API}/kitchen/orders/{o['id']}/advance", headers=oh).status_code == 409
        assert s.post(f"{API}/kitchen/orders/{o['id']}/cancel", json={"reason": "x"}, headers=oh).status_code == 409
        done = s.get(f"{API}/kitchen/orders?filter=done", headers=oh).json()["orders"]
        assert any(x["id"] == o["id"] for x in done)
        pytest.delivered_id = o["id"]

    def test_advance_invalid(self, s, owner):
        oh, _ = owner
        assert s.post(f"{API}/kitchen/orders/notanid/advance", headers=oh).status_code == 404
        assert s.post(f"{API}/kitchen/orders/{'0'*24}/advance", headers=oh).status_code == 404
        assert s.post(f"{API}/kitchen/orders/{'0'*24}/cancel", json={}, headers=oh).status_code == 404

    @pytest.mark.parametrize("steps", [0, 1, 2, 3])
    def test_cancel_from_cancellable(self, s, owner, newcust, steps):
        oh, _ = owner
        ch, _ = newcust
        o = place(s, ch)
        for _ in range(steps):
            assert s.post(f"{API}/kitchen/orders/{o['id']}/advance", headers=oh).status_code == 200
        r = s.post(f"{API}/kitchen/orders/{o['id']}/cancel", json={"reason": "TEST_out of dough"}, headers=oh)
        assert r.status_code == 200, r.text
        got = s.get(f"{API}/orders/{o['id']}", headers=ch).json()["order"]
        assert got["status"] == "cancelled" and got["cancelReason"] == "TEST_out of dough"
        assert s.post(f"{API}/kitchen/orders/{o['id']}/advance", headers=oh).status_code == 409
        assert s.post(f"{API}/kitchen/orders/{o['id']}/cancel", json={}, headers=oh).status_code == 409

    def test_cancel_out_for_delivery_409(self, s, owner, newcust):
        oh, _ = owner
        ch, _ = newcust
        o = place(s, ch)
        for _ in range(4):
            s.post(f"{API}/kitchen/orders/{o['id']}/advance", headers=oh)
        assert s.post(f"{API}/kitchen/orders/{o['id']}/cancel", json={}, headers=oh).status_code == 409
        s.post(f"{API}/kitchen/orders/{o['id']}/advance", headers=oh)  # finish to delivered

    def test_cancel_default_reason(self, s, owner, newcust):
        oh, _ = owner
        ch, _ = newcust
        o = place(s, ch)
        r = s.post(f"{API}/kitchen/orders/{o['id']}/cancel", json={}, headers=oh)
        assert r.status_code == 200 and r.json()["order"]["cancelReason"]


# --- Ratings ---
class TestRatings:
    def test_rating_rules(self, s, owner, newcust, cust):
        oh, _ = owner
        ch, _ = newcust
        oid = getattr(pytest, "delivered_id", None)
        if not oid:
            pytest.skip("no delivered order")
        pending = place(s, ch)
        assert s.post(f"{API}/orders/{pending['id']}/rating", json={"stars": 4}, headers=ch).status_code == 409
        s.post(f"{API}/kitchen/orders/{pending['id']}/cancel", json={"reason": "TEST_cleanup"}, headers=oh)
        for bad in [0, 6, "x", None]:
            assert s.post(f"{API}/orders/{oid}/rating", json={"stars": bad}, headers=ch).status_code == 400
        # other customer cannot rate
        assert s.post(f"{API}/orders/{oid}/rating", json={"stars": 3}, headers=cust[0]).status_code == 404
        r = s.post(f"{API}/orders/{oid}/rating", json={"stars": 4, "comment": "TEST_tasty"}, headers=ch)
        assert r.status_code == 200, r.text
        assert r.json()["order"]["rating"]["stars"] == 4
        got = s.get(f"{API}/orders/{oid}", headers=ch).json()["order"]["rating"]
        assert got["stars"] == 4 and got["comment"] == "TEST_tasty"
        assert s.post(f"{API}/orders/{oid}/rating", json={"stars": 5}, headers=ch).status_code == 409

    def test_stats_shape(self, s, owner):
        oh, _ = owner
        r = s.get(f"{API}/kitchen/stats", headers=oh)
        assert r.status_code == 200
        d = r.json()
        for k in ["newOrders", "inProgress", "delivered", "cancelled", "revenue"]:
            assert isinstance(d["today"][k], (int, float))
        assert d["today"]["delivered"] >= 1 and d["today"]["cancelled"] >= 1
        assert 1 <= d["ratings"]["average"] <= 5 and d["ratings"]["count"] >= 1
        assert any(i["name"] == "Margherita" or i["name"] for i in d["ratings"]["items"])
        assert any(rv.get("comment") == "TEST_tasty" for rv in d["ratings"]["recent"])


# --- Favourites ---
class TestFavorites:
    def test_add_dedupe_remove(self, s, newcust):
        h, _ = newcust
        fav = {"kind": "menu", "key": "margherita", "name": "TEST_Margherita", "unitPrice": 14.9,
               "details": {"size": "large", "sizeName": 'Grande 14"'}}
        r = s.post(f"{API}/auth/favorites", json=fav, headers=h)
        assert r.status_code == 201
        n = len(r.json()["user"]["favorites"])
        r = s.post(f"{API}/auth/favorites", json=fav, headers=h)
        assert len(r.json()["user"]["favorites"]) == n
        r = s.post(f"{API}/auth/favorites", json={**fav, "details": {"size": "small", "sizeName": "x"}}, headers=h)
        favs = r.json()["user"]["favorites"]
        assert len(favs) == n + 1
        me = s.get(f"{API}/auth/me", headers=h).json()["user"]["favorites"]
        assert len(me) == n + 1
        r = s.delete(f"{API}/auth/favorites/{favs[0]['id']}", headers=h)
        assert r.status_code == 200 and len(r.json()["user"]["favorites"]) == n

    def test_invalid_and_max(self, s, newcust):
        h, _ = newcust
        assert s.post(f"{API}/auth/favorites", json={"name": "", "unitPrice": 5}, headers=h).status_code == 400
        assert s.post(f"{API}/auth/favorites", json={"name": "x", "unitPrice": -1}, headers=h).status_code == 400
        assert s.post(f"{API}/auth/favorites", json={"name": "x", "unitPrice": 5}).status_code == 401
        last = None
        for i in range(32):
            last = s.post(f"{API}/auth/favorites", json={"kind": "custom", "name": f"TEST_c{i}", "unitPrice": 10,
                                                        "details": {"size": "m", "i": i}}, headers=h)
        assert last.status_code == 400
        assert len(s.get(f"{API}/auth/me", headers=h).json()["user"]["favorites"]) == 30


# --- Sizeless items ---
class TestSizeless:
    def test_drinks_sides_details_null(self, s, newcust, owner):
        h, _ = newcust
        o = place(s, h, [{"type": "menu", "key": "cola", "size": "large", "qty": 2},
                         {"type": "menu", "key": "garlic-bread", "qty": 1},
                         {"type": "menu", "key": "margherita", "size": "small", "qty": 1}])
        by = {i["key"]: i for i in o["items"]}
        assert by["cola"]["details"] is None and by["cola"]["unitPrice"] == 2.9
        assert by["garlic-bread"]["details"] is None and by["garlic-bread"]["unitPrice"] == 6.5
        assert by["margherita"]["details"]["size"] == "small" and by["margherita"]["unitPrice"] == 7.9
        s.post(f"{API}/kitchen/orders/{o['id']}/cancel", json={"reason": "TEST_cleanup"}, headers=owner[0])
