--
-- PostgreSQL database dump
--

\restrict 3zXoxqfy6XCz5Tz6r2mOFD5KuNLaDTNYgr3dltHiiN2eQhH8PaxcBgF7cytJnRb

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AttendanceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT',
    'HALF_DAY',
    'ON_LEAVE'
);


ALTER TYPE public."AttendanceStatus" OWNER TO postgres;

--
-- Name: ExpenseCategory; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ExpenseCategory" AS ENUM (
    'TRAVEL',
    'FOOD',
    'ACCOMMODATION',
    'OTHER'
);


ALTER TYPE public."ExpenseCategory" OWNER TO postgres;

--
-- Name: LeaveStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LeaveStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."LeaveStatus" OWNER TO postgres;

--
-- Name: PunchType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PunchType" AS ENUM (
    'OFFICE',
    'FIELD'
);


ALTER TYPE public."PunchType" OWNER TO postgres;

--
-- Name: RequestStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."RequestStatus" OWNER TO postgres;

--
-- Name: SalarySlipStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SalarySlipStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED'
);


ALTER TYPE public."SalarySlipStatus" OWNER TO postgres;

--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."TaskStatus" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'SUPERADMIN',
    'ADMIN',
    'MANAGER',
    'EMPLOYEE'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

--
-- Name: WorkMode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."WorkMode" AS ENUM (
    'OFFICE',
    'FIELD',
    'BOTH'
);


ALTER TYPE public."WorkMode" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Attendance" (
    id text NOT NULL,
    "userId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "punchType" public."PunchType",
    "checkInTime" timestamp(3) without time zone,
    "checkInLat" double precision,
    "checkInLng" double precision,
    "checkInPhotoUrl" text,
    "checkOutTime" timestamp(3) without time zone,
    "checkOutLat" double precision,
    "checkOutLng" double precision,
    "checkOutPhotoUrl" text,
    status public."AttendanceStatus" DEFAULT 'PRESENT'::public."AttendanceStatus" NOT NULL,
    "endOdometerPhotoUrl" text,
    "startOdometerPhotoUrl" text,
    "endOdometer" double precision,
    "startOdometer" double precision,
    "checkInApproved" boolean DEFAULT true NOT NULL,
    "checkInApprovedAt" timestamp(3) without time zone,
    "checkInApprovedBy" text,
    "isCheckInPending" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Attendance" OWNER TO postgres;

--
-- Name: AttendanceRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AttendanceRequest" (
    id text NOT NULL,
    "userId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    type text DEFAULT 'New Punch Added'::text NOT NULL,
    "punchType" public."PunchType" DEFAULT 'OFFICE'::public."PunchType" NOT NULL,
    "checkInTime" timestamp(3) without time zone,
    "checkOutTime" timestamp(3) without time zone,
    reason text NOT NULL,
    status public."RequestStatus" DEFAULT 'PENDING'::public."RequestStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AttendanceRequest" OWNER TO postgres;

--
-- Name: Break; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Break" (
    id text NOT NULL,
    "attendanceId" text NOT NULL,
    "startTime" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endTime" timestamp(3) without time zone
);


ALTER TABLE public."Break" OWNER TO postgres;

--
-- Name: Company; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Company" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Company" OWNER TO postgres;

--
-- Name: DayEndReport; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DayEndReport" (
    id text NOT NULL,
    "userId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "visitsSummary" text NOT NULL,
    "ordersTaken" integer NOT NULL,
    "ordersCancelled" integer NOT NULL,
    "kmTravelled" double precision NOT NULL,
    "kmPhotoUrl" text,
    "startOdometer" double precision,
    "endOdometer" double precision,
    "startOdometerPhotoUrl" text,
    remarks text NOT NULL,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DayEndReport" OWNER TO postgres;

--
-- Name: Expense; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Expense" (
    id text NOT NULL,
    "userId" text NOT NULL,
    category public."ExpenseCategory" NOT NULL,
    amount double precision NOT NULL,
    description text NOT NULL,
    "receiptUrl" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    "approvedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Expense" OWNER TO postgres;

--
-- Name: Form; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Form" (
    id text NOT NULL,
    name text NOT NULL,
    category text,
    status text DEFAULT 'Published'::text NOT NULL,
    "createdById" text,
    "companyId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Form" OWNER TO postgres;

--
-- Name: FormField; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FormField" (
    id text NOT NULL,
    "formId" text NOT NULL,
    label text NOT NULL,
    type text NOT NULL,
    required boolean DEFAULT false NOT NULL,
    options text
);


ALTER TABLE public."FormField" OWNER TO postgres;

--
-- Name: FormResponse; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FormResponse" (
    id text NOT NULL,
    "formId" text NOT NULL,
    "userId" text NOT NULL,
    data text NOT NULL,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FormResponse" OWNER TO postgres;

--
-- Name: Group; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Group" (
    id text NOT NULL,
    name text NOT NULL,
    "baseSalary" double precision DEFAULT 0 NOT NULL,
    "companyId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Group" OWNER TO postgres;

--
-- Name: Holiday; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Holiday" (
    id text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    name text NOT NULL,
    description text,
    type text DEFAULT 'HOLIDAY'::text NOT NULL,
    "companyId" text NOT NULL,
    "groupId" text,
    "userId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Holiday" OWNER TO postgres;

--
-- Name: HolidayTemplate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HolidayTemplate" (
    id text NOT NULL,
    name text NOT NULL,
    "companyId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."HolidayTemplate" OWNER TO postgres;

--
-- Name: HolidayTemplateItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HolidayTemplateItem" (
    id text NOT NULL,
    "templateId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."HolidayTemplateItem" OWNER TO postgres;

--
-- Name: Issue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Issue" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    priority text DEFAULT 'Medium'::text NOT NULL,
    status text DEFAULT 'Open'::text NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    department text,
    "projectId" text,
    "startDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reportedById" text NOT NULL,
    "assigneeId" text,
    "companyId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Issue" OWNER TO postgres;

--
-- Name: IssueUpdate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."IssueUpdate" (
    id text NOT NULL,
    "issueId" text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    content text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."IssueUpdate" OWNER TO postgres;

--
-- Name: LeaveRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LeaveRequest" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    reason text NOT NULL,
    status public."LeaveStatus" DEFAULT 'PENDING'::public."LeaveStatus" NOT NULL,
    "approvedById" text,
    "companyId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LeaveRequest" OWNER TO postgres;

--
-- Name: LeaveType; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LeaveType" (
    id text NOT NULL,
    name text NOT NULL,
    alias text NOT NULL,
    description text,
    "autoAllocationCount" double precision NOT NULL,
    "autoAllocationFreq" text NOT NULL,
    "carryForward" double precision NOT NULL,
    "carryForwardFreq" text NOT NULL,
    encashment boolean DEFAULT false NOT NULL,
    "leaveCycle" text DEFAULT 'CALENDAR'::text NOT NULL,
    "companyId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LeaveType" OWNER TO postgres;

--
-- Name: LocationLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LocationLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    accuracy double precision NOT NULL,
    "batteryLevel" double precision,
    "timestamp" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LocationLog" OWNER TO postgres;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO postgres;

--
-- Name: Project; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'Ongoing'::text NOT NULL,
    "companyId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Project" OWNER TO postgres;

--
-- Name: SalarySlip; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SalarySlip" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "companyId" text NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    status public."SalarySlipStatus" DEFAULT 'DRAFT'::public."SalarySlipStatus" NOT NULL,
    "orgName" text,
    "orgSubtitle" text,
    "orgCode" text,
    "logoUrl" text,
    "companyCode" text,
    "bankName" text,
    "bankAccountNo" text,
    "ifscCode" text,
    "departmentName" text,
    "divisionName" text,
    designation text,
    "traineeType" text,
    "aadhaarNumber" text,
    "monthDays" double precision,
    "payableDays" double precision,
    earnings jsonb,
    deductions jsonb,
    "netPay" double precision DEFAULT 0 NOT NULL,
    "netPayWords" text,
    remarks text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SalarySlip" OWNER TO postgres;

--
-- Name: SyncDevice; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SyncDevice" (
    id text NOT NULL,
    name text NOT NULL,
    "macAddress" text NOT NULL,
    "lastSync" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'Offline'::text NOT NULL,
    "companyId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SyncDevice" OWNER TO postgres;

--
-- Name: Task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    status public."TaskStatus" DEFAULT 'PENDING'::public."TaskStatus" NOT NULL,
    "assignedToId" text NOT NULL,
    "assignedById" text NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    lat double precision,
    lng double precision,
    "isRepeating" boolean DEFAULT false NOT NULL,
    "repeatFrequency" text,
    "repeatDays" text,
    "repeatDates" text,
    "skipHolidays" boolean DEFAULT false NOT NULL,
    "completionPhotoUrl" text,
    "completionRemarks" text,
    "projectId" text,
    priority text DEFAULT 'Medium'::text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    "parentTaskId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "completionLat" double precision,
    "completionLng" double precision,
    "attachmentName" text,
    "attachmentUrl" text,
    checklist jsonb,
    "checklistResponses" jsonb,
    "endDate" timestamp(3) without time zone,
    "geofenceLat" double precision,
    "geofenceLng" double precision,
    "geofenceRadius" double precision,
    "isSubtask" boolean DEFAULT false NOT NULL,
    reminder integer,
    "startDate" timestamp(3) without time zone,
    "templateId" text,
    validations jsonb
);


ALTER TABLE public."Task" OWNER TO postgres;

--
-- Name: Template; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Template" (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    priority text DEFAULT 'Medium'::text NOT NULL,
    "startTime" text,
    "dueTime" text,
    recurrence text,
    description text,
    data text DEFAULT '{}'::text NOT NULL,
    rating double precision DEFAULT 0 NOT NULL,
    "usageCount" integer DEFAULT 0 NOT NULL,
    "createdById" text,
    "companyId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Template" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    phone text NOT NULL,
    role public."UserRole" NOT NULL,
    "workMode" public."WorkMode" DEFAULT 'FIELD'::public."WorkMode" NOT NULL,
    designation text,
    "joiningDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "avatarUrl" text,
    "shiftStart" text DEFAULT '09:00'::text NOT NULL,
    "shiftEnd" text DEFAULT '18:00'::text NOT NULL,
    "baseSalary" double precision DEFAULT 0 NOT NULL,
    "companyId" text NOT NULL,
    "managerId" text,
    "groupId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "holidayTemplateId" text,
    "expoPushToken" text,
    "travelRate" double precision DEFAULT 5.0 NOT NULL,
    "batteryLevel" integer,
    "isLocationOn" boolean DEFAULT true NOT NULL,
    "locationOffAt" timestamp(3) without time zone
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Data for Name: Attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Attendance" (id, "userId", date, "punchType", "checkInTime", "checkInLat", "checkInLng", "checkInPhotoUrl", "checkOutTime", "checkOutLat", "checkOutLng", "checkOutPhotoUrl", status, "endOdometerPhotoUrl", "startOdometerPhotoUrl", "endOdometer", "startOdometer", "checkInApproved", "checkInApprovedAt", "checkInApprovedBy", "isCheckInPending") FROM stdin;
\.


--
-- Data for Name: AttendanceRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AttendanceRequest" (id, "userId", date, type, "punchType", "checkInTime", "checkOutTime", reason, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Break; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Break" (id, "attendanceId", "startTime", "endTime") FROM stdin;
\.


--
-- Data for Name: Company; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Company" (id, name, "createdAt") FROM stdin;
\.


--
-- Data for Name: DayEndReport; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DayEndReport" (id, "userId", date, "visitsSummary", "ordersTaken", "ordersCancelled", "kmTravelled", "kmPhotoUrl", "startOdometer", "endOdometer", "startOdometerPhotoUrl", remarks, "submittedAt") FROM stdin;
\.


--
-- Data for Name: Expense; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Expense" (id, "userId", category, amount, description, "receiptUrl", date, approved, "approvedById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Form; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Form" (id, name, category, status, "createdById", "companyId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: FormField; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FormField" (id, "formId", label, type, required, options) FROM stdin;
\.


--
-- Data for Name: FormResponse; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FormResponse" (id, "formId", "userId", data, "submittedAt") FROM stdin;
\.


--
-- Data for Name: Group; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Group" (id, name, "baseSalary", "companyId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Holiday; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Holiday" (id, date, name, description, type, "companyId", "groupId", "userId", "createdAt") FROM stdin;
\.


--
-- Data for Name: HolidayTemplate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HolidayTemplate" (id, name, "companyId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: HolidayTemplateItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HolidayTemplateItem" (id, "templateId", date, name, description, "createdAt") FROM stdin;
\.


--
-- Data for Name: Issue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Issue" (id, title, description, priority, status, category, department, "projectId", "startDate", "reportedById", "assigneeId", "companyId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: IssueUpdate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."IssueUpdate" (id, "issueId", "userId", type, content, "createdAt") FROM stdin;
\.


--
-- Data for Name: LeaveRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LeaveRequest" (id, "userId", "startDate", "endDate", reason, status, "approvedById", "companyId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: LeaveType; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LeaveType" (id, name, alias, description, "autoAllocationCount", "autoAllocationFreq", "carryForward", "carryForwardFreq", encashment, "leaveCycle", "companyId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: LocationLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LocationLog" (id, "userId", lat, lng, accuracy, "batteryLevel", "timestamp") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Notification" (id, "userId", title, message, type, "isRead", "createdAt") FROM stdin;
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Project" (id, name, description, status, "companyId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SalarySlip; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SalarySlip" (id, "userId", "companyId", month, year, status, "orgName", "orgSubtitle", "orgCode", "logoUrl", "companyCode", "bankName", "bankAccountNo", "ifscCode", "departmentName", "divisionName", designation, "traineeType", "aadhaarNumber", "monthDays", "payableDays", earnings, deductions, "netPay", "netPayWords", remarks, "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SyncDevice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SyncDevice" (id, name, "macAddress", "lastSync", status, "companyId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Task" (id, title, description, status, "assignedToId", "assignedById", "dueDate", lat, lng, "isRepeating", "repeatFrequency", "repeatDays", "repeatDates", "skipHolidays", "completionPhotoUrl", "completionRemarks", "projectId", priority, points, "parentTaskId", "createdAt", "updatedAt", "completionLat", "completionLng", "attachmentName", "attachmentUrl", checklist, "checklistResponses", "endDate", "geofenceLat", "geofenceLng", "geofenceRadius", "isSubtask", reminder, "startDate", "templateId", validations) FROM stdin;
\.


--
-- Data for Name: Template; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Template" (id, name, type, priority, "startTime", "dueTime", recurrence, description, data, rating, "usageCount", "createdById", "companyId", "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, name, email, "passwordHash", phone, role, "workMode", designation, "joiningDate", "avatarUrl", "shiftStart", "shiftEnd", "baseSalary", "companyId", "managerId", "groupId", "createdAt", "updatedAt", "holidayTemplateId", "expoPushToken", "travelRate", "batteryLevel", "isLocationOn", "locationOffAt") FROM stdin;
\.


--
-- Name: AttendanceRequest AttendanceRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AttendanceRequest"
    ADD CONSTRAINT "AttendanceRequest_pkey" PRIMARY KEY (id);


--
-- Name: Attendance Attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY (id);


--
-- Name: Break Break_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Break"
    ADD CONSTRAINT "Break_pkey" PRIMARY KEY (id);


--
-- Name: Company Company_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Company"
    ADD CONSTRAINT "Company_pkey" PRIMARY KEY (id);


--
-- Name: DayEndReport DayEndReport_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DayEndReport"
    ADD CONSTRAINT "DayEndReport_pkey" PRIMARY KEY (id);


--
-- Name: Expense Expense_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_pkey" PRIMARY KEY (id);


--
-- Name: FormField FormField_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FormField"
    ADD CONSTRAINT "FormField_pkey" PRIMARY KEY (id);


--
-- Name: FormResponse FormResponse_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FormResponse"
    ADD CONSTRAINT "FormResponse_pkey" PRIMARY KEY (id);


--
-- Name: Form Form_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Form"
    ADD CONSTRAINT "Form_pkey" PRIMARY KEY (id);


--
-- Name: Group Group_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Group"
    ADD CONSTRAINT "Group_pkey" PRIMARY KEY (id);


--
-- Name: HolidayTemplateItem HolidayTemplateItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HolidayTemplateItem"
    ADD CONSTRAINT "HolidayTemplateItem_pkey" PRIMARY KEY (id);


--
-- Name: HolidayTemplate HolidayTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HolidayTemplate"
    ADD CONSTRAINT "HolidayTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Holiday Holiday_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Holiday"
    ADD CONSTRAINT "Holiday_pkey" PRIMARY KEY (id);


--
-- Name: IssueUpdate IssueUpdate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IssueUpdate"
    ADD CONSTRAINT "IssueUpdate_pkey" PRIMARY KEY (id);


--
-- Name: Issue Issue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Issue"
    ADD CONSTRAINT "Issue_pkey" PRIMARY KEY (id);


--
-- Name: LeaveRequest LeaveRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY (id);


--
-- Name: LeaveType LeaveType_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveType"
    ADD CONSTRAINT "LeaveType_pkey" PRIMARY KEY (id);


--
-- Name: LocationLog LocationLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LocationLog"
    ADD CONSTRAINT "LocationLog_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: SalarySlip SalarySlip_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SalarySlip"
    ADD CONSTRAINT "SalarySlip_pkey" PRIMARY KEY (id);


--
-- Name: SyncDevice SyncDevice_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SyncDevice"
    ADD CONSTRAINT "SyncDevice_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: Template Template_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Template"
    ADD CONSTRAINT "Template_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: AttendanceRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AttendanceRequest_status_idx" ON public."AttendanceRequest" USING btree (status);


--
-- Name: AttendanceRequest_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AttendanceRequest_userId_idx" ON public."AttendanceRequest" USING btree ("userId");


--
-- Name: Attendance_userId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Attendance_userId_date_idx" ON public."Attendance" USING btree ("userId", date);


--
-- Name: Break_attendanceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Break_attendanceId_idx" ON public."Break" USING btree ("attendanceId");


--
-- Name: DayEndReport_userId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DayEndReport_userId_date_idx" ON public."DayEndReport" USING btree ("userId", date);


--
-- Name: DayEndReport_userId_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DayEndReport_userId_date_key" ON public."DayEndReport" USING btree ("userId", date);


--
-- Name: Expense_approvedById_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Expense_approvedById_idx" ON public."Expense" USING btree ("approvedById");


--
-- Name: Expense_userId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Expense_userId_date_idx" ON public."Expense" USING btree ("userId", date);


--
-- Name: FormResponse_formId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "FormResponse_formId_idx" ON public."FormResponse" USING btree ("formId");


--
-- Name: FormResponse_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "FormResponse_userId_idx" ON public."FormResponse" USING btree ("userId");


--
-- Name: Form_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Form_companyId_idx" ON public."Form" USING btree ("companyId");


--
-- Name: Group_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Group_companyId_idx" ON public."Group" USING btree ("companyId");


--
-- Name: HolidayTemplateItem_templateId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HolidayTemplateItem_templateId_idx" ON public."HolidayTemplateItem" USING btree ("templateId");


--
-- Name: HolidayTemplate_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HolidayTemplate_companyId_idx" ON public."HolidayTemplate" USING btree ("companyId");


--
-- Name: Holiday_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Holiday_companyId_idx" ON public."Holiday" USING btree ("companyId");


--
-- Name: Holiday_groupId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Holiday_groupId_idx" ON public."Holiday" USING btree ("groupId");


--
-- Name: Holiday_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Holiday_userId_idx" ON public."Holiday" USING btree ("userId");


--
-- Name: IssueUpdate_issueId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IssueUpdate_issueId_idx" ON public."IssueUpdate" USING btree ("issueId");


--
-- Name: Issue_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Issue_companyId_idx" ON public."Issue" USING btree ("companyId");


--
-- Name: Issue_reportedById_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Issue_reportedById_idx" ON public."Issue" USING btree ("reportedById");


--
-- Name: LeaveRequest_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LeaveRequest_companyId_idx" ON public."LeaveRequest" USING btree ("companyId");


--
-- Name: LeaveRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LeaveRequest_status_idx" ON public."LeaveRequest" USING btree (status);


--
-- Name: LeaveRequest_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LeaveRequest_userId_idx" ON public."LeaveRequest" USING btree ("userId");


--
-- Name: LeaveType_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LeaveType_companyId_idx" ON public."LeaveType" USING btree ("companyId");


--
-- Name: LocationLog_userId_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LocationLog_userId_timestamp_idx" ON public."LocationLog" USING btree ("userId", "timestamp");


--
-- Name: Notification_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Notification_userId_idx" ON public."Notification" USING btree ("userId");


--
-- Name: Project_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Project_companyId_idx" ON public."Project" USING btree ("companyId");


--
-- Name: SalarySlip_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SalarySlip_companyId_idx" ON public."SalarySlip" USING btree ("companyId");


--
-- Name: SalarySlip_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SalarySlip_userId_idx" ON public."SalarySlip" USING btree ("userId");


--
-- Name: SalarySlip_userId_month_year_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SalarySlip_userId_month_year_key" ON public."SalarySlip" USING btree ("userId", month, year);


--
-- Name: SyncDevice_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SyncDevice_companyId_idx" ON public."SyncDevice" USING btree ("companyId");


--
-- Name: SyncDevice_macAddress_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SyncDevice_macAddress_key" ON public."SyncDevice" USING btree ("macAddress");


--
-- Name: Task_assignedById_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_assignedById_idx" ON public."Task" USING btree ("assignedById");


--
-- Name: Task_assignedToId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_assignedToId_idx" ON public."Task" USING btree ("assignedToId");


--
-- Name: Task_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_status_idx" ON public."Task" USING btree (status);


--
-- Name: Task_templateId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_templateId_idx" ON public."Task" USING btree ("templateId");


--
-- Name: User_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_companyId_idx" ON public."User" USING btree ("companyId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_groupId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_groupId_idx" ON public."User" USING btree ("groupId");


--
-- Name: User_managerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_managerId_idx" ON public."User" USING btree ("managerId");


--
-- Name: AttendanceRequest AttendanceRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AttendanceRequest"
    ADD CONSTRAINT "AttendanceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attendance Attendance_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Break Break_attendanceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Break"
    ADD CONSTRAINT "Break_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES public."Attendance"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DayEndReport DayEndReport_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DayEndReport"
    ADD CONSTRAINT "DayEndReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Expense Expense_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Expense Expense_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FormField FormField_formId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FormField"
    ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES public."Form"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FormResponse FormResponse_formId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FormResponse"
    ADD CONSTRAINT "FormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES public."Form"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FormResponse FormResponse_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FormResponse"
    ADD CONSTRAINT "FormResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Form Form_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Form"
    ADD CONSTRAINT "Form_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Form Form_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Form"
    ADD CONSTRAINT "Form_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Group Group_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Group"
    ADD CONSTRAINT "Group_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HolidayTemplateItem HolidayTemplateItem_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HolidayTemplateItem"
    ADD CONSTRAINT "HolidayTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."HolidayTemplate"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HolidayTemplate HolidayTemplate_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HolidayTemplate"
    ADD CONSTRAINT "HolidayTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Holiday Holiday_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Holiday"
    ADD CONSTRAINT "Holiday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IssueUpdate IssueUpdate_issueId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IssueUpdate"
    ADD CONSTRAINT "IssueUpdate_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES public."Issue"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IssueUpdate IssueUpdate_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IssueUpdate"
    ADD CONSTRAINT "IssueUpdate_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Issue Issue_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Issue"
    ADD CONSTRAINT "Issue_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Issue Issue_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Issue"
    ADD CONSTRAINT "Issue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Issue Issue_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Issue"
    ADD CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Issue Issue_reportedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Issue"
    ADD CONSTRAINT "Issue_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaveRequest LeaveRequest_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeaveRequest LeaveRequest_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaveRequest LeaveRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaveType LeaveType_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveType"
    ADD CONSTRAINT "LeaveType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LocationLog LocationLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LocationLog"
    ADD CONSTRAINT "LocationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SalarySlip SalarySlip_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SalarySlip"
    ADD CONSTRAINT "SalarySlip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SalarySlip SalarySlip_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SalarySlip"
    ADD CONSTRAINT "SalarySlip_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SyncDevice SyncDevice_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SyncDevice"
    ADD CONSTRAINT "SyncDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_assignedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_parentTaskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."Template"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."Group"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_holidayTemplateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_holidayTemplateId_fkey" FOREIGN KEY ("holidayTemplateId") REFERENCES public."HolidayTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 3zXoxqfy6XCz5Tz6r2mOFD5KuNLaDTNYgr3dltHiiN2eQhH8PaxcBgF7cytJnRb

