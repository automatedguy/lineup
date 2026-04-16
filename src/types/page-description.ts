export interface PageElement {
  description: string;
  type: string;
  method: string;
}

export interface PageSection {
  section: string;
  elements: PageElement[];
}

export type PageElementMap = PageSection[];

export interface PageDescription {
  url: string;
  elementMap: PageElementMap;
  screenshot: Buffer;
}
