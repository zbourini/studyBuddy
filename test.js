const request = require('supertest');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

// Import the app from index.js
let app;

beforeAll(() => {
    // Recreate the app for each test run
    app = require('./index');
});

describe('User Registration', () => {
    it('should register a new user with valid Clemson email, password, name, and major', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                username: 'test@clemson.edu',
                password: 'password123',
                confirmPassword: 'password123',
                firstName: 'John',
                lastName: 'Doe',
                major: 'Computer Science'
            });
        expect(res.statusCode).toBe(302); // Redirect to login
    });

    it('should not register user with non-Clemson email', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                username: 'test@gmail.com',
                password: 'password123',
                confirmPassword: 'password123',
                firstName: 'John',
                lastName: 'Doe',
                major: 'Computer Science'
            });
        expect(res.statusCode).toBe(400);
        expect(res.text).toContain('Only Clemson emails are allowed');
    });

    it('should not register user with short password', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                username: 'test2@clemson.edu',
                password: 'short',
                confirmPassword: 'short',
                firstName: 'Jane',
                lastName: 'Smith',
                major: 'Math'
            });
        expect(res.statusCode).toBe(400);
        expect(res.text).toContain('Password must be at least 8 characters long');
    });
});

describe('User Login & Logout', () => {
    it('should login with valid credentials', async () => {
        // First, register
        await request(app)
            .post('/register')
            .send({
                username: 'login@clemson.edu',
                password: 'password123',
                confirmPassword: 'password123',
                firstName: 'Alice',
                lastName: 'Wonder',
                major: 'Physics'
            });
        // Then, login
        const res = await request(app)
            .post('/login')
            .send({
                username: 'login@clemson.edu',
                password: 'password123'
            });
        expect(res.statusCode).toBe(302); // Redirect to dashboard
    });

    it('should not login with invalid credentials', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'wrong@clemson.edu',
                password: 'wrongpassword'
            });
        expect(res.statusCode).toBe(400);
        expect(res.text).toContain('Invalid credentials');
    });
});

describe('Profile Management', () => {
    it('should allow user to view and update profile', async () => {
        // Register and login
        await request(app)
            .post('/register')
            .send({
                username: 'profile@clemson.edu',
                password: 'password123',
                confirmPassword: 'password123',
                firstName: 'Bob',
                lastName: 'Builder',
                major: 'Engineering'
            });
        const agent = request.agent(app);
        await agent
            .post('/login')
            .send({ username: 'profile@clemson.edu', password: 'password123' });
        // Update profile
        const res = await agent
            .post('/profile')
            .send({ name: 'Robert Builder', major: 'Civil Engineering' });
        expect(res.statusCode).toBe(302); // Redirect to profile
    });
});

describe('Course Management', () => {
    it('should allow user to add and remove courses', async () => {
        // Register and login
        await request(app)
            .post('/register')
            .send({
                username: 'course@clemson.edu',
                password: 'password123',
                confirmPassword: 'password123',
                firstName: 'Charlie',
                lastName: 'Brown',
                major: 'Art'
            });
        const agent = request.agent(app);
        await agent
            .post('/login')
            .send({ username: 'course@clemson.edu', password: 'password123' });
        // Add course
        let res = await agent
            .post('/courses/add')
            .send({ course: 'ART 1010' });
        expect(res.statusCode).toBe(302);
        // Remove course
        res = await agent
            .post('/courses/remove')
            .send({ course: 'ART 1010' });
        expect(res.statusCode).toBe(302);
    });
});

describe('Search for Classmates', () => {
    it('should find classmates in the same course', async () => {
        // Register user 1
        await request(app)
            .post('/register')
            .send({
                username: 'student1@clemson.edu',
                password: 'password123',
                confirmPassword: 'password123',
                firstName: 'Student',
                lastName: 'One',
                major: 'Biology'
            });

        // Register user 2
        await request(app)
            .post('/register')
            .send({
                username: 'student2@clemson.edu',
                password: 'password123',
                confirmPassword: 'password123',
                firstName: 'Student',
                lastName: 'Two',
                major: 'Biology'
            });

        // Login as student 1 and add a course
        const agent1 = request.agent(app);
        await agent1
            .post('/login')
            .send({ username: 'student1@clemson.edu', password: 'password123' });
        await agent1
            .post('/courses/add')
            .send({ course: 'BIOL 1010' });

        // Login as student 2 and search for that course
        const agent2 = request.agent(app);
        await agent2
            .post('/login')
            .send({ username: 'student2@clemson.edu', password: 'password123' });
        const res = await agent2
            .post('/search')
            .send({ course: 'BIOL 1010' });
        
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('student1@clemson.edu');
    });
});

describe('Availability', () => {
    it('should allow a user to set their availability', async () => {
        // Register a user
        await request(app)
            .post('/register')
            .send({
                username: 'avail@clemson.edu',
                password: 'password123',
                confirmPassword: 'password123',
                firstName: 'Ava',
                lastName: 'Ilable',
                major: 'Scheduling'
            });

        // Login and set availability
        const agent = request.agent(app);
        await agent
            .post('/login')
            .send({ username: 'avail@clemson.edu', password: 'password123' });
        
        const availability = ['Monday-10:00', 'Wednesday-14:00'];
        const res = await agent
            .post('/availability')
            .send({ availability });

        expect(res.statusCode).toBe(302); // Redirects to dashboard
        expect(res.header.location).toBe('/dashboard');
    });
});

describe('Study Session Requests', () => {
    it('should send a session request only if users share course and time', async () => {
        // Register two users
        await request(app).post('/register').send({
            username: 'req1@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Req', lastName: 'One', major: 'CS'
        });
        await request(app).post('/register').send({
            username: 'req2@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Req', lastName: 'Two', major: 'CS'
        });

        // Login users and set courses/availability
        const a1 = request.agent(app);
        await a1.post('/login').send({ username: 'req1@clemson.edu', password: 'password123' });
        await a1.post('/courses/add').send({ course: 'CPSC 2120' });
        await a1.post('/availability').send({ availability: ['Monday-10:00'] });

        const a2 = request.agent(app);
        await a2.post('/login').send({ username: 'req2@clemson.edu', password: 'password123' });
        await a2.post('/courses/add').send({ course: 'CPSC 2120' });
        await a2.post('/availability').send({ availability: ['Monday-10:00'] });

        // Find req1's id via users.json
        const usersRes = await a2.get('/users.json');
        const user1 = usersRes.body.find(u => u.username === 'req1@clemson.edu');

        // Send request from req2 to req1
        const sendRes = await a2.post('/send-request').send({
            recipientId: user1.id,
            course: 'CPSC 2120',
            timeSlot: 'Monday-10:00'
        });
        expect(sendRes.statusCode).toBe(302);
        expect(sendRes.header.location).toBe('/dashboard');

        // Verify it appears in req1's incoming
        const incomingAgent = request.agent(app);
        await incomingAgent.post('/login').send({ username: 'req1@clemson.edu', password: 'password123' });
        const reqsRes = await incomingAgent.get('/requests.json');
        expect(reqsRes.statusCode).toBe(200);
        const incoming = reqsRes.body.incoming;
        expect(incoming.length).toBeGreaterThan(0);
        expect(incoming[0].status).toBe('pending');
    });

    it('should accept and decline session requests', async () => {
        // Register and set up two users
        await request(app).post('/register').send({
            username: 'acc1@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Acc', lastName: 'One', major: 'CS'
        });
        await request(app).post('/register').send({
            username: 'acc2@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Acc', lastName: 'Two', major: 'CS'
        });

        const a1 = request.agent(app);
        await a1.post('/login').send({ username: 'acc1@clemson.edu', password: 'password123' });
        await a1.post('/courses/add').send({ course: 'MATH 1060' });
        await a1.post('/availability').send({ availability: ['Tuesday-14:00'] });

        const a2 = request.agent(app);
        await a2.post('/login').send({ username: 'acc2@clemson.edu', password: 'password123' });
        await a2.post('/courses/add').send({ course: 'MATH 1060' });
        await a2.post('/availability').send({ availability: ['Tuesday-14:00'] });

        const usersRes = await a2.get('/users.json');
        const user1 = usersRes.body.find(u => u.username === 'acc1@clemson.edu');

        await a2.post('/send-request').send({ recipientId: user1.id, course: 'MATH 1060', timeSlot: 'Tuesday-14:00' });

        // acc1 accepts
        const inbox = await a1.get('/requests.json');
        const reqId = inbox.body.incoming[0].id;
        const acceptRes = await a1.post(`/requests/${reqId}/accept`).send();
        expect(acceptRes.statusCode).toBe(302);
        const afterAccept = await a1.get('/requests.json');
        expect(afterAccept.body.incoming[0].status).toBe('accepted');

        // acc2 sends another then acc1 declines
        await a2.post('/send-request').send({ recipientId: user1.id, course: 'MATH 1060', timeSlot: 'Tuesday-14:00' });
        const inbox2 = await a1.get('/requests.json');
        const pending = inbox2.body.incoming.find(r => r.status === 'pending');
        const declineRes = await a1.post(`/requests/${pending.id}/decline`).send();
        expect(declineRes.statusCode).toBe(302);
        const afterDecline = await a1.get('/requests.json');
        const declined = afterDecline.body.incoming.find(r => r.id === pending.id);
        expect(declined.status).toBe('declined');
    });
});

describe('Dashboard and Sessions View', () => {
    it('should display upcoming sessions, suggested matches, and all sessions correctly', async () => {
        // 1. Register three users
        await request(app).post('/register').send({ username: 'main@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Main', lastName: 'User', major: 'CS' });
        await request(app).post('/register').send({ username: 'partner@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Session', lastName: 'Partner', major: 'ECE' });
        await request(app).post('/register').send({ username: 'match@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Suggested', lastName: 'Match', major: 'ME' });

        // 2. Log in users and set up their profiles
        const agentMain = request.agent(app);
        await agentMain.post('/login').send({ username: 'main@clemson.edu', password: 'password123' });
        await agentMain.post('/courses/add').send({ course: 'CPSC 1010' });
        await agentMain.post('/courses/add').send({ course: 'ENGL 1030' });
        await agentMain.post('/availability').send({ availability: ['Monday-10:00', 'Tuesday-12:00'] });

        const agentPartner = request.agent(app);
        await agentPartner.post('/login').send({ username: 'partner@clemson.edu', password: 'password123' });
        await agentPartner.post('/courses/add').send({ course: 'CPSC 1010' });
        await agentPartner.post('/availability').send({ availability: ['Monday-10:00'] });

        const agentMatch = request.agent(app);
        await agentMatch.post('/login').send({ username: 'match@clemson.edu', password: 'password123' });
        await agentMatch.post('/courses/add').send({ course: 'ENGL 1030' });
        await agentMatch.post('/availability').send({ availability: ['Tuesday-12:00'] });

        // 3. Create an accepted session between Main and Partner
        const usersRes = await agentMain.get('/users.json');
        const partnerUser = usersRes.body.find(u => u.username === 'partner@clemson.edu');
        await agentMain.post('/send-request').send({ recipientId: partnerUser.id, course: 'CPSC 1010', timeSlot: 'Monday-10:00' });
        
        const partnerInbox = await agentPartner.get('/requests.json');
        const reqIdToAccept = partnerInbox.body.incoming[0].id;
        await agentPartner.post(`/requests/${reqIdToAccept}/accept`);

        // 4. Test Dashboard (US-14 & US-12)
        const dashboardRes = await agentMain.get('/dashboard');
        expect(dashboardRes.statusCode).toBe(200);
        // Check for upcoming session
        expect(dashboardRes.text).toContain('Upcoming Sessions');
        expect(dashboardRes.text).toContain('With: Session Partner');
        expect(dashboardRes.text).toContain('Course: CPSC 1010');
        // Check for suggested match
        expect(dashboardRes.text).toContain('Suggested Matches');
        expect(dashboardRes.text).toContain('Suggested Match');
        expect(dashboardRes.text).toContain('Mutual Courses: ENGL 1030');

        // 5. Create a pending session for the sessions page test
        const mainUser = usersRes.body.find(u => u.username === 'main@clemson.edu');
        await agentMatch.post('/send-request').send({ recipientId: mainUser.id, course: 'ENGL 1030', timeSlot: 'Tuesday-12:00' });

        // 6. Test All Sessions Page (US-09)
        const sessionsRes = await agentMain.get('/sessions');
        expect(sessionsRes.statusCode).toBe(200);
        // Check for confirmed session
        expect(sessionsRes.text).toContain('Confirmed Sessions');
        expect(sessionsRes.text).toContain('With: Session Partner');
        // Check for pending session
        expect(sessionsRes.text).toContain('Pending Sessions');
        expect(sessionsRes.text).toContain('Incoming request with Suggested Match');
    });
});

// US-13: Filter Search Results by major and availability
describe('Search Filters (US-13)', () => {
    it('should filter search results by major and overlapping availability', async () => {
        // Register current user
        await request(app).post('/register').send({
            username: 'filter.current@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Filter', lastName: 'Current', major: 'CS'
        });
        const agentCur = request.agent(app);
        await agentCur.post('/login').send({ username: 'filter.current@clemson.edu', password: 'password123' });
        await agentCur.post('/availability').send({ availability: ['Monday-10:00', 'Tuesday-12:00'] });

        // Register candidates
        await request(app).post('/register').send({ username: 'filter.cs@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Filter', lastName: 'CS', major: 'CS' });
        await request(app).post('/register').send({ username: 'filter.ece@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Filter', lastName: 'ECE', major: 'ECE' });
        await request(app).post('/register').send({ username: 'filter.cs.no@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Filter', lastName: 'NoOverlap', major: 'CS' });

        // Set their courses and availability
        const aCS = request.agent(app);
        await aCS.post('/login').send({ username: 'filter.cs@clemson.edu', password: 'password123' });
        await aCS.post('/courses/add').send({ course: 'FILTR 1010' });
        await aCS.post('/availability').send({ availability: ['Monday-10:00'] });

        const aECE = request.agent(app);
        await aECE.post('/login').send({ username: 'filter.ece@clemson.edu', password: 'password123' });
        await aECE.post('/courses/add').send({ course: 'FILTR 1010' });
        await aECE.post('/availability').send({ availability: ['Monday-10:00'] });

        const aCSNo = request.agent(app);
        await aCSNo.post('/login').send({ username: 'filter.cs.no@clemson.edu', password: 'password123' });
        await aCSNo.post('/courses/add').send({ course: 'FILTR 1010' });
        await aCSNo.post('/availability').send({ availability: ['Wednesday-14:00'] });

        // Perform search with course, major=CS, availability=Monday-10:00
        const res = await agentCur
            .post('/search')
            .send({ course: 'FILTR 1010', major: 'CS', availabilityFilter: 'Monday-10:00' });

        expect(res.statusCode).toBe(200);
        // Should include CS candidate with overlap
        expect(res.text).toContain('filter.cs@clemson.edu');
        // Should exclude ECE major
        expect(res.text).not.toContain('filter.ece@clemson.edu');
        // Should exclude CS candidate without overlap
        expect(res.text).not.toContain('filter.cs.no@clemson.edu');
    });
});

// US-10: Cancel a Scheduled Session
describe('Cancel Scheduled Session (US-10)', () => {
    it('should cancel an accepted session by a participant', async () => {
        // Register two users
        await request(app).post('/register').send({ username: 'cancel.a@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Cancel', lastName: 'One', major: 'CS' });
        await request(app).post('/register').send({ username: 'cancel.b@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Cancel', lastName: 'Two', major: 'CS' });

        const aA = request.agent(app);
        await aA.post('/login').send({ username: 'cancel.a@clemson.edu', password: 'password123' });
        await aA.post('/courses/add').send({ course: 'CANC 1010' });
        await aA.post('/availability').send({ availability: ['Wednesday-16:00'] });

        const aB = request.agent(app);
        await aB.post('/login').send({ username: 'cancel.b@clemson.edu', password: 'password123' });
        await aB.post('/courses/add').send({ course: 'CANC 1010' });
        await aB.post('/availability').send({ availability: ['Wednesday-16:00'] });

        // Find A id and send request from B to A
        const usersRes = await aB.get('/users.json');
        const userA = usersRes.body.find(u => u.username === 'cancel.a@clemson.edu');
        await aB.post('/send-request').send({ recipientId: userA.id, course: 'CANC 1010', timeSlot: 'Wednesday-16:00' });

        // A accepts
        const inbox = await aA.get('/requests.json');
        const reqId = inbox.body.incoming.find(r => r.status === 'pending').id;
        await aA.post(`/requests/${reqId}/accept`).send();

        // Cancel as A
        const cancelRes = await aA.post(`/sessions/${reqId}/cancel`).send({ redirectTo: '/sessions' });
        expect(cancelRes.statusCode).toBe(302);
        expect(cancelRes.header.location).toBe('/sessions');

        // Verify cancelled status
        const after = await aA.get('/requests.json');
        const cancelled = after.body.incoming.find(r => r.id === reqId);
        expect(cancelled.status).toBe('cancelled');

        // Confirm not shown in confirmed sessions page
        const sessionsRes = await aA.get('/sessions');
        expect(sessionsRes.text).not.toContain('With: Cancel Two');
    });

    it('should not allow canceling a pending request', async () => {
        await request(app).post('/register').send({ username: 'pend.a@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Pend', lastName: 'A', major: 'CS' });
        await request(app).post('/register').send({ username: 'pend.b@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Pend', lastName: 'B', major: 'CS' });

        const aA = request.agent(app);
        await aA.post('/login').send({ username: 'pend.a@clemson.edu', password: 'password123' });
        await aA.post('/courses/add').send({ course: 'PEND 1010' });
        await aA.post('/availability').send({ availability: ['Thursday-10:00'] });

        const aB = request.agent(app);
        await aB.post('/login').send({ username: 'pend.b@clemson.edu', password: 'password123' });
        await aB.post('/courses/add').send({ course: 'PEND 1010' });
        await aB.post('/availability').send({ availability: ['Thursday-10:00'] });

        const usersRes = await aA.get('/users.json');
        const userB = usersRes.body.find(u => u.username === 'pend.b@clemson.edu');
        await aA.post('/send-request').send({ recipientId: userB.id, course: 'PEND 1010', timeSlot: 'Thursday-10:00' });

        // Attempt to cancel pending as requester (A)
        const out = await aA.get('/requests.json');
        const pending = out.body.outgoing.find(r => r.status === 'pending');
        const resCancel = await aA.post(`/sessions/${pending.id}/cancel`).send();
        expect(resCancel.statusCode).toBe(400);
    });

    it('should forbid cancellation by a non-participant', async () => {
        // Set up an accepted session between X and Y
        await request(app).post('/register').send({ username: 'acc.x@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Acc', lastName: 'X', major: 'CS' });
        await request(app).post('/register').send({ username: 'acc.y@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'Acc', lastName: 'Y', major: 'CS' });
        await request(app).post('/register').send({ username: 'intruder@clemson.edu', password: 'password123', confirmPassword: 'password123', firstName: 'In', lastName: 'Truder', major: 'ME' });

        const aX = request.agent(app);
        await aX.post('/login').send({ username: 'acc.x@clemson.edu', password: 'password123' });
        await aX.post('/courses/add').send({ course: 'SAFE 1010' });
        await aX.post('/availability').send({ availability: ['Friday-15:00'] });

        const aY = request.agent(app);
        await aY.post('/login').send({ username: 'acc.y@clemson.edu', password: 'password123' });
        await aY.post('/courses/add').send({ course: 'SAFE 1010' });
        await aY.post('/availability').send({ availability: ['Friday-15:00'] });

        const usersRes = await aX.get('/users.json');
        const userY = usersRes.body.find(u => u.username === 'acc.y@clemson.edu');
        await aX.post('/send-request').send({ recipientId: userY.id, course: 'SAFE 1010', timeSlot: 'Friday-15:00' });
        const inboxY = await aY.get('/requests.json');
        const reqId = inboxY.body.incoming.find(r => r.status === 'pending').id;
        await aY.post(`/requests/${reqId}/accept`).send();

        // Intruder tries to cancel
        const aIntruder = request.agent(app);
        await aIntruder.post('/login').send({ username: 'intruder@clemson.edu', password: 'password123' });
        const resCancel = await aIntruder.post(`/sessions/${reqId}/cancel`).send();
        expect(resCancel.statusCode).toBe(403);
    });
});
