import { PDFDocument } from 'pdf-lib';
import type { PdfFieldInfo } from '../types';
import type { PdfReader } from './interfaces';

/**
 * pdf-lib implementation of PdfReader.
 * Enumerates AcroForm fields and maps them to PdfFieldInfo.
 */
export class PdfLibReader implements PdfReader {
  async extractFields(pdfBytes: Uint8Array): Promise<PdfFieldInfo[]> {
    const doc = await PDFDocument.load(pdfBytes);
    const form = doc.getForm();
    const fields = form.getFields();

    return fields.map((field) => {
      const type = mapFieldType(field);
      const info: PdfFieldInfo = {
        name: field.getName(),
        type,
        page: 0, // pdf-lib doesn't easily expose page number
      };

      if (type === 'dropdown' || type === 'radio') {
        if ('getOptions' in field) {
          info.options = (field as any).getOptions();
        }
      }

      return info;
    });
  }
}

function mapFieldType(field: any): PdfFieldInfo['type'] {
  const name = field.constructor.name;
  switch (name) {
    case 'PDFTextField':
      return 'text';
    case 'PDFCheckBox':
      return 'checkbox';
    case 'PDFRadioGroup':
      return 'radio';
    case 'PDFDropdown':
      return 'dropdown';
    case 'PDFOptionList':
      return 'dropdown';
    default:
      return 'text';
  }
}
