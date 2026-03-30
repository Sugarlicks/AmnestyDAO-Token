require('dotenv').config();
const fs = require('fs');
const path = require('path');

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
function readEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    return fs.readFileSync(envPath, 'utf8')
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
function writeEnvFile(envVars) {
  const envPath = path.join(__dirname, '..', '.env');
  const content = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  try {
    fs.writeFileSync(envPath, content);
  } catch (error) {
    console.error('Error writing to .env file:', error);
    process.exit(1);
  }
}

// Get current version and build number from .env
const envVars = readEnvFile();
const currentVersion = envVars.APP_VERSION || '0.0.1';
const currentBuildNumber = parseInt(envVars.BUILD_NUMBER || '1', 10);

// Increment version and build number
const newVersion = incrementVersion(currentVersion, process.env.VERSION_TYPE || 'patch');
const newBuildNumber = currentBuildNumber + 1;

// Update .env file
envVars.APP_VERSION = newVersion;
envVars.BUILD_NUMBER = newBuildNumber.toString();
writeEnvFile(envVars);

// Create version object for version.json
const versionInfo = {
  version: newVersion,
  buildDate: new Date().toISOString(),
  buildNumber: newBuildNumber
};

// Path to version.json
const versionPath = path.join(__dirname, '..', 'version.json');

// Write to version.json
try {
  fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
  console.log('Version updated successfully:');
  console.log('New version:', newVersion);
  console.log('New build number:', newBuildNumber);
  console.log('Updated version.json:', versionInfo);
} catch (error) {
  console.error('Failed to update version.json:', error);
  process.exit(1);
} 