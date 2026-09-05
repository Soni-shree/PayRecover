# PayRecover Enterprise — Demo Walkthrough & Architecture

PayRecover is an autonomous revenue recovery engine for e-commerce merchants and payment gateways (Razorpay, Paytm). It intercepts payment declines in real-time, diagnoses root causes via machine learning telemetry, and executes optimal recovery workflows.

---

## 🖥️ Platform Navigation & Pages

### 1. **Overview Dashboard** (`/`)
- **Payment Recovery Journey**: 5-step transaction lifecycle bar (`Payment Failed` ➔ `Telemetry Ingestion` ➔ `Probability Evaluation` ➔ `Action Dispatch` ➔ `Revenue Recovered`).
- **Executive Metrics Grid**: Real-time *Revenue at Risk*, *Recoverable Revenue*, *Revenue Recovered*, and *Recovery Rate (%)*.
- **Recent Failures Ledger**: Real-time table streaming failed transactions with conversion probabilities and action triggers.

### 2. **Smart Recovery Console** (`/recovery`)
- **Telemetry Inspector**: Deep diagnostic pane displaying Transaction ID, Amount (₹), Payment Instrument, Bank Decline Reason, Retry Count, and Customer Profile.
- **Conversion Probability Gauge**: Visual probability meter dynamically computed by the Random Forest classifier.
- **Action Dispatcher**: 1-click execution to dispatch the targeted recovery action and immediately update the transaction ledger.

### 3. **Transactions Log** (`/transactions`)
- **Full Audit Ledger**: Complete tabular record of all processed transactions.
- **Filter Controls**: Instant filtering by status (`All Records`, `Pending Recovery`, `Recovered`).

### 4. **Merchant Checkout Demo** (`/shop`)
- **Simulated Storefront**: Minimal product cards with interactive checkout buttons (₹5,999, ₹12,499, ₹4,299).
- **Gateway Failure Simulation**: 1-click test buttons to simulate specific gateway declines (*Bank Server Timeout*, *NPCI UPI Downtime*, *OTP Expired*, *Insufficient Funds*, *Issuer Decline*, *Latency Spike*).
- **Recovery Modal**: Razorpay-styled intercept modal demonstrating the customer-facing resolution experience.

### 5. **System Telemetry & Diagnostics** (`/diagnostics`)
- **Bank Gateway Health**: Real-time latency and uptime monitors for Core Gateway Switch, HDFC Bank, ICICI Netbanking, and NPCI UPI.
- **Webhook Feed**: Live streaming log of webhook events and dispatched recovery actions.
- **Feature Attribution (SHAP)**: Top features driving model recovery predictions.
- **Scenario Sandbox**: Custom parameter tester for simulating hypothetical transaction variables.

---

## 🎨 Design System
- **Aesthetic**: Minimalist Razorpay / Paytm fintech theme.
- **Palette**: Deep Navy (`#0c2340`) sidebar, Razorpay Blue (`#0c83ff`) brand accent, neutral slate canvas (`#f6f8fb`), and crisp white card containers (`#ffffff`).
- **Typography & Icons**: Clean Inter font with tabular figures, inline SVG icons, and soft-tinted status pills.
