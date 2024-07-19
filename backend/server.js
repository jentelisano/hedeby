require('dotenv').config();
console.log('DATABASE_URL:', process.env.DATABASE_URL);
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', (client) => {
  console.log('Connected to the database');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test the database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error', err.stack);
  } else {
    console.log('Database connected, current time:', res.rows[0].now);
  }
});

app.use(cors({ origin: 'http://localhost:8080' }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';

// Add your routes here (login, receive-queue, receive/start, receive/complete)
// Temp login hash check
// Temporary route to generate new password hash
/*app.get('/generate-hash', async (req, res) => {
  const saltRounds = 10;
  const plainTextPassword = 'password123';

  try {
    const hash = await bcrypt.hash(plainTextPassword, saltRounds);
    console.log('New hash:', hash);
    res.json({ success: true, hash: hash });
  } catch (err) {
    console.error('Error hashing password:', err);
    res.status(500).json({ success: false, message: 'Error generating hash' });
  }
});*/

// Login Route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password: '****' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    console.log('Query result:', result.rows);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('Comparing passwords...');
      const isMatch = await bcrypt.compare(password, user.password_hash);
      console.log('Password match result:', isMatch);
      if (isMatch) {
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ success: true, token });
      } else {
        console.log('Password mismatch');
        res.json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      res.json({ success: false, message: 'User not found' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get receive queue
app.get('/api/receive-queue', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shipment_notifications WHERE status = $1', ['pending']);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching receive queue:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Start receive process
app.post('/api/receive/start', async (req, res) => {
  const { shipmentNumber } = req.body;
  console.log('Start receive process input:', { shipmentNumber });
  
  if (!shipmentNumber) {
    return res.status(400).json({ success: false, message: 'Missing shipment number' });
  }
  
  try {
    console.log('Executing query...');
    const { rows } = await pool.query(
      'SELECT sn.*, po.vendor_name, po.vendor_id ' +
      'FROM shipment_notifications sn ' +
      'JOIN purchase_orders po ON sn.po_number = po.po_number ' +
      'WHERE sn.shipment_number = $1 AND sn.status = $2',
      [shipmentNumber, 'pending']
    );
    console.log('Query executed. Result:', rows);
    
    if (rows.length > 0) {
      console.log('Shipment found. Updating status...');
      await pool.query('UPDATE shipment_notifications SET status = $1 WHERE shipment_number = $2', 
        ['in_progress', shipmentNumber]);
      console.log('Status updated successfully.');
      res.json({ success: true, data: rows[0] });
    } else {
      console.log('No pending shipment found.');
      res.json({ success: false, message: 'Pending shipment not found' });
    }
  } catch (error) {
    console.error('Error starting receive process:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/receive/item', async (req, res) => {
  const { shipmentNumber, itemBarcode, receivedQuantity, locationBarcode } = req.body;
  
  try {
    // Verify the item belongs to the shipment
    const { rows } = await pool.query(
      'SELECT sn.*, ic.sku FROM shipment_notifications sn ' +
      'JOIN item_catalog ic ON sn.vendor_product_number = ic.vendor_product_number ' +
      'WHERE sn.shipment_number = $1 AND ic.barcode = $2',
      [shipmentNumber, itemBarcode]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: 'Item not found in this shipment' });
    }

    // Return the received item data
    res.json({ 
      success: true, 
      data: { 
        sku: rows[0].sku, 
        receivedQuantity, 
        locationBarcode 
      } 
    });
  } catch (error) {
    console.error('Error receiving item:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

//Fetch item details by po
app.get('/api/shipment-item', async (req, res) => {
  const { poNumber, itemBarcode } = req.query;
  try {
    const { rows } = await pool.query(
      'SELECT sn.*, po.vendor_name, po.vendor_id, ic.item_name, ic.sku ' +
      'FROM shipment_notifications sn ' +
      'JOIN purchase_orders po ON sn.po_number = po.po_number ' +
      'JOIN item_catalog ic ON sn.vendor_product_number = ic.vendor_product_number ' +
      'WHERE sn.po_number = $1 AND sn.barcode = $2',
      [poNumber, itemBarcode]
    );
    if (rows.length > 0) {
      res.json({ success: true, data: rows[0] });
    } else {
      res.json({ success: false, message: 'Shipment item not found' });
    }
  } catch (error) {
    console.error('Error fetching shipment item details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Scan Item
app.post('/api/receive/scan-item', async (req, res) => {
  const { barcode } = req.body;
  const { rows } = await pool.query('SELECT * FROM item_catalog WHERE barcode = $1', [barcode]);
  if (rows.length > 0) {
    res.json({ success: true, item: rows[0] });
  } else {
    res.json({ success: false, message: 'Item not found' });
  }
});

//Scan Location
app.post('/api/receive/scan-location', async (req, res) => {
  const { locationBarcode } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM locations WHERE barcode = $1 AND is_active = true', [locationBarcode]);
    if (rows.length > 0) {
      res.json({ success: true, location: rows[0] });
    } else {
      res.json({ success: false, message: 'Active location not found' });
    }
  } catch (error) {
    console.error('Error scanning location:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Complete receive process
app.post('/api/receive/complete', async (req, res) => {
  const { shipmentNumber, receivedItems } = req.body;
  
  await pool.query('BEGIN');
  try {
    // Update shipment_notifications status
    await pool.query(
      'UPDATE shipment_notifications SET status = $1 WHERE shipment_number = $2',
      ['completed', shipmentNumber]
    );
    
    // Update inventory for each received item
    for (let item of receivedItems) {
      await pool.query(
        'INSERT INTO inventory (sku, location, quantity) VALUES ($1, $2, $3) ' +
        'ON CONFLICT (sku, location) DO UPDATE SET quantity = inventory.quantity + $3', 
        [item.sku, item.locationBarcode, item.receivedQuantity]
      );
    }
    
    await pool.query('COMMIT');
    console.log('Receive process completed, inventory updated');
    res.json({ success: true, message: 'Receive process completed successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error in receive process:', error);
    res.status(500).json({ success: false, message: 'Error completing receive process' });
  }
});

//Fetch item details by po
/*app.get('/api/shipment-item', async (req, res) => {
  const { poNumber, itemBarcode } = req.query;
  try {
    const { rows } = await pool.query(
      'SELECT sn.*, po.vendor_name, po.vendor_id, ic.item_name, ic.sku ' +
      'FROM shipment_notifications sn ' +
      'JOIN purchase_orders po ON sn.po_number = po.po_number ' +
      'JOIN item_catalog ic ON sn.vendor_product_number = ic.vendor_product_number ' +
      'WHERE sn.po_number = $1 AND sn.barcode = $2',
      [poNumber, itemBarcode]
    );
    if (rows.length > 0) {
      res.json({ success: true, data: rows[0] });
    } else {
      res.json({ success: false, message: 'Shipment item not found' });
    }
  } catch (error) {
    console.error('Error fetching shipment item details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});*/

app.listen(port, () => console.log(`Server running on port ${port}`));