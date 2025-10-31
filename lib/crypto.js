import CryptoJS from "crypto-js";

export function decryptAES(ciphertext, key) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return null;
  }
}

export function encryptAES(text, key) {
  return CryptoJS.AES.encrypt(text, key).toString();
}
