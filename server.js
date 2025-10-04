// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID || 'bd044441c90c6789bfa8c7b730b09226';

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

// Local cache for performance
let dataCache = { links: [], activities: [] };
let lastSyncTime = Date.now();
let syncInProgress = false;

// GitHub Gist API functions
async function fetchGist() {
  try {
    if (!GITHUB_TOKEN) {
      console.error('❌ GitHub token not configured in .env file');
      return dataCache;
    }
    
    if (!GIST_ID) {
      console.error('❌ Gist ID not configured');
      return dataCache;
    }
    
    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Droneplus-App'
      }
    });
    
    if (!response.data.files || !response.data.files['links.json']) {
      console.error('❌ links.json file not found in gist');
      return dataCache;
    }
    
    const content = response.data.files['links.json'].content;
    const data = JSON.parse(content);
    
    dataCache = data;
    lastSyncTime = Date.now();
    
    console.log(`✅ Synced from GitHub: ${data.links.length} links, ${data.activities.length} activities`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching gist:', error.response?.status, error.response?.statusText || error.message);
    
    if (error.response?.status === 401) {
      console.error('❌ GitHub token is invalid or expired. Please update your .env file.');
    } else if (error.response?.status === 404) {
      console.error('❌ Gist not found. Check your GIST_ID in .env file.');
    }
    
    return dataCache; // Return cached data on error
  }
}

async function updateGist(data) {
  if (syncInProgress) {
    console.log('⏳ Sync already in progress, skipping...');
    return false;
  }
  
  syncInProgress = true;
  
  try {
    if (!GITHUB_TOKEN) {
      console.error('❌ GitHub token not configured');
      return false;
    }
    
    const response = await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
      files: {
        "links.json": {
          content: JSON.stringify(data, null, 2)
        }
      }
    }, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Droneplus-App'
      }
    });
    
    dataCache = data;
    lastSyncTime = Date.now();
    
    console.log(`✅ Updated GitHub: ${data.links.length} links, ${data.activities.length} activities`);
    return true;
  } catch (error) {
    console.error('❌ Error updating gist:', error.response?.status, error.response?.statusText || error.message);
    return false;
  } finally {
    syncInProgress = false;
  }
}

// Initialize data from GitHub
async function initializeData() {
  await fetchGist();
  
  // Auto-sync every 5 minutes
  setInterval(async () => {
    if (Date.now() - lastSyncTime > 4 * 60 * 1000) { // 4 minutes
      await fetchGist();
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Initialize on startup
initializeData();

// Helper functions
function readData() {
  return dataCache;
}

async function writeData(data) {
  const success = await updateGist(data);
  if (success) {
    dataCache = data;
  }
  return success;
}

// API Routes

// Get all links
app.get('/api/links', async (req, res) => {
  try {
    const data = await fetchGist();
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
    
    // Get current data
    const data = await fetchGist();
    
    const newLink = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      name,
      url,
      description,
      category,
      clicks: 0,
      createdAt: new Date().toISOString(),
      permanent: true
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
    
    // Keep only last 50 activities
    if (data.activities.length > 50) data.activities.pop();
    
    // Update GitHub
    const success = await updateGist(data);
    
    if (success) {
      console.log('Link added successfully:', newLink.id);
      res.json(newLink);
    } else {
      res.status(500).json({ error: 'Failed to save link to GitHub' });
    }
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
    
    const data = await fetchGist();
    const linkIndex = data.links.findIndex(link => link.id === id);
    
    if (linkIndex !== -1) {
      data.links[linkIndex] = {
        ...data.links[linkIndex],
        name,
        url,
        description,
        category,
        updatedAt: new Date().toISOString(),
        permanent: true
      };
      
      // Add activity
      data.activities.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: 'edited',
        linkName: name,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 50 activities
      if (data.activities.length > 50) data.activities.pop();
      
      const success = await updateGist(data);
      
      if (success) {
        res.json(data.links[linkIndex]);
      } else {
        res.status(500).json({ error: 'Failed to update link' });
      }
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
    const data = await fetchGist();
    
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
      
      // Keep only last 50 activities
      if (data.activities.length > 50) data.activities.pop();
      
      const success = await updateGist(data);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to delete link' });
      }
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
    const data = await fetchGist();
    
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
      
      // Keep only last 50 activities
      if (data.activities.length > 50) data.activities.pop();
      
      const success = await updateGist(data);
      
      if (success) {
        res.json({ clicks: data.links[linkIndex].clicks });
      } else {
        res.status(500).json({ error: 'Failed to update clicks' });
      }
    } else {
      res.status(404).json({ error: 'Link not found' });
    }
  } catch (error) {
    console.error('Error in POST /api/links/:id/click:', error);
    res.status(500).json({ error: 'Failed to update clicks' });
  }
});

// Get activities
app.get('/api/activities', async (req, res) => {
  try {
    const data = await fetchGist();
    res.json(data.activities);
  } catch (error) {
    console.error('Error in /api/activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Sync endpoint
app.post('/api/sync', async (req, res) => {
  try {
    const data = await fetchGist();
    res.json({ 
      success: true, 
      message: 'Synced from GitHub',
      linksCount: data.links.length,
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      workingDir: __dirname,
      publicPath: publicPath,
      cacheSize: dataCache.links.length,
      lastSyncTime: new Date(lastSyncTime).toISOString(),
      syncInProgress: syncInProgress,
      githubConfigured: !!(GITHUB_TOKEN && GIST_ID),
      githubTokenSet: !!GITHUB_TOKEN,
      gistIdSet: !!GIST_ID,
      gistUrl: `https://gist.github.com/dkruban/${GIST_ID}`,
      envFileExists: fs.existsSync(path.join(__dirname, '.env'))
    };
    res.json(files);
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
    linksCount: dataCache.links.length,
    lastSyncTime: new Date(lastSyncTime).toISOString(),
    githubConfigured: !!(GITHUB_TOKEN && GIST_ID),
    uptime: process.uptime()
  });
});

// Start server with error handling
const server = app.listen(port, () => {
  console.log(`🚁 Droneplus server listening at http://localhost:${port}`);
  console.log(`📊 GitHub Gist configured: ${!!(GITHUB_TOKEN && GIST_ID)}`);
  console.log(`📝 Gist URL: https://gist.github.com/dkruban/${GIST_ID}`);
  console.log(`📝 Loaded ${dataCache.links.length} links from GitHub`);
  console.log(`🔧 Using .env file: ${fs.existsSync(path.join(__dirname, '.env'))}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
