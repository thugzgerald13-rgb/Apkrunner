// /apps/api/src/scanner.ts
import * as net from 'net';

const isScanEnabled = process.env.ENABLE_VIRUS_SCAN === 'true';
const clamavHost = process.env.CLAMAV_HOST || 'clamav';
const clamavPort = parseInt(process.env.CLAMAV_PORT || '3310', 10);

export interface ScanResult {
  isInfected: boolean;
  virusName?: string;
  scanned: boolean;
}

/**
 * Streams buffer to ClamAV daemon via INSTREAM protocol
 */
export async function scanApkBuffer(buffer: Buffer): Promise<ScanResult> {
  if (!isScanEnabled) {
    return { isInfected: false, scanned: false };
  }

  return new Promise<ScanResult>((resolve) => {
    const socket = new net.Socket();
    let responseData = '';

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(10000, () => {
      cleanup();
      console.warn('[ClamAV] Scan timed out, allowing upload with warning');
      resolve({ isInfected: false, scanned: false });
    });

    socket.connect(clamavPort, clamavHost, () => {
      // Send INSTREAM command
      socket.write('zINSTREAM\0');

      // Send chunk in ClamAV chunk format: [4-byte big-endian length][chunk data]
      const chunkSize = 65536;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(chunk.length, 0);
        socket.write(lenBuf);
        socket.write(chunk);
      }

      // Zero-length chunk indicates EOF
      const zeroBuf = Buffer.alloc(4);
      zeroBuf.writeUInt32BE(0, 0);
      socket.write(zeroBuf);
    });

    socket.on('data', (chunk: Buffer) => {
      responseData += chunk.toString('utf-8');
    });

    socket.on('end', () => {
      cleanup();
      const trimmed = responseData.trim();
      if (trimmed.includes('FOUND')) {
        const match = trimmed.match(/stream:\s+(.+)\s+FOUND/);
        const virusName = match ? match[1] : 'Unknown Threat';
        resolve({ isInfected: true, virusName, scanned: true });
      } else {
        resolve({ isInfected: false, scanned: true });
      }
    });

    socket.on('error', (err: Error) => {
      cleanup();
      console.warn('[ClamAV] Scan error:', err.message);
      // Soft-fail if ClamAV daemon is unreachable during local test
      resolve({ isInfected: false, scanned: false });
    });
  });
}
