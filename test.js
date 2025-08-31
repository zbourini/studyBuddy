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
