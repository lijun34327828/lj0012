import { nanoid } from 'nanoid';

export const generateId = (length: number = 21): string => {
  return nanoid(length);
};

export const generateShortId = (): string => {
  return nanoid(12);
};

export const generateFileId = (): string => {
  return `file_${nanoid(16)}`;
};

export const generateTextBlockId = (): string => {
  return `tb_${nanoid(14)}`;
};

export const generateUploadId = (): string => {
  return `upl_${nanoid(16)}`;
};

export const generateTaskId = (): string => {
  return `task_${nanoid(16)}`;
};

export const generateExportId = (): string => {
  return `exp_${nanoid(16)}`;
};

export const generateHistoryId = (): string => {
  return `hist_${nanoid(16)}`;
};

export const generateParagraphId = (): string => {
  return `para_${nanoid(12)}`;
};
