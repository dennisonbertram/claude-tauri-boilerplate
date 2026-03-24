/**
 * W-9 Form Schema — Request for Taxpayer Identification Number and Certification
 * IRS Revision: October 2024
 */

import type { FormSchema } from '../types/schema-types';
import { FieldType } from '../types/field-types';

export const w9_2024: FormSchema = {
  formCode: 'W-9',
  taxYear: 2024,
  irsRevision: 'Rev. October 2024',
  name: 'Request for Taxpayer Identification Number and Certification',
  fields: [
    // Line 1 — Name
    {
      id: 'name',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_1[0]',
      label: 'Name (as shown on your income tax return)',
      type: FieldType.Text,
      required: true,
      maxLength: 100,
    },
    // Line 2 — Business name
    {
      id: 'business_name',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_2[0]',
      label: 'Business name/disregarded entity name, if different from above',
      type: FieldType.Text,
      maxLength: 100,
    },
    // Line 3 — Federal tax classification checkboxes
    {
      id: 'tax_class_individual',
      pdfFieldName: 'topmostSubform[0].Page1[0].c1_1[0]',
      label: 'Individual/sole proprietor or single-member LLC',
      type: FieldType.Checkbox,
    },
    {
      id: 'tax_class_c_corp',
      pdfFieldName: 'topmostSubform[0].Page1[0].c1_2[0]',
      label: 'C Corporation',
      type: FieldType.Checkbox,
    },
    {
      id: 'tax_class_s_corp',
      pdfFieldName: 'topmostSubform[0].Page1[0].c1_3[0]',
      label: 'S Corporation',
      type: FieldType.Checkbox,
    },
    {
      id: 'tax_class_partnership',
      pdfFieldName: 'topmostSubform[0].Page1[0].c1_4[0]',
      label: 'Partnership',
      type: FieldType.Checkbox,
    },
    {
      id: 'tax_class_trust_estate',
      pdfFieldName: 'topmostSubform[0].Page1[0].c1_5[0]',
      label: 'Trust/estate',
      type: FieldType.Checkbox,
    },
    {
      id: 'tax_class_llc',
      pdfFieldName: 'topmostSubform[0].Page1[0].c1_6[0]',
      label: 'Limited liability company',
      type: FieldType.Checkbox,
    },
    {
      id: 'llc_classification',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_3[0]',
      label: 'LLC tax classification (C, S, or P)',
      type: FieldType.Text,
      maxLength: 1,
      allowedValues: ['C', 'S', 'P'],
      requiredIf: {
        field: 'tax_class_llc',
        operator: 'eq',
        value: true,
      },
    },
    {
      id: 'tax_class_other',
      pdfFieldName: 'topmostSubform[0].Page1[0].c1_7[0]',
      label: 'Other (see instructions)',
      type: FieldType.Checkbox,
    },
    {
      id: 'other_description',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_4[0]',
      label: 'Other tax classification description',
      type: FieldType.Text,
      maxLength: 50,
      requiredIf: {
        field: 'tax_class_other',
        operator: 'eq',
        value: true,
      },
    },
    // Line 4 — Exemptions
    {
      id: 'exempt_payee_code',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_5[0]',
      label: 'Exempt payee code (if any)',
      type: FieldType.Text,
      maxLength: 5,
    },
    {
      id: 'fatca_exemption_code',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_6[0]',
      label: 'Exemption from FATCA reporting code (if any)',
      type: FieldType.Text,
      maxLength: 5,
    },
    // Line 5 — Address
    {
      id: 'address',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_7[0]',
      label: 'Address (number, street, and apt. or suite no.)',
      type: FieldType.Text,
      required: true,
      maxLength: 100,
    },
    // Line 6 — City, state, ZIP
    {
      id: 'city_state_zip',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_8[0]',
      label: 'City, state, and ZIP code',
      type: FieldType.Text,
      required: true,
      maxLength: 100,
    },
    // Line 7 — Account numbers
    {
      id: 'account_numbers',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_9[0]',
      label: 'List account number(s) here (optional)',
      type: FieldType.Text,
      maxLength: 100,
    },
    // Requester info (not on the form itself but printed)
    {
      id: 'requester_name',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_10[0]',
      label: "Requester's name and address (optional)",
      type: FieldType.Text,
      maxLength: 100,
    },
    // Part I — TIN: SSN
    {
      id: 'ssn',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_11[0]',
      label: 'Social security number',
      type: FieldType.SSN,
    },
    // Part I — TIN: EIN
    {
      id: 'ein',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_12[0]',
      label: 'Employer identification number',
      type: FieldType.EIN,
    },
    // Part II — Certification signature checkbox
    {
      id: 'certification',
      pdfFieldName: 'topmostSubform[0].Page1[0].c1_8[0]',
      label: 'Under penalties of perjury, I certify the information is correct',
      type: FieldType.Checkbox,
    },
    // Signature date
    {
      id: 'signature_date',
      pdfFieldName: 'topmostSubform[0].Page1[0].f1_13[0]',
      label: 'Date',
      type: FieldType.Date,
    },
  ],
};
