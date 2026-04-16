import { PDFDocument } from 'pdf-lib';

export async function compressPdf(fileBuffer: Buffer): Promise<Buffer> {
  const sizeMb = fileBuffer.byteLength / (1024 * 1024);
  
  if (sizeMb < 0.5) {
    return fileBuffer; // Skip small files
  }

  try {
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    
    // Note: Due to limitations of fully native JS environments, pdf-lib can't natively
    // compress images. We strip metadata to guarantee some compression cleanly.
    // Real "85%" visual compression requires ghostscript in the container.
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    // Re-save with object stream compression
    const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
    
    // In a real environment with native access, we'd pipe this to ghostscript:
    // Size < 2MB -> 30% compression (screen)
    // Size < 5MB -> 50% max (ebook)
    // Size < 50MB -> 70% max (printer)
    // Size < 100MB -> 85% compression (prepress)

    console.log(`[PDF Optimize] Original: ${sizeMb.toFixed(2)}MB, Compressed: ${(compressedBytes.byteLength / 1024 / 1024).toFixed(2)}MB`);
    return Buffer.from(compressedBytes);
  } catch (err) {
    console.warn('[PDF Optimize] Failed to compress PDF natively, returning original buffer.', err);
    return fileBuffer;
  }
}
