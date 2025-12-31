const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });
const moment = require("moment");

admin.initializeApp();
const db = admin.firestore();

// --- CONFIGURATION ---
// Note: Ensure these are valid Sandbox credentials.
const CONSUMER_KEY = "QNO2KPbK6z1cnytgaNNj16tA5aI38Y8l0KF7ONPa1XuksbTT"; 
const CONSUMER_SECRET = "cUA5JXxqSar9qYsNoaF1Hr47C0dSzswNrx00XXMFSnRaCRTGURnGiTDXp2lwQBbX";

// Standard Sandbox Credentials
const PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const SHORTCODE = "174379"; 

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
    // Check for Firebase Spark Plan restriction (Network block)
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN' || error.message.includes('getaddrinfo')) {
      throw new Error("FIREBASE_BILLING_ERROR");
    }
    
    console.error("Access Token Error:", error.response ? error.response.data : error.message);
    throw new Error("Failed to authenticate with Safaricom. Check your Consumer Key/Secret.");
  }
}

// --- API 1: STK PUSH (DEPOSIT) ---
exports.stkPush = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
      const { phoneNumber, amount, accountReference, userId } = req.body;
      
      const formattedPhone = phoneNumber.replace('+', '').replace(/^0/, '254');
      
      // 1. Get Token (Will fail here if on Spark Plan)
      const token = await getAccessToken();
      
      const timestamp = moment().format("YYYYMMDDHHmmss");
      const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString("base64");
      
      const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
      const callbackUrl = `https://us-central1-${projectId}.cloudfunctions.net/callback`;

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

      console.log(`Initiating STK Push to ${formattedPhone} for KES ${amount} (Callback: ${callbackUrl})`);

      // 2. Send Request to Safaricom
      const response = await axios.post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 3. Create Pending Transaction in Firestore
      const checkoutRequestId = response.data.CheckoutRequestID;
      
      if (userId) {
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
          console.log(`Created PENDING transaction: ${checkoutRequestId}`);
      }

      res.json(response.data);
    } catch (error) {
      console.error("STK Push Error:", error);
      
      // Return specific error for Billing issues
      if (error.message === "FIREBASE_BILLING_ERROR") {
         return res.status(500).json({ 
           error: "FIREBASE_BILLING_ERROR", 
           message: "External network access requires Firebase Blaze Plan." 
         });
      }

      res.status(500).json({ 
        error: error.message,
        details: error.response ? error.response.data : null 
      });
    }
  });
});

// --- API 2: CALLBACK (M-PESA RESPONSES) ---
exports.callback = functions.https.onRequest(async (req, res) => {
    try {
        console.log("M-Pesa Callback Received:", JSON.stringify(req.body));
        
        // Handle case where body might be parsed differently depending on content-type
        const body = req.body.Body ? req.body.Body.stkCallback : req.body.stkCallback;
        
        if (!body) {
           console.error("Invalid Callback Body", req.body);
           return res.status(400).send("Invalid Body");
        }

        const checkoutRequestId = body.CheckoutRequestID;
        const resultCode = body.ResultCode; // 0 is success

        const txnRef = db.collection('transactions').doc(checkoutRequestId);
        const txnDoc = await txnRef.get();

        if (!txnDoc.exists) {
            console.log(`Transaction ${checkoutRequestId} not found.`);
            return res.json({ result: "ignored_not_found" });
        }

        const txnData = txnDoc.data();
        const userId = txnData.userId;

        if (resultCode === 0) {
            // SUCCESS
            const meta = body.CallbackMetadata.Item;
            const receiptItem = meta.find(i => i.Name === "MpesaReceiptNumber");
            const receipt = receiptItem ? receiptItem.Value : txnData.reference;

            await db.runTransaction(async (t) => {
                t.update(txnRef, {
                    status: 'COMPLETED',
                    reference: receipt
                });
                const userRef = db.collection('users').doc(userId);
                t.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(txnData.amount)
                });
                const notifRef = db.collection('notifications').doc();
                t.set(notifRef, {
                    userId: userId,
                    title: 'Payment Received',
                    message: `Confirmed: KES ${txnData.amount} has been added to your wallet. Ref: ${receipt}`,
                    date: new Date().toISOString(),
                    read: false,
                    type: 'success'
                });
            });
            console.log(`Transaction ${checkoutRequestId} completed successfully.`);

        } else {
            // FAILED
            const reason = body.ResultDesc || "Transaction failed";
            await db.runTransaction(async (t) => {
                t.update(txnRef, {
                    status: 'FAILED',
                    description: `Failed: ${reason}`
                });
                const notifRef = db.collection('notifications').doc();
                t.set(notifRef, {
                    userId: userId,
                    title: 'Payment Failed',
                    message: `Your transaction could not be completed. Reason: ${reason}`,
                    date: new Date().toISOString(),
                    read: false,
                    type: 'error'
                });
            });
            console.log(`Transaction ${checkoutRequestId} failed: ${reason}`);
        }

        res.json({ result: "ok" });
    } catch (error) {
        console.error("Callback Processing Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- API 3: HEALTH CHECK ---
exports.ping = functions.https.onRequest((req, res) => {
    return cors(req, res, () => {
        console.log("Ping received from frontend.");
        res.json({ status: "online", time: new Date().toISOString(), mode: "PRODUCTION" });
    });
});