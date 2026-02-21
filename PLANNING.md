**DATABASE SCHEMA**

1. *Users table*

users
- id (SERIAL PRIMARY KEY)
- email (VARCHAR, UNIQUE, NOT NULL)
- password_hash (VARCHAR, NOT NULL)
- name (VARCHAR, NOT NULL)
- avatar_url (VARCHAR, nullable)
- created_at (TIMESTAMP)

2. *Workspaces table*

workspaces
- id (SERIAL PRIMARY KEY)
- name (VARCHAR, NOT NULL)
- created_by (INTEGER, FOREIGN KEY -> users.id)
- created_at (TIMESTAMP)

created_by links to the user who created the workspace. 

3. *Workspace Members (junction table)*

This connects users to workspaces. One user can belong to multiple workspaces, one workspace
has multiple users. This is a many-to-many relationship, which needs a junction table.

workspace_members
- id (SERIAL PRIMARY KEY)
- workspace_id (INTEGER, FOREIGN KEY -> workspaces.id)
- user_id (INTEGER, FOREIGN KEY -> users.id)
- role (VARCHAR, either 'owner' or 'member)
- joined_at (TIMESTAMP)

This table answers: "Which users belong to which workspaces, and what's their role?"

4. *Projects table*

Projects belong to a workspace

projects
- id (SERIAL PRIMARY KEY)
- workspace_id (INTEGER, FOREIGN KEY -> workspaces.id)
- name (VARCHAR, NOT NULL)
- description (TEXT, nullable)
- created_by (INTEGER, FOREIGN KEY -> users.id)
- created_at (TIMESTAMP)

A workspace can have many projects. A project belongs to one workspace.

5. *Tasks table*

Tasks belong to a project.

tasks
- id (SERIAL PRIMARY KEY)
- project_id (INTEGER, FOREIGN KEY -> projects.id)
- title (VARCHAR, NOT NULL)
- description (TEXT, nullable)
- status (VARCHAR, default 'todo') // 'todo', 'in_progress', 'done
- priority (VARCHAR, default 'medium') // 'low', 'medium', 'high'
- assigned_to (INTEGER, FOREIGN KEY -> users.id, nullable)
- created_by (INTEGER, FOREIGN KEY -> users.id)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

6. *Comments table*

Comments belong to tasks.

comments
- id (SERIAL PRIMARY KEY)
- task_id (INTEGER, FOREIGN KEY -> tasks.id)
- user_id (INTEGER, FOREIGN KEY -> users.id)
- content (TEXT, NOT NULL)
- created_at (TIMESTAMP)

7. *Notifications table*

When something happens (task assigned, comment added), create a notification

notifications
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER, FOREIGN KEY -> users.id)
- message (VARCHAR, NOT NULL)
- read (BOOLEAN, default false)
- created_at (TIMESTAMP)

**API ENDPOINTS**

*AUTH ENDPOINTS*

POST /auth/register ✅
- Public (no auth required)
- Body: { email, password, name }
- Returns: { user: {id, email, name }, token }

POST /auth/login ✅
- Public
- Body: { email, password }
- Returns: { user: { id, email, name }, token }

GET /auth/me
- Protected (required valid JWT token)
- Returns: { id, email, name, avatar_url }

*WORKSPACE ENDPOINTS*

POST /workspaces
- Protected
- Body: { name }
- Returns { id, name, created_by, created_at }
- Note: Creator is automatically added as owner in workspace_members

GET /workspaces
- Protected
- Returns: [ { id, name, role, member_count } ]
- Note: Returns all workspaces the current user belongs to

GET /workspaces/:id
- Protected
- Returns: { id, name, created_by, members: [...], projects: [...] }

POST /workspaces/:id/members
- Protected (owner only)
- Body: { email }
- Returns: { message: "User invited" }
- Note: Find user by email and adds them to workspace

DELETE /workspaces/:id/members/:userId
- Protected (owner only)
- Returns: { message: "Member removed" }

*PROJECT ENDPOINTS*

POST /workspaces/:workspaceId/projects
- Protected (workspace member)
- Body: { name, description }
- Returns: { id, workspace_id, name, description, created_by, created_at }

GET /workspaces/:workspaceId/projects
- Protected (workspace member)
- Returns: [ { id, name, description, task_count, created_at } ]

GET /projects/:id
- Protected (workspace member)
- Returns: { id, name, description, workspace_id, tasks: [...] }

PUT /projects/:id
- Protected (workspace member)
- Body: { name?, description? }
- Returns: updated project

DELETE /projects/:id
- Protected (owner only)
- Returns: { message: "Project deleted" }

*TASK ENDPOINTS*

POST /projects/:projectId/tasks
- Protected (workspace member)
- Body: { title, description, priority, assigned_to }
- Returns: { id, project_id, title, description, status, priority, assigned_to, created_by, created_at }

GET /projects/:projectId/tasks
- Protected (workspace member)
- Returns: [ { id, title, status, priority, assigned_to, created_at } ]

GET /tasks/:id
- Protected (workspace member)
- Returns: { id, title, description, status, priority, assigned_to, comments: [...] }

PUT /tasks/:id
- Protected (workspace member)
- Body: { title?, description?, status?, priority?, assigned_to? }
- Returns: updated task
- Note: This is where WebSocket events fire for real-time updates

DELETE /tasks/:id
- Protected (workspace member or creator)
- Returns: { message: "Task deleted" }

*COMMENT ENDPOINTS*

POST /tasks/:taskId/comments
- Protected (workspace member)
- Body: { content }
- Returns: { id, task_id, user_id, content, created_at }

GET /tasks/:taskId/comments
- Protected (workspace member)
- Returns: [ { id, user: { name, avatar_url }, content, created_at } ]

DELETE /comments/:id
- Protected (comment creator only)
- Returns: { message: "Comment deleted" }

*NOTIFICATION ENDPOINTS*

GET /notifications
- Protected
- Returns [ { id, message, read, created_at } ]
- Note: Returns notifications for current user only

PUT /notifications/:id/read
- Protected
- Returns: { message: "Notification marked as read" }

PUT /notifications/read-all
- Protected
- Returns: { message: "All notifications marked as read" }

**USER FLOWS**

*Flow 1: New User Registeration -> First Workspace*
    1. User lands on app
    2. Clicks "Sign Up"
    3. Enters email, password, name
    4. Backend hashes password, creates user, returns JWT token
    5. Frontend stores token in localStorage
    6. User is automatically redirected to "Create Workspace" screen
    7. User enters workspace name
    8. Backend creates workspace, adds user as owner in workspace_members table
    9. User sees empty workspace dashboard

*Flow 2: Creating First Project*
    1. User clicks "New Project" from workspace dashboard
    2. Modal opens asking for project name and description
    3. User fills it in, clicks "Create"
    4. Backend creates project linked to current workspace
    5. User is redirected to project board (empty, no tasks yet)

*Flow 3: Creating and Assigning a Task*
    1. User clicks "Add Task" in a project
    2. Modal opens with fields: title, description, priority, assign to
    3. User fills title, selects priority, assigns to themselves
    4. Backend creates task with status='todo', assigned_to=user_id
    5. Task appears in "To Do" column instantly
    6. WebSocket event fires -> All users viewing this project see the new task appear in real-time

*Flow 4: Moving a Task (Real-time Update)*
    1. User drags task from "To Do" to "In Progress"
    2. Frontend optimistically updates UI immediately (instant)
    3. Frontend sends PUT /tasks/:id with { status: 'in_progress' }
    4. Backend updates task in database
    5. WebSocket event fires -> Broadcast to all users in this project
    6. Other users see the task move columns in real-time without refreshing

*Flow 5: Commenting on a task*
    1. User clicks on a task card
    2. Task detail modal opens showing title, description, comments
    3. User types a comment and hits "Post"
    4. Frontend sends POST /tasks/:taskId/comments
    5. Backend creates comment, creates notification for task asignee
    6. WebSocket event fires -> Comment appears instantly for all users viewing this task
    7. Assignee gets notification badge update in real-time

*Flow 6: Inviting a Team Member*
    1. Workspace owner clicks "Invite Member"
    2. Enters teammate's email
    3. Backend checks if user with that email exists
    4. If yes: adds them to workspace_members table with role='member'
    5. If no: returns error "User not found, they need to register first"
    6. New member sees this workspace appear in their workspace list
    7. (Future: send email invitation link)

**FEATURE PRIORITY**

**MVP (Must Have)**
    ✅ User registeration and login (JWT auth)
    ✅ Create workspace
    ✅ Invite existing users to workspace (manual, by email lookup)
    - Create projects within workspace
    - Create tasks with title, description, priority, status
    - Assign tasks to users
    - Move tasks between columns (status changes)
    - Real-time task updates via WebSockets
    - Comment on tasks
    - Basic notification (in-app only)

**Phase 2 (Nice to Have)**
    - Email invitation links for new users
    - Mark notifications as read
    - Task filtering (by assignee, priority, status)
    - User avatars
    - Workspace settings page
    - Delete workspace, project, taks

**Phase 3 (Polish)**
    - Redis caching for active workspaces/projects
    - Background job for notification emails
    - Search tasks across projects
    - Activity log (who did what when)
    - Deploy to production
    - Write comprehensive README with screenshots
    

Amaan Ali