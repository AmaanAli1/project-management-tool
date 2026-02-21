export interface Workspace {
    id: number;
    name: string;
    created_by: number;
    created_at: Date;
}

export interface CreateWorkspaceBody {
    name: string;
}

export interface WorkspaceMember {
    id: number;
    workspace_id: number;
    user_id: number;
    role: "owner" | "member";
    joined_at: Date;
}

export interface InviteMemberBody {
    email: string;
}