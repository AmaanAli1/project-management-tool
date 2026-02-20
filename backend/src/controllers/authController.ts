import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db";
import { RegisterBody, LoginBody } from "../types/user";

// ============================================
// REGISTER A NEW USER
// ============================================

export const register = async (
    req: Request<{}, {}, RegisterBody>, 
    res: Response
) => {
    try {
        const { email, password, name } = req.body;

        // STEP 1: Validate input
        if (!email || !password || !name) {
            res.status(400).json({ message: "All fields are required" });
            return;
        }

        // STEP 2: Check if user already exists
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE email = $1", 
            [email]
        );

        if (existingUser.rows.length > 0) {
            res.status(409).json({ message: "User already exists" });
            // 409 = Conflict status code (resource already exists)
            return;
        }

        // STEP 3: Hash the pasword
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // STEP 4: Insert user into database
        const result = await pool.query(
            "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name", 
            [email, passwordHash, name]
        );

        const user = result.rows[0];

        // STEP 5: Generate JWT token
        // JWT tokens are how we maintain authentication without sessions
        // { expiresIn: "7d" } means the token expires after 7 days - user has to login again
        const token = jwt.sign(
            { userId: user.id, email: user.email }, // Payload - data embedded in the token
            process.env.JWT_SECRET!,    // Secret key to sign the token
            { expiresIn: "7d" }
        );

        // STEP 6: Send response
        // 201 = Created status code
        // We send back the user info AND the token
        // Frontend will store the token and include it in future requests
        res.status(201).json({
            user: {
                id: user.id, 
                email: user.email, 
                name: user.name, 
            }, 
            token, 
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ============================================
// LOGIN USER
// ============================================

export const login = async(
    req: Request<{}, {}, LoginBody>, 
    res: Response
) => {
    try {
        const { email, password } = req.body;

        // STEP 1: Validate input
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required" });
            return;
        }

        // STEP 2: Find user by email
        // We need the password_hash from the database to compare it with the input password 
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1", 
            [email]
        );

        if (result.rows.length === 0) {
            // 401 = Unauthorized status code
            // Security best practice: don't tell attackers which part failed (email vs password)
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }

        const user = result.rows[0];

        // STEP 3: Compare password with stored hash
        // This is a one-way check; you can't reverse the hash to get the original password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            // Same "Invalid credentials" message for security
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }

        // STEP 4: Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email }, 
            process.env.JWT_SECRET!, 
            { expiresIn: "7d" }
        );

        // STEP 5: Send response
        // Return user info and token
        // Frontend stores this token and sends it back in the Authorization header for protected routes
        res.json({
            user: {
                id: user.id, 
                email: user.email, 
                name: user.name, 
            },
            token,
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error" });
    }
};