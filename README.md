# StaffTrack - Advanced Administrative Dashboard

![Deploy](https://github.com/mebishnusahu0595/StaffTrack/actions/workflows/deploy.yml/badge.svg)

StaffTrack is a comprehensive, production-ready employee management system designed for companies with both office-based and field-based teams. It provides a robust suite of tools for real-time tracking, attendance automation, payroll processing, and task management.

## 🚀 Key Features

### 1. **Payroll & Attendance System**
- **Automated Salary Calculation**: Logic-driven payroll that calculates net salary based on present days, half-days, and absences.
- **Holiday Protection**: Admins can mark holidays for the whole company, specific groups, or individuals, ensuring no salary is deducted for these days.
- **Joining Date Sync**: Automatically calculates salary from the employee's official joining date onwards.
- **Daily Mapping**: Visual calendar breakdown for each employee's attendance status.

### 2. **Task Management Console**
- **Advanced Filtering**: Categorize tasks by Today, Ongoing, Overdue, Scheduled, and more.
- **Visual Control**: Support for List, Board, and Calendar views.
- **Repeating Tasks**: Automated creation of recurring tasks (Daily, Weekly, Monthly).
- **Points & Priority**: Assign performance points and priority levels to tasks for better oversight.

### 3. **Field Monitoring & GPS Tracking**
- **Live Command Center**: Real-time location tracking for field staff.
- **Punch-In/Out with Photos**: Mandatory photo verification for attendance with GPS coordinates.
- **Distance Tracking**: Automated calculation of KM travelled by field staff for expense reimbursement.

### 4. **Group-Based Management**
- **Organizational Hierarchy**: Group users by department or region.
- **Group Protocols**: Assign base salaries and policies at the group level for bulk management.

### 5. **Premium Design Language**
- **White & Blue Aesthetic**: Professional, clean, and modern interface optimized for administrative focus.
- **Responsive & Interactive**: Built with Next.js, Radix UI, and Lucide Icons for a seamless user experience.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, Tailwind CSS, TanStack Query, Radix UI, Lucide Icons.
- **Backend**: Express.js, Node.js, Prisma ORM.
- **Database**: PostgreSQL / SQLite (Prisma-compatible).
- **Real-time**: WebSockets (Socket.io) for live updates.

---

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm (Recommended) or npm/yarn
- PostgreSQL Database

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mebishnusahu0595/StaffTrack.git
   cd StaffTrack
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up Environment Variables**:
   Create a `.env` file in the root and backend directories following the `.env.example` templates.

4. **Database Migration**:
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma db seed
   ```

5. **Run the Development Environment**:
   From the root:
   ```bash
   pnpm dev
   ```

---

## 📸 Dashboard Preview

StaffTrack uses a high-contrast, premium blue-and-white theme designed for clarity and efficiency. The "Task Control" and "Payroll Console" provide deep analytical insights into your workforce's daily activity.

---

## 📄 License
This project is licensed under the MIT License.

## 👥 Contributors
Developed by [Bishnu Sahu](https://github.com/mebishnusahu0595) & Team.


.
<!-- CI/CD Test Wed Jul 22 13:13:51 IST 2026 -->
