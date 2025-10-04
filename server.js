const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

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

// Data file path - store in the root directory
const dataFilePath = path.join(__dirname, 'data.json');

// Initialize data file if it doesn't exist
if (!fs.existsSync(dataFilePath)) {
  fs.writeFileSync(dataFilePath, JSON.stringify({ links: [], activities: [] }));
  console.log('Created data.json file');
}

// Helper function to read data
function readData() {
  try {
    const data = fs.readFileSync(dataFilePath);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return { links: [], activities: [] };
  }
}

// Helper function to write data
function writeData(data) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
}

// API Routes

// Get all links
app.get('/api/links', (req, res) => {
  const data = readData();
  res.json(data.links);
});

// Add a new link
app.post('/api/links', (req, res) => {
  const { name, url, description, category } = req.body;
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
  
  if (writeData(data)) {
    res.json(newLink);
  } else {
    res.status(500).json({ error: 'Failed to save link' });
  }
});

// Update a link
app.put('/api/links/:id', (req, res) => {
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
    
    if (writeData(data)) {
      res.json(data.links[linkIndex]);
    } else {
      res.status(500).json({ error: 'Failed to update link' });
    }
  } else {
    res.status(404).json({ error: 'Link not found' });
  }
});

// Delete a link
app.delete('/api/links/:id', (req, res) => {
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
    
    if (writeData(data)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete link' });
    }
  } else {
    res.status(404).json({ error: 'Link not found' });
  }
});

// Increment link clicks
app.post('/api/links/:id/click', (req, res) => {
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
    
    if (writeData(data)) {
      res.json({ clicks: data.links[linkIndex].clicks });
    } else {
      res.status(500).json({ error: 'Failed to update clicks' });
    }
  } else {
    res.status(404).json({ error: 'Link not found' });
  }
});

// Get activities
app.get('/api/activities', (req, res) => {
  const data = readData();
  res.json(data.activities);
});

// Debug endpoint to check file structure
app.get('/debug', (req, res) => {
  const files = {
    root: fs.readdirSync(rootPath),
    public: fs.existsSync(publicPath) ? fs.readdirSync(publicPath) : 'not found',
    publicExists: fs.existsSync(publicPath),
    indexInRoot: fs.existsSync(path.join(rootPath, 'index.html')),
    indexInPublic: fs.existsSync(path.join(publicPath, 'index.html')),
    dataExists: fs.existsSync(dataFilePath),
    workingDir: __dirname,
    publicPath: publicPath
  };
  res.json(files);
});

// Serve the main page - with comprehensive path checking
app.get('/', (req, res) => {
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
    // Create a comprehensive error page with debug info
    const debugInfo = {
      workingDir: __dirname,
      publicPath: publicPath,
      publicExists: fs.existsSync(publicPath),
      checkedPaths: possiblePaths,
      allFiles: fs.readdirSync(rootPath),
      publicFiles: fs.existsSync(publicPath) ? fs.readdirSync(publicPath) : []
    };
    
    const errorHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Droneplus - Debug Info</title>
        <style>
            body { 
                font-family: 'Courier New', monospace; 
                padding: 20px; 
                background: #0a0a0a; 
                color: white; 
                line-height: 1.6;
            }
            .container { max-width: 1000px; margin: 0 auto; }
            .error { color: #ff453a; }
            .success { color: #32d74b; }
            .warning { color: #ff9f1a; }
            .debug { 
                background: rgba(255,255,255,0.1); 
                padding: 15px; 
                border-radius: 8px; 
                margin: 10px 0;
                white-space: pre-wrap;
                font-size: 12px;
            }
            button { 
                background: #0a84ff; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 5px; 
                cursor: pointer;
                margin: 5px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚁 Droneplus Debug Information</h1>
            <p class="success">✅ Server is running successfully!</p>
            <p class="error">❌ index.html file not found in any expected location</p>
            
            <h2>🔍 Debug Information:</h2>
            <div class="debug">${JSON.stringify(debugInfo, null, 2)}</div>
            
            <h2>🛠️ Solutions:</h2>
            <ol>
                <li>Move index.html to the root directory of your repository</li>
                <li>Or ensure it's in a 'public' directory</li>
                <li>Check that the file is named exactly 'index.html' (lowercase)</li>
            </ol>
            
            <h2>📋 Test API:</h2>
            <button onclick="testAPI()">Test API Endpoints</button>
            <div id="apiResults"></div>
        </div>
        
        <script>
            async function testAPI() {
                const results = document.getElementById('apiResults');
                results.innerHTML = '<div class="debug">Testing API...</div>';
                
                try {
                    const links = await fetch('/api/links').then(r => r.json());
                    const activities = await fetch('/api/activities').then(r => r.json());
                    results.innerHTML = \`
                        <div class="debug">
API Test Results:
Links: \${JSON.stringify(links, null, 2)}
Activities: \${JSON.stringify(activities, null, 2)}
                        </div>
                    \`;
                } catch (error) {
                    results.innerHTML = \`<div class="error">API Error: \${error.message}</div>\`;
                }
            }
        </script>
    </body>
    </html>`;
    res.send(errorHtml);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Droneplus server listening at http://localhost:${port}`);
  console.log(`Working directory: ${__dirname}`);
  console.log(`Public directory: ${publicPath}`);
  console.log(`Public exists: ${fs.existsSync(publicPath)}`);
});
