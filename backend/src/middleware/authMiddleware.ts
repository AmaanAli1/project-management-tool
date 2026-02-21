import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request to include user info
// This lets us access req.user in our controllers after authentication
export interface AuthRequest extends Request {
    user?: {
        userId: number;
        email: string;
    };
}

// Middleware to verify JWT token and attach user to request
export const authenticateToken = (
    req: AuthRequest, 
    res: Response, 
    next: NextFunction
) => {
    // STEP 1: Get token from Authorization header
    // Format: "Bearer []"
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];   // Extract token after "Bearer "

    if (!token) {
        // No token provided - not authenticated
        res.status(401).json({ message: "Access deined. No token provided" });
        return;
    }

    try {
        // STEP 2: Verify token with our secret
        // If valid, jwt.verify returns the payload we embedded during login/register
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId: number;
            email: string;
        };

        // STEP 3: Attach user info to request object
        // Now any controller can access req.user to know who's making the request
        req.user = decoded;

        // STEP 4: Continue to the next middleware or route handler
        next();
    } catch (error) {
        // Token is invalid or expired
        res.status(403).json({ message: "Invalid or expired token" });
    }
};