import { z } from "zod";

export const Severity = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof Severity>;

export const ElementType = z.enum([
  "link",
  "button",
  "input",
  "select",
  "textarea",
  "form",
  "image",
  "other",
]);
export type ElementType = z.infer<typeof ElementType>;

export const PageElement = z.object({
  selector: z.string(),
  elementType: ElementType,
  text: z.string().default(""),
  attributes: z.record(z.string()).default({}),
  isVisible: z.boolean().default(true),
});
export type PageElement = z.infer<typeof PageElement>;

export const Route = z.object({
  url: z.string(),
  title: z.string().default(""),
  depth: z.number().default(0),
  discoveredFrom: z.string().nullable().default(null),
  elements: z.array(PageElement).default([]),
});
export type Route = z.infer<typeof Route>;

export const AppMap = z.object({
  baseUrl: z.string(),
  routes: z.array(Route).default([]),
  totalElements: z.number().default(0),
  scanDurationSeconds: z.number().default(0),
});
export type AppMap = z.infer<typeof AppMap>;

export const TestAction = z.object({
  action: z.string(),
  selector: z.string().nullable().default(null),
  value: z.string().nullable().default(null),
  description: z.string().default(""),
});
export type TestAction = z.infer<typeof TestAction>;

export const TestCase = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  targetUrl: z.string(),
  actions: z.array(TestAction).default([]),
  expectedBehavior: z.string().default(""),
  category: z.string().default(""),
});
export type TestCase = z.infer<typeof TestCase>;

export const TestResult = z.object({
  testCase: TestCase,
  passed: z.boolean(),
  actualBehavior: z.string().default(""),
  errorMessage: z.string().nullable().default(null),
  screenshots: z.array(z.string()).default([]),
  durationSeconds: z.number().default(0),
  timestamp: z.string().datetime().default(() => new Date().toISOString()),
});
export type TestResult = z.infer<typeof TestResult>;

export const Bug = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: Severity,
  url: z.string(),
  stepsToReproduce: z.array(z.string()).default([]),
  expected: z.string().default(""),
  actual: z.string().default(""),
  screenshots: z.array(z.string()).default([]),
  testResult: TestResult.nullable().default(null),
  timestamp: z.string().datetime().default(() => new Date().toISOString()),
});
export type Bug = z.infer<typeof Bug>;

export const ScanReport = z.object({
  targetUrl: z.string(),
  appMap: AppMap,
  testCasesGenerated: z.number().default(0),
  testCasesExecuted: z.number().default(0),
  testCasesPassed: z.number().default(0),
  testCasesFailed: z.number().default(0),
  bugs: z.array(Bug).default([]),
  results: z.array(TestResult).default([]),
  durationSeconds: z.number().default(0),
  timestamp: z.string().datetime().default(() => new Date().toISOString()),
  modelUsed: z.string().default(""),
});
export type ScanReport = z.infer<typeof ScanReport>;
