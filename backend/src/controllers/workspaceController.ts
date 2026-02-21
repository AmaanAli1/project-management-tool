import { Response } from "express";
import pool from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";
import { CreateWorkspaceBody, InviteMemberBody } from "../types/workspace";

// Create a new workspace
export const createWorkspace = async (
    req: AuthRequest, 
    res: Response
) => {
    try {
        const { name } = req.body as CreateWorkspaceBody;
        const userId = req.user!.userId;    // We know user exists because of auth middleware

        // Validation
        if (!name) {
            res.status(400).json({ message: "Workspace name is required" });
            return;
        }

        // STEP 1: Create workspace
        const workspaceResult = await pool.query(
            "INSERT INTO workspaces (name, created_by) VALUES ($1, $2) RETURNING *", 
            [name, userId]
        );

        const workspace = workspaceResult.rows[0];

        // STEP 2: Add creator as owner in workspace_members
        // When you create a workspace, you're automatically the owner
        await pool.query(
            "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)", 
            [workspace.id, userId, "owner"]
        );

        res.status(201).json(workspace);
    } catch (error) {
        console.error("Create workspace error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get all workspaces for the current user
export const getWorkspaces = async (
    req: AuthRequest, 
    res: Response
) => {
    try {
        const userId = req.user!.userId;

        // Join workspaces with workspace_members to get all workspaces the user belongs to
        // Also get their role in each workspace
        const result = await pool.query(
            `SELECT w.id, w.name, w.created_by, w.created_at, wm.role
            FROM workspaces w
            JOIN workspace_members wm ON w.id = wm.workspace_id
            WHERE wm.user_id = $1
            ORDER BY w.created_at DESC`, 
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Get workspace error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get workspace by ID with members
export const getWorkspaceById = async(
    req: AuthRequest, 
    res: Response
) => {
    try {
        const workspaceId = parseInt(req.params.id as string);
        const userId = req.user!.userId;

        // STEP 1: Check if user is a member of this workspace
        const memberCheck = await pool.query(
            "SELECT * FROM workspace_members WHERE workspacE_id = $1 AND user_id = $2", 
            [workspaceId, userId]
        );

        if (memberCheck.rows.length === 0) {
            res.status(403).json({ message: "Access denied. Not a workspace member" });
            return;
        }

        // STEP 2: Get workspace details
        const workspaceResult = await pool.query(
            "SELECT * FROM workspaces WHERE id = $1", 
            [workspaceId]
        );

        if (workspaceResult.rows.length === 0) {
            res.status(404).json({ message: " Workspace not found" });
        }

        const workspace = workspaceResult.rows[0];

        // STEP 3: Get all members of this workspace
        const membersResult = await pool.query(
            `SELECT u.id, u.name, u.email, u.avatar_url, wm.role, wm.joined_at
            FROM users u
            JOIN workspace_members wm ON u.id = wm.user_id
            WHERE wm.workspace_id = $1
            ORDER BY wm.joined_at ASC`, 
            [workspaceId]
        );

        res.json({
            ...workspace, 
            members: membersResult.rows,
        });
    } catch (error) {
        console.error("Get workspace error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Invite a user to workspace (owner only)
export const inviteMember = async(
    req: AuthRequest, 
    res: Response
) => {
    try {
        const workspaceId = parseInt(req.params.id as string);
        const { email } = req.body as InviteMemberBody;
        const userId = req.user!.userId;

        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }

        // STEP 1: Check if current user is the owner of this workspace
        const ownerCheck = await pool.query(
            "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND role = $3", 
            [workspaceId, userId, "owner"]
        );

        if (ownerCheck.rows.length === 0) {
            res.status(403).json({ message: "Only workspace owners can invite members" });
            return;
        }

        // STEP 2: Find user by email
        const userResult = await pool.query(
            "SELECT id FROM users WHERE email = $1", 
            [email]
        );

        if (userResult.rows.length === 0) {
            res.status(404).json({ message: "User not found. They need to register first." });
            return;
        }

        const invitedUserId = userResult.rows[0].id;

        // STEP 3: Check if user is already a member
        const existingMember = await pool.query(
            "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2", 
            [workspaceId, invitedUserId]
        );

        if (existingMember.rows.length > 0) {
            res.status(409).json({ message: "User is already a member of this workspace" });
            return;
        } 

        // STEP 4: Add user as a member
        await pool.query(
            "INSERT INTO workspace_members (workspace,id, user_id, role) VALUES ($1, $2, $3)", 
            [workspaceId, invitedUserId, "member"]
        );

        res.status(201).json({ message: "User invited successfully" });
    } catch (error) {
        console.error("Invite member error:", error);
        res.status(500).json({ message: "Server error" });
    }
};