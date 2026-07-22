# StaffTrack Backup Package

This folder contains **ONLY** the backup assets and database dumps for **StaffTrack** (`stafftrack.cloud`) to migrate to a new server.

## Directory Structure

```
stafftrack_backup/
├── .env                       # Environment configuration file (PostgreSQL, JWT, Port 4000)
├── uploads/                   # Media uploads and APK files (~1.3 GB)
├── postgres_backup/           # PostgreSQL Database Dumps
│   ├── stafftrack_db.sql      # Main database dump (25 tables)
│   └── stafftrack.sql         # Legacy/Secondary database dump (19 tables)
├── nginx/                     # Nginx server block configuration for stafftrack
├── letsencrypt/               # SSL Certificates backup (stafftrack.cloud)
└── README.md                  # Restore instructions
```

## Restore Instructions for New Server

### 1. PostgreSQL Database Restore
Create the database on PostgreSQL and import the SQL dump:
```bash
# Create database
createdb -U postgres stafftrack_db

# Restore SQL dump
psql -U postgres -d stafftrack_db -f ./postgres_backup/stafftrack_db.sql
```

If you also need the `stafftrack` database:
```bash
createdb -U postgres stafftrack
psql -U postgres -d stafftrack -f ./postgres_backup/stafftrack.sql
```

### 2. Uploads Directory
Copy the `uploads` folder to your application directory on the new server:
```bash
cp -r ./uploads /var/www/stafftrack/
```

### 3. Environment File
Copy `.env` to your application backend directory:
```bash
cp .env /var/www/stafftrack/backend/.env
```
