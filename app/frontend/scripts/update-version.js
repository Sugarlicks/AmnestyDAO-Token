import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to increment version number
function incrementVersion(version, type = 'patch') {
  const [major, minor, patch] = version.split('.').map(Number);
  
  switch(type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// Function to read and parse .env file
function readEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .reduce((acc, line) => {
        const [key, value] = line.split('=');
        if (key && value) {
          acc[key.trim()] = value.trim();
        }
        return acc;
      }, {});
  } catch (error) {
    console.error('Error reading .env file:', error);
    return {};
  }
}

// Function to write to .env file
function writeEnvFile(filePath, envVars) {
  const content = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  try {
    fs.writeFileSync(filePath, content);
  } catch (error) {
    console.error('Error writing to .env file:', error);
    process.exit(1);
  }
}

// Function to update backend version
async function updateBackendVersion(version, buildNumber) {
  try {
    const response = await axios.post('http://localhost:4000/api/version/update', {
      version,
      buildNumber,
      buildDate: new Date().toISOString()
    });
    console.log('Backend version updated successfully:', response.data);
  } catch (error) {
    console.error('Failed to update backend version:', error.message);
    process.exit(1);
  }
}

// Main function
async function main() {
  // Get version type from command line
  const versionType = process.env.VERSION_TYPE || 'patch';
  
  // Frontend .env paths
  const frontendEnvPath = path.join(__dirname, '..', '.env');
  const frontendEnvVars = readEnvFile(frontendEnvPath);
  
  // Get current version and build number
  const currentVersion = frontendEnvVars.VITE_APP_VERSION || '0.0.1';
  const currentBuildNumber = parseInt(frontendEnvVars.VITE_BUILD_NUMBER || '1', 10);
  
  // Increment version and build number
  const newVersion = incrementVersion(currentVersion, versionType);
  const newBuildNumber = currentBuildNumber + 1;
  
  // Update frontend .env
  frontendEnvVars.VITE_APP_VERSION = newVersion;
  frontendEnvVars.VITE_BUILD_NUMBER = newBuildNumber.toString();
  writeEnvFile(frontendEnvPath, frontendEnvVars);
  
  // Update backend version
  await updateBackendVersion(newVersion, newBuildNumber);
  
  console.log('Version updated successfully:');
  console.log('New version:', newVersion);
  console.log('New build number:', newBuildNumber);
}

// Run the script
main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
}); 