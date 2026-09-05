# PayRecover — Autonomous Payment Recovery Engine

> **Agentic revenue recovery system for failed payment transactions.**  
> Built with real-time ML telemetry, automated failure intercepts, and an enterprise merchant console.

---

## 📌 Problem Statement

Every year, e-commerce merchants and digital businesses lose up to **15% to 20% of their Gross Merchandise Value (GMV)** due to failed payment transactions. Common causes include:
- Issuing bank timeouts & latency spikes
- NPCI UPI stack downtime
- OTP expiration and user friction
- False-positive card declines & low wallet balances

When a checkout fails, traditional gateways return a generic error screen, leading to permanent customer churn and lost revenue.

---

## 💡 Solution: PayRecover

**PayRecover** intercepts payment failure webhooks in real time, diagnoses root causes using a trained machine learning telemetry classifier, evaluates conversion recovery odds, and automatically executes optimal recovery workflows (instant route fallbacks, smart OTP nudges, alternate payment rails, or VIP escalation) before the customer leaves the checkout page.

---

## ✨ Key Features

- **⚡ Real-Time ML Telemetry Classifier (`RandomForestClassifier`)**:
  Predicts the exact conversion probability for each failed transaction based on bank error codes, retry counts, time-of-day, past conversion rate, and customer segmentation.
- **🤖 Autonomous Decision Engine**:
  Maps failure causes to targeted recovery actions (`instant_retry`, `retry_with_otp_reminder`, `suggest_alternate_method`, `delayed_retry_24h`, `send_personalized_nudge`, `escalate_to_human`).
- **📊 Enterprise Merchant Console (Razorpay / Paytm Aesthetic)**:
  - **Overview**: Real-time GMV at risk, recoverable revenue, recovered totals, and 5-step recovery lifecycle.
  - **Smart Recovery Console**: Deep telemetry inspector with probability gauge and 1-click execution.
  - **Checkout Testbed**: Simulated e-commerce checkout with live Razorpay SDK modal integration and failure scenario triggers.
  - **Transactions Ledger**: Real-time transaction audit table with status filters.
  - **System Telemetry & Diagnostics**: Gateway uptime monitors (HDFC, ICICI, NPCI) and SHAP feature attribution weights.

---

## 🛠️ Architecture & Recovery Lifecycle

```
[ Customer Checkout ] ➔ [ Payment Failure Event ]
                               │
                               ▼
            [ PayRecover Telemetry Ingestion Engine ]
                               │
                               ▼
               [ Scikit-Learn ML Classifier ]
         (Evaluates Recovery Probability: 0% - 100%)
                               │
                               ▼
               [ Optimal Action Dispatcher ]
       (Instant Fallback / OTP Reminder / Alternate Rail)
                               │
                               ▼
        [ Revenue Recovered & Ledger Updated in Real-Time ]
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- Python 3.9+ installed
- Git

### 1. Clone Repository
```bash
git clone https://github.com/your-username/payrecover.git
cd payrecover
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and add your Razorpay test keys:
```bash
cp .env.example .env
```
Edit `.env`:
```env
RAZORPAY_KEY_ID=rzp_test_YourKeyHere
RAZORPAY_KEY_SECRET=YourSecretKeyHere
```
*(Note: If left as placeholders, the app automatically runs in simulated offline sandbox mode).*

### 4. Start the Application
```bash
python app.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

---

## 📁 Project Structure

```
payrecover-ai/
├── app.py                   # Flask backend, ML model training & REST API routes
├── requirements.txt         # Python dependencies
├── .env.example             # Environment variable template
├── .gitignore               # Git ignore rules for secrets and cache
├── README.md                # Project documentation
├── static/
│   ├── style.css            # Enterprise fintech design system (Razorpay/Paytm)
│   ├── script.js            # Live dashboard polling, charts & action handlers
│   ├── shop.css             # Checkout simulator styling & modal
│   └── shop.js              # Razorpay checkout SDK & failure simulation
└── templates/
    ├── index.html           # Overview dashboard & executive metrics
    ├── recovery.html        # Smart Recovery spotlight console
    ├── transactions.html    # Transactions ledger & audit log
    ├── shop.html            # Checkout demo & failure trigger panel
    └── diagnostics.html     # Gateway telemetry & feature attribution
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/queue` | `GET` | Fetches live failure queue, executive stats, and webhook logs |
| `/api/predict` | `POST` | Runs ML inference on custom transaction variables |
| `/api/execute-action` | `POST` | Dispatches recovery action and updates transaction status |
| `/api/model-info` | `GET` | Returns baseline accuracy score and top feature importances |
| `/api/gateway-health` | `GET` | Returns live latency and uptime of payment switches |
| `/api/create-order` | `POST` | Creates a Razorpay checkout order |
| `/api/analyze-failure` | `POST` | Intercepts gateway decline and computes recovery odds |

---

## 📄 License
MIT License. Built for fintech developers and merchants.
