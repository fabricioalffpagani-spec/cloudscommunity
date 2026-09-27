// Upload metadata uses flat fields only; reject nested/oversized array indexes.
export const FLAT_UPLOAD_FIELD_LIMITS = {
  fieldNestingDepth: 0,
  fieldArrayIndexLimit: 0,
} as const;
