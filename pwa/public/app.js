console.log("App.js loaded successfully");

const API_URL = 'http://localhost:3000';
let token = '';

const app = document.getElementById('app');

function renderLogin() {
    app.innerHTML = `
        <div id="login">
            <h2>Login</h2>
            <input type="text" id="username" placeholder="Username">
            <input type="password" id="password" placeholder="Password">
            <button onclick="login()">Login</button>
        </div>
    `;
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await axios.post(`${API_URL}/api/login`, { username, password });
        token = response.data.token;
        renderWorkflowSelection();
    } catch (error) {
        alert('Login failed');
    }
}

function renderWorkflowSelection() {
    app.innerHTML = `
        <div id="workflow">
            <h2>Select Workflow</h2>
            <button onclick="selectWorkflow('inbound')">Inbound Activities</button>
            <button onclick="selectWorkflow('outbound')">Outbound Activities</button>
        </div>
    `;
}

function selectWorkflow(type) {
    const tasks = type === 'inbound'
        ? ['Receive', 'Move Inventory', 'Remove from Inventory']
        : ['Picking Orders', 'Stage for Delivery', 'Out for Delivery'];
    
    app.innerHTML = `
        <div id="tasks">
            <h2>${type === 'inbound' ? 'Inbound' : 'Outbound'} Tasks</h2>
            <div id="taskButtons">
                ${tasks.map(task => `<button onclick="startTask('${task}')">${task}</button>`).join('')}
            </div>
        </div>
    `;
}

function startTask(task) {
    if (task === 'Receive') {
        startReceiveWorkflow();
    } else {
        alert(`${task} workflow not implemented yet`);
    }
}

let currentShipment = null;
let receivedItems = [];

function startReceiveWorkflow() {
    app.innerHTML = `
        <div id="receive">
            <h2>Receive Workflow</h2>
            <h3>Enter Shipment Number</h3>
            <input type="text" id="shipmentNumberInput">
            <button onclick="processShipment()">Process Shipment</button>
        </div>
    `;
}

async function processShipment() {
    const shipmentNumber = document.getElementById('shipmentNumberInput').value;
    try {
        const response = await axios.post(`${API_URL}/api/receive/start`, { shipmentNumber }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
            currentShipment = response.data.data;
            showReceiveItemForm();
        } else {
            alert(`Failed to process shipment: ${response.data.message}`);
        }
    } catch (error) {
        console.error('Error processing shipment:', error);
        alert('Failed to process shipment: ' + (error.response?.data?.message || error.message));
    }
}

function showReceiveItemForm() {
    app.innerHTML = `
        <div id="receiveItem">
            <h2>Receive Item</h2>
            <p>Shipment Number: ${currentShipment.shipment_number}</p>
            <p>PO Number: ${currentShipment.po_number}</p>
            <p>Vendor: ${currentShipment.vendor_name}</p>
            <h3>Scan Item Barcode</h3>
            <input type="text" id="itemBarcodeInput">
            <h3>Enter Received Quantity</h3>
            <input type="number" id="quantityInput">
            <h3>Scan Location</h3>
            <input type="text" id="locationInput">
            <button onclick="receiveItem()">Receive Item</button>
        </div>
    `;
}

async function receiveItem() {
    const itemBarcode = document.getElementById('itemBarcodeInput').value;
    const receivedQuantity = document.getElementById('quantityInput').value;
    const locationBarcode = document.getElementById('locationInput').value;

    try {
        const response = await axios.post(`${API_URL}/api/receive/item`, {
            shipmentNumber: currentShipment.shipment_number,
            itemBarcode,
            receivedQuantity: parseInt(receivedQuantity),
            locationBarcode
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
            receivedItems.push(response.data.data);
            showReceiveSummary();
        } else {
            alert(`Failed to receive item: ${response.data.message}`);
        }
    } catch (error) {
        console.error('Error receiving item:', error);
        alert('Failed to receive item: ' + (error.response?.data?.message || error.message));
    }
}

function showReceiveSummary() {
    app.innerHTML = `
        <div id="receiveSummary">
            <h2>Receive Summary</h2>
            <p>Shipment Number: ${currentShipment.shipment_number}</p>
            <h3>Received Items:</h3>
            <ul>
                ${receivedItems.map(item => `
                    <li>Item: ${item.sku}, Quantity: ${item.receivedQuantity}, Location: ${item.locationBarcode}</li>
                `).join('')}
            </ul>
            <button onclick="showReceiveItemForm()">Receive Another Item</button>
            <button onclick="completeReceive()">Complete Receive</button>
        </div>
    `;
}

async function completeReceive() {
    try {
        const response = await axios.post(`${API_URL}/api/receive/complete`, {
            shipmentNumber: currentShipment.shipment_number,
            receivedItems
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
            alert('Receive process completed successfully');
            renderWorkflowSelection();
        } else {
            alert(`Failed to complete receive process: ${response.data.message}`);
        }
    } catch (error) {
        console.error('Error completing receive process:', error);
        alert('Failed to complete receive process: ' + (error.response?.data?.message || error.message));
    }
}

renderLogin();