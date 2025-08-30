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
