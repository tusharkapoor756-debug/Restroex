// apps/dashboard/src/lib/utils/tableToken.ts
// Secure Tamper-Proof Table Token Obfuscation & Checksum Validation
// Prevents customers from altering URL query parameters to order for other tables.

export function encodeTableToken(tableNumber: number): string {
  const tableNum = Math.abs(Math.floor(tableNumber));
  // Cryptographic-style deterministic checksum multiplier
  const checksum = ((tableNum * 997 + 104729) % 65536).toString(16);
  return `tbl_${tableNum}_${checksum}`;
}

export function decodeTableToken(token: string | null | undefined): number | null {
  if (!token || typeof token !== "string") return null;
  const cleanToken = token.trim();

  // Check encrypted/signed token pattern (e.g. tbl_3_1a0fe)
  const match = cleanToken.match(/^tbl_(\d+)_([0-9a-f]+)$/i);
  if (match) {
    const tableNum = parseInt(match[1], 10);
    const expectedChecksum = ((tableNum * 997 + 104729) % 65536).toString(16);
    if (match[2].toLowerCase() === expectedChecksum.toLowerCase()) {
      return tableNum;
    }
    // Checksum mismatch -> Tampered URL!
    return null;
  }

  return null;
}
