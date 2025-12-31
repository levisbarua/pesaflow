const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');
const moment = require('moment');

// --- SETUP ---
// For Render Deployment:
// 1. We check if the service account is provided as an Environment Variable (JSON String)
// 2. Fallback to local file for development
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    // On Render, paste the entire content of serviceAccountKey.json into this ENV var
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env var", e);
  }
} else {
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (e) {
    console.warn("No Service Account found. Database operations will fail.");
  }
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const app = express();

// Enable CORS for your frontend
app.use(cors({ origin: true })); 
app.use(express.json());

// --- CONFIGURATION ---
// Use ENV variables for security on Render, fallback to Sandbox defaults for dev
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || "QNO2KPbK6z1cnytgaNNj16tA5aI38Y8l0KF7ONPa1XuksbTT"; 
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || "cUA5JXxqSar9qYsNoaF1Hr47C0dSzswNrx00XXMFSnRaCRTGURnGiTDXp2lwQBbX";
const PASSKEY = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const SHORTCODE = process.env.MPESA_SHORTCODE || "174379"; 

// The public URL of your Render Service (e.g., https://pesaflow-api.onrender.com)
// If not set, it won't receive callbacks!
const APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || "http://localhost:5000";

// --- HELPER: GET ACCESS TOKEN ---
async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  try {
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Access Token Error:", error.message);
    throw new Error("Failed to authenticate with Safaricom. Check Consumer Key/Secret.");
  }
}

// --- ROUTE 1: STK PUSH ---
app.post('/stkPush', async (req, res) => {
    try {
      const { phoneNumber, amount, accountReference, userId } = req.body;
      const formattedPhone = phoneNumber.replace('+', '').replace(/^0/, '254');
      const token = await getAccessToken();
      
      const timestamp = moment().format("YYYYMMDDHHmmss");
      const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString("base64");
      
      // Construct the Callback URL based on where the app is running
      const callbackUrl = `${APP_URL}/callback`;

      const data = {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.floor(amount), 
        PartyA: formattedPhone,
        PartyB: SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: accountReference || "PesaFlow",
        TransactionDesc: "Wallet Topup"
      };

      console.log(`Initiating STK Push to ${formattedPhone}. Callback: ${callbackUrl}`);
      
      const response = await axios.post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Create Pending Transaction in Firestore
      const checkoutRequestId = response.data.CheckoutRequestID;
      if (userId && db) {
          await db.collection('transactions').doc(checkoutRequestId).set({
              id: checkoutRequestId,
              userId: userId,
              amount: Math.floor(amount),
              type: 'DEPOSIT',
              status: 'PENDING',
              date: new Date().toISOString(),
              description: 'M-Pesa Topup',
              phoneNumber: formattedPhone,
              reference: accountReference || "PesaFlow"
          });
      }

      res.json(response.data);
    } catch (error) {
      console.error("STK Push Error:", error.response ? error.response.data : error.message);
      res.status(500).json({ error: error.message });
    }
});

// --- ROUTE 2: CALLBACK ---
app.post('/callback', async (req, res) => {
    try {
        console.log("Callback Received");
        const body = req.body.Body ? req.body.Body.stkCallback : req.body.stkCallback;
        if (!body) return res.status(400).send("Invalid Body");

        const checkoutRequestId = body.CheckoutRequestID;
        const resultCode = body.ResultCode;

        if (!db) {
           console.error("Database not initialized");
           return res.status(500).send("DB Error");
        }

        const txnRef = db.collection('transactions').doc(checkoutRequestId);
        const txnDoc = await txnRef.get();

        if (!txnDoc.exists) {
            console.log("Transaction not found, ignoring.");
            return res.json({ result: "ignored" });
        }

        const txnData = txnDoc.data();
        const userId = txnData.userId;

        if (resultCode === 0) {
            // Success Logic
            const meta = body.CallbackMetadata.Item;
            const receiptItem = meta.find(i => i.Name === "MpesaReceiptNumber");
            const receipt = receiptItem ? receiptItem.Value : "REF";

            await db.runTransaction(async (t) => {
                t.update(txnRef, { status: 'COMPLETED', reference: receipt });
                const userRef = db.collection('users').doc(userId);
                t.update(userRef, { balance: admin.firestore.FieldValue.increment(txnData.amount) });
                
                const notifRef = db.collection('notifications').doc();
                t.set(notifRef, {
                    userId: userId,
                    title: 'Payment Received',
                    message: `Confirmed: KES ${txnData.amount} added.`,
                    date: new Date().toISOString(),
                    read: false,
                    type: 'success'
                });
            });
        } else {
            // Failure Logic
            await txnRef.update({ 
                status: 'FAILED', 
                description: `Failed: ${body.ResultDesc}` 
            });
        }

        res.json({ result: "ok" });
    } catch (error) {
        console.error("Callback Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- ROUTE 3: HEALTH CHECK ---
app.get('/ping', (req, res) => {
    res.json({ 
      status: "online", 
      mode: process.env.RENDER ? "RENDER_CLOUD" : "LOCAL_DEV",
      appUrl: APP_URL
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
