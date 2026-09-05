document.addEventListener('DOMContentLoaded', () => {
    const buyBtns = document.querySelectorAll('.btn-buy');
    buyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const amount = parseFloat(e.currentTarget.getAttribute('data-amount') || '5999');
            const name = e.currentTarget.getAttribute('data-name') || 'Tech Item';
            handleCheckout(amount, name);
        });
    });

    const simButtons = document.querySelectorAll('.sim-btn');
    simButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const reason = e.currentTarget.getAttribute('data-reason');
            triggerPayRecoverAI(reason, 5999);
        });
    });

    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            document.getElementById('recoveryModal').classList.add('hidden');
        });
    }

    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', async (e) => {
            const txId = e.currentTarget.getAttribute('data-txid');
            if (txId) {
                e.currentTarget.textContent = "Executing Recovery...";
                try {
                    const res = await fetch('/api/execute-action', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ tx_id: txId })
                    });
                    const data = await res.json();
                    if (data.success) {
                        e.currentTarget.textContent = "Recovery Dispatched";
                        e.currentTarget.style.backgroundColor = "var(--success)";
                        setTimeout(() => {
                            document.getElementById('recoveryModal').classList.add('hidden');
                        }, 1200);
                    }
                } catch (err) {
                    console.error("Error executing action:", err);
                }
            } else {
                document.getElementById('recoveryModal').classList.add('hidden');
            }
        });
    }
});

async function handleCheckout(amount = 5999, productName = 'Tech Device') {
    try {
        const res = await fetch('/api/create-order', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ amount: amount })
        });
        const order = await res.json();
        
        var options = {
            "key": RAZORPAY_KEY_ID, 
            "amount": order.amount, 
            "currency": order.currency,
            "name": "TechStore Direct",
            "description": productName,
            "order_id": order.id,
            "handler": function (response){
                alert("Payment Successful. Payment ID: " + response.razorpay_payment_id);
            },
            "prefill": {
                "name": "Soni Mishra",
                "email": "soni@example.com",
                "contact": "9999999999"
            },
            "theme": {
                "color": "#0c83ff"
            }
        };
        
        var rzp = new Razorpay(options);
        
        rzp.on('payment.failed', function (response){
            let reason = response.error.reason || 'network_error';
            triggerPayRecoverAI(reason, amount);
        });

        rzp.open();
        
        // Demo fallback if using placeholder keys
        if (RAZORPAY_KEY_ID.startsWith('rzp_test_YourPlaceholder')) {
            const reasons = ['bank_server_timeout', 'npci_upi_downtime', 'otp_expired', 'insufficient_funds'];
            const randomReason = reasons[Math.floor(Math.random() * reasons.length)];
            setTimeout(() => {
                try { rzp.close(); } catch(e){}
                triggerPayRecoverAI(randomReason, amount);
            }, 1200);
        }
        
    } catch (err) {
        console.error("Checkout error:", err);
    }
}

async function triggerPayRecoverAI(reason, amount = 5999) {
    try {
        const res = await fetch('/api/analyze-failure', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                failure_reason: reason,
                amount: amount,
                payment_method: 'card'
            })
        });
        const data = await res.json();
        
        const modal = document.getElementById('recoveryModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalReason = document.getElementById('modalReason');
        const modalExplanation = document.getElementById('modalExplanation');
        const modalProb = document.getElementById('modalProb');
        const retryBtn = document.getElementById('retryBtn');
        
        if (modalTitle) modalTitle.textContent = "Payment Intercepted";
        if (modalReason) modalReason.textContent = `Reason: ${reason.replace(/_/g, ' ')}`;
        if (modalExplanation) modalExplanation.textContent = data.explanation;
        if (modalProb) modalProb.textContent = `${(data.probability * 100).toFixed(1)}%`;
        
        if (retryBtn) {
            retryBtn.textContent = `Dispatch Action: ${data.action.replace(/_/g, ' ')}`;
            retryBtn.style.backgroundColor = "var(--primary)";
            retryBtn.setAttribute('data-txid', data.tx_id);
        }
        
        modal.classList.remove('hidden');
    } catch (err) {
        console.error("Recovery analysis error:", err);
    }
}
