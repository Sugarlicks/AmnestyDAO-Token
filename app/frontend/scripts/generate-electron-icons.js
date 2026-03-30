const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to the source icon
const SOURCE_ICON = path.join(__dirname, '..', 'public', 'icons', 'icon.png');
const ELECTRON_ICONS_DIR = path.join(__dirname, '..', 'src-electron', 'icons');

async function generateElectronIcons() {
  try {
    // Check if source icon exists
    if (!fs.existsSync(SOURCE_ICON)) {
      console.error(`Source icon not found at ${SOURCE_ICON}`);
      process.exit(1);
    }

    // Ensure Electron icons directory exists
    if (!fs.existsSync(ELECTRON_ICONS_DIR)) {
      fs.mkdirSync(ELECTRON_ICONS_DIR, { recursive: true });
    }

    // Copy PNG icon
    const pngPath = path.join(ELECTRON_ICONS_DIR, 'icon.png');
    await sharp(SOURCE_ICON)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(pngPath);
    console.log('✓ Generated icon.png');

    // Generate macOS .icns file (requires macOS)
    if (process.platform === 'darwin') {
      try {
        const iconsetDir = path.join(ELECTRON_ICONS_DIR, 'icon.iconset');
        if (fs.existsSync(iconsetDir)) {
          fs.rmSync(iconsetDir, { recursive: true, force: true });
        }
        fs.mkdirSync(iconsetDir, { recursive: true });

        // Generate all required sizes for .icns
        const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
        for (const size of icnsSizes) {
          const size2x = size * 2;
          // Generate 1x
          await sharp(SOURCE_ICON)
            .resize(size, size, {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toFile(path.join(iconsetDir, `icon_${size}x${size}.png`));
          
          // Generate 2x (except for 1024)
          if (size !== 1024) {
            await sharp(SOURCE_ICON)
              .resize(size2x, size2x, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
              })
              .toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
          }
        }

        // Convert iconset to .icns using iconutil (macOS only)
        const icnsPath = path.join(ELECTRON_ICONS_DIR, 'icon.icns');
        execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
        console.log('✓ Generated icon.icns (macOS)');
        
        // Clean up iconset directory
        fs.rmSync(iconsetDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('⚠ Could not generate .icns file (iconutil not available or error):', error.message);
        console.warn('  Electron Builder will convert PNG to .icns automatically during build');
      }
    } else {
      console.log('ℹ Skipping .icns generation (requires macOS)');
      console.log('  Electron Builder will convert PNG to .icns automatically during build');
    }

    // Generate Windows .ico file
    try {
      // .ico files can contain multiple sizes
      // We'll create a 256x256 version which Electron Builder can use
      const icoPath = path.join(ELECTRON_ICONS_DIR, 'icon.ico');
      await sharp(SOURCE_ICON)
        .resize(256, 256, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toFile(icoPath);
      console.log('✓ Generated icon.ico (Windows)');
      console.log('  Note: For best results, use a tool like ImageMagick or online converters');
      console.log('  to create a multi-resolution .ico file. Electron Builder will also');
      console.log('  convert PNG to .ico automatically during build.');
    } catch (error) {
      console.warn('⚠ Could not generate .ico file:', error.message);
      console.warn('  Electron Builder will convert PNG to .ico automatically during build');
    }

    console.log('\n✓ Electron icons generation complete!');
    console.log(`  Icons are in: ${ELECTRON_ICONS_DIR}`);
    console.log('\n  Note: Electron Builder can also convert PNG to platform-specific');
    console.log('  formats automatically, so pre-generated .icns/.ico files are optional.');

  } catch (error) {
    console.error('Error generating Electron icons:', error);
    process.exit(1);
  }
}

generateElectronIcons();

