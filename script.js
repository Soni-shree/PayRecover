document.addEventListener('DOMContentLoaded', () => {
    fetchGatewayHealth();
    fetchModelInfo();
    fetchQueue();
    
    // Poll queue every 3 seconds, gateway health every 15 seconds
    setInterval(fetchQueue, 3000);
    setInterval(fetchGatewayHealth, 15000);

    const form = document.getElementById('predictForm');
    if (form) form.addEventListener('submit', handlePredictSubmit);

    const filter = document.getElementById('statusFilter');
    if (filter) filter.addEventListener('change', fetchQueue);

    const selector = document.getElementById('spotlightSelector');
    if (selector) selector.addEventListener('change', (e) => renderSpotlightCard(e.target.value));
});

let cachedQueueData = [];
let currentSpotlightId = null;

function formatINR(val) {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function fetchGatewayHealth() {
    try {
        const res = await fetch('/api/gateway-health');
        const data = await res.json();
        
        const ticker = document.getElementById('gatewayTicker');
        if (!ticker) return;
        
        ticker.innerHTML = '';
        data.gateways.forEach(gw => {
            const isOk = gw.status === 'Operational';
            const statClass = isOk ? 'ok' : 'deg';
            
            const div = document.createElement('div');
            div.className = 'gw-item';
            div.innerHTML = `
                <span class="gw-name">${gw.name}:</span>
                <span class="gw-stat ${statClass}">${gw.status}</span>
                <span class="gw-lat">(${gw.latency})</span>
            `;
            ticker.appendChild(div);
        });
    } catch (err) {
        console.error("Error fetching gateway health:", err);
    }
}

async function fetchModelInfo() {
    try {
        const res = await fetch('/api/model-info');
        const data = await res.json();
        
        const accuracyEl = document.getElementById('modelAccuracy');
        if (accuracyEl) {
            accuracyEl.textContent = `Baseline Recovery Score: ${(data.accuracy * 100).toFixed(1)}%`;
        }

        const featureList = document.getElementById('featureList');
        if (!featureList) return;
        
        featureList.innerHTML = '';
        data.top_features.forEach(f => {
            const li = document.createElement('li');
            
            let name = f.feature.replace('failure_reason_', '').replace('payment_method_', '');
            name = name.replace(/_/g, ' ').toUpperCase();
            
            li.innerHTML = `
                <span>${name}</span>
                <span style="color: var(--primary); font-weight: 600; font-family: var(--font-mono);">${(f.importance * 100).toFixed(1)}%</span>
            `;
            featureList.appendChild(li);
        });
    } catch (err) {
        console.error("Error fetching model info:", err);
    }
}

async function executeAction(txId, btnElement) {
    if (!btnElement) btnElement = document.getElementById('heroExecuteBtn');
    if (btnElement) {
        btnElement.disabled = true;
        btnElement.textContent = "Executing...";
    }
    
    try {
        const res = await fetch('/api/execute-action', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ tx_id: txId })
        });
        const data = await res.json();
        
        if (data.success) {
            if (btnElement) {
                btnElement.textContent = "Recovered";
                btnElement.style.backgroundColor = "var(--success)";
            }
            await fetchQueue();
        } else {
            if (btnElement) {
                btnElement.textContent = "Execution Failed";
                btnElement.disabled = false;
            }
        }
    } catch (err) {
        console.error("Error executing action:", err);
        if (btnElement) {
            btnElement.textContent = "Error Executing";
            btnElement.disabled = false;
        }
    }
}

async function fetchQueue() {
    try {
        const res = await fetch('/api/queue');
        const data = await res.json();
        cachedQueueData = data.queue || [];
        
        // 1. Update Executive Stats
        const riskEl = document.getElementById('statAtRisk');
        const recovEl = document.getElementById('statRecoverable');
        const recovTodayEl = document.getElementById('statRecovered');
        const rateEl = document.getElementById('statRecoveryRate');
        
        if (riskEl) riskEl.textContent = formatINR(data.stats.revenue_at_risk);
        if (recovEl) recovEl.textContent = formatINR(data.stats.recoverable_revenue);
        if (recovTodayEl) recovTodayEl.textContent = formatINR(data.stats.recovered_revenue || 0);
        if (rateEl) rateEl.textContent = `${(data.stats.recovery_rate * 100).toFixed(1)}%`;
        
        // 2. Update Webhooks Log (Developer Zone)
        const webhookFeed = document.getElementById('webhookFeed');
        if (webhookFeed && data.webhooks) {
            webhookFeed.innerHTML = '';
            data.webhooks.forEach(evt => {
                const div = document.createElement('div');
                const isAction = evt.type.includes('action');
                div.className = `wh-item ${isAction ? 'action' : ''}`;
                div.innerHTML = `
                    <span class="wh-time">${evt.timestamp}</span>
                    <span class="wh-type">[${evt.type}]</span>
                    <span class="wh-details">${evt.details}</span>
                `;
                webhookFeed.appendChild(div);
            });
        }

        // 3. Render Overview Table
        renderOverviewTable(cachedQueueData);

        // 4. Render Spotlight Feature
        renderSpotlightPage(cachedQueueData);

        // 5. Render Transactions Queue
        renderTransactionsQueue(cachedQueueData);

    } catch (err) {
        console.error("Error fetching queue:", err);
    }
}

function renderOverviewTable(items) {
    const tableBody = document.getElementById('overviewQueueTable');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    items.slice(0, 10).forEach(item => {
        const tx = item.transaction;
        const prob = item.probability;
        const status = item.status || 'PENDING';
        const isRecovered = status === 'RECOVERED';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="font-mono font-bold">TXN-${tx.id.toUpperCase()}</td>
            <td class="font-bold">${formatINR(tx.amount)}</td>
            <td><span class="status-badge failure">${tx.failure_reason.replace(/_/g, ' ')}</span></td>
            <td><span class="status-badge neutral">${tx.payment_method.toUpperCase()}</span></td>
            <td>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <div style="width:45px; background:var(--border-subtle); height:5px; border-radius:3px; overflow:hidden;">
                        <div style="width:${prob * 100}%; background:${prob >= 0.7 ? 'var(--success)' : 'var(--warning)'}; height:100%;"></div>
                    </div>
                    <span class="font-mono" style="font-size:0.75rem; font-weight:600;">${(prob * 100).toFixed(0)}%</span>
                </div>
            </td>
            <td style="font-weight:500; color:var(--text-main);">${item.action.replace(/_/g, ' ')}</td>
            <td>
                <span class="status-badge ${isRecovered ? 'success' : 'warning'}">
                    ${isRecovered ? 'RECOVERED' : 'PENDING'}
                </span>
            </td>
            <td>
                ${isRecovered 
                    ? `<button class="btn-action-trigger" disabled style="opacity:0.7;">Recovered</button>`
                    : `<button class="btn-action-trigger" onclick="executeAction('${tx.id}', this)">Execute</button>`}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderSpotlightPage(items) {
    const selector = document.getElementById('spotlightSelector');
    if (!selector) return;

    const currentVal = selector.value;
    selector.innerHTML = '';
    items.forEach(item => {
        const tx = item.transaction;
        const opt = document.createElement('option');
        opt.value = tx.id;
        opt.textContent = `TXN-${tx.id.toUpperCase()} (${formatINR(tx.amount)} - ${item.action.replace(/_/g, ' ')})`;
        if (tx.id === currentVal) opt.selected = true;
        selector.appendChild(opt);
    });

    if (!currentSpotlightId || !items.find(i => i.transaction.id === currentSpotlightId)) {
        currentSpotlightId = items[0] ? items[0].transaction.id : null;
    }
    if (selector.value !== currentSpotlightId && currentSpotlightId) {
        selector.value = currentSpotlightId;
    }

    renderSpotlightCard(currentSpotlightId);
    renderSpotlightTable(items);
}

function renderSpotlightCard(txId) {
    if (!txId || !cachedQueueData.length) return;
    currentSpotlightId = txId;

    const item = cachedQueueData.find(i => i.transaction.id === txId) || cachedQueueData[0];
    if (!item) return;

    const tx = item.transaction;
    const prob = item.probability;
    const status = item.status || 'PENDING';
    const isRecovered = status === 'RECOVERED';

    const heroAmount = document.getElementById('heroAmount');
    const heroTxId = document.getElementById('heroTxId');
    const heroMethod = document.getElementById('heroMethod');
    const heroReason = document.getElementById('heroReason');
    const heroRetries = document.getElementById('heroRetries');
    const heroSegment = document.getElementById('heroSegment');
    const heroAction = document.getElementById('heroAction');
    const heroProb = document.getElementById('heroProb');
    const heroProbBar = document.getElementById('heroProbBar');
    const heroExplanation = document.getElementById('heroExplanation');
    const heroExecuteBtn = document.getElementById('heroExecuteBtn');

    if (heroAmount) heroAmount.textContent = formatINR(tx.amount);
    if (heroTxId) heroTxId.textContent = `TXN-${tx.id.toUpperCase()}`;
    if (heroMethod) heroMethod.textContent = tx.payment_method.toUpperCase();
    if (heroReason) heroReason.textContent = tx.failure_reason.replace(/_/g, ' ');
    if (heroRetries) heroRetries.textContent = `${tx.retry_count} attempts`;
    if (heroSegment) heroSegment.textContent = tx.is_repeat_customer ? 'Repeat Customer' : 'First Time Customer';

    if (heroAction) heroAction.textContent = item.action.replace(/_/g, ' ');
    if (heroProb) heroProb.textContent = `${(prob * 100).toFixed(1)}%`;
    if (heroProbBar) {
        heroProbBar.style.width = `${prob * 100}%`;
        heroProbBar.style.background = isRecovered ? 'var(--success)' : (prob >= 0.7 ? 'var(--success)' : 'var(--primary)');
    }
    if (heroExplanation) heroExplanation.textContent = item.explanation;

    if (heroExecuteBtn) {
        if (isRecovered) {
            heroExecuteBtn.disabled = true;
            heroExecuteBtn.textContent = "Action Executed & Recovered";
            heroExecuteBtn.style.background = "var(--success)";
        } else {
            heroExecuteBtn.disabled = false;
            heroExecuteBtn.textContent = `Execute Action: ${item.action.replace(/_/g, ' ')}`;
            heroExecuteBtn.style.background = "var(--primary)";
            heroExecuteBtn.onclick = () => executeAction(tx.id, heroExecuteBtn);
        }
    }
}

function renderSpotlightTable(items) {
    const tableBody = document.getElementById('spotlightQueueTable');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    items.forEach(item => {
        const tx = item.transaction;
        const prob = item.probability;
        const status = item.status || 'PENDING';
        const isRecovered = status === 'RECOVERED';
        const isSelected = tx.id === currentSpotlightId;

        const row = document.createElement('tr');
        if (isSelected) row.style.background = 'var(--primary-light)';
        row.style.cursor = 'pointer';

        row.innerHTML = `
            <td class="font-mono font-bold">TXN-${tx.id.toUpperCase()}</td>
            <td class="font-bold">${formatINR(tx.amount)}</td>
            <td><span class="status-badge failure">${tx.failure_reason.replace(/_/g, ' ')}</span></td>
            <td><span class="status-badge neutral">${tx.payment_method.toUpperCase()}</span></td>
            <td class="font-mono">${(prob * 100).toFixed(1)}%</td>
            <td style="font-weight:500; color:var(--text-main);">${item.action.replace(/_/g, ' ')}</td>
            <td>
                <span class="status-badge ${isRecovered ? 'success' : 'warning'}">
                    ${isRecovered ? 'RECOVERED' : 'PENDING'}
                </span>
            </td>
            <td>
                <button class="btn-action-trigger" onclick="event.stopPropagation(); renderSpotlightCard('${tx.id}'); document.getElementById('spotlightSelector').value='${tx.id}';">
                    ${isSelected ? 'Selected' : 'Inspect'}
                </button>
            </td>
        `;

        row.addEventListener('click', () => {
            renderSpotlightCard(tx.id);
            const sel = document.getElementById('spotlightSelector');
            if (sel) sel.value = tx.id;
        });

        tableBody.appendChild(row);
    });
}

function renderTransactionsQueue(items) {
    const filterVal = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : 'ALL';
    
    const tableBody = document.getElementById('transactionsTable');
    if (tableBody) {
        tableBody.innerHTML = '';
        items.forEach(item => {
            const tx = item.transaction;
            const prob = item.probability;
            const status = item.status || 'PENDING';
            const isRecovered = status === 'RECOVERED';

            if (filterVal !== 'ALL' && status !== filterVal) return;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="font-mono font-bold">TXN-${tx.id.toUpperCase()}</td>
                <td class="font-bold">${formatINR(tx.amount)}</td>
                <td><span class="status-badge failure">${tx.failure_reason.replace(/_/g, ' ')}</span></td>
                <td><span class="status-badge neutral">${tx.payment_method.toUpperCase()}</span></td>
                <td class="font-mono">${tx.retry_count}</td>
                <td class="font-mono">${(prob * 100).toFixed(1)}%</td>
                <td style="font-weight:500; color:var(--text-main);">${item.action.replace(/_/g, ' ')}</td>
                <td>
                    <span class="status-badge ${isRecovered ? 'success' : 'warning'}">
                        ${isRecovered ? 'RECOVERED' : 'PENDING'}
                    </span>
                </td>
                <td>
                    ${isRecovered 
                        ? `<button class="btn-action-trigger" disabled style="opacity:0.7;">Recovered</button>`
                        : `<button class="btn-action-trigger" onclick="executeAction('${tx.id}', this)">Execute</button>`}
                </td>
            `;
            tableBody.appendChild(row);
        });
        return;
    }
}

async function handlePredictSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    data.amount = parseFloat(data.amount);
    data.retry_count = parseInt(data.retry_count);
    
    try {
        const res = await fetch('/api/predict', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        const resultDiv = document.getElementById('predictionResult');
        if (!resultDiv) return;
        resultDiv.classList.remove('hidden');
        
        let color = 'var(--warning-text)';
        if (result.probability >= 0.75) color = 'var(--success-text)';
        else if (result.probability < 0.40) color = 'var(--danger-text)';

        resultDiv.innerHTML = `
            <div style="font-size:0.75rem; color: var(--text-muted); margin-bottom: 0.35rem; font-weight:600; text-transform:uppercase;">Recovery Engine Recommendation</div>
            <div style="color: ${color}; font-size:0.95rem; font-weight:700;">${result.action.replace(/_/g, ' ')}</div>
            <div style="font-size: 0.75rem; display:flex; justify-content:space-between; margin-top: 0.5rem; margin-bottom: 0.2rem; color:var(--text-muted);">
                <span>Conversion Probability</span>
                <span style="font-family: var(--font-mono); font-weight:600;">${(result.probability * 100).toFixed(1)}%</span>
            </div>
            <div class="prob-meter-bg">
                <div class="prob-meter-fill" style="width: ${result.probability * 100}%; background: ${color};"></div>
            </div>
            <div class="action-explanation-text" style="margin-top: 0.6rem; margin-bottom:0;">
                ${result.explanation}
            </div>
        `;
    } catch (err) {
        console.error("Error predicting:", err);
    }
}
