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
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (e) {
    throw new Error(`AES-GCM decryption failed: ${e.message}`);
  }
}

// Get hardware key
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

  if (!config.decryptedFile) {
    console.error('Output file path not configured in config.js');
    process.exit(1);
  }

  const outputDir = path.dirname(config.decryptedFile);
  if (outputDir) {
    await fs.ensureDir(outputDir);
  }

  const vaultData = await fs.readFile(config.encryptedArchive);
  const salt = vaultData.slice(0, 16);
  const hardwareKeyHash = vaultData.slice(16, 48);
  const encryptedData = vaultData.slice(48);
  const key = await deriveKey(config.password, salt);
  const hardwareKey = await getHardwareKey();
  const computedHardwareKeyHash = crypto.createHash('sha256').update(hardwareKey).digest();

  if (!crypto.timingSafeEqual(hardwareKeyHash, computedHardwareKeyHash)) {
    console.error('Hardware key mismatch!');
    process.exit(1);
  }

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {

    const pinPositionsInput = await new Promise(resolve => {
      readline.question('Enter PIN positions (e.g., 1423): ', resolve);
    });

    readline.close();

    if (!/^\d+$/.test(pinPositionsInput)) {
      throw new Error('PIN must contain only digits');
    }

    const pinPositions = pinPositionsInput.split('').map(Number);

    if (pinPositions.length !== config.fragmentCount) {
      throw new Error(`PIN must contain exactly ${config.fragmentCount} digits`);
    }

    const encryptedFragments = splitBySeparator(encryptedData, SEPARATOR);

    if (encryptedFragments.length <= Math.max(...pinPositions)) {
      throw new Error('Not enough fragments available for the provided PIN');
    }

    // Sort pin positions to reassemble fragments in correct byte order
    const sortedPinPositions = [...pinPositions].sort((a, b) => a - b);
    const realFragments = new Array(pinPositions.length);

    for (let i = 0; i < pinPositions.length; i++) {
      const vaultIndex = pinPositions[i];
      const frag = encryptedFragments[vaultIndex];

      if (!frag || frag.length === 0) {
        throw new Error(`Fragment ${vaultIndex} is empty or missing`);
      }

      realFragments[i] = frag;
    }

    if (realFragments.some(f => f === undefined)) {
      throw new Error('Could not collect all required fragments - check your PIN');
    }

    const encryptedFile = Buffer.concat(realFragments);

    const finalIV         = encryptedFile.slice(0, 12);
    const finalAuthTag    = encryptedFile.slice(12, 28);
    const finalCiphertext = encryptedFile.slice(28);
    const decryptedData   = decryptAES(finalIV, finalAuthTag, finalCiphertext, key);

    await fs.writeFile(config.decryptedFile, decryptedData);
    console.log(`Decrypted file saved to: ${config.decryptedFile}`);

  } catch (error) {
    readline.close();
    console.error('Decryption failed:', error.message);
    process.exit(1);
  }
}

decryptFile().catch(console.error);
