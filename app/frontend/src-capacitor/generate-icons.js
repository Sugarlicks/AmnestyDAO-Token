const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Primary color from your app - #fff000 (RGB: 255, 240, 0)
// Used for splash screens, loading screens, and icon backgrounds
const PRIMARY_COLOR = '#fff000';
const PRIMARY_COLOR_RGB = { r: 255, g: 240, b: 0, alpha: 1 };

// Path to the icon file - using the main app icon
const ICON_PATH = path.join(__dirname, '..', 'public', 'icons', 'icon.png');

// iOS icon sizes
const IOS_ICON_SIZES = {
  '20x20@2x': 40,
  '20x20@3x': 60,
  '29x29@2x': 58,
  '29x29@3x': 87,
  '40x40@2x': 80,
  '40x40@3x': 120,
  '60x60@2x': 120,
  '60x60@3x': 180,
  '76x76@2x': 152,
  '83.5x83.5@2x': 167,
  '1024x1024': 1024
};

const IOS_SPLASH_SIZES = [
  { name: '1x', width: 320, height: 480 },   // 1x
  { name: '2x', width: 640, height: 960 },   // 2x
  { name: '3x', width: 960, height: 1440 }   // 3x
];


// Android icon sizes
const ANDROID_ICON_SIZES = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

// Android splash screen sizes - Portrait
const ANDROID_SPLASH_SIZES_PORT = {
  'port-hdpi': { width: 720, height: 1280 },
  'port-mdpi': { width: 480, height: 800 },
  'port-xhdpi': { width: 960, height: 1600 },
  'port-xxhdpi': { width: 1440, height: 2560 },
  'port-xxxhdpi': { width: 2160, height: 3840 }
};

// Android splash screen sizes - Landscape
const ANDROID_SPLASH_SIZES_LAND = {
  'land-hdpi': { width: 1280, height: 720 },
  'land-mdpi': { width: 800, height: 480 },
  'land-xhdpi': { width: 1600, height: 960 },
  'land-xxhdpi': { width: 2560, height: 1440 },
  'land-xxxhdpi': { width: 3840, height: 2160 }
};

async function createBackground(size) {
  try {
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: PRIMARY_COLOR_RGB
      }
    });
  } catch (error) {
    console.error('Error creating background:', error);
    throw error;
  }
}

async function createSplashBackground(width, height) {
  try {
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: PRIMARY_COLOR_RGB
      }
    });
  } catch (error) {
    console.error('Error creating splash background:', error);
    throw error;
  }
}

async function createIcon(size) {
  try {
    // Load and resize the icon with primary color background
    console.log(`Loading icon from: ${ICON_PATH}`);
    const iconBuffer = await fs.promises.readFile(ICON_PATH);
    console.log('Icon file read successfully');
    
    // Resize the icon to the required size, maintaining aspect ratio
    // Use 'contain' to fit within bounds with primary color background
    const icon = await sharp(iconBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: PRIMARY_COLOR_RGB
      });
    
    console.log('Icon resized successfully');
    
    return icon;
  } catch (error) {
    console.error('Error creating icon:', error);
    throw error;
  }
}

// Create icon foreground for adaptive icons (transparent background)
async function createIconForeground(size) {
  try {
    // Load and resize the icon without background (for adaptive icon foreground)
    console.log(`Loading icon foreground from: ${ICON_PATH}`);
    const iconBuffer = await fs.promises.readFile(ICON_PATH);
    
    // Resize with transparent background for adaptive icon foreground
    const icon = await sharp(iconBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      });
    
    return icon;
  } catch (error) {
    console.error('Error creating icon foreground:', error);
    throw error;
  }
}

async function createRoundIcon(size) {
  try {
    // Create a circular mask
    const svgString = `<svg><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`;
    const mask = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: PRIMARY_COLOR_RGB
      }
    })
    .composite([{
      input: Buffer.from(svgString),
      gravity: 'center'
    }])
    .png()  // Ensure we're working with PNG format
    .toBuffer();

    // Create the icon
    const icon = await createIcon(size);
    
    // Apply the circular mask
    return icon.composite([{
      input: mask,
      gravity: 'center',
      blend: 'dest-in'
    }]);
  } catch (error) {
    console.error('Error creating round icon:', error);
    throw error;
  }
}

async function createSplashWithIcon(width, height) {
  try {
    // Create the background with primary color (#fff000)
    const background = await createSplashBackground(width, height);
    
    // Calculate icon size (40% of the smaller dimension)
    const iconSize = Math.floor(Math.min(width, height) * 0.4);
    
    // Load and resize the icon
    console.log(`Loading icon for splash screen from: ${ICON_PATH}`);
    const iconBuffer = await fs.promises.readFile(ICON_PATH);
    console.log('Icon file read successfully for splash screen');
    
    const icon = await sharp(iconBuffer)
      .resize(iconSize, iconSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
    
    console.log('Icon resized successfully for splash screen');
    
    // Composite the icon onto the background
    return background.composite([{
      input: icon,
      gravity: 'center'
    }]);
  } catch (error) {
    console.error('Error creating splash with icon:', error);
    throw error;
  }
}

async function generateIcons() {
  try {
    // Check if icon exists
    if (!fs.existsSync(ICON_PATH)) {
      console.error(`Icon file not found at ${ICON_PATH}`);
      console.error('Please ensure public/icons/icon.png exists');
      process.exit(1);
    }

    // Verify icon file is readable
    try {
      await fs.promises.access(ICON_PATH, fs.constants.R_OK);
      console.log('Icon file is readable');
    } catch (error) {
      console.error('Icon file is not readable:', error);
      process.exit(1);
    }

    // Create iOS icons
    const iosIconPath = path.join(__dirname, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
    if (!fs.existsSync(iosIconPath)) {
      fs.mkdirSync(iosIconPath, { recursive: true });
    }

    // Create Android icons
    const androidIconPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
    if (!fs.existsSync(androidIconPath)) {
      fs.mkdirSync(androidIconPath, { recursive: true });
    }

    // Generate iOS icons
    for (const [name, size] of Object.entries(IOS_ICON_SIZES)) {
      console.log(`Generating iOS icon: ${name} (${size}x${size})`);
      const icon = await createIcon(size);
      const outputPath = path.join(iosIconPath, `icon-${name}.png`);
      await icon.toFile(outputPath);
      console.log(`Generated iOS icon: ${name}`);
    }

    // Generate Android icons
    for (const [density, size] of Object.entries(ANDROID_ICON_SIZES)) {
      const mipmapPath = path.join(androidIconPath, `mipmap-${density}`);
      if (!fs.existsSync(mipmapPath)) {
        fs.mkdirSync(mipmapPath, { recursive: true });
      }

      // Generate regular icon
      console.log(`Generating Android icon: ${density} (${size}x${size})`);
      const icon = await createIcon(size);
      const outputPath = path.join(mipmapPath, 'ic_launcher.png');
      await icon.toFile(outputPath);
      console.log(`Generated Android icon: ${density}`);

      // Generate round icon
      console.log(`Generating Android round icon: ${density} (${size}x${size})`);
      const roundIcon = await createRoundIcon(size);
      const roundOutputPath = path.join(mipmapPath, 'ic_launcher_round.png');
      await roundIcon.toFile(roundOutputPath);
      console.log(`Generated Android round icon: ${density}`);

      // Generate foreground icon for adaptive icons
      console.log(`Generating Android foreground icon: ${density} (${size}x${size})`);
      const foregroundIcon = await createIconForeground(size);
      const foregroundOutputPath = path.join(mipmapPath, 'ic_launcher_foreground.png');
      await foregroundIcon.toFile(foregroundOutputPath);
      console.log(`Generated Android foreground icon: ${density}`);
    }

    // Generate Android portrait splash screens
    for (const [density, dimensions] of Object.entries(ANDROID_SPLASH_SIZES_PORT)) {
      const drawablePath = path.join(androidIconPath, `drawable-${density}`);
      if (!fs.existsSync(drawablePath)) {
        fs.mkdirSync(drawablePath, { recursive: true });
      }

      console.log(`Generating Android portrait splash screen: ${density} (${dimensions.width}x${dimensions.height})`);
      const splash = await createSplashWithIcon(dimensions.width, dimensions.height);
      const outputPath = path.join(drawablePath, 'splash.png');
      await splash.toFile(outputPath);
      console.log(`Generated Android portrait splash screen: ${density}`);
    }

    // Generate Android landscape splash screens
    for (const [density, dimensions] of Object.entries(ANDROID_SPLASH_SIZES_LAND)) {
      const drawablePath = path.join(androidIconPath, `drawable-${density}`);
      if (!fs.existsSync(drawablePath)) {
        fs.mkdirSync(drawablePath, { recursive: true });
      }

      console.log(`Generating Android landscape splash screen: ${density} (${dimensions.width}x${dimensions.height})`);
      const splash = await createSplashWithIcon(dimensions.width, dimensions.height);
      const outputPath = path.join(drawablePath, 'splash.png');
      await splash.toFile(outputPath);
      console.log(`Generated Android landscape splash screen: ${density}`);
    }

    // Generate default splash screen (portrait)
    const defaultDrawablePath = path.join(androidIconPath, 'drawable');
    if (!fs.existsSync(defaultDrawablePath)) {
      fs.mkdirSync(defaultDrawablePath, { recursive: true });
    }
    const defaultDimensions = ANDROID_SPLASH_SIZES_PORT['port-mdpi'];
    console.log(`Generating default Android splash screen (${defaultDimensions.width}x${defaultDimensions.height})`);
    const defaultSplash = await createSplashWithIcon(defaultDimensions.width, defaultDimensions.height);
    const defaultSplashPath = path.join(defaultDrawablePath, 'splash.png');
    await defaultSplash.toFile(defaultSplashPath);
    console.log('Generated default Android splash screen');

    // Generate iOS splash screen
    const iosSplashPath = path.join(__dirname, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');
    if (!fs.existsSync(iosSplashPath)) {
      fs.mkdirSync(iosSplashPath, { recursive: true });
    }

    for (const splash of IOS_SPLASH_SIZES) {
      console.log(`Generating iOS splash screen ${splash.name} (${splash.width}x${splash.height})`);
      const iosSplash = await createSplashWithIcon(splash.width, splash.height);
      const iosSplashOutputPath = path.join(iosSplashPath, `${splash.name}.png`);
      await iosSplash.toFile(iosSplashOutputPath);
      console.log(`Generated iOS splash screen ${splash.name}`);
    }

  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
