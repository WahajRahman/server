import jwt from 'jsonwebtoken';
import User from '../model/User.js';

const JWT_TOKEN = process.env.JWT_SECRET;
const inActive = 15 * 60 * 1000;

export const isAuthenticated = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        const decoded = jwt.verify(token, JWT_TOKEN);
        const user = await User.findById(decoded.userId);

        console.log('Decoded JWT:', decoded);
        console.log('User from DB:', user);
        

        if (!user || user.authToken !== token) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        const now = Date.now();
        const lastActive = new Date(user.lastActiveAt).getTime();

        if (now - lastActive > inActive) {
            user.authToken = null;
            await user.save();
            return res.status(401).json({ message: 'Session expired due to inactivity' });
        }

        user.lastActiveAt = new Date();
        await user.save();
        req.user = user;
        console.log('Authenticated user:', user._id);
        
        next();
    } catch (err) {
        res.status(401).json({ message: 'Unauthorized' });
    }
}