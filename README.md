# CivicFix

CivicFix is a decentralized civic accountability engine that empowers citizens to report, track, and resolve local civic issues. 

## Tech Stack

### Frontend
- React 19
- Vite
- Tailwind CSS
- Framer Motion for animations
- Leaflet for maps

### Backend
- Node.js & Express
- PostgreSQL with PostGIS for spatial data
- H3-js for spatial indexing
- Cloudinary for image uploads
- JWT for authentication

## Project Structure
- `/web` - Frontend React application
- `/server` - Backend Node.js/Express server

## Getting Started

### Prerequisites
- Node.js (>= 18.17)
- PostgreSQL with PostGIS extension
- Cloudinary account for media storage

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/usmanalix03/CivicFix.git
   ```

2. **Backend Setup:**
   ```bash
   cd server
   npm install
   ```
   Create a `.env` file in the `/server` directory and add the required environment variables (e.g., database connection string, Cloudinary credentials, JWT secret).

   Run database migrations and seed the super admin:
   ```bash
   npm run migrate
   npm run seed:superadmin
   ```
   
   Start the backend server:
   ```bash
   npm run dev
   ```

3. **Frontend Setup:**
   ```bash
   cd web
   npm install
   npm run dev
   ```

## License
MIT License
