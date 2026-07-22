--
-- PostgreSQL database dump
--

\restrict n9eaKbZfddm2tUd5eggbdaWug414sQ07Pb1l1JZ38I82UHCw1PDXZT0PcgJs3PN

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
    status public."AttendanceStatus" DEFAULT 'PRESENT'::public."AttendanceStatus" NOT NULL
);


ALTER TABLE public."Attendance" OWNER TO postgres;

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
-- Name: Issue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Issue" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    priority text DEFAULT 'Medium'::text NOT NULL,
    status text DEFAULT 'Open'::text NOT NULL,
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
-- Name: Task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
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
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
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
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Data for Name: Attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Attendance" (id, "userId", date, "punchType", "checkInTime", "checkInLat", "checkInLng", "checkInPhotoUrl", "checkOutTime", "checkOutLat", "checkOutLng", "checkOutPhotoUrl", status) FROM stdin;
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
demo-corp-company	Demo Corp	2026-05-15 15:08:15.526
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
-- Data for Name: Issue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Issue" (id, title, description, priority, status, "startDate", "reportedById", "assigneeId", "companyId", "createdAt", "updatedAt") FROM stdin;
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
cmp73h7nx0001ondo5a19zfq1	cmp71xz090007jsdu0npv94qo	2026-05-15 15:50:46.553	2026-05-15 15:50:46.553	jsw\n	PENDING	\N	demo-corp-company	2026-05-15 15:51:13.651	2026-05-15 15:51:13.651
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
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Task" (id, title, description, status, "assignedToId", "assignedById", "dueDate", lat, lng, "isRepeating", "repeatFrequency", "repeatDays", "repeatDates", "skipHolidays", "completionPhotoUrl", "completionRemarks", "projectId", priority, points, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Template; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Template" (id, name, type, priority, "startTime", "dueTime", recurrence, description, data, rating, "usageCount", "createdById", "companyId", "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, name, email, "passwordHash", phone, role, "workMode", designation, "joiningDate", "avatarUrl", "shiftStart", "shiftEnd", "baseSalary", "companyId", "managerId", "groupId", "createdAt", "updatedAt") FROM stdin;
cmp71xyzr0001jsduq57gsear	Global SuperAdmin	superadmin@gmail.com	$2a$12$ceWrVp6skP7LwosnmpcfN.xKhJ9bzyqCqgEM0ZjExT/wL6JUug58O	0000000000	SUPERADMIN	OFFICE	\N	2026-05-15 15:08:16.356	\N	09:00	18:00	0	demo-corp-company	\N	\N	2026-05-15 15:08:16.356	2026-05-15 15:08:16.356
cmp71xyzy0003jsdu8q9bojrq	Demo Admin	admin@demo.com	$2a$12$aRhaeVgClhaj7qgXdatekeM5lPWdiyF5SpLZpSbnS7FVhpXJ4We9y	9000000001	ADMIN	FIELD	\N	2026-05-15 15:08:16.366	\N	09:00	18:00	0	demo-corp-company	\N	\N	2026-05-15 15:08:16.366	2026-05-15 15:08:16.366
cmp71xz040005jsdux6dnmgh9	Demo Manager	manager@demo.com	$2a$12$aRhaeVgClhaj7qgXdatekeM5lPWdiyF5SpLZpSbnS7FVhpXJ4We9y	9000000002	MANAGER	FIELD	\N	2026-05-15 15:08:16.372	\N	09:00	18:00	0	demo-corp-company	cmp71xyzy0003jsdu8q9bojrq	\N	2026-05-15 15:08:16.372	2026-05-15 15:08:16.372
cmp71xz090007jsdu0npv94qo	Aarav Field	employee1@demo.com	$2a$12$aRhaeVgClhaj7qgXdatekeM5lPWdiyF5SpLZpSbnS7FVhpXJ4We9y	9000000003	EMPLOYEE	FIELD	\N	2026-05-15 15:08:16.377	\N	09:00	18:00	0	demo-corp-company	cmp71xz040005jsdux6dnmgh9	\N	2026-05-15 15:08:16.377	2026-05-15 15:08:16.377
cmp71xz0e0009jsduo7aho17t	Diya Route	employee2@demo.com	$2a$12$aRhaeVgClhaj7qgXdatekeM5lPWdiyF5SpLZpSbnS7FVhpXJ4We9y	9000000004	EMPLOYEE	FIELD	\N	2026-05-15 15:08:16.382	\N	09:00	18:00	0	demo-corp-company	cmp71xz040005jsdux6dnmgh9	\N	2026-05-15 15:08:16.382	2026-05-15 15:08:16.382
cmp71xz0j000bjsdu0wz3o7s7	Kabir Office	employee3@demo.com	$2a$12$aRhaeVgClhaj7qgXdatekeM5lPWdiyF5SpLZpSbnS7FVhpXJ4We9y	9000000005	EMPLOYEE	OFFICE	\N	2026-05-15 15:08:16.387	\N	09:00	18:00	0	demo-corp-company	cmp71xz040005jsdux6dnmgh9	\N	2026-05-15 15:08:16.387	2026-05-15 15:08:16.387
\.


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
-- Name: Attendance_userId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Attendance_userId_date_idx" ON public."Attendance" USING btree ("userId", date);


--
-- Name: Attendance_userId_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Attendance_userId_date_key" ON public."Attendance" USING btree ("userId", date);


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
-- Name: Task Task_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: User User_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict n9eaKbZfddm2tUd5eggbdaWug414sQ07Pb1l1JZ38I82UHCw1PDXZT0PcgJs3PN

