const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Data file path
const dataFilePath = path.join(__dirname, 'data.json');

// Initialize data file if it doesn't exist
if (!fs.existsSync(dataFilePath)) {
  fs.writeFileSync(dataFilePath, JSON.stringify({ links: [], activities: [] }));
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

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Droneplus server listening at http://localhost:${port}`);
});
