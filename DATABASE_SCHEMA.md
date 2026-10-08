# CivicFix Database Schema

This document outlines the PostgreSQL + PostGIS database schema for the CivicFix platform, constructed across all migrations.

## Enum Types

* **`user_role`**: `'USER'`, `'ADMIN'`, `'SUPER_ADMIN'`
* **`account_status`**: `'PENDING'`, `'ACTIVE'`, `'SUSPENDED'`
* **`node_status`**: `'ACTIVE'`, `'CONTESTED'`, `'NEEDS_VERIFICATION'`, `'RESOLVED'`, `'ARCHIVED'`
* **`user_action`**: `'INITIAL_REPORT'`, `'CONFIRM_FIXED'`, `'FLAG_SPAM'`, `'STILL_EXISTS'`
* **`region_type`**: `'CITY'`, `'WARD'`, `'LOCALITY'`
* **`otp_purpose`**: `'CITIZEN_SIGNUP'`, `'ADMIN_SIGNUP'`, `'ADMIN_SIGNUP_SUPER'`, `'PASSWORD_RESET'`, `'ADMIN_EDIT'`, `'USER_DELETE'`, `'ADMIN_DELETE'`, `'ADMIN_DELETE_SUPER'`

---

## Tables

### `regions`
Stores geographical boundaries for administrative regions.
* `id` (uuid) - Primary Key
* `name` (varchar) - Unique
* `parent_region_id` (uuid) - Foreign Key to `regions`
* `type` (region_type)
* `boundary` (geometry: MultiPolygon) - Used for spatial queries
* `created_at` (timestamp)

### `users`
Stores user accounts for citizens and administrators.
* `id` (uuid) - Primary Key
* `email_hash` (varchar) - Unique, hashed email for quick lookup
* `email_encrypted` (text) - Reversibly-encrypted email for notifications
* `password_hash` (varchar)
* `role` (user_role)
* `status` (account_status)
* `region_id` (uuid) - Foreign Key to `regions`
* `name` (varchar)
* `address` (text)
* `phone_number` (varchar)
* `created_at` (timestamp)

### `issue_nodes`
The core table representing civic issues reported on the map.
* `id` (uuid) - Primary Key
* `h3_index` (varchar) - H3 spatial index for clustering
* `coordinates` (geometry: Point) - Exact location
* `title` (varchar)
* `description` (text)
* `category` (varchar)
* `density_score` (integer) - Tracks density/severity of the issue
* `likes_count` (integer)
* `flag_count` (integer)
* `status` (node_status)
* `region_id` (uuid) - Foreign Key to `regions`
* `resolution_deadline` (timestamp)
* `contested_at` (timestamp)
* `last_escalated_at` (timestamp)
* `escalation_count` (integer)
* `verification_started_at` (timestamp) - Tracks when the latest verification window opened
* `created_at` (timestamp)
* `updated_at` (timestamp)

### `issue_reports`
An immutable action log that acts as the source of truth for consensus and multi-image proofs.
* `id` (uuid) - Primary Key
* `issue_node_id` (uuid) - Foreign Key to `issue_nodes`
* `user_id` (uuid) - Foreign Key to `users`
* `action_type` (user_action)
* `image_url` (text) - Primary proof image
* `proof_images` (text[]) - Array of additional proof images
* `created_at` (timestamp)
*(Note: A unique constraint ensures one action of each type per user per node to prevent Sybil attacks).*

### `issue_comments`
Stores discussion comments on issues.
* `id` (uuid) - Primary Key
* `issue_node_id` (uuid) - Foreign Key to `issue_nodes`
* `user_id` (uuid) - Foreign Key to `users`
* `content` (text)
* `created_at` (timestamp)

### `issue_likes`
Tracks which users have liked which issues.
* `issue_node_id` (uuid) - Primary Key / Foreign Key
* `user_id` (uuid) - Primary Key / Foreign Key
* `created_at` (timestamp)

### `notifications`
In-app notifications for users.
* `id` (uuid) - Primary Key
* `user_id` (uuid) - Foreign Key to `users`
* `type` (varchar)
* `title` (varchar)
* `body` (text)
* `link` (varchar)
* `read` (boolean)
* `created_at` (timestamp)

### `otp_codes`
Persisted OTP store for secure, horizontally scalable authentication.
* `id` (uuid) - Primary Key
* `email_hash` (varchar)
* `purpose` (otp_purpose)
* `code_hash` (varchar)
* `attempts` (integer)
* `consumed` (boolean)
* `expires_at` (timestamp)
* `created_at` (timestamp)
