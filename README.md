# Three-Card-Monte-Encryption

Encryption based upon classic hustle. Inspired by the game.

As the name implies, it does a trick:

1. Encrypts a file
2. Slices it into 4 parts.
3. Shuffles parts around based upon PINCODE digits
4. Slices a 16 char length secret (the hidden ball)
5. Generates random puzzle fragments
6. Concatenates them into one file.

### Difficulty

- Each password guess takes 3 seconds, with Argon2.
- Requires all slices/puzzle pieces to be correctly aligned
- Requires the salt slice
- And a strong master password.

### How it works

`Encryption`

- A file is encrypted with AES 256-GCM, using Argon2, using a strong master password.
- The secret file is sliced into 4 random part lenghts.
- Additionally, 6 (or more) random file parts are generated and encrypted.
- These `secret file` fragments are placed at positions based upon a unique pincode.
- At the other 6 positions are random fragments.
- All fragments are then concatenated into one file
- A 16 (or more) char slice is taken from this concatenated file, and stored on hardware key.
- A hash of that slicekey is embedded in the final file.
- The final file is then saved as a `.tcm` file.

`Decryption`

Script reads the masterpassword, and ask for a PIN.

You could make them all required to enter, but for testing we hardcoded both the password + PIN.

### Use

`node encrypt.js`
`node dcrypt.js`

### Requires

NODEJS + argon crypto extension.

