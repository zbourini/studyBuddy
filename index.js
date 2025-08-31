const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// In-memory user store (for demonstration purposes)
const users = [];
let nextUserId = 1;
// In-memory session requests store
const sessionRequests = [];
let nextRequestId = 1;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'mysecretkey', // Replace with a real secret key in production
    resave: false,
    saveUninitialized: true
}));

// Helper to get current user object from session
function getCurrentUser(req) {
    return users.find(u => u.username === req.session.user?.username);
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Routes
app.get('/', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    try {
        const { username, password, confirmPassword, firstName, lastName, major } = req.body;

        // Validation
        if (!username.endsWith('@clemson.edu')) {
            return res.status(400).send('Only Clemson emails are allowed.');
        }
        if (password.length < 8) {
            return res.status(400).send('Password must be at least 8 characters long.');
        }
        if (password !== confirmPassword) {
            return res.status(400).send('Passwords do not match.');
        }
        if (users.find(user => user.username === username)) {
            return res.status(400).send('User already exists.');
        }
        if (!firstName || !lastName || !major) {
            return res.status(400).send('First name, last name, and major are required.');
        }

        const name = `${firstName} ${lastName}`;
        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ id: nextUserId++, username, password: hashedPassword, name, major, courses: [], availability: [] });
        res.redirect('/login');
    } catch (error) {
        res.status(500).send('Error registering user.');
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = users.find(user => user.username === username);

        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            res.redirect('/dashboard');
        } else {
            res.status(400).send('Invalid credentials.');
        }
    } catch (error) {
        res.status(500).send('Error logging in.');
    }
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const incomingRequests = sessionRequests.filter(r => r.toUserId === user.id && r.status === 'pending');
    const outgoingRequests = sessionRequests.filter(r => r.fromUserId === user.id);
    const upcomingSessions = sessionRequests.filter(r => (r.fromUserId === user.id || r.toUserId === user.id) && r.status === 'accepted');

    // Suggested Matches Logic
    const suggestedMatches = users.map(otherUser => {
        if (otherUser.id === user.id) return null;

        const mutualCourses = (user.courses || []).filter(course => (otherUser.courses || []).includes(course));
        const overlappingAvailability = (user.availability || []).filter(slot => (otherUser.availability || []).includes(slot));

        if (mutualCourses.length > 0 && overlappingAvailability.length > 0) {
            return {
                id: otherUser.id,
                name: otherUser.name,
                major: otherUser.major,
                mutualCourses,
                overlappingAvailability,
                score: mutualCourses.length + overlappingAvailability.length
            };
        }
        return null;
    }).filter(Boolean).sort((a, b) => b.score - a.score);

    res.render('dashboard', { user, incomingRequests, outgoingRequests, upcomingSessions, suggestedMatches, users });
});

// Profile management
app.get('/profile', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    res.render('profile', { user });
});

app.post('/profile', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const { name, major } = req.body;
    if (name && major) {
        user.name = name;
        user.major = major;
        res.redirect('/profile');
    } else {
        res.status(400).send('Name and major are required.');
    }
});

// Course management
app.get('/courses', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    res.render('courses', { user });
});

app.post('/courses/add', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const { course } = req.body;
    if (course && !user.courses.includes(course)) {
        user.courses.push(course);
    }
    res.redirect('/courses');
});

app.post('/courses/remove', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const { course } = req.body;
    user.courses = user.courses.filter(c => c !== course);
    res.redirect('/courses');
});

// Search for classmates
app.get('/search', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    res.render('search', { user, results: undefined, filters: {} });
});

app.post('/search', isAuthenticated, (req, res) => {
    const { course, major: majorFilter, availabilityFilter } = req.body;
    const currentUser = getCurrentUser(req);

    // Normalize filters
    const selectedTimes = Array.isArray(availabilityFilter)
        ? availabilityFilter
        : availabilityFilter
            ? [availabilityFilter]
            : [];

    // Base matches by course (if provided), otherwise all except self
    const basePool = users.filter(u => u.username !== currentUser.username);
    const courseFiltered = course
        ? basePool.filter(u => (u.courses || []).includes(course))
        : basePool;

    // Build result objects with shared courses and overlapping availability
    let results = courseFiltered.map(u => {
        const sharedCourses = (currentUser.courses || []).filter(c => (u.courses || []).includes(c));
        const overlapAvailability = (currentUser.availability || []).filter(slot => (u.availability || []).includes(slot));
        return {
            id: u.id,
            username: u.username,
            name: u.name,
            major: u.major,
            sharedCourses,
            overlapAvailability
        };
    });

    // Apply major filter (case-insensitive exact match) if provided
    if (majorFilter && String(majorFilter).trim().length > 0) {
        const mf = String(majorFilter).trim().toLowerCase();
        results = results.filter(r => (r.major || '').toLowerCase() === mf);
    }

    // Apply availability filter (any overlap with selected times)
    if (selectedTimes.length > 0) {
        results = results.filter(r => (r.overlapAvailability || []).some(t => selectedTimes.includes(t)));
    }

    const user = currentUser;
    const filters = { course: course || '', major: majorFilter || '', availability: selectedTimes };
    res.render('search', { user, results, filters });
});

// Set availability
app.get('/availability', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    res.render('availability', { user });
});

app.post('/availability', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const { availability } = req.body;
    user.availability = Array.isArray(availability) ? availability : [availability];
    res.redirect('/dashboard');
});

// Send a study session request
app.post('/send-request', isAuthenticated, (req, res) => {
    try {
        const { recipientId, course, timeSlot } = req.body;
        const fromUser = getCurrentUser(req);
        const toUser = users.find(u => u.id === parseInt(recipientId, 10));

        if (!toUser) return res.status(400).send('Recipient not found.');
        if (toUser.id === fromUser.id) return res.status(400).send('Cannot send request to yourself.');

        // Validate shared course
        if (!fromUser.courses.includes(course) || !toUser.courses.includes(course)) {
            return res.status(400).send('You must share the selected course.');
        }

        // Validate overlapping time slot
        const overlap = (fromUser.availability || []).includes(timeSlot) && (toUser.availability || []).includes(timeSlot);
        if (!overlap) {
            return res.status(400).send('Selected time slot is not available for both users.');
        }

        const newReq = {
            id: nextRequestId++,
            fromUserId: fromUser.id,
            toUserId: toUser.id,
            course,
            timeSlot,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        sessionRequests.push(newReq);
        res.redirect('/dashboard');
    } catch (e) {
        res.status(500).send('Error sending request.');
    }
});

// Accept a study session request
app.post('/requests/:id/accept', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const reqId = parseInt(req.params.id, 10);
    const found = sessionRequests.find(r => r.id === reqId);
    if (!found) return res.status(404).send('Request not found.');
    if (found.toUserId !== user.id) return res.status(403).send('Not authorized to accept this request.');
    if (found.status !== 'pending') return res.status(400).send('Request is not pending.');
    found.status = 'accepted';
    res.redirect('/dashboard');
});

// Decline a study session request
app.post('/requests/:id/decline', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const reqId = parseInt(req.params.id, 10);
    const found = sessionRequests.find(r => r.id === reqId);
    if (!found) return res.status(404).send('Request not found.');
    if (found.toUserId !== user.id) return res.status(403).send('Not authorized to decline this request.');
    if (found.status !== 'pending') return res.status(400).send('Request is not pending.');
    found.status = 'declined';
    res.redirect('/dashboard');
});

// View all sessions
app.get('/sessions', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const confirmedSessions = sessionRequests.filter(r => (r.fromUserId === user.id || r.toUserId === user.id) && r.status === 'accepted');
    const pendingSessions = sessionRequests.filter(r => (r.fromUserId === user.id || r.toUserId === user.id) && r.status === 'pending');
    res.render('sessions', { user, confirmedSessions, pendingSessions, users });
});

// Cancel a scheduled (accepted) session
app.post('/sessions/:id/cancel', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const reqId = parseInt(req.params.id, 10);
    const found = sessionRequests.find(r => r.id === reqId);
    if (!found) return res.status(404).send('Session not found.');
    const isParticipant = found.fromUserId === user.id || found.toUserId === user.id;
    if (!isParticipant) return res.status(403).send('Not authorized to cancel this session.');
    if (found.status !== 'accepted') return res.status(400).send('Only accepted sessions can be canceled.');
    found.status = 'cancelled';
    const redirectTo = req.body.redirectTo || '/dashboard';
    res.redirect(redirectTo);
});

// JSON endpoint to help tests fetch a user's requests
app.get('/requests.json', isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    const incoming = sessionRequests.filter(r => r.toUserId === user.id);
    const outgoing = sessionRequests.filter(r => r.fromUserId === user.id);
    res.json({ incoming, outgoing });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Minimal users listing (authenticated) for testing and UI support
app.get('/users.json', isAuthenticated, (req, res) => {
    const minimal = users.map(u => ({ id: u.id, username: u.username, name: u.name, major: u.major }));
    res.json(minimal);
});

// Only start the server if this file is run directly (not when imported by tests)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

// Export app for testing
module.exports = app;
