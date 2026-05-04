const crypto = require('crypto');
const fs = require('fs-extra');
const config = require('./config');

const ab = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
];

const chars = [
  '~', '`', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '-',
  '+', '=', '|', '\\', '{', '}', '[', ']', ':', ';', '"', "'", '<',
  ',', '>', '.', '?', '/'
];
  
// Helper: Random delay (0–500ms)
function randomDelay() {
  return new Promise(resolve => setTimeout(resolve, Math.random() * 500));
}

// Argon2 Key Derivation
async function deriveKey(password, salt) {
  await randomDelay();
  const argon2 = require('argon2');
  return argon2.hash(password, {
    ...config.argon2,
    salt,
    raw: true,
    type: argon2.argon2id,
  });
}

// AES-256-GCM Encrypt
function encryptAES(data, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { iv, ciphertext, authTag };
}

// Generate hardware key and save to file
async function generateHardwareKey() {
  const key = crypto.randomBytes(config.hardwareKeySize);
  await fs.writeFile(config.hardwareKeyPath, key);
  console.log(`Hardware key saved to: ${config.hardwareKeyPath}`);
  return key;
}

function createWord() {
  let word = '';
  const min = 2; // Minimum 2 characters
  const max = 10; // Maximum 9 characters
  const length = Math.floor(Math.random() * (max - min + 1)) + min;

  for(let i = 0; i < length; i++) {
    word += ab[Math.floor(Math.random() * ab.length)];
  }
  return word + ' ';
}

function createSymbol() {
  return chars[Math.floor(Math.random() * chars.length)] + ' ';
}

function createRandomData(length) {
  let data = '';
  const targetLength = Math.floor(Math.random() * (length - 100 + 1)) + 100;

  // Generate random text
  while (data.length < targetLength) {
    data += createWord();
    if (Math.random() > 0.99) data += createSymbol(); // 1% symbol
    if (Math.random() > 0.91) data += '\r\n';         // 1% newline
  }

  // Ensure data is not empty
  if (!data.trim()) {
    throw new Error("Generated empty data");
  }

  // Generate a 32-byte key
  const key = crypto.randomBytes(32);

  // Encrypt (with error handling)
  try {
    const encryptedFile = encryptAES(data.substring(0, targetLength), key);

    // Combine IV + AuthTag + Ciphertext
    const encryptedBuffer = Buffer.concat([
      encryptedFile.iv,
      encryptedFile.authTag,
      encryptedFile.ciphertext
    ]);

    return encryptedBuffer;
  } catch (error) {
    const encryptedFile = encryptAES(data.substring(0, targetLength), key);

    // Combine IV + AuthTag + Ciphertext
    const encryptedBuffer = Buffer.concat([
      encryptedFile.iv,
      encryptedFile.authTag,
      encryptedFile.ciphertext
    ]);
  }
}

async function encryptFile() {

  // 1. Generate random salt
  const salt = crypto.randomBytes(16);

  // 2. Derive encryption key
  const key = await deriveKey(config.password, salt);

  // 3. Generate hardware key (physical 2FA)
  const hardwareKey = await generateHardwareKey();
  const hardwareKeyHash = crypto.createHash('sha256').update(hardwareKey).digest();

  // 4. Read and split file into fragments
  const fileData = await fs.readFile(config.inputFile);
  const fileSize1 = fileData.length;
  const fragments = [];

  const encryptedFile = encryptAES(fileData, key);
  
  const encryptedBuffer = Buffer.concat([
    encryptedFile.iv,
    encryptedFile.authTag,
    encryptedFile.ciphertext
  ]);

  const fileSize2 = encryptedBuffer.length;
  const p1 = Math.floor(Math.random() * (fileSize2 - 3)) + 1;
  const p2 = Math.floor(Math.random() * (fileSize2 - p1 - 2)) + p1 + 1;
  const p3 = Math.floor(Math.random() * (fileSize2 - p2 - 1)) + p2 + 1;

  const realFragments = [
    encryptedBuffer.slice(0, p1),
    encryptedBuffer.slice(p1, p2),
    encryptedBuffer.slice(p2, p3),
    encryptedBuffer.slice(p3, fileSize2)
  ];
  
  // 5. Create all fragments (real + fake)
  for(let i = 0; i < config.totalFragments; i++) {
    if(config.pinPositions.includes(i)) {
        fragments[i] = realFragments[config.pinPositions.indexOf(i)];
        } else {
        let randomSize = Math.floor(Math.random() * (config.maxFragmentSize - config.minFragmentSize + 1)) + config.minFragmentSize;
        let randomData = createRandomData(randomSize);
        fragments[i] = randomData;
    }
  }
  
  const sep = Buffer.from('<<<TCM-PART>>>', 'utf8');
  
  const vaultData = Buffer.concat([
    salt,
    hardwareKeyHash,
    ...interleaveWithSeparators(fragments, sep)
  ]);

  // console.log(fragments);
  
  await fs.writeFile(config.encryptedArchive, vaultData);
  
  console.log(`File saved to: ${config.encryptedArchive}`);
  console.log(`PIN: ${config.pinPositions.join(', ')}`);
}

// Helper function to interleave buffers with separators
function interleaveWithSeparators(buffers, separator) {
  const result = [];
  for(let i = 0; i < buffers.length; i++) {
    result.push(buffers[i]);
    if(i < buffers.length - 1) {
      result.push(separator);
    }
  }
  return result;
}

encryptFile().catch(console.error);