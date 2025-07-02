const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure data paths
const DATA_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'groups.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Ensure data directory exists
const initDataDirectory = () => {
  try {
    [DATA_DIR, UPLOADS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });

    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf8');
      console.log(`Created new data file at ${DATA_FILE}`);
    }
  } catch (err) {
    console.error('Storage initialization failed:', err);
    process.exit(1);
  }
};
initDataDirectory();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Helper functions
const loadGroups = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading groups:', err);
    return [];
  }
};

const saveGroups = (groups) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(groups, null, 2), 'utf8');
};

// API Endpoints
app.get('/api/groups', (req, res) => {
  try {
    let groups = loadGroups();
    
    // Add full URL to image paths if they're local files
    groups = groups.map(group => {
      if (group.imagePath && !group.imagePath.startsWith('http') && !group.imagePath.startsWith('/uploads')) {
        return {
          ...group,
          imagePath: `/uploads/${group.imagePath}`
        };
      }
      return group;
    });

    // Filter by search query if provided
    const searchQuery = req.query.q?.toLowerCase();
    if (searchQuery) {
      groups = groups.filter(group => 
        group.groupName.toLowerCase().includes(searchQuery) ||
        group.username.toLowerCase().includes(searchQuery)
      );
    }

    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ error: 'Failed to load groups' });
  }
});

app.post('/api/groups', upload.single('image'), (req, res) => {
  try {
    const { username, groupName, groupLink } = req.body;
    
    // Validation
    if (!username?.trim() || !groupName?.trim() || !groupLink?.trim()) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!groupLink.startsWith('https://chat.whatsapp.com/')) {
      return res.status(400).json({ error: 'Invalid WhatsApp link format' });
    }

    // Handle image upload
    const imagePath = req.file ? req.file.filename : null;

    const groups = loadGroups();
    const newGroup = {
      id: crypto.randomUUID(),
      username: username.trim(),
      groupName: groupName.trim(),
      groupLink: groupLink.trim(),
      imagePath: imagePath || `https://www.gravatar.com/avatar/${crypto.createHash('md5').update(groupName.trim()).digest('hex')}?d=identicon&s=200`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    groups.push(newGroup);
    saveGroups(groups);

    // Return the new group with proper image URL
    res.json({
      success: true,
      group: {
        ...newGroup,
        imagePath: imagePath ? `/uploads/${imagePath}` : newGroup.imagePath
      }
    });
  } catch (err) {
    console.error('Error saving group:', err);
    res.status(500).json({ error: 'Failed to save group' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    groupsCount: loadGroups().length,
    diskSpace: fs.statSync(DATA_DIR).size
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
  console.log(`Uploads dir: ${UPLOADS_DIR}`);
});
