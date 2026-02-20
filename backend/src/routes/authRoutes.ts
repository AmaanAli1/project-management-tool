import { Router } from "express";
import { register, login} from "../controllers/authController";

const router = Router();

// POST /auth/register - Create a new user account
router.post("/register", register);

// POST /auth/login - Authenticate and get token
router.post("/login", login);

export default router;