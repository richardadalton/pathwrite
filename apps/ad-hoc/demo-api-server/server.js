import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for wizard states
// Key format: whatever the client sends (e.g., "user:123:onboarding")
const wizardStates = new Map();

// Save wizard state (PUT — used by HttpStore, POST — also accepted)
function handleSave(req, res) {
  const { key } = req.params;
  const state = req.body;
  
  console.log(`📝 ${req.method} /api/wizard/state/${key}`);
  console.log('   State:', JSON.stringify(state, null, 2));
  
  wizardStates.set(key, state);
  
  res.json({ 
    success: true, 
    message: 'State saved',
    key 
  });
}

app.put('/api/wizard/state/:key', handleSave);
app.post('/api/wizard/state/:key', handleSave);

// GET endpoint - Load wizard state
app.get('/api/wizard/state/:key', (req, res) => {
  const { key } = req.params;
  
  console.log(`📖 GET /api/wizard/state/${key}`);
  
  if (wizardStates.has(key)) {
    const state = wizardStates.get(key);
    console.log('   Returning saved state');
    res.json(state);
  } else {
    console.log('   No state found, returning 404');
    res.status(404).json({ 
      error: 'State not found',
      message: `No saved state for key: ${key}` 
    });
  }
});

// DELETE endpoint - Clear wizard state (optional, useful for testing)
app.delete('/api/wizard/state/:key', (req, res) => {
  const { key } = req.params;
  
  console.log(`🗑️  DELETE /api/wizard/state/${key}`);
  
  if (wizardStates.has(key)) {
    wizardStates.delete(key);
    console.log('   State deleted');
    res.json({ 
      success: true, 
      message: 'State deleted' 
    });
  } else {
    console.log('   No state found');
    res.status(404).json({ 
      error: 'State not found' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    storedKeys: Array.from(wizardStates.keys())
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Pathwrite Demo API Server running on http://localhost:${PORT}`);
  console.log(`   POST   http://localhost:${PORT}/api/wizard/state/:key`);
  console.log(`   GET    http://localhost:${PORT}/api/wizard/state/:key`);
  console.log(`   DELETE http://localhost:${PORT}/api/wizard/state/:key`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log('\n✨ Ready to accept wizard state requests!\n');
});

