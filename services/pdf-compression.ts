import { PDFDocument } from 'pdf-lib';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export async function compressPdf(fileBuffer: Buffer): Promise<Buffer> {
  const sizeMb = fileBuffer.byteLength / (1024 * 1024);
  
  if (sizeMb < 0.5) {
    return fileBuffer; // Skip small files
  }

  try {
    // 1. Try Ghostscript if file > 5MB
    if (sizeMb >= 5) {
      const gsBuffer = await compressWithGhostscript(fileBuffer, sizeMb);
      if (gsBuffer) return gsBuffer;
    }
  } catch (err) {
    console.warn('[PDF Optimize] Ghostscript compression failed or unavailable. Falling back to pdf-lib.', err);
  }

  // 2. Fallback to pdf-lib metadata stripping
  try {
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
    
    console.log(`[PDF Optimize] pdf-lib fallback: Original ${sizeMb.toFixed(2)}MB -> ${(compressedBytes.byteLength / 1024 / 1024).toFixed(2)}MB`);
    return Buffer.from(compressedBytes);
  } catch (err) {
    console.warn('[PDF Optimize] Failed to compress PDF natively, returning original buffer.', err);
    return fileBuffer;
  }
}

/**
 * Compresses a PDF using a system Ghostscript installation.
 * Returns null if Ghostscript is not installed.
 */
async function compressWithGhostscript(fileBuffer: Buffer, sizeMb: number): Promise<Buffer | null> {
  // Determine compression level
  let pdfSettings = '/printer'; // 300 dpi
  if (sizeMb >= 20) {
    pdfSettings = '/screen'; // 72 dpi (Max compression)
  } else if (sizeMb >= 5) {
    pdfSettings = '/ebook'; // 150 dpi (Good balance)
  }

  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
  const outputPath = path.join(tempDir, `output-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);

  try {
    // Check if gs is installed
    try {
      await execAsync('gs --version');
    } catch {
      return null; // gs not found
    }

    await fs.writeFile(inputPath, fileBuffer);

    // Run Ghostscript command
    const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${pdfSettings} -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${outputPath} ${inputPath}`;
    await execAsync(gsCommand);

    const outputBuffer = await fs.readFile(outputPath);
    
    console.log(`[PDF Optimize] Ghostscript (${pdfSettings}): Original ${sizeMb.toFixed(2)}MB -> ${(outputBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
    
    return outputBuffer;
  } catch (error) {
    console.error('[PDF Optimize] Ghostscript execution error:', error);
    return null;
  } finally {
    // Cleanup temporary files
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}
