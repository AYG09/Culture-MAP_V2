export type InlineElement = { type: 'text'; content: string } | { type: 'bold'; content: string };

export type ListItem = {
  type: 'listItem';
  content: InlineElement[];
};

export type ReportElement =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; content: string }
  | { type: 'paragraph'; content: InlineElement[] }
  | { type: 'thematicBreak' }
  | { type: 'list'; ordered: boolean; items: ListItem[] };
