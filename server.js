const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

// Add error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Middleware
app.use(cors());
app.use(express.json());

// Check multiple possible locations for static files
const publicPath = path.join(__dirname, 'public');
const rootPath = __dirname;

// Use public directory if it exists, otherwise use root
if (fs.existsSync(publicPath)) {
  console.log('Serving static files from public directory');
  app.use(express.static(publicPath));
} else {
  console.log('Serving static files from root directory');
  app.use(express.static(rootPath));
}

// Use Render's persistent disk for data storage
const dataDir = '/opt/render/project/data';
const dataFilePath = path.join(dataDir, 'data.json');

// Create data directory if it doesn't exist
function ensureDataDir() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`Created data directory: ${dataDir}`);
    }
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Lock mechanism to prevent race conditions
let isWriting = false;

// Initialize data file if it doesn't exist
function initializeDataFile() {
  try {
    ensureDataDir();
    if (!fs.existsSync(dataFilePath)) {
      const initialData = { links: [], activities: [] };
      fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
      console.log('Created data.json file at:', dataFilePath);
    } else {
      console.log('data.json file exists at:', dataFilePath);
    }
  } catch (error) {
    console.error('Error initializing data file:', error);
  }
}

// Initialize on startup
initializeDataFile();

// Helper function to read data with retry mechanism
function readData(retries = 3) {
  try {
    if (!fs.existsSync(dataFilePath)) {
      initializeDataFile();
    }
    
    // Wait if file is being written
    if (isWriting) {
      setTimeout(() => readData(retries - 1), 100);
      return { links: [], activities: [] };
    }
    
    const data = fs.readFileSync(dataFilePath, 'utf8');
    const parsed = JSON.parse(data);
    console.log(`Read data: ${parsed.links.length} links, ${parsed.activities.length} activities`);
    return parsed;
  } catch (error) {
    console.error('Error reading data:', error);
    if (retries > 0) {
      setTimeout(() => readData(retries - 1), 100);
    }
    return { links: [], activities: [] };
  }
}

// Helper function to write data with lock mechanism
function writeData(data, retries = 3) {
  return new Promise((resolve, reject) => {
    if (isWriting) {
      setTimeout(() => writeData(data, retries - 1).then(resolve).catch(reject), 100);
      return;
    }
    
    isWriting = true;
    try {
      ensureDataDir(); // Ensure directory exists before writing
      const jsonString = JSON.stringify(data, null, 2);
      fs.writeFileSync(dataFilePath, jsonString);
      console.log(`Data saved: ${data.links.length} links, ${data.activities.length} activities`);
      isWriting = false;
      resolve(true);
    } catch (error) {
      console.error('Error writing data:', error);
      isWriting = false;
      if (retries > 0) {
        setTimeout(() => writeData(data, retries - 1).then(resolve).catch(reject), 100);
      } else {
        reject(error);
      }
    }
  });
}

// API Routes

// Get all links
app.get('/api/links', (req, res) => {
  try {
    const data = readData();
    res.json(data.links);
  } catch (error) {
    console.error('Error in /api/links:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// Add a new link
app.post('/api/links', async (req, res) => {
  try {
    const { name, url, description, category } = req.body;
    console.log('Adding link:', { name, url, description, category });
    
    // Read current data
    const data = readData();
    
    const newLink = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      name,
      url,
      description,
      category,
      clicks: 0,
      createdAt: new Date().toISOString()
    };
    
    // Add new link to the beginning of the array
    data.links.unshift(newLink);
    
    // Add activity
    data.activities.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      type: 'added',
      linkName: name,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 activities
    if (data.activities.length > 10) data.activities.pop();
    
    // Write data back to file
    await writeData(data);
    
    console.log('Link added successfully:', newLink.id);
    res.json(newLink);
  } catch (error) {
    console.error('Error in POST /api/links:', error);
    res.status(500).json({ error: 'Failed to add link' });
  }
});

// Update a link
app.put('/api/links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, description, category } = req.body;
    
    const data = readData();
    const linkIndex = data.links.findIndex(link => link.id === id);
    
    if (linkIndex !== -1) {
      data.links[linkIndex] = {
        ...data.links[linkIndex],
        name,
        url,
        description,
        category,
        updatedAt: new Date().toISOString()
      };
      
      // Add activity
      data.activities.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: 'edited',
        linkName: name,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 activities
      if (data.activities.length > 10) data.activities.pop();
      
      await writeData(data);
      res.json(data.links[linkIndex]);
    } else {
      res.status(404).json({ error: 'Link not found' });
    }
  } catch (error) {
    console.error('Error in PUT /api/links:', error);
    res.status(500).json({ error: 'Failed to update link' });
  }
});

// Delete a link
app.delete('/api/links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = readData();
    
    const linkIndex = data.links.findIndex(link => link.id === id);
    
    if (linkIndex !== -1) {
      const linkName = data.links[linkIndex].name;
      data.links.splice(linkIndex, 1);
      
      // Add activity
      data.activities.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: 'deleted',
        linkName,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 activities
      if (data.activities.length > 10) data.activities.pop();
      
      await writeData(data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Link not found' });
    }
  } catch (error) {
    console.error('Error in DELETE /api/links:', error);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// Increment link clicks
app.post('/api/links/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    const data = readData();
    
    const linkIndex = data.links.findIndex(link => link.id === id);
    
    if (linkIndex !== -1) {
      data.links[linkIndex].clicks++;
      
      // Add activity
      data.activities.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: 'clicked',
        linkName: data.links[linkIndex].name,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 activities
      if (data.activities.length > 10) data.activities.pop();
      
      await writeData(data);
      res.json({ clicks: data.links[linkIndex].clicks });
    } else {
      res.status(404).json({ error: 'Link not found' });
    }
  } catch (error) {
    console.error('Error in POST /api/links/:id/click:', error);
    res.status(500).json({ error: 'Failed to update clicks' });
  }
});

// Get activities
app.get('/api/activities', (req, res) => {
  try {
    const data = readData();
    res.json(data.activities);
  } catch (error) {
    console.error('Error in /api/activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Debug endpoint
app.get('/debug', (req, res) => {
  try {
    const files = {
      root: fs.readdirSync(rootPath),
      public: fs.existsSync(publicPath) ? fs.readdirSync(publicPath) : 'not found',
      publicExists: fs.existsSync(publicPath),
      indexInRoot: fs.existsSync(path.join(rootPath, 'index.html')),
      indexInPublic: fs.existsSync(path.join(publicPath, 'index.html')),
      dataExists: fs.existsSync(dataFilePath),
      dataContent: fs.existsSync(dataFilePath) ? JSON.parse(fs.readFileSync(dataFilePath, 'utf8')) : 'not found',
      workingDir: __dirname,
      publicPath: publicPath,
      dataDir: dataDir,
      dataDirExists: fs.existsSync(dataDir),
      isWriting: isWriting
    };
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backup/Restore endpoints
app.post('/api/backup', (req, res) => {
  try {
    const data = readData();
    const backupPath = path.join(dataDir, `backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
    res.json({ success: true, backupPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restore', (req, res) => {
  try {
    const { data } = req.body;
    if (data) {
      writeData(data);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'No data provided' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  try {
    // Check multiple possible locations for index.html
    const possiblePaths = [
      path.join(publicPath, 'index.html'),
      path.join(rootPath, 'index.html'),
      path.join(__dirname, 'public', 'index.html'),
      path.join(__dirname, 'index.html')
    ];
    
    let indexPath = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        indexPath = possiblePath;
        console.log(`Found index.html at: ${indexPath}`);
        break;
      }
    }
    
    if (indexPath) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send(`
        <h1>Droneplus - index.html not found</h1>
        <p>Checked paths: ${JSON.stringify(possiblePaths)}</p>
        <p><a href="/debug">Debug Info</a></p>
      `);
    }
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Server error');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    dataFileExists: fs.existsSync(dataFilePath),
    dataDirExists: fs.existsSync(dataDir),
    isWriting: isWriting
  });
});

// Start server with error handling
const server = app.listen(port, () => {
  console.log(`Droneplus server listening at http://localhost:${port}`);
  console.log(`Working directory: ${__dirname}`);
  console.log(`Data directory: ${dataDir}`);
  console.log(`Data file: ${dataFilePath}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
