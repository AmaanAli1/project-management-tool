import { Router } from "express";
import {
    createWorkspace, 
    getWorkspaces,
    getWorkspaceById, 
    inviteMember,
} from "../controllers/workspaceController";

import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

// All workspace routes require authentication
// We apply the middleware to every route in this file

// POST /workspaces - Create a new workspace
router.post("/", authenticateToken, createWorkspace);

// GET /workspaces - Get all workspaces for current user
router.get("/", authenticateToken, getWorkspaces);

// GET /workspaces/:id - Get workspaces by ID with members
router.get("/:id", authenticateToken, getWorkspaceById);

// POST /workspaces/:id/members - Invite a member to workspace (owner only)
router.post("/:id/members", authenticateToken, inviteMember);

export default router;