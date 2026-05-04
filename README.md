# Three-Card-Monte-Encryption. (TCM)

Encryption based upon classic hustle. Inspired by the game.

*This encryption scheme is security through obscurity done right-it doesn't just rely on strong encryption (AES-256 + Argon2), but also on psychological deception (dummy fragments, shuffling, and plausible deniability). It forces attackers into a brute-force nightmare, just like the shell game forces players into a losing bet*

As the name implies, it does a neat trick:

1. Encrypts a file
2. Slices it into 4 parts.
3. Shuffles parts around based upon PINCODE digits
4. Slices a 16 char length secret (the hidden ball)
5. Generates random puzzle fragments
6. Concatenates them into one file.

We use a minimum of 6 random fragments with random data and random lengths. Increasing it makes it even more difficult, but increases storage costs.
10 puzzle pieces is good trade-off between storage and security.

Everything if configurable by editting the `config.js` file

### Difficulty

- Requires all slices/puzzle pieces to be correctly aligned. 10.000 guesses, 8+ days. (The attacker cannot verify if a PIN is correct without also guessing the master password.)
- Each password guess takes 3 seconds, with AES-256-GCM + Argon2.
- Requires the salt slice, stored on hardware.
- And a strong master password.

Time to practically bruteforce: `8.9 × 10^35 × 3 sec ≈ 8.5 × 10^27 years`
(That’s 615 trillion times the age of the universe.)

No Verification = No Brute-Force.

    The attacker cannot verify if a PIN is correct without also guessing:
        - The fragment order (24 permutations).
        - The master password (94^16 possibilities).
    Even if they guess the PIN and fragment order correctly, they still face 3.5 × 10^23 years of brute-forcing.

### How it works

`Encryption`

- A file is encrypted with AES-256-GCM + Argon2, using a strong master password.
- The secret file is sliced into 4 random part lenghts.
- Additionally, 6 (or more) random file parts are generated and encrypted.
- The `secret file` fragments are placed at positions based upon a unique pincode (each digit indicates a puzzle position).
- All other 6 positions are random fragments, the random fragments are encrypted with a `random password`
- All fragments are then concatenated into one file
- A 16 (or more) char slice is taken from this concatenated file, and stored on hardware key.
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
Free to use, adapt and modify. No warranty, use at your own risk.

Made with Mistral AI.
