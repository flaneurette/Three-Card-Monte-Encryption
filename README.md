# Three-Card-Monte-Encryption. (TCM)

Encryption based upon classic hustle. Inspired by the game.

*This encryption scheme is security through obscurity done right-it doesn't just rely on strong encryption (AES-256 + Argon2), but also on psychological deception (dummy fragments, shuffling, and plausible deniability). It forces attackers into a brute-force nightmare, just like the shell game forces players into a losing bet*

As the name implies, it does a neat trick:

1. Encrypts a file
2. Slices it into 4 parts.
3. Shuffles parts around based upon PINCODE digits
4. Slices a 16 char length secret (the hidden ball)
5. Generates random puzzle fragments (~30, random)
6. Weaves them into one file.

We use a minimum of ~30 random fragments with random data and random lengths. Increasing it makes it even more difficult, but increases storage costs.
30 puzzle pieces is good trade-off between storage and security.

Everything if configurable by editting the `config.js` file

### Difficulty

- Requires all slices/puzzle pieces to be correctly aligned. 10.000 guesses, 8+ days. (The attacker cannot verify if a PIN is correct without also guessing the master password.)
- Each password guess takes 3 seconds, with AES-256-GCM + Argon2. Shuffeling takes about `~4.2 hours` per password candidate.
- Requires the salt slice, stored on hardware.
- And a strong master password.

Realisticly:

- Without shuffling: 1 guess = 3 seconds
- With shuffling:    1 guess = 5,040 * 3 seconds = ~4.2 hours per password candidate.

### How it works

`Encryption`

- A file is encrypted with AES-256-GCM + Argon2, using a strong master password.
- The secret file is sliced into 4 random part lenghts.
- Additionally, 30 (or more) random file parts are generated and encrypted.
- The `secret file` fragments are placed at positions based upon a unique pincode (each digit indicates a puzzle position).
- All other 30 positions are random fragments, the random fragments are encrypted with a `random password`
- All fragments are then weaved into one file
- A 16 (or more) char slice is taken from this weaved file, and stored on hardware key.
- A hash of that slicekey is embedded in the final file.
- The final file is then saved as a `.tcm` file.

`Decryption`

Script reads the masterpassword, and asks for a PIN.

You could make them all required to enter, but for testing we hardcoded both the password + PIN.

### Use

`node encrypt.js`

`node decrypt.js`

### Requires

NODEJS + argon/crypto extension.

### Safety
NOTE: The generation of the random fragments has not been thoroughly tested. This stage generates random words, like text and encrypts it in the same way with different filelengths as the orginal file.
We think this is safe, but might need crypto-analysis to be more certain. `As with all crypto, there is no way to know it's 100% secure.`

### License
Free to use, adapt and modify. No warranty, use at your own risk. Code is still experimental.

Made with Mistral AI, verified/reviewed by Claud AI.
