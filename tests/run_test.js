import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const sampleInputPath = path.join(projectRoot, 'sample_input.json');
const testStorageDir = path.join(__dirname, 'test_storage');

// Clean up previous test run
if (fs.existsSync(testStorageDir)) {
  fs.rmSync(testStorageDir, { recursive: true, force: true });
}

// Prepare storage structure
const kvStoreDir = path.join(testStorageDir, 'key_value_stores', 'default');
fs.mkdirSync(kvStoreDir, { recursive: true });

// Read and modify sample input
const rawInput = fs.readFileSync(sampleInputPath, 'utf8');
const input = JSON.parse(rawInput);

// Add required fields and test fields
input.max_outbound_flight_limit = input.max_outbound_flight_limit ?? 3;
input.max_return_flight_limit = input.max_return_flight_limit ?? 3;
input.max_crawler_runtime_secs = input.max_crawler_runtime_secs ?? 60;
input.debug = input.debug ?? false; 

// Write INPUT.json
fs.writeFileSync(path.join(kvStoreDir, 'INPUT.json'), JSON.stringify(input, null, 2));
fs.writeFileSync(path.join(kvStoreDir, 'input.json'), JSON.stringify(input, null, 2));

console.log('Test input configured:', input);
console.log('Starting actor...');
console.log('Storage Dir:', testStorageDir);

const env = { 
  ...process.env, 
  APIFY_STORAGE_DIR: testStorageDir, 
  APIFY_LOCAL_STORAGE_DIR: testStorageDir,
  CRAWLEE_STORAGE_DIR: testStorageDir,
  APIFY_PURGE_ON_START: '0' 
};

const child = spawn('node', ['src/index.js'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: env
});

child.on('close', (code) => {
  console.log(`Actor finished with exit code ${code}`);
  
  if (code === 0) {
    // Check for results
    const datasetDir = path.join(testStorageDir, 'datasets', 'default');
    if (fs.existsSync(datasetDir)) {
      const files = fs.readdirSync(datasetDir);
      if (files.length > 0) {
        console.log(`Success! Found ${files.length} items in the dataset.`);
        files.forEach((file) => {
          const filePath = path.join(datasetDir, file);
          const result = fs.readFileSync(filePath, 'utf8');
          console.log(`Result from ${file}:`, result);
        });
      } else {
        console.warn('Warning: Dataset directory exists but is empty.');
      }
    } else {
        console.warn('Warning: No dataset directory found.');
    }
  } else {
      console.error('Test failed.');
  }
});
