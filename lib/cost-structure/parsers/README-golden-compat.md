# Golden SAP Workbook Parser Compatibility

Company 2000 July-2026 SAP source contract uses the raw `Cost Elements` and `Act. Costs` columns. These raw columns are authoritative when helper columns such as `CE` / `Act Amt` are also present.

Parser compatibility rules:

- prefer raw `Cost Elements` over helper/formula `CE`;
- extract the leading 8-digit COA from `Cost Elements` and preserve it as text;
- derive the descriptive suffix from the same raw field when no dedicated description column exists;
- prefer raw `Act. Costs` over helper/formula `Act Amt`;
- normalize downloaded bytes to a Node `Buffer` for ExcelJS;
- if ExcelJS rejects optional OOXML package metadata, use the already-installed SheetJS library to reserialize the workbook package and retry ExcelJS parsing;
- the fallback changes no accounting values and does not evaluate business formulas.

Private golden workbooks remain outside Git.
