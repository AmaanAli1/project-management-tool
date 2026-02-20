export interface User {
    id: number;
    email: string;
    name: string;
    avatar_url?: string;
    created_at: Date;
}

export interface RegisterBody {
    email: string;
    password: string;
    name: string;
}

export interface LoginBody {
    email: string;
    password: string;
}

export interface AuthResponse {
    user: {
        id: number;
        email: string;
        name: string;
    };
    token: string;
}