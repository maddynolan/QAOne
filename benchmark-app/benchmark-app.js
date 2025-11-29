// Benchmark Application JavaScript
// Simulates the 10 complex failure modes for testing

let orderModalCounter = 0;
let currentStep = 3;
let chartType = 'bar';
let userRole = 'user';
let messages = [];

// Scenario 1: Trading Portal - Dynamic ID on Re-render
function openOrderModal() {
    document.getElementById('orderModal').style.display = 'block';
    updateOrderForm();
}

function updateOrderForm() {
    // Simulate DOM re-render - change the ID every time
    orderModalCounter++;
    const submitBtn = document.getElementById('submit-btn-dynamic');
    if (submitBtn) {
        submitBtn.id = `submit-btn-${Date.now()}-${orderModalCounter}`;
        // But keep the role and name attributes stable
        submitBtn.setAttribute('role', 'button');
        submitBtn.setAttribute('name', 'Submit Order');
    }
}

function submitOrder() {
    const asset = document.getElementById('asset-select').value;
    const price = document.getElementById('order-price').value;
    document.getElementById('order-result').innerHTML = `<p>Order submitted: ${asset} @ $${price}</p>`;
    closeOrderModal();
}

function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
}

// Scenario 2: CMS Drag and Drop
function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.testid);
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const blockType = e.dataTransfer.getData('text/plain');
    if (blockType === 'image-block' && e.currentTarget.dataset.testid === 'document-body') {
        document.getElementById('drop-result').innerHTML = '<p>✅ Image Block dropped successfully!</p>';
    }
}

// Scenario 3: CRM Virtualized Table
const customers = Array.from({length: 100}, (_, i) => ({
    id: i + 1,
    name: `Customer ${i + 1}`,
    status: i % 2 === 0 ? 'open' : 'closed'
}));

function filterTable() {
    const status = document.getElementById('status-filter').value;
    const filtered = status === 'all' ? customers : customers.filter(c => c.status === status);
    renderTable(filtered);
}

function renderTable(customers) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    // Simulate virtualization - only render first 20 visible rows
    const visibleRows = customers.slice(0, 20);
    visibleRows.forEach((customer, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${customer.id}</td>
            <td>${customer.name}</td>
            <td>${customer.status}</td>
            <td><button role="button" name="Edit" onclick="editCustomer(${customer.id})">Edit</button></td>
        `;
        tbody.appendChild(row);
    });
}

function editCustomer(id) {
    alert(`Editing customer ${id}`);
}

// Initialize table
filterTable();

// Scenario 4: Insurance Form - Disabled Button Race Condition
function validateStep3() {
    const amount = document.getElementById('coverage-amount').value;
    const nextBtn = document.getElementById('next-btn');
    nextBtn.disabled = true;
    document.getElementById('validation-status').innerHTML = '<p>Validating...</p>';
    
    // Simulate async validation
    setTimeout(() => {
        if (amount && parseInt(amount) > 0) {
            nextBtn.disabled = false;
            document.getElementById('validation-status').innerHTML = '<p>✅ Valid</p>';
        } else {
            document.getElementById('validation-status').innerHTML = '<p>❌ Invalid amount</p>';
        }
    }, 1500); // 1.5 second delay
}

function goToNextStep() {
    currentStep++;
    document.getElementById('form-step').textContent = `Step ${currentStep} of 7`;
}

// Scenario 5: iFrame Consent
function loadConsentFrame() {
    const iframe = document.getElementById('frame-async');
    iframe.srcdoc = `
        <!DOCTYPE html>
        <html>
        <head><title>User Consent Agreement</title></head>
        <body style="padding: 20px; font-family: Arial;">
            <h2>User Consent Agreement</h2>
            <p>Please read and accept the terms.</p>
            <label>
                <input type="checkbox" id="consent-checkbox" role="checkbox" name="I Agree">
                I Agree to the terms and conditions
            </label>
            <br><br>
            <button onclick="parent.postMessage('consent-accepted', '*')">Submit</button>
        </body>
        </html>
    `;
    
    window.addEventListener('message', (e) => {
        if (e.data === 'consent-accepted') {
            alert('Consent accepted!');
        }
    });
}

// Scenario 6: Analytics Chart
function changeChartType(type) {
    chartType = type;
    document.getElementById('chart-display').textContent = `Current Chart: ${type === 'bar' ? 'Bar' : 'Line'}`;
}

// Scenario 7: E-Commerce Pop-up
function checkPrice() {
    // Random delay before popup appears
    setTimeout(() => {
        document.getElementById('popup-modal').style.display = 'block';
    }, Math.random() * 2000 + 1000); // 1-3 seconds
}

function closePopup() {
    document.getElementById('popup-modal').style.display = 'none';
    document.getElementById('product-price').textContent = '$79.99'; // Final price after discount
}

// Scenario 8: File Upload
function handleFileDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    document.getElementById('upload-status').innerHTML = `<p>✅ File uploaded: ${file.name}</p>`;
}

// Scenario 9: Async Chat
function sendMessage() {
    const input = document.getElementById('chat-input');
    const messageText = input.value;
    if (!messageText) return;
    
    input.value = '';
    
    // Simulate async message delivery
    setTimeout(() => {
        const timestamp = new Date().toLocaleTimeString();
        messages.push({ text: messageText, time: timestamp });
        renderMessages();
    }, Math.random() * 1000 + 500); // 0.5-1.5 seconds
}

function renderMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = messages.map(msg => `
        <div class="chat-message">
            <div>Message: ${msg.text}</div>
            <div class="timestamp">Time: ${msg.time}</div>
        </div>
    `).join('');
}

// Scenario 10: Dynamic Profile Name
function toggleUserRole() {
    userRole = userRole === 'user' ? 'admin' : 'user';
    const profileName = document.getElementById('profile-name');
    if (userRole === 'admin') {
        profileName.textContent = 'JOHN DOE'; // Uppercase for admin
    } else {
        profileName.textContent = 'John Doe'; // Normal case for user
    }
}

function showProfile() {
    document.getElementById('profile-details').innerHTML = `
        <p>Role: ${userRole}</p>
        <p>Name: ${document.getElementById('profile-name').textContent}</p>
    `;
}

function showScenario(num) {
    // Hide all scenarios
    for (let i = 1; i <= 10; i++) {
        document.getElementById(`scenario${i}`).style.display = 'none';
    }
    // Show selected scenario
    document.getElementById(`scenario${num}`).style.display = 'block';
}

// Show first scenario by default
showScenario(1);

