import { Document, HeadingLevel, LevelFormat, Paragraph, TextRun, AlignmentType, Packer } from 'docx';

interface FormattingContext {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  color?: string;
  size?: number;
}

type HeadingLevelValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];

const DEFAULT_PARAGRAPH_SPACING = {
  after: 200,
};

const BULLET_REFERENCE = 'bullet-list';
const NUMBER_REFERENCE = 'numbered-list';

const BULLET_LEVELS = [
  { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.START },
  { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.START },
  { level: 2, format: LevelFormat.BULLET, text: '\u25AA', alignment: AlignmentType.START },
];

const NUMBER_LEVELS = [
  { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START },
  { level: 1, format: LevelFormat.DECIMAL, text: '%2.', alignment: AlignmentType.START },
  { level: 2, format: LevelFormat.DECIMAL, text: '%3.', alignment: AlignmentType.START },
];

const HEADING_MAP: Record<string, HeadingLevelValue> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
};

const domParser = new DOMParser();

interface ConversionState {
  numberingEntries: Map<string, typeof BULLET_LEVELS | typeof NUMBER_LEVELS>;
  bulletCounter: number;
  numberedCounter: number;
}

const MAX_LIST_LEVEL = 2;

const createConversionState = (): ConversionState => ({
  numberingEntries: new Map(),
  bulletCounter: 0,
  numberedCounter: 0,
});

const registerListReference = (state: ConversionState, type: 'bullet' | 'numbered'): string => {
  if (type === 'bullet') {
    state.bulletCounter += 1;
    const reference = `${BULLET_REFERENCE}-${state.bulletCounter}`;
    if (!state.numberingEntries.has(reference)) {
      state.numberingEntries.set(reference, BULLET_LEVELS);
    }
    return reference;
  }

  state.numberedCounter += 1;
  const reference = `${NUMBER_REFERENCE}-${state.numberedCounter}`;
  if (!state.numberingEntries.has(reference)) {
    state.numberingEntries.set(reference, NUMBER_LEVELS);
  }
  return reference;
};

const colorFromStyle = (styleValue: string): string | undefined => {
  if (!styleValue) {
    return undefined;
  }

  if (styleValue.startsWith('#')) {
    // Remove hash for docx API
    return styleValue.replace('#', '');
  }

  const rgbMatch = styleValue.match(/rgb\s*\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    const hex = [r, g, b]
      .map((value) => {
        const hexValue = parseInt(value, 10).toString(16).padStart(2, '0');
        return hexValue;
      })
      .join('');
    return hex;
  }

  return undefined;
};

const fontSizeFromPx = (value: string): number | undefined => {
  if (!value.endsWith('px')) {
    return undefined;
  }

  const numeric = parseFloat(value.replace('px', ''));
  if (Number.isNaN(numeric)) {
    return undefined;
  }

  // Convert px -> pt (1pt = 1.333px) then to half-points for docx (pt * 2)
  const size = Math.round(numeric * 1.5);
  return size > 0 ? size : undefined;
};

const mergeContext = (base: FormattingContext, element: Element): FormattingContext => {
  const updated: FormattingContext = { ...base };
  const tag = element.tagName.toUpperCase();

  if (tag === 'STRONG' || tag === 'B') {
    updated.bold = true;
  }
  if (tag === 'EM' || tag === 'I') {
    updated.italics = true;
  }
  if (tag === 'U') {
    updated.underline = true;
  }

  const style = (element as HTMLElement).style;
  if (style) {
    if (style.fontWeight === 'bold') {
      updated.bold = true;
    }
    if (style.fontStyle === 'italic') {
      updated.italics = true;
    }
    if (style.textDecoration.includes('underline')) {
      updated.underline = true;
    }
    const color = colorFromStyle(style.color);
    if (color) {
      updated.color = color;
    }
    const size = fontSizeFromPx(style.fontSize);
    if (size) {
      updated.size = size;
    }
  }

  const inlineStyle = element.getAttribute('style');
  if (inlineStyle) {
    inlineStyle.split(';').forEach((rule) => {
      const trimmedRule = rule.trim();
      if (!trimmedRule) {
        return;
      }
      const colonIndex = trimmedRule.indexOf(':');
      if (colonIndex === -1) {
        return;
      }
      const property = trimmedRule.slice(0, colonIndex).trim().toLowerCase();
      const rawValue = trimmedRule.slice(colonIndex + 1).trim().toLowerCase();
      if (!property || !rawValue) {
        return;
      }
      if (property === 'font-weight' && rawValue === 'bold') {
        updated.bold = true;
      }
      if (property === 'font-style' && rawValue === 'italic') {
        updated.italics = true;
      }
      if (property === 'text-decoration' && rawValue.includes('underline')) {
        updated.underline = true;
      }
      if (property === 'color') {
        const color = colorFromStyle(rawValue);
        if (color) {
          updated.color = color;
        }
      }
      if (property === 'font-size') {
        const size = fontSizeFromPx(rawValue);
        if (size) {
          updated.size = size;
        }
      }
    });
  }

  return updated;
};

const createTextRun = (text: string, context: FormattingContext): TextRun | null => {
  if (!text) {
    return null;
  }

  const normalized = text.replace(/\s+/g, ' ');
  if (!normalized.trim()) {
    // Preserve a single space if the original text contained whitespace between inline elements
    return text.includes(' ') ? new TextRun(' ') : null;
  }

  return new TextRun({
    text: normalized,
    bold: context.bold,
    italics: context.italics,
    underline: context.underline ? {} : undefined,
    color: context.color,
    size: context.size,
  });
};

const createRunsFromNode = (node: Node, context: FormattingContext): TextRun[] => {
  if (node.nodeType === Node.TEXT_NODE) {
    const run = createTextRun(node.textContent ?? '', context);
    return run ? [run] : [];
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;

    if (element.tagName.toUpperCase() === 'BR') {
      return [new TextRun({ break: 1 })];
    }

    const childContext = mergeContext(context, element);
    return Array.from(element.childNodes).flatMap((child) => createRunsFromNode(child, childContext));
  }

  return [];
};

const buildParagraph = (
  runs: TextRun[],
  options: {
    heading?: HeadingLevelValue;
    numbering?: {
      reference: string;
      level: number;
    };
  } = {}
): Paragraph | null => {
  if (runs.length === 0) {
    return null;
  }

  const paragraphOptions: Record<string, unknown> = {
    spacing: DEFAULT_PARAGRAPH_SPACING,
    children: runs,
  };

  if (options.heading) {
    paragraphOptions.heading = options.heading;
  }

  if (options.numbering) {
    paragraphOptions.numbering = {
      level: options.numbering.level,
      reference: options.numbering.reference,
    };
  }

  return new Paragraph(paragraphOptions as ConstructorParameters<typeof Paragraph>[0]);
};

const convertList = (element: HTMLElement, type: 'bullet' | 'numbered', level: number, state: ConversionState): Paragraph[] => {
  const reference = registerListReference(state, type);
  const currentLevel = Math.min(level, MAX_LIST_LEVEL);

  return Array.from(element.children).flatMap((child) => {
    if (child.tagName.toUpperCase() !== 'LI') {
      return convertNodeToParagraphs(child, state, level);
    }

    const listItem = child as HTMLElement;
    const inlineRuns = Array.from(listItem.childNodes)
      .filter((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return true;
        }
        const tag = (node as Element).tagName.toUpperCase();
        return tag !== 'UL' && tag !== 'OL';
      })
      .flatMap((node) => createRunsFromNode(node, {}));

    const paragraph = buildParagraph(inlineRuns, {
      numbering: {
        reference,
        level: currentLevel,
      },
    });

    const nestedParagraphs = Array.from(listItem.children)
      .filter((childElement) => {
        const tag = childElement.tagName.toUpperCase();
        return tag === 'UL' || tag === 'OL';
      })
      .flatMap((nestedList) => convertList(
        nestedList as HTMLElement,
        nestedList.tagName.toUpperCase() === 'UL' ? 'bullet' : 'numbered',
        level + 1,
        state,
      ));

    const paragraphs: Paragraph[] = [];
    if (paragraph) {
      paragraphs.push(paragraph);
    }
    paragraphs.push(...nestedParagraphs);
    return paragraphs;
  });
};

const convertNodeToParagraphs = (node: Node, state: ConversionState, listLevel = 0): Paragraph[] => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text.trim()) {
      return [];
    }
    const run = createTextRun(text, {});
    if (!run) {
      return [];
    }
    const paragraph = buildParagraph([run]);
    return paragraph ? [paragraph] : [];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toUpperCase();

  if (tag === 'UL') {
    return convertList(element, 'bullet', listLevel, state);
  }

  if (tag === 'OL') {
    return convertList(element, 'numbered', listLevel, state);
  }

  const runs = Array.from(element.childNodes).flatMap((child) => createRunsFromNode(child, {}));

  if (tag in HEADING_MAP) {
    const headingParagraph = buildParagraph(runs, { heading: HEADING_MAP[tag] });
    return headingParagraph ? [headingParagraph] : [];
  }

  if (tag === 'P' || tag === 'DIV') {
    const paragraph = buildParagraph(runs);
    return paragraph ? [paragraph] : [];
  }

  // Fallback: treat as paragraph by converting children
  const fallbackParagraph = buildParagraph(runs);
  return fallbackParagraph ? [fallbackParagraph] : [];
};

const buildParagraphsFromHtml = (html: string): { paragraphs: Paragraph[]; numbering: Array<{ reference: string; levels: typeof BULLET_LEVELS | typeof NUMBER_LEVELS }>; } => {
  const parsed = domParser.parseFromString(html, 'text/html');
  const body = parsed.body;
  const state = createConversionState();
  const paragraphs = Array.from(body.childNodes).flatMap((node) => convertNodeToParagraphs(node, state));
  const numbering = Array.from(state.numberingEntries.entries()).map(([reference, levels]) => ({
    reference,
    levels,
  }));

  return {
    paragraphs: paragraphs.length > 0 ? paragraphs : [new Paragraph('')],
    numbering,
  };
};

export const createDocxBlobFromHtml = async (html: string): Promise<Blob> => {
  const { paragraphs, numbering } = buildParagraphsFromHtml(html);

  const document = new Document({
    numbering: numbering.length > 0 ? { config: numbering } : undefined,
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  return Packer.toBlob(document);
};
