"""Builds the Fornello project guide PDF.

Run:  PYTHONPATH=/tmp/pdfgen python3 /app/docs/generate_guide.py
Output: /app/docs/Fornello_Project_Guide.pdf (+ a copy served by the API at
        /api/images/docs/Fornello_Project_Guide.pdf)
"""
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

ROOT = Path("/app")
FONTS = ROOT / "frontend/assets/fonts"
OUT = ROOT / "docs/Fornello_Project_Guide.pdf"
PUBLIC_COPY = ROOT / "backend/public/docs/Fornello_Project_Guide.pdf"
PREVIEW_URL = "https://85fa60f4-d0d7-4d17-999b-a57c67dee47c.preview.emergentagent.com"

pdfmetrics.registerFont(TTFont("Display", str(FONTS / "playfair-700.ttf")))
pdfmetrics.registerFont(TTFont("Body", str(FONTS / "Satoshi-Regular.ttf")))
pdfmetrics.registerFont(TTFont("BodyMed", str(FONTS / "Satoshi-Medium.ttf")))
pdfmetrics.registerFont(TTFont("BodyBold", str(FONTS / "Satoshi-Bold.ttf")))

BRAND = colors.HexColor("#D95D39")
BRAND_DARK = colors.HexColor("#B54322")
BRAND_TINT = colors.HexColor("#FCECE6")
CREAM = colors.HexColor("#FDFBF7")
SAND = colors.HexColor("#F5EFE6")
BORDER = colors.HexColor("#E5DCD0")
INK = colors.HexColor("#2C2621")
MUTED = colors.HexColor("#7A6E63")
SUCCESS = colors.HexColor("#3B6D4F")

S = {
    "h1": ParagraphStyle("h1", fontName="Display", fontSize=22, leading=28, textColor=INK, spaceBefore=4, spaceAfter=10),
    "h2": ParagraphStyle("h2", fontName="Display", fontSize=15, leading=20, textColor=BRAND_DARK, spaceBefore=12, spaceAfter=6),
    "body": ParagraphStyle("body", fontName="Body", fontSize=10, leading=15, textColor=INK, spaceAfter=6, alignment=TA_LEFT),
    "muted": ParagraphStyle("muted", fontName="Body", fontSize=9, leading=13, textColor=MUTED, spaceAfter=4),
    "bullet": ParagraphStyle("bullet", fontName="Body", fontSize=10, leading=15, textColor=INK, leftIndent=12, bulletIndent=2, spaceAfter=2),
    "cell": ParagraphStyle("cell", fontName="Body", fontSize=9, leading=12.5, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName="BodyBold", fontSize=9, leading=12.5, textColor=INK),
    "cellh": ParagraphStyle("cellh", fontName="BodyBold", fontSize=9, leading=12.5, textColor=colors.white),
    "step": ParagraphStyle("step", fontName="Body", fontSize=10, leading=15, textColor=INK, leftIndent=18, firstLineIndent=-18, spaceAfter=3),
    "callout": ParagraphStyle("callout", fontName="BodyMed", fontSize=10, leading=15, textColor=INK),
}


def P(text, style="body"):
    return Paragraph(text, S[style])


def bullets(items):
    return [Paragraph(i, S["bullet"], bulletText="\u2022") for i in items]


def steps(items):
    return [Paragraph(f"<font name='BodyBold' color='#D95D39'>{n}.</font>&nbsp;&nbsp;{t}", S["step"]) for n, t in enumerate(items, 1)]


def table(rows, widths, header=True):
    data = []
    for r_i, row in enumerate(rows):
        style = "cellh" if header and r_i == 0 else "cell"
        data.append([c if not isinstance(c, str) else Paragraph(c, S[style]) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    cmds = [
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [colors.white, SAND]),
    ]
    if header:
        cmds.append(("BACKGROUND", (0, 0), (-1, 0), BRAND))
    t.setStyle(TableStyle(cmds))
    return t


def callout(text, bg=BRAND_TINT, edge=BRAND):
    t = Table([[Paragraph(text, S["callout"])]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 3, edge),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    if doc.page == 1:
        canvas.setFillColor(CREAM)
        canvas.rect(0, 0, w, h, stroke=0, fill=1)
        canvas.setFillColor(BRAND)
        canvas.rect(0, h - 14 * mm, w, 14 * mm, stroke=0, fill=1)
        canvas.rect(0, 0, w, 6 * mm, stroke=0, fill=1)
    else:
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.6)
        canvas.line(20 * mm, h - 15 * mm, w - 20 * mm, h - 15 * mm)
        canvas.setFont("BodyBold", 8.5)
        canvas.setFillColor(BRAND)
        canvas.drawString(20 * mm, h - 12.5 * mm, "FORNELLO ARTISAN PIZZA")
        canvas.setFont("Body", 8.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(w - 20 * mm, h - 12.5 * mm, "Project Documentation & User Guide")
        canvas.line(20 * mm, 15 * mm, w - 20 * mm, 15 * mm)
        canvas.drawString(20 * mm, 10 * mm, "Version 1.0  \u00b7  November 2026")
        canvas.drawRightString(w - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build():
    story = []

    # ---------- Cover ----------
    story += [Spacer(1, 30 * mm)]
    hero = ROOT / "backend/public/menu/wood-oven.jpg"
    if hero.exists():
        img = Image(str(hero), width=170 * mm, height=78 * mm)
        story += [img, Spacer(1, 12 * mm)]
    story += [
        P("<font name='BodyBold' color='#D95D39' size='10'>PROJECT DOCUMENTATION &amp; USER GUIDE</font>", "body"),
        Paragraph("Fornello Artisan Pizza", ParagraphStyle("cover", fontName="Display", fontSize=36, leading=42, textColor=INK, spaceAfter=8)),
        P("A Domino's-style pizza delivery and pizza shop mobile app with ordering, a custom pizza builder, cash-on-delivery "
          "checkout, live order tracking, favourites, ratings and a shop-owner Kitchen Dashboard.", "body"),
        Spacer(1, 10 * mm),
        table([
            ["Document", "Details"],
            ["Version", "1.0"],
            ["Date", "November 2026"],
            ["Platform", "iOS, Android (via Expo) and web preview"],
            ["Stack", "React Native (Expo) \u00b7 Node.js (Express) \u00b7 MongoDB"],
        ], [45 * mm, 125 * mm]),
        PageBreak(),
    ]

    # ---------- Contents ----------
    story += [P("Contents", "h1")]
    toc = [
        "1. Project overview", "2. Features", "3. Technology stack", "4. System architecture",
        "5. Data model", "6. API reference", "7. How to open the app", "8. Test accounts",
        "9. Customer walkthrough", "10. Kitchen (owner) walkthrough", "11. Full end-to-end test scenario",
        "12. Order status lifecycle", "13. Security", "14. Troubleshooting", "15. Roadmap",
    ]
    story += [P(t) for t in toc]
    story += [PageBreak()]

    # ---------- 1 Overview ----------
    story += [
        P("1. Project overview", "h1"),
        P("Fornello is a complete pizza delivery solution built for an independent pizza shop. Customers browse a "
          "wood-fired menu, customise pizzas, pay cash on delivery and follow their order live. The shop owner runs "
          "the kitchen from the same app: accepting or rejecting orders, moving them through each preparation step "
          "and reviewing customer ratings."),
        P("Goals", "h2"),
        *bullets([
            "Give customers a fast, professional ordering experience similar to Domino's.",
            "Give the shop owner full manual control of every order (no automatic timers).",
            "Collect ratings to show which pizzas customers love most.",
            "Keep the brand consistent with a warm artisan design (cream, burnt orange, editorial serif type).",
        ]),
        P("User roles", "h2"),
        table([
            ["Role", "Who", "What they can do"],
            ["Customer", "Anyone who registers in the app", "Browse menu, build pizzas, manage cart, check out (COD), track orders, rate delivered orders, save favourites and addresses."],
            ["Shop owner", "One special owner account (seeded on the server)", "Open the Kitchen Dashboard, accept / reject orders, advance order status, see today's stats and all ratings. Customers never see this screen."],
        ], [28 * mm, 50 * mm, 92 * mm]),
        PageBreak(),
    ]

    # ---------- 2 Features ----------
    story += [
        P("2. Features", "h1"),
        P("Customer app", "h2"),
        table([
            ["Area", "What it does"],
            ["Sign up / Login", "Email + password accounts. The session is remembered on the device."],
            ["Home", "Hero banner, category chips, 'Your favourites' row, 'Popular this week' row, full menu, cart badge, and a live banner for any active order."],
            ["Menu", "Search, category filter (Pizzas, Sides, Desserts, Drinks), 'Veg only' filter and an empty state with reset."],
            ["Item detail", "Large photo, description, veg / spicy badges, size choice (Personal 8\", Classic 11\", Grande 14\"), quantity, add to cart, heart to save as favourite."],
            ["Pizza builder", "Five steps: size, crust, sauce, cheese, 14 toppings. Live price, add to cart, heart to save the creation as a favourite."],
            ["Cart", "Quantity steppers, remove, promo codes (WELCOME10, FREEDEL), subtotal, delivery fee (free over $30), 5% tax, total."],
            ["Checkout", "Choose a saved address or add a new one (saved automatically), order notes, Cash on Delivery summary, Place order."],
            ["Order tracking", "Status banner and timeline that update live as the kitchen works, driver card with call button once out for delivery, cancellation reason if rejected."],
            ["Ratings", "After delivery: 1-5 stars plus an optional comment, once per order."],
            ["Orders", "Active orders with 'Track order'; past orders with status, rating, 'Rate this order' and one-tap 'Re-order'."],
            ["Profile", "Saved addresses (add / remove with confirmation), favourite pizzas (add to cart / remove), sign out."],
        ], [32 * mm, 138 * mm]),
        P("Kitchen Dashboard (shop owner)", "h2"),
        table([
            ["Area", "What it does"],
            ["Today's stats", "New orders, orders in progress, delivered today, revenue today."],
            ["Order queue", "Filters: New, In progress, Completed, Ratings. Each card shows items (with custom pizza details), notes, customer, address and amount to collect."],
            ["Step buttons", "Accept order \u2192 Start baking \u2192 Quality check \u2192 Send out for delivery \u2192 Mark delivered."],
            ["Reject / cancel", "Pick a reason (Out of ingredients, Kitchen too busy, Outside delivery area, Closing soon) and confirm. The customer sees the reason."],
            ["Ratings", "Overall average, menu items ranked by rating, latest reviews with comments."],
        ], [32 * mm, 138 * mm]),
        PageBreak(),
    ]

    # ---------- 3 Tech stack ----------
    story += [
        P("3. Technology stack", "h1"),
        table([
            ["Layer", "Technology", "Purpose"],
            ["Mobile app", "React Native 0.88 with Expo SDK 58", "One codebase for iOS, Android and web preview."],
            ["Navigation", "Expo Router (file-based) + bottom tabs", "Screens, tabs (Home, Menu, Orders, Profile) and stack screens."],
            ["Data fetching", "TanStack React Query", "Caching and live polling (order tracking, kitchen queue)."],
            ["UI", "expo-image, expo-linear-gradient, Ionicons, Reanimated", "Fast cached photos, gradients, icons, animations."],
            ["Forms & keyboard", "react-native-keyboard-controller", "Inputs stay visible above the keyboard."],
            ["Typography", "Playfair Display (headings), Satoshi (body)", "Editorial, artisan brand feel."],
            ["Device storage", "Expo SecureStore (tokens), AsyncStorage (cart)", "Secure login session, cart saved across restarts."],
            ["Backend", "Node.js 24 + Express 4", "REST API under /api."],
            ["Database", "MongoDB 7 + Mongoose 8", "Users, menu items and orders."],
            ["Authentication", "bcryptjs + JSON Web Tokens (30-day)", "Hashed passwords, signed sessions, owner role checks."],
            ["Security middleware", "helmet, cors, express-rate-limit", "Secure headers, cross-origin rules, login throttling."],
            ["Hosting gateway", "Python (FastAPI) proxy on port 8001", "Platform entry point that starts the Node server and forwards /api/* to it."],
        ], [32 * mm, 62 * mm, 76 * mm]),
        P("Design system", "h2"),
        table([
            ["Token", "Value", "Used for"],
            ["Cream surface", "#FDFBF7", "Screen backgrounds"],
            ["Burnt orange", "#D95D39", "Primary buttons, active chips, highlights"],
            ["Deep ember", "#B54322", "Links, secondary accents"],
            ["Ink", "#2C2621", "Main text"],
            ["Spacing", "4 / 8 / 12 / 16 / 24 / 32 / 48", "Consistent layout rhythm"],
            ["Radius", "6 / 12 / 20 / pill", "Cards, inputs, chips"],
        ], [40 * mm, 55 * mm, 75 * mm]),
        PageBreak(),
    ]

    # ---------- 4 Architecture ----------
    story += [
        P("4. System architecture", "h1"),
        P("Request flow", "h2"),
        table([
            ["Mobile app (Expo)", "\u2192", "/api/* over HTTPS", "\u2192", "Gateway (port 8001)", "\u2192", "Node.js API (port 8002)", "\u2192", "MongoDB"],
        ], [30 * mm, 6 * mm, 26 * mm, 6 * mm, 28 * mm, 6 * mm, 32 * mm, 6 * mm, 30 * mm], header=False),
        Spacer(1, 4 * mm),
        P("The hosting platform routes every <b>/api</b> request to port 8001. A small gateway there starts the Node.js "
          "server, restarts it if it stops, and forwards each request unchanged. All business logic lives in Node.js."),
        P("Project structure", "h2"),
        table([
            ["Path", "Contents"],
            ["backend/server.js", "Express app: security middleware, routes, MongoDB connection, menu seed, owner seed."],
            ["backend/src/auth.js", "Register, login, profile, addresses, favourites, requireAuth / requireOwner, owner seeding."],
            ["backend/src/menu.js", "Menu seed data (13 items) and menu endpoints."],
            ["backend/src/builder.js", "Custom pizza options and server-side pricing."],
            ["backend/src/orders.js", "Place order (server-priced), list / get own orders, rate an order."],
            ["backend/src/kitchen.js", "Owner-only queue, stats, advance status, cancel."],
            ["backend/src/promo.js", "Promo code rules and validation."],
            ["backend/public/menu", "Menu photography served at /api/images/menu/..."],
            ["frontend/app/(tabs)", "Home, Menu, Orders, Profile tabs."],
            ["frontend/app/*.tsx", "login, register, cart, checkout, builder, kitchen, item/[id], order/[id]."],
            ["frontend/src", "Theme tokens, API client, auth & cart state, shared components."],
        ], [50 * mm, 120 * mm]),
        PageBreak(),
    ]

    # ---------- 5 Data model ----------
    story += [
        P("5. Data model", "h1"),
        table([
            ["Collection", "Key fields"],
            ["users", "name, email (unique), passwordHash (never returned), phone, role (customer | owner), addresses[], favorites[]"],
            ["menuitems", "key, name, description, category (pizza | sides | desserts | drinks), veg, spicy, image, popular, basePrice, hasSizes"],
            ["orders", "number, user, items[] (type, name, qty, unitPrice, details), address, notes, paymentMethod (cod), promo, pricing (subtotal, discount, deliveryFee, tax, total), status, statusHistory[], driver, cancelReason, rating (stars, comment, at), deliveredAt"],
        ], [30 * mm, 140 * mm]),
        P("Pricing rules (calculated on the server)", "h2"),
        *bullets([
            "Menu pizzas: Personal = price - $3, Classic = menu price, Grande = price + $4. Sides, desserts and drinks have one price.",
            "Custom pizza: base $9.90 + size + crust + sauce + cheese + each topping.",
            "Delivery $2.99, free when the subtotal is $30 or more, or with FREEDEL.",
            "WELCOME10 takes 10% off the subtotal. Tax is 5% of (subtotal - discount).",
        ]),
        Spacer(1, 4 * mm),
        P("6. API reference", "h1"),
        table([
            ["Method & path", "Access", "Description"],
            ["POST /api/auth/register", "Public", "Create a customer account"],
            ["POST /api/auth/login", "Public", "Sign in, returns token + user"],
            ["GET / PUT /api/auth/me", "Signed in", "Read / update profile"],
            ["POST / DELETE /api/auth/addresses", "Signed in", "Add / remove a saved address"],
            ["POST / DELETE /api/auth/favorites", "Signed in", "Save / remove a favourite"],
            ["GET /api/menu", "Public", "Full menu"],
            ["GET /api/builder-config", "Public", "Custom pizza options and prices"],
            ["POST /api/promo/validate", "Public", "Check a promo code"],
            ["POST /api/orders", "Customer", "Place an order (Cash on Delivery)"],
            ["GET /api/orders, /api/orders/:id", "Customer", "Own orders only"],
            ["POST /api/orders/:id/rating", "Customer", "Rate a delivered order once"],
            ["GET /api/kitchen/orders?filter=", "Owner", "Queue: new | active | done"],
            ["GET /api/kitchen/stats", "Owner", "Today's numbers and ratings"],
            ["POST /api/kitchen/orders/:id/advance", "Owner", "Move the order to the next step"],
            ["POST /api/kitchen/orders/:id/cancel", "Owner", "Reject / cancel with a reason"],
        ], [62 * mm, 25 * mm, 83 * mm]),
        PageBreak(),
    ]

    # ---------- 7 Access ----------
    story += [
        P("7. How to open the app", "h1"),
        P("Option A - On your phone (recommended)", "h2"),
        *steps([
            "Install <b>Expo Go</b> from the App Store (iPhone) or Google Play (Android).",
            "In the Emergent workspace, scan the <b>QR code</b> shown beside the app preview panel.",
            "The app opens in Expo Go on the Fornello login screen.",
        ]),
        P("Option B - In a web browser (quick check)", "h2"),
        *steps([
            "Open the preview link (works while the development workspace is running):",
        ]),
        P(f"<font name='BodyMed' color='#B54322'>{PREVIEW_URL}</font>", "body"),
        *steps(["For the best result, use your browser's phone view (for example Chrome DevTools \u2192 device toolbar, iPhone size)."]),
        P("Option C - Production builds", "h2"),
        P("Click <b>Publish</b> (top right in Emergent) \u2192 deploy the app \u2192 generate the iOS and Android builds. "
          "After deployment, test the live version with the Expo Go QR code in the deployment panel."),
        callout("<b>Tip:</b> to test the customer and kitchen sides at the same time, sign in as the customer on your "
                "phone and as the owner in a web browser (or on a second phone)."),
        Spacer(1, 6 * mm),
        P("8. Test accounts", "h1"),
        table([
            ["Account", "Email", "Password", "Opens"],
            ["Shop owner (Kitchen)", "owner@fornello.com", "FornoKitchen2026", "Kitchen Dashboard"],
            ["Customer (demo)", "testy@fornello.com", "forno123", "Customer app (tabs)"],
            ["New customer", "Any email you like", "6+ characters", "Tap 'Create an account' on the login screen"],
        ], [40 * mm, 45 * mm, 35 * mm, 50 * mm]),
        Spacer(1, 3 * mm),
        table([
            ["Promo code", "Effect"],
            ["WELCOME10", "10% off the order subtotal"],
            ["FREEDEL", "Free delivery"],
        ], [40 * mm, 130 * mm]),
        Spacer(1, 3 * mm),
        callout("<b>How the app decides which screen to show:</b> after login the server returns the account's role. "
                "The owner account goes straight to the Kitchen Dashboard. Every other account sees the customer tabs. "
                "Customers who try to open /kitchen are sent back to Home, and the server refuses all kitchen requests "
                "from non-owner accounts."),
        PageBreak(),
    ]

    # ---------- 9 Customer walkthrough ----------
    story += [
        P("9. Customer walkthrough", "h1"),
        P("Sign in", "h2"),
        *steps([
            "Open the app. On the login screen enter <b>testy@fornello.com</b> / <b>forno123</b> and tap <b>Sign in</b>.",
            "Or tap <b>Create an account</b>, enter your name, email and a password (6+ characters).",
        ]),
        P("Order from the menu", "h2"),
        *steps([
            "On <b>Home</b>, tap a category chip or scroll the menu. Tap the orange <b>+</b> for a quick add (Classic size).",
            "Tap any pizza card to open its detail page, choose a size and quantity, then tap <b>Add</b>.",
            "Tap the <b>heart</b> on the detail page to save that pizza and size to your favourites.",
            "Use the <b>Menu</b> tab to search (for example 'truffle') or switch on <b>Veg only</b>.",
        ]),
        P("Build your own pizza", "h2"),
        *steps([
            "On Home tap <b>Build your pizza</b>.",
            "Pick size, crust, sauce, cheese and any toppings. The price at the bottom updates live.",
            "Tap the <b>heart</b> (top right) to save the creation, then <b>Add to cart</b>.",
        ]),
        P("Cart and checkout", "h2"),
        *steps([
            "Tap the cart icon (top right of Home). Adjust quantities with <b>-</b> / <b>+</b>.",
            "Type <b>WELCOME10</b> in the promo box and tap <b>Apply</b>. The discount appears in the totals.",
            "Tap <b>Go to checkout</b>. Choose a saved address or tap <b>Add a new address</b>.",
            "Add notes if you like, check the Cash on Delivery summary, then tap <b>Place order</b>.",
        ]),
        P("Track, rate and re-order", "h2"),
        *steps([
            "After placing the order you land on the tracking screen, showing <b>'Waiting for the kitchen'</b>.",
            "The status and timeline update by themselves as the owner works on the order (about every 4 seconds).",
            "When the order is delivered, a <b>'How was your pizza?'</b> card appears. Tap 1-5 stars, add a comment and tap <b>Submit rating</b>.",
            "The <b>Orders</b> tab lists active and past orders. Past orders show your rating, a <b>Rate this order</b> link or a cancellation reason, plus <b>Re-order</b>.",
            "Your saved favourites appear on Home ('Your favourites') and in <b>Profile</b>. Tap <b>+</b> to add one to the cart in one tap.",
        ]),
        PageBreak(),
    ]

    # ---------- 10 Kitchen walkthrough ----------
    story += [
        P("10. Kitchen (owner) walkthrough", "h1"),
        P("Sign in as the owner", "h2"),
        *steps([
            "On the login screen enter <b>owner@fornello.com</b> / <b>FornoKitchen2026</b> and tap <b>Sign in</b>.",
            "The <b>Kitchen</b> dashboard opens. The top cards show New, In progress, Delivered today and Revenue today (scroll them sideways).",
        ]),
        P("Handle an order", "h2"),
        *steps([
            "Under the <b>New</b> filter, new orders appear automatically (refreshes every 5 seconds) with an orange border.",
            "Read the items (custom pizzas show crust, sauce, cheese and toppings), notes, customer, address and the amount to collect.",
            "Tap <b>Accept order</b>. The order moves to <b>In progress</b>.",
            "Keep tapping the step button: <b>Start baking</b> \u2192 <b>Quality check</b> \u2192 <b>Send out for delivery</b> \u2192 <b>Mark delivered</b>.",
            "Finished orders appear under <b>Completed</b> along with any rating the customer left.",
        ]),
        P("Reject or cancel an order", "h2"),
        *steps([
            "Tap <b>Reject</b> on a new order (or <b>Cancel</b> on an accepted one, before it goes out for delivery).",
            "Choose a reason chip and tap <b>Reject order</b>, or tap <b>Keep order</b> to go back.",
            "The customer immediately sees a red 'Cancelled' banner with your reason.",
        ]),
        P("See what customers love", "h2"),
        *steps([
            "Tap the <b>Ratings</b> filter.",
            "See the overall average, menu items ranked by their average stars, and the latest reviews with comments.",
            "Tap the <b>sign-out</b> icon (top right) to leave the kitchen.",
        ]),
        PageBreak(),
    ]

    # ---------- 11 E2E scenario ----------
    story += [
        P("11. Full end-to-end test scenario", "h1"),
        P("Use two screens: <b>Screen 1</b> = customer (phone with Expo Go), <b>Screen 2</b> = owner (web browser)."),
        table([
            ["#", "Screen", "Action", "Expected result"],
            ["1", "Customer", "Sign in as testy@fornello.com", "Home with menu, favourites and popular rows"],
            ["2", "Customer", "Add a Grande Margherita + a custom pizza, apply WELCOME10", "Cart shows the 10% discount and correct total"],
            ["3", "Customer", "Checkout with a saved address, Place order", "Tracking screen: 'Waiting for the kitchen'"],
            ["4", "Owner", "Sign in as owner@fornello.com", "Kitchen dashboard, new order under 'New'"],
            ["5", "Owner", "Tap Accept order, then Start baking", "Customer tracking moves to 'In the wood-fired oven'"],
            ["6", "Owner", "Quality check \u2192 Send out for delivery", "Customer sees 'On its way' and the driver card"],
            ["7", "Owner", "Mark delivered", "Order moves to 'Completed'; revenue updates"],
            ["8", "Customer", "Give 5 stars + a comment, Submit", "Read-only rating card; Orders tab shows stars"],
            ["9", "Owner", "Open the Ratings filter", "New review listed; item ranking updated"],
            ["10", "Customer", "Place another order", "-"],
            ["11", "Owner", "Reject it with 'Out of ingredients'", "Customer sees the red Cancelled banner with that reason"],
            ["12", "Customer", "Orders tab \u2192 Re-order on a past order", "Items are added back to the cart"],
        ], [8 * mm, 20 * mm, 72 * mm, 70 * mm]),
        Spacer(1, 6 * mm),
        P("12. Order status lifecycle", "h1"),
        table([
            ["Status", "Customer sees", "Set by", "Owner button to reach it"],
            ["placed", "Waiting for the kitchen", "Customer (checkout)", "-"],
            ["confirmed", "Order accepted", "Owner", "Accept order"],
            ["baking", "In the wood-fired oven", "Owner", "Start baking"],
            ["quality_check", "Quality check", "Owner", "Quality check"],
            ["out_for_delivery", "On its way (+ driver card)", "Owner", "Send out for delivery"],
            ["delivered", "Delivered (+ rating form)", "Owner", "Mark delivered"],
            ["cancelled", "Cancelled + reason", "Owner", "Reject / Cancel (before out for delivery)"],
        ], [30 * mm, 45 * mm, 35 * mm, 60 * mm]),
        P("There is no automatic timer: an order only moves when the owner taps the next step.", "muted"),
        PageBreak(),
    ]

    # ---------- 13 Security ----------
    story += [
        P("13. Security", "h1"),
        *bullets([
            "Passwords are hashed with bcrypt and never sent back to the app.",
            "Sessions use signed JSON Web Tokens, stored in the phone's secure storage (Keychain / Keystore).",
            "Every order request checks the signed-in user. Customers can only see and rate their own orders.",
            "Kitchen endpoints require the owner role, which is re-checked in the database on every request. Registering can never create an owner.",
            "All prices are recalculated on the server, so prices changed in the app are ignored.",
            "Login and registration are rate-limited, and secure HTTP headers are set with helmet.",
            "The owner account is created once from server settings (OWNER_EMAIL / OWNER_PASSWORD). Restarts never overwrite its password.",
        ]),
        callout("<b>Before going live:</b> change the owner password and JWT secret in the deployment panel "
                "(Publish \u2192 Secrets) to private values. Do not share them."),
        Spacer(1, 6 * mm),
        P("14. Troubleshooting", "h1"),
        table([
            ["Problem", "What to do"],
            ["Login says 'Invalid email or password'", "Check the exact credentials in section 8 (passwords are case-sensitive)."],
            ["Owner login shows customer tabs", "Sign out and sign in again with owner@fornello.com. The role is read at login."],
            ["Tracking doesn't change", "The order moves only when the owner taps the next step in the Kitchen."],
            ["'Too many requests' at login", "The login limit was reached. Wait 15 minutes and try again."],
            ["Preview link doesn't open", "The development workspace may be asleep. Open the project in Emergent, or use the deployed version."],
            ["Photos don't appear", "Pull to refresh or reopen the screen. Images load from the server at /api/images."],
        ], [60 * mm, 110 * mm]),
        Spacer(1, 6 * mm),
        P("15. Roadmap", "h1"),
        *bullets([
            "Online card payments alongside Cash on Delivery.",
            "Loyalty points ('Forno Club') earned on every order.",
            "Kitchen menu management: change prices, hide sold-out items, add new pizzas.",
            "Store hours, delivery radius and live driver location on a map.",
            "Dark mode and multiple branches.",
        ]),
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=22 * mm, bottomMargin=22 * mm,
                            title="Fornello Artisan Pizza - Project Documentation & User Guide",
                            author="Fornello", subject="Project documentation")
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    PUBLIC_COPY.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(OUT, PUBLIC_COPY)
    print("written", OUT, OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    build()
