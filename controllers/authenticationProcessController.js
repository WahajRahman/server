import jwt from 'jsonwebtoken';
import User from '../model/User.js';
import dotenv from 'dotenv';
import { getAccessToken } from '../middleware/token.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const JWT_EXPIRES_IN = '1h';

export const signup = async (req, res) => {
    const { email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const user = new User({ email, password });
        await user.save();
        res.status(201).json({ message: 'User created successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}

export const login = async (req, res) => {
    const { email, password } = req.body;
    
    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        console.log('User found:', user);

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password (no user)' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password (wrong password)' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        console.log("user :", { userId: user._id });
        console.log('JWT Token:', token);

        const dynamicsToken = await getAccessToken(user);

        user.authToken = token;
        user.lastActiveAt = new Date();

        if (dynamicsToken?.access_token) {
            user.DynamicsToken = dynamicsToken.access_token;
            if (dynamicsToken.expires_on) {
                user.DynamicsTokenExpiredAt = new Date(dynamicsToken.expires_on * 1000);
            } else if (dynamicsToken.expires_in) {
                user.DynamicsTokenExpiredAt = new Date(Date.now() + (dynamicsToken.expires_in * 1000));
            }
        }
        await user.save();
        res.status(200).json({ token });
    } catch (error) {
        console.error('Login error:', error);
        console.log('JWT_SECRET:', JWT_SECRET);
        res.status(500).json({ message: 'Server error during login', error: error.message });
    }

};

    export const logout = async (req, res) => {
        const token = req.headers.authorization?.split(' ')[1];
        try {
            const user = await User.findOne({ authToken: token });
            if (user) {
                user.authToken = null;
                await user.save();
            }
            res.status(200).json({ message: 'Logged out' });
        } catch (err) {
            res.status(500).json({ message: 'Logout failed' });
        }
    };















    //posting of mutliple purchase order lines 
    
    // export const createMutiplePurchaseOrderLines = async (req, res) => {
    //     try {
    //         const token = await getAccessToken();
    //         const baseUrl = process.env.D365_URL;
    //         const { company } = req.query;
    //         const dataAreaId = company || 'USMF';
    
    //         if (!baseUrl) {
    //             return res.status(500).json({ error: "D365_URL is not configured" });
    //         }
    //         const acceptLines = Array.isArray(req.body) ? req.body : [req.body];
    
    //         const linesPayload = acceptLines.map(line => {
    //           return  buildLines({ ...line, dataAreaId: dataAreaId });
    //         });
    
    //         const required = [
    //             "PurchaseOrderNumber",
    //             "LineNumber",
    //             "OrderedPurchaseQuantity",
    //             "ItemNumber",
    //             "LineDescription",
    //             "RequestedDeliveryDate",
    //             "ReceivingWarehouseId",
    //             "ReceivingSiteId",
    //             "PurchasePrice",
    //             "PurchaseUnitSymbol",
    //             "LineAmount",
    //         ];
    //         const missingErrors = linesPayload.map((line, idx) => {
    //             const missing = required.filter(k => !line[k]);
    //             return missing.length ? { line: idx + 1, missing, preview: line } : null;
    //         }).filter(Boolean);
    
    //         if (missingErrors.length > 0) {
    //             return res.status(400).json({
    //                 error: "Missing required fields in one or more lines",
    //                 details: missingErrors,
    //             });
    //         }
    
    //         const url = `${baseUrl}data/PurchaseOrderLinesV2`;
    //         const responses = await Promise.all(
    //             linesPayload.map(line =>
    //                 fetch(url, {
    //                     method: "POST",
    //                     headers: {
    //                         Authorization: `Bearer ${token}`,
    //                         "Content-Type": "application/json",
    //                         Accept: "application/json",
    //                         "OData-Version": "4.0",
    //                         "OData-MaxVersion": "4.0",
    //                         Prefer: "return=representation",
    //                     },
    //                     body: JSON.stringify(line),
    //                 })
    //             )
    //         );
    
    
    //         const results = [];
    //         for (let i = 0; i < responses.length; i++) {
    //             const r = responses[i];
    //             if (!r.ok) {
    //                 const errBody = await readErrorBody(r);
    //                 results.push({
    //                     success: false,
    //                     status: r.status,
    //                     error: errBody,
    //                     payload: linesPayload[i],
    //                 });
    //             } else {
    //                 const data = await r.json();
    //                 results.push({
    //                     success: true,
    //                     status: r.status,
    //                     data,
    //                 });
    //             }
    //         }
    //         const successCount = results.filter(r => r.success).length;
    //         const failureCount = results.length - successCount;
    
    //         return res.status(failureCount > 0 ? 207 : 200).json({
    //             message: `Processed ${results.length} line(s)`,
    //             successCount,
    //             failureCount,
    //             results,
    //         });
    //     } catch (error) {
    //         console.error("Unhandled error in createMutiplePurchaseOrderLines:", error);
    //         return res.status(500).json({ error: "Server Error", details: error.message });
    //     }
    // }
    