const crypto = require('crypto');
const fs = require('fs-extra');
const argon2 = require('argon2');
const path = require('path');
const config = require('./config');

const SEPARATOR = Buffer.from('<<<TCM-PART>>>', 'utf8');

// Helper: Random delay (0–500ms)
function randomDelay() {
  return new Promise(resolve => setTimeout(resolve, Math.random() * 500));
}

// Argon2 Key Derivation
async function deriveKey(password, salt) {
  await randomDelay();
  return argon2.hash(password, {
    ...config.argon2,
    salt,
    raw: true,
    type: argon2.argon2id,
  });
}

// AES-256-GCM Decrypt
function decryptAES(iv, authTag, ciphertext, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// Get hardware key (Windows-friendly)
async function getHardwareKey() {
  try {
    return await fs.readFile(config.hardwareKeyPath);
  } catch (e) {
    console.error('Hardware key not found! Place it at:', config.hardwareKeyPath);
    process.exit(1);
  }
}

// Split buffer by separator
function splitBySeparator(buffer, separator) {
  const fragments = [];
  let start = 0;
  let end = buffer.indexOf(separator);

  while (end !== -1) {
    fragments.push(buffer.slice(start, end));
    start = end + separator.length;
    end = buffer.indexOf(separator, start);
  }
  fragments.push(buffer.slice(start));

  return fragments;
}

async function decryptFile() {
  // Validate config first
  if (!config.decryptedFile) {
    console.error('Output file path not configured in config.js');
    process.exit(1);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(config.decryptedFile);
  if (outputDir) {
    await fs.ensureDir(outputDir);
  }

  // 1. Read vault data
  const vaultData = await fs.readFile(config.encryptedArchive);

  // 2. Extract header components
  const salt = vaultData.slice(0, 16);
  const hardwareKeyHash = vaultData.slice(16, 48);
  const encryptedData = vaultData.slice(48);

  // 3. Derive encryption key
  const key = await deriveKey(config.password, salt);

  // 4. Get and verify hardware key
  const hardwareKey = await getHardwareKey();
  const computedHardwareKeyHash = crypto.createHash('sha256').update(hardwareKey).digest();

  if (!crypto.timingSafeEqual(hardwareKeyHash, computedHardwareKeyHash)) {
    console.error('Hardware key mismatch!');
    process.exit(1);
  }

  // 5. Create readline interface
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // 6. Prompt for PIN positions
    const pinPositionsInput = await new Promise(resolve => {
      readline.question('Enter PIN positions (e.g., 1423): ', resolve);
    });

    readline.close();

    // Validate PIN input
    if (!/^\d+$/.test(pinPositionsInput)) {
      throw new Error('PIN must contain only digits');
    }

    const pinPositions = pinPositionsInput.split('').map(Number);

    // Validate we have enough digits
    if (pinPositions.length !== config.fragmentCount) {
      throw new Error(`PIN must contain exactly ${config.fragmentCount} digits`);
    }

    // 7. Split encrypted data by separator
    const encryptedFragments = splitBySeparator(encryptedData, SEPARATOR);

    // 8. Process each fragment
    const fragments = encryptedFragments.map(frag => {
      if (frag.length < 28) { // 12 (IV) + 16 (authTag) = 28
        throw new Error('Invalid fragment size');
      }
      const iv = frag.slice(0, 12);
      const authTag = frag.slice(12, 28);
      const ciphertext = frag.slice(28);
      return { iv, authTag, ciphertext };
    });

    // Validate we have enough fragments
    if (Math.max(...pinPositions) >= fragments.length) {
      throw new Error('PIN position exceeds available fragments');
    }

    // 9. Decrypt fragments (only the ones at PIN positions are real)
    const decryptedFragments = fragments.map((frag, index) => {
      if (pinPositions.includes(index)) {
        try {
          return decryptAES(frag.iv, frag.authTag, frag.ciphertext, key);
        } catch (e) {
          console.error(`Decryption failed for fragment ${index}`);
          throw new Error('Decryption failed - wrong PIN or corrupted data');
        }
      } else {
        // Fake fragments (random noise)
        return crypto.randomBytes(frag.ciphertext.length);
      }
    });

    // 10. Reconstruct file from real fragments only
    const realFragments = pinPositions.map(pos => {
      if (pos >= decryptedFragments.length) {
        throw new Error(`Invalid PIN position: ${pos}`);
      }
      return decryptedFragments[pos];
    });

    const decryptedData = Buffer.concat(realFragments);

    // 11. Save decrypted file
    await fs.writeFile(config.decryptedFile, decryptedData);
    console.log(`Decrypted file saved to: ${config.decryptedFile}`);
  } catch (error) {
    readline.close();
    console.error('Decryption failed:', error.message);
    process.exit(1);
  }
}

decryptFile().catch(console.error);
