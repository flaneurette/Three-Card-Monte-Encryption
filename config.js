module.exports = {
  // Security settings
  password: "correct-horse-battery-staple", // Replace with a strong Diceware password
  hardwareKeySize: 128,                     // Bytes to slice and store as hardware key (e.g., USB drive)
  argon2: {
    timeCost: 6,                            // ~3s delay
    memoryCost: 524288,                     // 512MB RAM
    parallelism: 1,                         // number of required cores. Increase if required.
  }, 
  totalFragments: 30,                       // Minimum of 10 puzzle fragments already makes it impracticle to bruteforce. Can be increased, but requires more storage.
  fragmentCount: 4,                         // Split real file into 4 puzzle pieces
  pinPositions: [4,3,2,1],                  // Positions of real puzzle fragments in the archive (this is your unique PINCODE!)
  // File paths
  inputFile: "./secret.txt",                // File to encrypt
  encryptedArchive: 'enecypted-file.tcm',
  decryptedFile: 'decrypted-secret.txt',
  hardwareKeyPath: 'hardware-key.bin',
};
