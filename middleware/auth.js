import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { isAuthenticated } from "./authentication.js";

const client = jwksClient({
    jwksUri: process.env.JWKS_URI,
    requestHeaders: {},
    timeout: 30000,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000,
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) {
            console.error("Error getting signing key:", err);
            return callback(err);
        }
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

const verifyAzureJwt = (token) => new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER,
        algorithms: ["RS256"]
    }, (err, decoded) => {
        if (err) {
            return reject(err);
        }
        resolve(decoded);
    });
});

const buildAzureUser = (decoded) => ({
    id: decoded.oid || decoded.sub,
    email: decoded.email || decoded.preferred_username || decoded.upn,
    name: decoded.name,
    roles: decoded.roles || [],
    groups: decoded.groups || [],
    tenantId: decoded.tid,
    clientId: decoded.aud,
    scope: decoded.scp || decoded.scope,
    tokenVersion: decoded.ver
});

export async function verifyToken(req, res, next) {
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            error: "Access denied",
            message: "No token provided"
        });
    }

    const decodedMeta = jwt.decode(token, { complete: true });
    const algorithm = decodedMeta?.header?.alg;

    if (!algorithm) {
        return res.status(403).json({
            success: false,
            error: "Invalid token",
            message: "Token header missing algorithm"
        });
    }

    try {
        if (algorithm.startsWith("RS")) {
            const decoded = await verifyAzureJwt(token);
            req.user = buildAzureUser(decoded);
            console.log(`Auth success (Azure AD): ${req.user.name || req.user.email || req.user.id}`);
            return next();
        }

        if (algorithm.startsWith("HS")) {
            return isAuthenticated(req, res, next);
        }

        // Default to trying Azure verification first, then fall back to local JWT validation.
        const decoded = await verifyAzureJwt(token);
        req.user = buildAzureUser(decoded);
        console.log(`Auth success (Azure AD - fallback): ${req.user.name || req.user.email || req.user.id}`);
        return next();
    } catch (err) {
        if (algorithm.startsWith("HS")) {
            return isAuthenticated(req, res, next);
        }

        console.error("Token verification failed:", err.message);
        return res.status(403).json({
            success: false,
            error: "Invalid token",
            message: "Token verification failed",
            details: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
}
