# CAMPZEN
## Multi-College Academic Platform
### Software Project Management & System Design Document (Consolidated)

---

## 1. Project Overview

**Project Name:** Campzen
**Category:** Multi-College Academic Network / ERP Platform  
**Target Context:** Hackathon-ready, scalable web application

### 1.1 Core Idea
Poly Network is a **multi-tenant academic web platform** where **multiple colleges** can independently create and manage their own digital academic ecosystems. Each college operates in **strict isolation**, with its own administrators, teachers, students, academic structure, timetables, attendance system, assessments, and student-support tools.

### 1.2 Objectives
- Support **multiple colleges** on a single platform
- Provide end-to-end academic tooling (quizzes, materials, timetables)
- Implement a **robust attendance & student tracker system**
- Ensure **data isolation, accountability, and realism**
- Be fully functional, demo-ready, and extensible

---

## 2. Technology Stack

### 2.1 Final Tech Stack

- **Frontend:** React.js
- **Backend:** Node.js (Express.js)
- **Database:** Firebase Firestore
- **Authentication:** Firebase Authentication
- **Charts & Analytics:** Chart.js / Recharts
- **Hosting:** Firebase Hosting (optional)

### 2.2 Firebase Clarification

- Firebase is a **Backend-as-a-Service (BaaS)**
- ❌ No server hosting required by the team
- ✅ Interaction is via SDKs and APIs
- Optional Firebase Cloud Functions may be used for secure logic

---

## 3. Multi-Tenant Architecture

### 3.1 College Isolation Rule (Critical)

Every entity in the system belongs to **exactly one college**.

**Hard Rule:**
> No document or record may exist without a `college_id`.

### 3.2 College Identification

- `college_id`: System-generated (UUID, internal)
- `college_code`: Human-readable, unique (used during login)

### 3.3 Login Pattern (All Roles)
```
College Code
User ID (PIN / UID / Admin username)
Password
```

---

## 4. User Roles & Permission Model

### 4.1 Roles

1. **Admin (College-level)**
2. **Teacher**
3. **Student**

No additional roles are created.

### 4.2 Teacher Flags

Teachers may have:
- `is_class_teacher: true | false`
- `class_id_assigned`

A **class teacher is also a subject teacher**, but not vice versa.

---

## 5. Academic Structure

### 5.1 Core Academic Unit: Class

Hierarchy is flattened for simplicity and performance.

Each **Class** contains:
- college_id
- branch
- year
- semester
- section
- pin_validation_rule

---

## 6. PIN Number Validation System

Colleges use different roll number formats. Poly Network supports **configurable PIN validation per class**.

### 6.1 Supported Validation Types

1. **Regex Pattern (Recommended)**  
Example:
```
^24093\sCM\s[0-9]{3}$
```

2. **Numeric Range**  
Example:
```
min: 198
max: 239
```

### 6.2 Registration Flow

1. Student selects college and class
2. Enters PIN
3. System validates PIN using class rule
4. Registration succeeds or fails

---

## 7. Student Module

### 7.1 Registration

Fields:
- Name
- PIN Number
- Password
- Branch
- Year
- Semester
- Section
- Parent Phone Number

Passwords handled via Firebase Authentication.

### 7.2 Student Capabilities

- Attempt quizzes
- View quiz marks
- View and search study materials
- Raise concerns (anonymous / non-anonymous)

❌ Students **cannot view attendance**.

---

## 8. Teacher Module

### 8.1 Account Creation

- Teachers cannot self-register
- Accounts are created by Admin
- Each teacher has a unique **3-letter UID**

---

### 8.2 Teaching Assignments

Each assignment defines:
- teacher_uid
- class_id
- subject
- max_periods_per_week
- max_periods_per_day

This governs quizzes, materials, and timetables.

---

### 8.3 Quiz System

- MCQ-based (4 options, 1 correct)
- Targeted to class or section
- States: Draft → Active → Ended
- No time limits
- Manual end by teacher

Anti-copy measures:
- Question shuffling per student
- Option shuffling per question

---

### 8.4 Materials

- PDF / DOCX uploads only
- Tagged by class, subject, semester
- Editable and deletable by owner

---

## 9. Attendance System (Detailed)

### 9.1 Core Principles

- Attendance is **period-wise**
- Can be marked by **any authenticated teacher** (to support substitutes)
- Attendance is recorded **only once** per:
  - class + date + period

---

### 9.2 Attendance Marking Workflow

1. Teacher selects:
   - Class
   - Date (today or past)
   - Period
2. Student list loads
3. Teacher marks absentees/present
4. Teacher clicks **Submit**
5. Attendance is locked

If attendance already exists:
- System displays: *"Attendance already taken for this period"*

---

### 9.3 Editing Rules

| Role | Can Edit |
|------|----------|
| Subject Teacher | ❌ |
| Class Teacher | ✅ |
| Admin | ✅ |

Editable window:
- Today
- Yesterday
- Day before yesterday

Edits toggle **Present ↔ Absent** (no deletion unless admin override).

---

### 9.4 Accountability

Each attendance record stores:
- marked_by_teacher_uid
- timestamp

Class teacher can audit **who marked which period**.

---

## 10. Student Tracker (Class Teacher & Admin Only)

### 10.1 Access

- Class Teacher
- Admin

### 10.2 Features

- Student list (class-wise)
- Attendance views:
  - Period-wise
  - Day-wise
  - Monthly summary
- Quiz marks aggregation
- Performance graphs
- Parent alert button (simulated or real)

Students have **no access** to tracker.

---

## 11. Timetable System

### 11.1 College-Level Configuration

- Working days: Monday–Saturday
- Periods per day (configurable)
- Lunch after period 4
- Sunday is always a holiday

---

### 11.2 Daily Structure (Default)

- Periods 1–4
- Lunch
- Periods 5–7
- Period 8: Study Hour

Lunch and study hour are not schedulable.

---

### 11.3 Subject Rules

- Weekly subject limits enforced
- Max 2 theory periods per day
- No excessive consecutive periods

---

### 11.4 Lab Rules

Labs are treated as **block subjects**.

Configuration:
- block_size = 3 periods
- allowed starts = [1, 5]
- max one lab per day
- labs may repeat per week

---

### 11.5 Timetable Algorithm (High-Level)

1. Validate subject weekly loads
2. Validate teacher capacity
3. Place lab blocks first
4. Place theory subjects
5. Enforce:
   - no teacher clashes
   - no lunch overlap
   - daily and weekly limits

Failures return descriptive errors.

---

## 12. Concern (Reporting) System

### 12.1 Feature Name

**Raise a Concern**

### 12.2 Flow

- Student enters:
  - Reported student PIN
  - Category
  - Description
  - Anonymous toggle

- Sent to class teacher
- Teacher must respond within 30 days
- Else escalates to admin

Rate-limited and non-punitive.

---

## 13. Database Schema (Firestore Collections)

### Core Collections
- colleges
- admins
- teachers
- students
- classes
- teaching_assignments
- quizzes
- quiz_questions
- quiz_attempts
- materials
- timetables
- timetable_slots
- attendance_records
- concerns

All documents include `college_id`.

---

## 14. Design Guarantees

- Strict college data isolation
- Role-based permissions
- Attendance accountability
- Validation-driven timetable generation
- Hackathon-ready scalability

---

## 15. Project Status

✔ Requirements consolidated  
✔ Architecture finalized  
✔ Attendance & timetable logic locked

**Next Steps:**
- Firestore security rules
- Timetable & attendance implementation
- UI dashboards
- Demo & pitch preparation

---

**Document Type:** Software Project Management & System Design Specification  
**Project:** Poly Network

