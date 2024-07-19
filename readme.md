# Hedeby WMS Prototype

This is a prototype for the Hedeby Warehouse Management System.

## Features
- User authentication
- Validate POs and shipments
- Receive process workflow
- Update inventory

## Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see .env.example)
4. Create db and add data
5. Run the server: `node backend/server.js`
6. Access the application at http://localhost:3000

## Usage

1. Use the test user credentials to log in:
2. Select "Inbound Activities" and then "Receive" to test the receive workflow

## Technologies Used
- Node.js
- Express.js
- PostgreSQL
