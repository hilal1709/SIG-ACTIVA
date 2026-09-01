import type ExcelJS from 'exceljs';

export type StyleRole = string;
export type BlueprintCellStyle = Partial<Pick<ExcelJS.Style, 'font' | 'alignment' | 'fill' | 'border' | 'numFmt' | 'protection'>>;

export type BlueprintColumn = {
  key: string;
  width?: number;
  hidden?: boolean;
  outlineLevel?: number;
  styleRole?: StyleRole;
};

export type BlueprintRow = {
  index: number;
  height?: number;
  hidden?: boolean;
  outlineLevel?: number;
  styleRole?: StyleRole;
};

export type BlueprintRange = {
  range: string;
  styleRole: StyleRole;
};

export type BlueprintRepeatingRange = {
  fromColumn: string;
  toColumn: string;
  fromRow: number;
  toRow?: number;
  minimumToRow?: number;
  styleRole: StyleRole;
};

export type BlueprintWorksheetProperties = {
  defaultRowHeight?: number;
  defaultColWidth?: number;
  dyDescent?: number;
  outlineLevelRow?: number;
  outlineLevelCol?: number;
};

export type SheetStyleBlueprint = {
  sourceTemplateName?: string;
  aliases?: string[];
  styleCatalog: Record<StyleRole, BlueprintCellStyle>;
  columns?: BlueprintColumn[];
  rows?: BlueprintRow[];
  merges?: string[];
  views?: ExcelJS.WorksheetView[];
  autoFilter?: ExcelJS.AutoFilter | string;
  autoFilterMinRowCount?: number;
  pageSetup?: Partial<ExcelJS.PageSetup>;
  headerFooter?: Partial<ExcelJS.HeaderFooter>;
  properties?: BlueprintWorksheetProperties;
  state?: ExcelJS.WorksheetState;
  repeatingRanges?: BlueprintRepeatingRange[];
  ranges?: BlueprintRange[];
};

export type WorkbookStyleBlueprint = {
  companyCode: '2000' | '7000';
  sourceTemplatePeriod: '2026-07';
  templateVersion: string;
  exactTemplateFidelity: boolean;
  sheets: Record<string, SheetStyleBlueprint>;
};
