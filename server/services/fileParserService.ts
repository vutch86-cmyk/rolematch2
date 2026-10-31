import path from 'path';
import multer from 'multer';
import mammoth from 'mammoth';
import * as pdfParseModule from 'pdf-parse';
import express from 'express';

export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfModule: any = pdfParseModule;

    // 1. Check if PDFParse class exists (pdf-parse v2+ / @cybercity/pdf-parse)
    const PDFParseClass = pdfModule?.PDFParse || (pdfModule?.default && pdfModule.default.PDFParse);
    if (typeof PDFParseClass === 'function') {
      const parser = new PDFParseClass({ data: buffer });
      const result = await parser.getText();
      if (result?.text && result.text.trim()) return result.text;
    }

    // 2. Check if pdfModule or default export is a function (pdf-parse v1)
    let pdfFn = typeof pdfModule === 'function' ? pdfModule : pdfModule?.default;
    if (typeof pdfFn !== 'function') {
      try {
        // @ts-ignore
        pdfFn = require('pdf-parse');
        if (typeof pdfFn !== 'function' && pdfFn && typeof pdfFn.default === 'function') {
          pdfFn = pdfFn.default;
        }
      } catch (e) {
        // ignore
      }
    }

    if (typeof pdfFn === 'function') {
      // Pass options object to prevent pdf-parse from loading disk test files
      const pdfData = await pdfFn(buffer, { max: 0 });
      if (pdfData?.text && pdfData.text.trim()) return pdfData.text;
    }

    // 3. Fallback string extraction for raw PDF text streams
    const rawStr = buffer.toString('utf-8');
    const matches = rawStr.match(/[\w\sàáảãạăắằẳẵặânấầnẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ\.,:;()\-\/]{4,}/gi);
    if (matches && matches.join(' ').length > 50) {
      return matches.join('\n');
    }

    throw new Error('Không thể đọc dữ liệu chữ từ file PDF này.');
  } catch (err: any) {
    console.error('parsePdfBuffer Error:', err);

    // Final fallback attempt on error
    try {
      const rawStr = buffer.toString('utf-8');
      const matches = rawStr.match(/[\w\sàáảãạăắằẳẵặânấầnẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ\.,:;()\-\/]{4,}/gi);
      if (matches && matches.join(' ').length > 50) {
        return matches.join('\n');
      }
    } catch {
      // ignore
    }

    throw new Error('Lỗi đọc file PDF: ' + (err.message || 'File PDF bị đặt mật khẩu hoặc không chứa định dạng chuẩn.'));
  }
}

export async function parseDocxBuffer(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max file size
});

export const handleUploadAny = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.any()(req, res, (err: any) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({
        error: 'Lỗi tải tệp lên: ' + (err.message || 'Kích thước tệp vượt quá giới hạn hoặc định dạng không hợp lệ.'),
      });
    }
    next();
  });
};
