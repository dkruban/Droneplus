const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const app = express();
const port = process.env.PORT || 10000;

// Initialize Firebase Admin SDK with environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
});

const db = admin.firestore();

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

// API Routes

// Get all links
app.get('/api/links', async (req, res) => {
  try {
    const linksSnapshot = await db.collection('links').orderBy('createdAt', 'desc').get();
    const links = [];
    
    linksSnapshot.forEach(doc => {
      links.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`Fetched ${links.length} links from Firebase`);
    res.json(links);
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// Add a new link
app.post('/api/links', async (req, res) => {
  try {
    const { name, url, description, category } = req.body;
    console.log('Adding link:', { name, url, description, category });
    
    const newLink = {
      name,
      url,
      description,
      category,
      clicks: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('links').add(newLink);
    
    // Add activity
    await db.collection('activities').add({
      type: 'added',
      linkName: name,
      linkId: docRef.id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const savedLink = { id: docRef.id, ...newLink };
    console.log('Link added successfully:', docRef.id);
    res.json(savedLink);
  } catch (error) {
    console.error('Error adding link:', error);
    res.status(500).json({ error: 'Failed to add link' });
  }
});

// Update a link
app.put('/api/links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, description, category } = req.body;
    
    const updatedLink = {
      name,
      url,
      description,
      category,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('links').doc(id).update(updatedLink);
    
    // Add activity
    await db.collection('activities').add({
      type: 'edited',
      linkName: name,
      linkId: id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const linkDoc = await db.collection('links').doc(id).get();
    const savedLink = { id: linkDoc.id, ...linkDoc.data() };
    
    console.log('Link updated successfully:', id);
    res.json(savedLink);
  } catch (error) {
    console.error('Error updating link:', error);
    res.status(500).json({ error: 'Failed to update link' });
  }
});

// Delete a link
app.delete('/api/links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get link name before deletion for activity log
    const linkDoc = await db.collection('links').doc(id).get();
    const linkName = linkDoc.data().name;
    
    await db.collection('links').doc(id).delete();
    
    // Add activity
    await db.collection('activities').add({
      type: 'deleted',
      linkName: linkName,
      linkId: id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Link deleted successfully:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting link:', error);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// Increment link clicks
app.post('/api/links/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    
    const linkRef = db.collection('links').doc(id);
    await linkRef.update({
      clicks: admin.firestore.FieldValue.increment(1)
    });
    
    const updatedDoc = await linkRef.get();
    const linkData = updatedDoc.data();
    
    // Add activity
    await db.collection('activities').add({
      type: 'clicked',
      linkName: linkData.name,
      linkId: id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Link click incremented:', id);
    res.json({ clicks: linkData.clicks });
  } catch (error) {
    console.error('Error incrementing clicks:', error);
    res.status(500).json({ error: 'Failed to update clicks' });
  }
});

// Get activities
app.get('/api/activities', async (req, res) => {
  try {
    const activitiesSnapshot = await db.collection('activities')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    const activities = [];
    
    activitiesSnapshot.forEach(doc => {
      const activity = doc.data();
      activities.push({
        id: doc.id,
        ...activity,
        timestamp: activity.timestamp.toDate().toISOString()
      });
    });
    
    console.log(`Fetched ${activities.length} activities from Firebase`);
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Export all data for backup
app.get('/api/export', async (req, res) => {
  try {
    const linksSnapshot = await db.collection('links').get();
    const links = [];
    
    linksSnapshot.forEach(doc => {
      const link = doc.data();
      links.push({
        id: doc.id,
        ...link,
        createdAt: link.createdAt.toDate().toISOString(),
        updatedAt: link.updatedAt.toDate().toISOString()
      });
    });
    
    res.json({ links, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Import data from backup
app.post('/api/import', async (req, res) => {
  try {
    const { links } = req.body;
    
    if (!links || !Array.isArray(links)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    const batch = db.batch();
    
    links.forEach(link => {
      const linkRef = db.collection('links').doc();
      const linkData = {
        name: link.name,
        url: link.url,
        description: link.description,
        category: link.category,
        clicks: link.clicks || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      batch.set(linkRef, linkData);
    });
    
    await batch.commit();
    
    console.log(`Imported ${links.length} links`);
    res.json({ success: true, imported: links.length });
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    status: 'Firebase connected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    envVars: {
      projectId: process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Not set',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 'Set' : 'Not set',
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? 'Set' : 'Not set'
    }
  });
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
    database: 'Firebase Firestore',
    uptime: process.uptime(),
    envVarsSet: {
      projectId: !!process.env.FIREBASE_PROJECT_ID,
      clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: !!process.env.FIREBASE_PRIVATE_KEY
    }
  });
});

// Start server with error handling
const server = app.listen(port, () => {
  console.log(`🚁 Droneplus server listening at http://localhost:${port}`);
  console.log(`📊 Connected to Firebase Firestore`);
  console.log(`🔧 Using environment variables for Firebase credentials`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
