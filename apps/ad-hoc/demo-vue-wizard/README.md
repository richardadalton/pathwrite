# Vue Wizard Demo with Persistence

Demo Vue application showing wizard state persistence using `@daltonr/pathwrite-store-http`.

## Features

- 4-step onboarding wizard
- Automatic state persistence on each "Next" click
- Restores wizard state on page reload
- Works with the demo API server

## Setup

1. **Start the API server first** (in a separate terminal):
   ```bash
   cd ../demo-api-server
   npm start
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the dev server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**: http://localhost:5173

## How It Works

1. Fill out the wizard and click "Next" on each step
2. State is automatically saved to the API server
3. Close your browser or refresh the page
4. The wizard will restore to where you left off!

## Try It

1. Fill out step 1 (Personal Info) and click Next
2. Check the API server console - you'll see the POST request
3. Refresh the browser
4. Check the API server console - you'll see the GET request
5. The wizard resumes at step 2!

## Clear State

Click the "Clear State" button to reset the wizard and delete saved state.

