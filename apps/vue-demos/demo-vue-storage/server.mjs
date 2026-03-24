import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// In-memory storage (mimics a database)
const snapshots = new Map();

app.use(cors());
app.use(express.json());

// GET /api/state (list all keys)
app.get('/api/state', (req, res) => {
  const keys = Array.from(snapshots.keys());
  res.json({ keys });
});

// GET /api/state/:key (load snapshot)
app.get('/api/state/:key', (req, res) => {
  const { key } = req.params;
  const state = snapshots.get(key);
  
  if (!state) {
    return res.status(404).json({ error: 'Snapshot not found' });
  }
  
  res.json(state);
});

// PUT /api/state/:key (save snapshot)
app.put('/api/state/:key', (req, res) => {
  const { key } = req.params;
  const state = req.body;
  
  snapshots.set(key, state);
  res.json({ success: true, key });
});

// DELETE /api/state/:key (delete snapshot)
app.delete('/api/state/:key', (req, res) => {
  const { key } = req.params;
  
  if (!snapshots.has(key)) {
    return res.status(404).json({ error: 'Snapshot not found' });
  }
  
  snapshots.delete(key);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`✓ Storage API running at http://localhost:${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`    GET    /api/state       - List all snapshot keys`);
  console.log(`    GET    /api/state/:key  - Load a snapshot`);
  console.log(`    PUT    /api/state/:key  - Save a snapshot`);
  console.log(`    DELETE /api/state/:key  - Delete a snapshot`);
});

