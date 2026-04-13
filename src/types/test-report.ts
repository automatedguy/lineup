export interface TestReport {
  html: string;
  url: string;
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  };
  filePath?: string;
}
