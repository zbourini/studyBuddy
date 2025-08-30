const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// In-memory user store (for demonstration purposes)
const users = [];

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
        users.push({ username, password: hashedPassword, name, major, courses: [] });
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
    res.render('dashboard', { user });
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

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Export app for testing
module.exports = app;
