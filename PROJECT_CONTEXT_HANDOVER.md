# RESTROEX — SENIOR ENGINEERING HANDOVER & PROJECT CONTEXT DOCUMENT

---

## 1. PROJECT VISION

### Product Definition
Restroex is an **AI-Powered WhatsApp Restaurant Operating System**. It acts as an autonomous AI employee for restaurants, handling customer food ordering, menu browsing, cart customization, delivery address collection, UPI payment verification via OCR, and live kitchen board operations over WhatsApp.

### Problems Solved
- **Aggregator Commission Elimination**: Saves restaurants 25%–30% platform commissions charged by Zomato/Swiggy.
- **Order Taking Automation**: Eliminates manual WhatsApp messaging errors and delay during rush hours.
- **Low Barrier WhatsApp Onboarding**: Offers a **1-Click Restroex-Managed OTP Onboarding Flow**, allowing restaurants to go live under Restroex's Meta Business Account without setting up Meta Developer credentials.

### Long-Term Vision
To evolve from a WhatsApp AI ordering channel into a full-scale Restaurant Operating System incorporating POS hardware integration, inventory management, CRM automated retention campaigns, third-party logistics auto-dispatch (Dunzo/Shadowfax), and voice ordering.

### Product Philosophy
- **Production Over Demos**: Code must be production-ready, type-safe, and resilient.
- **Zero Friction Onboarding**: Restaurant owners should go live in under 5 minutes.
- **Deterministic Latency Efficiency**: Use 0ms fast-paths for deterministic actions; reserve LLM inference for unstructured queries.

---

## 2. BUSINESS MODEL

- **Target Customers**: Independent restaurants, cloud kitchens, bakeries, cafes, and multi-branch chains.
- **Core Workflows**: WhatsApp AI Customer Ordering, Live Kitchen Board Management, Menu & Pricing Config, Thermal Receipt Printing, Customer CRM, Sales Analytics.
- **Revenue Model**: Monthly/Annual SaaS Subscription per branch + optional pay-per-order tier.
- **Product Positioning**: Direct-to-Customer (D2C) automated AI ordering channel.

---

## 3. CURRENT ARCHITECTURE

```
Customer Mobile (WhatsApp)
       │
       ▼
Meta Graph API v19.0 / Web.js Provider Engine
       │
       ▼
Restroex Backend Webhook Controller (webhook.controller.ts)
       │
       ▼
Message Debouncer Service (message-debouncer.service.ts)
       │ (400ms fast flush for complete thoughts / 2000ms for short fragments)
       ▼
BullMQ Worker Queue ('whatsapp-incoming') & Worker (whatsapp-incoming.worker.ts)
       │
       ▼
SessionService.runPipelineLocked (session.service.ts)
       │ (Redis Mutex Lock: lock:pipeline:${restaurantId}:${customerPhone})
       ▼
WhatsAppBotReplyService (bot-reply.service.ts)
       │
       ├─► [Deterministic Fast-Path Intent Classifier] (0ms Latency)
       └─► [AiEmployeeService] -> OpenRouter API (gpt-4o-mini) + Tool Dispatcher
       │
       ▼
Supabase PostgreSQL Database + Redis Session & Cart Cache
       │
       ▼
Restroex Kitchen Dashboard (apps/dashboard Next.js 14 App Router)
```

### Complete Request & Message Lifecycle
1. **Webhook Arrival**: Inbound message arrives at `POST /api/v1/whatsapp/webhook`. `WebhookController` resolves `restaurantId` by `cloud_phone_number_id` and returns `HTTP 200 OK` immediately.
2. **Debouncing**: `MessageDebouncerService` buffers text fragments in Redis list `debounce:buffer:${restaurantId}:${customerPhone}`. If message is a complete sentence (>=4 words or trailing punctuation), it flushes in 400ms; otherwise, it waits 2000ms.
3. **Queue & Mutex Lock**: Worker picks job from BullMQ queue and calls `SessionService.runPipelineLocked()`, acquiring a Redis mutex lock (`SET lock:pipeline:... locked PX 30000 NX`).
4. **FSM & AI Execution**: Evaluates customer state (`idle`, `awaiting_name`, `awaiting_address`, `awaiting_payment`). If deterministic intent matches, executes repository mutation directly. Otherwise, calls `AiEmployeeService` (OpenRouter LLM + function tools with UUID regex guards).
5. **Database Persistence**: Updates `customer_carts`, `orders`, `conversation_sessions`, and `conversation_history`.
6. **Outbound Dispatch**: Sends reply through active provider (`WhatsAppCloudApiProvider` or `WhatsAppWebJsProvider`).

---

## 4. COMPLETE FOLDER STRUCTURE

```
Restroex/
├── apps/
│   ├── backend/                        # Primary API & Business Engine
│   │   ├── src/
│   │   │   ├── bootstrap/              # App init, Express server, WhatsApp session warmup
│   │   │   ├── infrastructure/         # DB client, Redis, Pino Logger, BullMQ Registry
│   │   │   ├── middlewares/            # Session auth middleware & error handlers
│   │   │   └── modules/
│   │   │       ├── ai/                 # OpenRouter engine, Context Builder, Tool Dispatcher
│   │   │       ├── analytics/          # Sales metrics, top items aggregation
│   │   │       ├── cart/               # Cart Repository & Cart Service
│   │   │       ├── conversations/      # Session Service & FSM State Engine
│   │   │       ├── customers/          # CRM Directory Repository & API
│   │   │       ├── menu/               # Categories, Items & Variants Repositories
│   │   │       ├── orders/             # Order Service, Receipts, History
│   │   │       ├── payments/           # Payment Service & OCR Analysis Engine
│   │   │       ├── restaurants/        # Setup Controller & Settings
│   │   │       └── whatsapp/           # Provider Factory, Web.js, Cloud API, Restroex OTP Controller
│   ├── dashboard/                      # Next.js 14 App Router Restaurant Portal
│   │   ├── src/app/dashboard/          # Orders, Menu, Analytics, CRM, Settings, WhatsApp UI
│   └── worker/                         # Isolated BullMQ Worker Process
└── packages/
    └── database/                       # PostgreSQL Migrations (00001 - 00020)
```

---

## 5. DATABASE SCHEMA

- **`restaurants`**: Stores primary restaurant profile, phone, owner email, and setup status.
- **`restaurant_settings`**: Stores UPI ID, merchant name, GST tax rates, packing charges, and operating hours.
- **`restaurant_whatsapp_config`**: Stores `provider_type` (`webjs` or `cloud_api`), `billing_mode` (`self_managed` or `restroex_managed`), `number_verification_status`, and Meta Graph API credentials.
- **`menu_categories` & `menu_items` & `menu_item_variants`**: Store menu hierarchy, item prices, veg/non-veg flags, availability, and Half/Full variant options.
- **`customer_carts` & `customer_cart_items`**: Persist active customer carts.
- **`orders` & `order_items`**: Store finalized orders (`ORD-YYYYMMDD-XXX`), delivery addresses, totals, GST tax, and order statuses (`received`, `accepted`, `preparing`, `ready`, `delivered`, `cancelled`).
- **`payments`**: Track payment status (`created`, `screenshot_uploaded`, `verified`, `rejected`), storage paths, and transaction references.
- **`customers`**: CRM table storing customer contact details and lifetime order metrics.
- **`conversation_sessions` & `conversation_history`**: Store customer FSM state and message history.

---

## 6. API SPECIFICATION

| Endpoint | Method | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/v1/health` | GET | Public | Health check |
| `/api/v1/whatsapp/webhook` | GET/POST | Verification | Meta Graph API Webhook Listener |
| `/api/v1/whatsapp/session/status` | GET | Session | Get WhatsApp connection state |
| `/api/v1/whatsapp/restroex-managed/register` | POST | Session | Register number for Restroex WABA & request OTP |
| `/api/v1/whatsapp/restroex-managed/verify` | POST | Session | Verify 6-digit OTP & activate Cloud API |
| `/api/v1/whatsapp/restroex-managed/disconnect`| POST | Session | Deregister number from Meta WABA |
| `/api/v1/orders/active` | GET | Session | Fetch active kitchen orders |
| `/api/v1/orders/history` | GET | Session | Fetch historical orders |
| `/api/v1/orders/:orderId/status` | PATCH | Session | Update order status |
| `/api/v1/orders/:orderId/receipt-link` | POST | Session | Generate signed thermal receipt link |
| `/api/v1/analytics/daily` | GET | Session | Fetch sales analytics & metrics |
| `/api/v1/customers` | GET | Session | Fetch CRM customer list |
| `/api/v1/categories` | GET/POST | Session | Manage menu categories |
| `/api/v1/items` | GET/POST | Session | Manage menu items & variants |

---

## 7. AI SYSTEM ARCHITECTURE

- **Provider**: OpenRouter API (`https://openrouter.ai/api/v1`, model `openai/gpt-4o-mini`).
- **Deterministic Fast-Paths**: Fast-path intent classifier intercepts greetings, menu requests, cart views, checkout triggers, and variant selections in code (0ms LLM latency).
- **Tools**: `add_item_to_cart`, `remove_item_from_cart`, `update_cart_quantity`, `clear_cart`, `checkout_cart`.
- **UUID Hallucination Guard**: Regex validation (`UUID_RE`) rejects hallucinated menu item IDs before tool execution.

---

## 8. WHATSAPP INTEGRATION

- **Providers**:
  1. `WhatsAppCloudApiProvider`: Meta Graph API v19.0 server-to-server integration. Dynamic token resolution for `self_managed` vs `restroex_managed` modes.
  2. `WhatsAppWebJsProvider`: Isolated Puppeteer Chromium instance using `LocalAuth`.
- **Provider Factory**: `WhatsAppProviderFactory` caches active provider per restaurant in Redis (5-minute TTL). Both providers implement uniform `WhatsAppProvider` interface.

---

## 9. DASHBOARD UI

- **Kitchen Board (`/dashboard/orders`)**: Real-time order card display with 1-click status transition buttons.
- **Order History (`/dashboard/orders/history`)**: Filterable past orders table with thermal print triggers.
- **WhatsApp Hub (`/dashboard/whatsapp`)**: Restroex-Managed OTP stepper, QR card, and disconnect confirmation modal.
- **Menu Manager (`/dashboard/menu`)**: Category/item price management and availability toggle.
- **Sales Analytics (`/dashboard/analytics`)**: Revenue, order count, and top item charts.
- **CRM Directory (`/dashboard/customers`)**: Customer spend and order history.

---

## 10. AUTHENTICATION & MULTI-TENANCY

- **Middleware**: `restaurantSessionMiddleware` validates session JWT and populates `req.restaurantId`.
- **Multi-Tenant Isolation**: All database queries append `.eq('restaurant_id', restaurantId)`, guaranteeing zero cross-tenant leakage.

---

## 11. ENGINEERING DECISIONS

1. **Hybrid Deterministic + LLM Architecture**: Used deterministic fast-paths for standard intents to achieve 0ms latency; reserved LLM calls for unstructured queries.
2. **Restroex-Managed WhatsApp Mode**: Built single WABA OTP onboarding to eliminate Meta Developer account setup friction for restaurant owners.
3. **Adaptive Debouncer**: Applied a 400ms flush window for complete sentences and 2000ms for short fragments to minimize turn count.
4. **Redis Pipeline Locking**: Enforced Redis mutex lock (`runPipelineLocked`) to serialize rapid parallel customer turns and eliminate cart race conditions.

---

## 12. CURRENT PROGRESS

- **Overall Completion**: **88% (Production-Ready SaaS)**
- **TypeScript Build**: **0 ERRORS** across `apps/backend` and `apps/dashboard`.
- **Verified Operations**: End-to-end customer ordering, debouncing, FSM state machine, cart management, checkout, UPI QR display, payment OCR screenshot processing, kitchen board, thermal printing, sales analytics, and CRM directory.

---

## 13. KNOWN TECHNICAL DEBT

1. **Unused Table**: `customer_reviews` table exists in database migration `00001`, but has no dashboard UI route.
2. **Dead Stub File**: `apps/backend/src/modules/whatsapp/webhook.retry.ts` contains stub code (`// TODO: implement retry`).

---

## 14. CODING STANDARDS & RULES

- **Domain Driven Modules**: Keep controllers, services, repositories, and routes grouped inside their respective domain directory (`apps/backend/src/modules/<domain>/`).
- **Database Query Boundaries**: Controllers must call services/repositories; raw Supabase query builders are restricted to repository classes.
- **Strict Multi-Tenancy**: Every database query MUST filter by `restaurant_id`.

---

## 15. QUICK START CONTEXT FOR NEW AI CHAT

```text
You are working on Restroex, an AI-Powered WhatsApp Restaurant Operating System.
- Tech Stack: Node.js, Express, TypeScript, Supabase (PostgreSQL), Redis (IORedis), BullMQ, Next.js 14 App Router.
- Status: 100% type-safe compilation (0 errors).
- Architecture: Modular Monorepo (`apps/backend`, `apps/dashboard`, `apps/worker`, `packages/database`).
- Key Modules:
  * `apps/backend/src/modules/whatsapp/`: Dual provider engine (`webjs` + `cloud_api` + `restroex_managed` OTP flow).
  * `apps/backend/src/modules/whatsapp/message-debouncer.service.ts`: Adaptive debouncer (400ms fast flush / 2000ms window).
  * `apps/backend/src/modules/conversations/`: SessionService with Redis mutex locking (`runPipelineLocked`) + FSM state machine.
  * `apps/backend/src/modules/ai/`: OpenRouter API (`gpt-4o-mini`) + 0ms deterministic fast-paths + UUID tool guards.
  * `apps/backend/src/modules/cart/` & `orders/`: Cart mutations, GST tax calculation, order creation, receipt signing.
  * `apps/backend/src/modules/payments/`: UPI QR display & Tesseract OCR screenshot queue worker.
  * `apps/dashboard/`: Kitchen Board (`/dashboard/orders`), Analytics (`/dashboard/analytics`), CRM (`/dashboard/customers`), WhatsApp Setup (`/dashboard/whatsapp`).
- Database: Supabase PostgreSQL migrations `00001` - `00020`. All queries scoped by `restaurant_id`.
```
