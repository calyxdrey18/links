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
const DATA_FILE = process.env.DATA_PATH || path.join(DATA_DIR, 'groups.json');
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
const upload = multer({ storage });

// Ensure data directory exists
const initDataDirectory = () => {
  try {
    [DATA_DIR, UPLOADS_DIR, path.join(DATA_DIR, 'backups')].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });

    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf8');
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
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Error loading groups:', err);
    return [];
  }
};

const saveGroups = (groups) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(groups, null, 2), 'utf8');
};

// API Endpoints
app.post('/api/groups', upload.single('image'), (req, res) => {
  try {
    const { username, groupName, groupLink } = req.body;
    
    if (!username?.trim() || !groupName?.trim() || !groupLink?.trim()) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!groupLink.startsWith('https://chat.whatsapp.com/')) {
      return res.status(400).json({ error: 'Invalid WhatsApp link format' });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const groups = loadGroups();
    
    const newGroup = {
      id: crypto.randomUUID(),
      username: username.trim(),
      groupName: groupName.trim(),
      groupLink: groupLink.trim(),
      imagePath: imagePath || `https://www.gravatar.com/avatar/${crypto.createHash('md5').update(groupName.trim()).digest('hex')}?d=identicon&s=200`,
      createdAt: new Date().toISOString()
    };

    groups.push(newGroup);
    saveGroups(groups);
    res.json({ success: true, group: newGroup });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save group' });
  }
});

// [Keep all other existing endpoints from previous version]

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
  console.log(`Uploads dir: ${UPLOADS_DIR}`);
});