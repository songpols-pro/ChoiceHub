const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const upload = multer({ dest: 'uploads/' });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure directories exist
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

// --- Multi-Event Config Storage ---
const eventsFile = path.join(__dirname, 'data', 'events.json');

function getEventsData() {
    try {
        if (!fs.existsSync(eventsFile)) {
            // Check if old event.json exists to migrate, otherwise empty
            const oldEventFile = path.join(__dirname, 'data', 'event.json');
            let initialEvents = {};
            if (fs.existsSync(oldEventFile)) {
                try {
                    const oldEvent = JSON.parse(fs.readFileSync(oldEventFile, 'utf8'));
                    const newId = crypto.randomUUID();
                    initialEvents[newId] = {
                        id: newId,
                        creatorName: "Legacy Admin",
                        ...oldEvent,
                        status: 'open',
                        allowedVoters: [],
                        createdAt: new Date().toISOString()
                    };
                } catch (e) { }
            }
            fs.writeFileSync(eventsFile, JSON.stringify(initialEvents, null, 2));
            return initialEvents;
        }
        const data = fs.readFileSync(eventsFile, 'utf8');
        let parsed = JSON.parse(data);

        // Migration to add status and allowedVoters if missing
        let changed = false;
        for (const key in parsed) {
            if (!parsed[key].status) { parsed[key].status = 'open'; changed = true; }
            if (!parsed[key].allowedVoters) { parsed[key].allowedVoters = []; changed = true; }
            if (!parsed[key].creatorName) { parsed[key].creatorName = 'Unknown'; changed = true; }
        }
        if (changed) saveEventsData(parsed);

        return parsed;
    } catch (err) {
        console.error("Error reading events.json:", err);
        return {};
    }
}

function saveEventsData(data) {
    fs.writeFileSync(eventsFile, JSON.stringify(data, null, 2), 'utf8');
}

// Ensure init
getEventsData();

// --- Votes Storage ---
const votesFile = path.join(__dirname, 'data', 'votes.json');

function getVotes() {
    try {
        if (!fs.existsSync(votesFile)) {
            fs.writeFileSync(votesFile, JSON.stringify({}));
        }
        const data = fs.readFileSync(votesFile, 'utf8');
        let parsed;
        try {
            parsed = JSON.parse(data);
        } catch (e) {
            const buf = fs.readFileSync(votesFile);
            const str = buf.toString('utf16le');
            parsed = JSON.parse(str.replace(/^\uFEFF/, ''));
        }

        if (Array.isArray(parsed)) return {};
        return parsed || {};
    } catch (err) {
        console.error('Error reading votes:', err);
        return {};
    }
}

function saveVotes(votes) {
    fs.writeFileSync(votesFile, JSON.stringify(votes, null, 2), 'utf8');
}

try {
    let v = getVotes();
    saveVotes(v);
} catch (e) {
    saveVotes({});
}

// Global users.json removed. Allowed voters are now strictly stored within each event object.


// ==========================================
// ====== EVENT API ROUTES ==================
// ==========================================

app.get('/api/events', (req, res) => {
    const events = getEventsData();
    const eventsArray = Object.values(events).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(eventsArray);
});

app.post('/api/events', (req, res) => {
    const { topic, creatorName } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });
    if (!creatorName) return res.status(400).json({ error: 'Creator Name is required' });

    const events = getEventsData();
    const newId = crypto.randomUUID();

    events[newId] = {
        id: newId,
        topic: topic.trim(),
        creatorName: creatorName.trim(),
        date: "",
        time: "",
        location: "",
        menuData: {},
        status: 'open',
        allowedVoters: [],
        createdAt: new Date().toISOString()
    };

    saveEventsData(events);
    res.json({ success: true, event: events[newId] });
});

app.get('/api/events/:eventId', (req, res) => {
    const events = getEventsData();
    const event = events[req.params.eventId];
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
});

app.put('/api/events/:eventId', (req, res) => {
    const events = getEventsData();
    const event = events[req.params.eventId];
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (req.body.topic !== undefined) event.topic = req.body.topic;
    if (req.body.date !== undefined) event.date = req.body.date;
    if (req.body.time !== undefined) event.time = req.body.time;
    if (req.body.location !== undefined) event.location = req.body.location;

    saveEventsData(events);
    res.json({ success: true, event });
});

app.put('/api/events/:eventId/status', (req, res) => {
    const events = getEventsData();
    const event = events[req.params.eventId];
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const newStatus = req.body.status;
    if (newStatus !== 'open' && newStatus !== 'closed') {
        return res.status(400).json({ error: 'Invalid status. Must be open or closed.' });
    }

    event.status = newStatus;
    saveEventsData(events);
    res.json({ success: true, status: event.status });
});

app.delete('/api/events/:eventId', (req, res) => {
    const events = getEventsData();
    const eventId = req.params.eventId;

    if (events[eventId]) {
        delete events[eventId];
        saveEventsData(events);

        const allVotes = getVotes();
        if (allVotes[eventId]) {
            delete allVotes[eventId];
            saveVotes(allVotes);
        }

        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Event not found' });
    }
});


// ==========================================
// ====== MENU MANAGEMENT API ROUTES ========
// ==========================================

app.post('/api/upload-menu/:eventId', upload.single('menuFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const events = getEventsData();
    const event = events[req.params.eventId];
    if (!event) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Event not found' });
    }

    try {
        const workbook = xlsx.readFile(req.file.path);
        let parsedMenuData = {};

        workbook.SheetNames.forEach(sheetName => {
            const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

            let sheetMenu = [];
            let currentCategory = '';
            let currentQuota = 1;

            rawData.forEach(row => {
                const catHeader = row['หมวดหมู่ (Category)'] || row['Category'];
                const quotaHeader = row['โควตาการเลือก'] || row['Quota'];
                const itemHeader = row['รายการอาหาร (Menu Items)'] || row['Items'];

                if (catHeader) currentCategory = catHeader.toString().trim();
                if (quotaHeader) {
                    const match = quotaHeader.toString().match(/\d+/);
                    currentQuota = match ? parseInt(match[0], 10) : 1;
                }

                if (itemHeader && currentCategory) {
                    let catObj = sheetMenu.find(c => c.category === currentCategory);
                    if (!catObj) {
                        catObj = { category: currentCategory, quota: currentQuota, items: [] };
                        sheetMenu.push(catObj);
                    }
                    catObj.items.push(itemHeader.toString().trim());
                }
            });

            parsedMenuData[sheetName] = sheetMenu;
        });

        event.menuData = parsedMenuData;
        saveEventsData(events);

        fs.unlinkSync(req.file.path);
        res.json({ success: true, message: 'Menu uploaded and parsed successfully!', menuData: parsedMenuData });

    } catch (err) {
        console.error('Error parsing uploaded excel:', err);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to process the Excel file. Please ensure it follows the template format.' });
    }
});

app.put('/api/events/:eventId/menu', (req, res) => {
    // Manually update the entire menu json structure
    const events = getEventsData();
    const event = events[req.params.eventId];
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (!req.body.menuData || typeof req.body.menuData !== 'object') {
        return res.status(400).json({ error: 'Invalid menu data' });
    }

    event.menuData = req.body.menuData;
    saveEventsData(events);
    res.json({ success: true, menuData: event.menuData });
});

app.get('/api/template', (req, res) => {
    const templatePath = path.join(__dirname, 'template.xlsx');
    if (fs.existsSync(templatePath)) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template.xlsx"');
        res.sendFile(templatePath);
    } else {
        res.status(404).send('Template file not found on server.');
    }
});


// ==========================================
// ====== VOTING & RESULTS API ROUTES =======
// ==========================================

app.post('/api/vote', (req, res) => {
    const { eventId, sheetName, voterName, selections } = req.body;

    if (!eventId || !sheetName || !voterName || !selections || Object.keys(selections).length === 0) {
        return res.status(400).json({ error: 'Missing required voting parameters.' });
    }

    const events = getEventsData();
    const event = events[eventId];

    if (!event) return res.status(404).json({ error: 'Event not found.' });

    if (event.status !== 'open') {
        return res.status(403).json({ error: 'Voting for this event is currently closed.' });
    }

    if (!event.menuData[sheetName]) return res.status(400).json({ error: 'Invalid sheet name.' });

    // Validate against PER-EVENT allowed voters
    const voters = event.allowedVoters || [];
    if (!voters.some(u => u.toLowerCase() === voterName.trim().toLowerCase())) {
        return res.status(403).json({ error: 'Name not found in the allowed voters list for this event. Please contact the creator.' });
    }

    const allVotes = getVotes();

    if (!allVotes[eventId]) allVotes[eventId] = {};
    if (!allVotes[eventId][sheetName]) allVotes[eventId][sheetName] = [];

    const votesForSheet = allVotes[eventId][sheetName];

    const existingVoteIndex = votesForSheet.findIndex(v => v.voterName.toLowerCase() === voterName.trim().toLowerCase());
    const newVote = {
        voterName: voterName.trim(),
        selections: selections,
        timestamp: new Date().toISOString()
    };

    if (existingVoteIndex >= 0) {
        votesForSheet[existingVoteIndex] = newVote;
    } else {
        votesForSheet.push(newVote);
    }

    saveVotes(allVotes);
    res.json({ success: true, message: 'Vote submitted successfully!' });
});

app.get('/api/results/:eventId', (req, res) => {
    const eventId = req.params.eventId;
    const sheetName = req.query.sheet;

    const events = getEventsData();
    const event = events[eventId];

    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (!sheetName || !event.menuData[sheetName]) return res.status(400).json({ error: 'Valid sheet name query parameter is required.' });

    const allVotes = getVotes();
    const eventVotes = allVotes[eventId] || {};
    const sheetVotes = eventVotes[sheetName] || [];

    let tally = {};
    let votersByItem = {};

    sheetVotes.forEach(vote => {
        Object.keys(vote.selections).forEach(cat => {
            const items = vote.selections[cat];
            items.forEach(item => {
                tally[item] = (tally[item] || 0) + 1;

                if (!votersByItem[item]) {
                    votersByItem[item] = [];
                }
                votersByItem[item].push(vote.voterName);
            });
        });
    });

    res.json({
        totalVotes: sheetVotes.length,
        tally,
        votersByItem,
        votesList: sheetVotes
    });
});

app.get('/api/votes/:eventId/:name', (req, res) => {
    const eventId = req.params.eventId;
    const name = req.params.name;

    const allVotes = getVotes();
    const eventVotes = allVotes[eventId] || {};
    let userVotes = {};

    for (const sheetName in eventVotes) {
        const sheetVotes = eventVotes[sheetName];
        const userVote = sheetVotes.find(v => v.voterName.toLowerCase() === name.trim().toLowerCase());
        if (userVote) {
            userVotes[sheetName] = userVote.selections;
        }
    }

    res.json({ success: true, votes: userVotes });
});


// ==========================================
// ====== PER-EVENT VOTER MANAGEMENT ========
// ==========================================

app.post('/api/events/:eventId/voters', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const events = getEventsData();
    const event = events[req.params.eventId];
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    if (!event.allowedVoters) event.allowedVoters = [];

    if (event.allowedVoters.some(u => u.toLowerCase() === name.trim().toLowerCase())) {
        return res.status(400).json({ error: 'User already exists in this event' });
    }

    event.allowedVoters.push(name.trim());
    event.allowedVoters.sort((a, b) => a.localeCompare(b, 'th'));

    saveEventsData(events);
    res.json({ success: true, voters: event.allowedVoters });
});

app.delete('/api/events/:eventId/voters/:name', (req, res) => {
    const { name } = req.params;

    const events = getEventsData();
    const event = events[req.params.eventId];
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    if (!event.allowedVoters) event.allowedVoters = [];

    const initialLength = event.allowedVoters.length;
    event.allowedVoters = event.allowedVoters.filter(u => u.toLowerCase() !== name.trim().toLowerCase());

    if (event.allowedVoters.length === initialLength) {
        return res.status(404).json({ error: 'User not found in this event' });
    }

    saveEventsData(events);
    res.json({ success: true, voters: event.allowedVoters });
});

// Clear ALL votes for a specific event
app.delete('/api/events/:eventId/votes', (req, res) => {
    try {
        const eventId = req.params.eventId;
        const allVotes = getVotes();

        if (allVotes[eventId]) {
            delete allVotes[eventId];
            saveVotes(allVotes);
        }

        res.json({ success: true, message: 'All votes for this event have been cleared.' });
    } catch (err) {
        console.error('Error clearing event votes:', err);
        res.status(500).json({ error: 'Internal server error while clearing votes.' });
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
