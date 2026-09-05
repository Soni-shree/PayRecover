import os
import random
import time
import uuid
from collections import deque

import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request
from sklearn.ensemble import RandomForestClassifier
import razorpay
from dotenv import load_dotenv

load_dotenv(override=True)

app = Flask(__name__)

# --- Razorpay Setup ---
RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID', 'rzp_test_YourPlaceholderKeyId')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET', 'YourPlaceholderSecret')
rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# --- Configuration & Globals ---
FAILURE_REASONS = [
    'insufficient_funds', 
    'bank_server_timeout', 
    'otp_expired', 
    'card_declined_by_issuer', 
    'network_error', 
    'wallet_balance_low', 
    'npci_upi_downtime', 
    'gateway_latency_spike'
]

PAYMENT_METHODS = ['card', 'upi', 'netbanking', 'wallet']
ACTIONS = [
    'instant_retry', 
    'retry_with_otp_reminder', 
    'suggest_alternate_method', 
    'escalate_to_human', 
    'delayed_retry_24h', 
    'send_personalized_nudge'
]

MAX_QUEUE_SIZE = 20
transaction_queue = deque(maxlen=MAX_QUEUE_SIZE)
webhook_events = deque(maxlen=15)

model = None
feature_columns = None
model_accuracy = 0.0

# --- 1. Synthetic Data Generation ---
def generate_synthetic_data(num_samples=1500):
    np.random.seed(42)
    random.seed(42)
    
    data = []
    for _ in range(num_samples):
        reason = random.choice(FAILURE_REASONS)
        method = random.choice(PAYMENT_METHODS)
        amount = round(random.uniform(250.0, 18500.0), 2)
        retry_count = random.randint(0, 5)
        customer_age_days = random.randint(1, 3650)
        past_success_rate = round(random.uniform(0.0, 1.0), 2)
        hour_of_day = random.randint(0, 23)
        is_repeat_customer = 1 if past_success_rate > 0.5 else 0
        
        recovered = 0
        if reason in ['bank_server_timeout', 'network_error', 'gateway_latency_spike']:
            recovered = 1 if retry_count < 2 else 0
        elif reason == 'insufficient_funds':
            recovered = 1 if past_success_rate > 0.75 else 0
        elif reason in ['otp_expired', 'npci_upi_downtime']:
            recovered = 1 if hour_of_day >= 8 and hour_of_day <= 23 else 0
        else:
            recovered = np.random.choice([0, 1], p=[0.65, 0.35])
            
        data.append({
            'failure_reason': reason,
            'payment_method': method,
            'amount': amount,
            'retry_count': retry_count,
            'customer_age_days': customer_age_days,
            'past_success_rate': past_success_rate,
            'hour_of_day': hour_of_day,
            'is_repeat_customer': is_repeat_customer,
            'recovered': recovered
        })
    return pd.DataFrame(data)

# --- 2. Model Training ---
def train_model():
    global model, feature_columns, model_accuracy
    df = generate_synthetic_data(num_samples=2500)
    df_encoded = pd.get_dummies(df, columns=['failure_reason', 'payment_method'])
    X = df_encoded.drop('recovered', axis=1)
    y = df_encoded['recovered']
    feature_columns = X.columns.tolist()
    
    model = RandomForestClassifier(n_estimators=120, max_depth=8, random_state=42)
    model.fit(X, y)
    model_accuracy = model.score(X, y)

def preprocess_transaction(tx):
    df = pd.DataFrame([tx])
    df_encoded = pd.get_dummies(df, columns=['failure_reason', 'payment_method'])
    for col in feature_columns:
        if col not in df_encoded.columns:
            df_encoded[col] = 0
    return df_encoded[feature_columns]

# --- 3. Agent Decision Logic ---
def agent_decision(transaction, recovery_prob):
    reason = transaction.get('failure_reason')
    prob = recovery_prob
    amount = transaction.get('amount', 0)
    
    action = 'delayed_retry_24h'
    explanation = "Default fallback schedule initiated."

    if prob >= 0.75:
        if reason in ['bank_server_timeout', 'network_error', 'gateway_latency_spike']:
            action = 'instant_retry'
            explanation = f"High recovery confidence ({prob:.0%}) for transient gateway glitch on {reason.replace('_', ' ')}. Instant auto-retry triggered via Razorpay Direct API."
        elif reason == 'otp_expired':
            action = 'retry_with_otp_reminder'
            explanation = f"User session timed out ({prob:.0%}). Automated SMS & WhatsApp OTP reminder link generated for instant retry."
        elif reason == 'npci_upi_downtime':
            action = 'suggest_alternate_method'
            explanation = f"NPCI UPI server degraded. Prompting user to switch to Netbanking/Card payment with 1-click fallback ({prob:.0%})."
        else:
            action = 'send_personalized_nudge'
            explanation = f"High conversion probability ({prob:.0%}). Sending personalized discount nudge to complete checkout."
    elif prob >= 0.40:
        if reason in ['insufficient_funds', 'wallet_balance_low']:
            action = 'suggest_alternate_method'
            explanation = f"Moderate recovery rate ({prob:.0%}). Insufficient balance detected; recommending UPI Autopay / Credit Card EMI."
        elif reason == 'card_declined_by_issuer':
            action = 'suggest_alternate_method'
            explanation = f"Issuer bank declined card transaction. Recommending Instant UPI Intent or Netbanking."
        else:
            action = 'delayed_retry_24h'
            explanation = f"Moderate recovery odds ({prob:.0%}). Queueing transaction for off-peak batch retry in 24 hours."
    else:
        if transaction.get('is_repeat_customer') == 1 and amount > 3000:
            action = 'escalate_to_human'
            explanation = f"High-value VIP customer (₹{amount:,.2f}) at high risk of churn ({prob:.0%}). Routing to Priority Support Desk."
        else:
            action = 'delayed_retry_24h'
            explanation = f"Low probability ({prob:.0%}) for {reason.replace('_', ' ')}. Automated 24h follow-up email scheduled."

    return action, explanation

def log_webhook_event(event_type, details):
    webhook_events.appendleft({
        'id': f"evt_{str(uuid.uuid4())[:8]}",
        'timestamp': time.strftime("%H:%M:%S"),
        'type': event_type,
        'details': details
    })

def simulate_live_traffic():
    tx_id = str(uuid.uuid4())[:8]
    reason = random.choice(FAILURE_REASONS)
    method = random.choice(PAYMENT_METHODS)
    amount = round(random.uniform(500.0, 15000.0), 2)
    
    tx = {
        'id': tx_id,
        'failure_reason': reason,
        'payment_method': method,
        'amount': amount,
        'retry_count': random.randint(0, 3),
        'customer_age_days': random.randint(10, 1000),
        'past_success_rate': round(random.uniform(0.1, 1.0), 2),
        'hour_of_day': int(time.strftime("%H")),
        'is_repeat_customer': random.choice([0, 1]),
        'timestamp': time.strftime("%Y-%m-%d %H:%M:%S"),
        'status': 'PENDING'
    }
    
    X_pred = preprocess_transaction(tx)
    prob = model.predict_proba(X_pred)[0][1]
    action, explanation = agent_decision(tx, prob)
    
    transaction_queue.appendleft({
        'transaction': tx,
        'probability': prob,
        'action': action,
        'explanation': explanation,
        'status': 'PENDING'
    })
    
    log_webhook_event('payment.failed', f"TXN-{tx_id.upper()} failed ({reason.replace('_', ' ')}) - Amount ₹{amount:,.2f}")

# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/recovery')
def recovery():
    return render_template('recovery.html')

@app.route('/transactions')
def transactions():
    return render_template('transactions.html')

@app.route('/diagnostics')
def diagnostics():
    return render_template('diagnostics.html')

@app.route('/shop')
def shop():
    return render_template('shop.html', key_id=RAZORPAY_KEY_ID)

@app.route('/api/create-order', methods=['POST'])
def create_order():
    data = request.json or {}
    amount = data.get('amount', 5999) # Amount in rupees
    
    # Razorpay expects amount in paise
    order_amount = int(amount * 100)
    order_currency = 'INR'
    
    # Check for placeholder keys
    if RAZORPAY_KEY_ID.startswith('rzp_test_YourPlaceholder') or RAZORPAY_KEY_SECRET.startswith('YourPlaceholder'):
        return jsonify({'id': f"order_{str(uuid.uuid4())[:14]}", 'amount': order_amount, 'currency': order_currency})
        
    try:
        order = rzp_client.order.create(dict(amount=order_amount, currency=order_currency, payment_capture=1))
        return jsonify(order)
    except Exception as e:
        print("Razorpay Error:", str(e))
        return jsonify({'id': f"order_{str(uuid.uuid4())[:14]}", 'amount': order_amount, 'currency': order_currency, 'error': str(e)})

@app.route('/api/analyze-failure', methods=['POST'])
def analyze_failure():
    data = request.json or {}
    reason = data.get('failure_reason', 'network_error')
    amount = float(data.get('amount', 5999.0))
    tx_id = str(uuid.uuid4())[:8]
    
    tx = {
        'id': tx_id,
        'failure_reason': reason,
        'payment_method': data.get('payment_method', 'card'),
        'amount': amount,
        'retry_count': 1,
        'customer_age_days': 45,
        'past_success_rate': 0.85,
        'hour_of_day': int(time.strftime("%H")),
        'is_repeat_customer': 1,
        'timestamp': time.strftime("%Y-%m-%d %H:%M:%S"),
        'status': 'PENDING'
    }
    
    X_pred = preprocess_transaction(tx)
    prob = model.predict_proba(X_pred)[0][1]
    action, explanation = agent_decision(tx, prob)
    
    item = {
        'transaction': tx,
        'probability': prob,
        'action': action,
        'explanation': explanation,
        'status': 'PENDING'
    }
    transaction_queue.appendleft(item)
    log_webhook_event('payment.failed', f"Shop Checkout Failed: TXN-{tx_id.upper()} - ₹{amount:,.2f}")
    
    return jsonify({
        'id': tx_id,
        'action': action,
        'explanation': explanation,
        'probability': prob
    })

@app.route('/api/execute-action', methods=['POST'])
def execute_action():
    data = request.json or {}
    tx_id = data.get('tx_id')
    
    for item in transaction_queue:
        if item['transaction']['id'] == tx_id:
            item['status'] = 'RECOVERED'
            item['transaction']['status'] = 'RECOVERED'
            log_webhook_event('recovery.action_executed', f"AI Action '{item['action']}' executed for TXN-{tx_id.upper()}! Payment Recovered.")
            return jsonify({'success': True, 'tx_id': tx_id, 'status': 'RECOVERED'})
            
    return jsonify({'success': False, 'message': 'Transaction not found'}), 444

@app.route('/api/gateway-health')
def gateway_health():
    return jsonify({
        'gateways': [
            {'name': 'Razorpay Core API', 'status': 'Operational', 'latency': '142ms', 'success_rate': '99.4%'},
            {'name': 'HDFC Bank Payment Gateway', 'status': 'Operational', 'latency': '195ms', 'success_rate': '98.1%'},
            {'name': 'ICICI Netbanking', 'status': 'Degraded', 'latency': '420ms', 'success_rate': '89.5%'},
            {'name': 'NPCI UPI Stack', 'status': 'Operational', 'latency': '110ms', 'success_rate': '99.8%'},
            {'name': 'Paytm Wallet Hub', 'status': 'Operational', 'latency': '160ms', 'success_rate': '99.0%'}
        ]
    })

@app.route('/api/queue')
def api_queue():
    if random.random() > 0.4:
        simulate_live_traffic()
        
    queue_list = list(transaction_queue)
    total_at_risk = sum(item['transaction']['amount'] for item in queue_list if item.get('status') != 'RECOVERED')
    total_recovered = sum(item['transaction']['amount'] for item in queue_list if item.get('status') == 'RECOVERED')
    total_recoverable = sum(item['transaction']['amount'] * item['probability'] for item in queue_list if item.get('status') != 'RECOVERED')
    
    avg_recovery_rate = np.mean([item['probability'] for item in queue_list]) if queue_list else 0
    
    return jsonify({
        'queue': queue_list,
        'webhooks': list(webhook_events),
        'stats': {
            'revenue_at_risk': total_at_risk,
            'recoverable_revenue': total_recoverable,
            'recovered_revenue': total_recovered,
            'recovery_rate': avg_recovery_rate
        }
    })

@app.route('/api/predict', methods=['POST'])
def api_predict():
    data = request.json or {}
    tx = {
        'failure_reason': data.get('failure_reason', 'network_error'),
        'payment_method': data.get('payment_method', 'card'),
        'amount': float(data.get('amount', 5000.0)),
        'retry_count': int(data.get('retry_count', 0)),
        'customer_age_days': int(data.get('customer_age_days', 30)),
        'past_success_rate': float(data.get('past_success_rate', 0.5)),
        'hour_of_day': int(data.get('hour_of_day', 12)),
        'is_repeat_customer': int(data.get('is_repeat_customer', 0))
    }
    
    X_pred = preprocess_transaction(tx)
    prob = model.predict_proba(X_pred)[0][1]
    action, explanation = agent_decision(tx, prob)
    
    return jsonify({
        'probability': prob,
        'action': action,
        'explanation': explanation
    })

@app.route('/api/model-info')
def api_model_info():
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    top_features = []
    for i in range(min(6, len(feature_columns))):
        top_features.append({
            'feature': feature_columns[indices[i]],
            'importance': float(importances[indices[i]])
        })
        
    return jsonify({
        'accuracy': model_accuracy,
        'top_features': top_features
    })

if __name__ == '__main__':
    train_model()
    for _ in range(6):
        simulate_live_traffic()
    print("Starting PayRecover AI Production Server...")
    app.run(debug=True, port=5000)

