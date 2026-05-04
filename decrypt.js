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

// ... (keep all your existing imports and helper functions)

async function decryptFile() {
  // 1. Read vault data
  const vaultData = await fs.readFile(config.encryptedArchive);

  // 2. Extract header components
  const salt = vaultData.slice(0, 16);
  const hardwareKeyHash = vaultData.slice(16, 48);
  const encryptedData = vaultData.slice(48);

  // 3. Derive encryption key for REAL fragments
  const key = await deriveKey(config.password, salt);

  // 4. Get and verify hardware key
  const hardwareKey = await getHardwareKey();
  const computedHardwareKeyHash = crypto.createHash('sha256').update(hardwareKey).digest();

  if (!crypto.timingSafeEqual(hardwareKeyHash, computedHardwareKeyHash)) {
    console.error('Hardware key mismatch!');
    process.exit(1);
  }

  // 5. Prompt for PIN positions
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const pinPositionsInput = await new Promise(resolve => {
    readline.question('Enter PIN positions (e.g., 1423): ', resolve);
  });
  readline.close();

  const pinPositions = pinPositionsInput.split('').map(Number);

  // 6. Split encrypted data
  const encryptedFragments = splitBySeparator(encryptedData, SEPARATOR);

  // 7. Process fragments
  const realFragments = [];

  for(let i = 0; i < encryptedFragments.length; i++) {
    if (pinPositions.includes(i)) {
      try {
        const iv = encryptedFragments[i].slice(0, 12);
        const authTag = encryptedFragments[i].slice(12, 28);
        const ciphertext = encryptedFragments[i].slice(28);

        const decrypted = decryptAES(iv, authTag, ciphertext, key);
        realFragments.push(decrypted);
      } catch (e) {
        console.error(`Decryption failed for fragment ${i} - wrong PIN or corrupted data`);
        process.exit(1);
      }
    }
  }

  // 8. Reconstruct file
  const decryptedData = Buffer.concat(realFragments);
  await fs.writeFile(config.decryptedFile, decryptedData);
  console.log(`Decrypted file saved to: ${config.decryptedFile}`);
}


decryptFile().catch(console.error);
