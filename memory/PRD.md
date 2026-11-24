# Fornello Artisan Pizza — PRD

## Original problem statement
Build a mobile app: create a pizza delivery and own pizza shop app like Domino's using React Native (frontend), Node.js (backend), MongoDB.

User choices: Node.js backend · full Domino's-style scope (menu, custom pizza builder, cart, checkout, live order tracking, order history) · Cash on Delivery only · warm artisan look (cream + burnt orange) · simple email sign-up/login · "make it professional".

## Architecture
- Frontend: Expo Router (React Native), TanStack Query, react-native-keyboard-controller, expo-image, Playfair Display + Satoshi fonts, theme tokens in `src/theme.ts`.
- Backend: Node.js / Express + Mongoose (`backend/server.js`, `backend/src/*`) on port 8002. The platform-managed `server.py` (uvicorn on 8001) starts and watches the Node process and forwards `/api/*` to it.
- Auth: bcrypt + JWT (30-day token), stored in SecureStore (native) or localStorage (web).
- Menu photos are served from `backend/public/menu` at `/api/images/menu/*`.

## Personas
- Hungry customer ordering delivery on their phone
- Pizza shop owner (future: an admin/kitchen view)

## Implemented (Nov 24, 2026)
- Email register/login, session restore, sign out (also clears the cart)
- Home: hero, category chips, popular row, full menu, cart badge, live active-order banner
- Menu: search, category filters, Veg only filter, empty state
- Item detail: size picker (Personal / Classic / Grande), quantity, add to cart
- Custom pizza builder: size, crust, sauce, cheese, 14 toppings, live price (server re-prices)
- Cart: quantity, remove, promo codes (WELCOME10, FREEDEL), delivery fee/free over $30, 5% tax
- Checkout: saved or new address (auto-saved, de-duplicated), notes, Cash on Delivery
- Live tracking: timeline placed → confirmed → baking → quality check → out for delivery → delivered (about 3.5 min demo), driver card with call button
- Orders history with Track and Re-order; Profile with saved addresses (remove needs confirmation)
- Security: protected order routes, passwords never returned, login rate limit

## Mocked
- Driver name/vehicle are demo data. Cash on Delivery only.

## Implemented — iteration 2 (Nov 24, 2026)
- Owner role + idempotent owner seed (OWNER_EMAIL/OWNER_PASSWORD); requireOwner re-checks role in DB
- Kitchen Dashboard (/kitchen): stats, New/In progress/Completed/Ratings filters, step-by-step advance, reject/cancel with reason
- Automatic status timer removed — only the owner moves orders
- Favourites (menu items per size + custom builds): heart on item/builder, Home row, Profile list, one-tap add
- Ratings: 1–5 stars + comment on delivered orders (once); kitchen ranking + recent reviews
- Project guide PDF: /app/docs/Fornello_Project_Guide.pdf (generator: /app/docs/generate_guide.py), served at /api/images/docs/Fornello_Project_Guide.pdf

## Known minor issues
- Rate limiter keys on first X-Forwarded-For (spoofable) and counts successful logins
- Order number = count+1001 (no unique index; rare race)
- Kitchen "today" uses server midnight; stat cards scroll sideways on small phones

## Backlog
- P0: Shop owner/kitchen dashboard to accept orders and update status manually
- P1: Online card payments, store locator / delivery radius, order rating
- P1: Loyalty points ("Forno Club") earned per order
- P2: Favourites, scheduled orders, dark mode
