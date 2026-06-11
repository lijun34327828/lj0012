import type { TextBlock, FileCategory, TextType } from '@shared/types.js';
import { generateTextBlockId } from '@api/utils/idGenerator.js';

interface MockOCROptions {
  category?: FileCategory;
  includeTable?: boolean;
  handwrittenRatio?: number;
  lineCount?: number;
  pageWidth?: number;
  pageHeight?: number;
  pageIndex?: number;
}

const randomNormal = (mean: number, stdDev: number): number => {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  const result = z * stdDev + mean;
  return Math.max(0, Math.min(1, result));
};

const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomChoice = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

const EXAM_CONTENTS = {
  printed: [
    '一、选择题（每题3分，共30分）',
    '1. 下列函数中，属于奇函数的是（  ）',
    'A. f(x) = x²    B. f(x) = x³',
    'C. f(x) = 2^x   D. f(x) = log₂x',
    '2. 已知等差数列{aₙ}，a₁=2，d=3，则a₁₀=（  ）',
    '3. 若sin α = 3/5，且α∈(0, π/2)，则cos α =（  ）',
    '二、填空题（每空4分，共20分）',
    '11. 函数 y = √(x-1) 的定义域是________',
    '12. 已知向量 a=(2,3), b=(4,-1)，则 a·b =________',
    '三、解答题（共50分）',
    '21. （12分）已知函数 f(x) = x³ - 3x² + 2',
    '（1）求f(x)的单调区间；',
    '（2）求f(x)在区间[-1,3]上的最大值和最小值。',
  ],
  handwritten: [
    '解：由题意得',
    '∵ f(x) = x³ - 3x² + 2',
    "∴ f'(x) = 3x² - 6x = 3x(x - 2)",
    '令 f\'(x) > 0，得 x < 0 或 x > 2',
    '令 f\'(x) < 0，得 0 < x < 2',
    '单调递增区间：(-∞,0), (2,+∞)',
    '单调递减区间：(0,2)',
    'f(-1) = (-1)³ - 3 + 2 = -2',
    'f(0) = 0 - 0 + 2 = 2',
    'f(2) = 8 - 12 + 2 = -2',
    'f(3) = 27 - 27 + 2 = 2',
    '∴ 最大值为 2，最小值为 -2',
    '答：（1）递增区间(-∞,0)∪(2,+∞)，递减(0,2)',
    '（2）最大值2，最小值-2',
  ],
};

const NOTE_CONTENTS = {
  printed: [
    '高等数学 · 第三章 导数与微分',
    '§3.1 导数的概念',
    '定义：设函数 y = f(x) 在点 x₀ 的某邻域内有定义，',
    '若极限 lim(Δx→0) Δy/Δx 存在，',
    '则称函数在 x₀ 处可导，记为 f\'(x₀)',
    '§3.2 基本求导公式',
    '1. (C)\' = 0   (C为常数)',
    '2. (xⁿ)\' = nxⁿ⁻¹',
    '3. (sin x)\' = cos x',
    '4. (cos x)\' = -sin x',
    '5. (eˣ)\' = eˣ',
    '6. (ln x)\' = 1/x',
    '§3.3 导数的运算法则',
    '[u(x) ± v(x)]\' = u\'(x) ± v\'(x)',
    '[u(x)·v(x)]\' = u\'(x)v(x) + u(x)v\'(x)',
  ],
  handwritten: [
    '⭐ 重点：导数的几何意义',
    'f\'(x₀) 表示曲线 y=f(x) 在点 (x₀,f(x₀)) 处的切线斜率',
    '切线方程：y - f(x₀) = f\'(x₀)(x - x₀)',
    '⚠️ 易错点：',
    '1. 可导 → 连续，但连续未必可导',
    '2. 例：f(x) = |x| 在 x=0 处连续但不可导',
    '📝 典型例题：',
    '例：求 f(x) = x·sin x 的导数',
    "f'(x) = (x)'·sin x + x·(sin x)'",
    '= 1·sin x + x·cos x',
    '= sin x + x cos x  ✓',
    '💡 记忆口诀：',
    '"前导后不导，前不导后导，中间加号不能少"',
  ],
};

const RECEIPT_CONTENTS = {
  printed: [
    '==============================',
    '        XX 超市购物小票',
    '==============================',
    '日期：2024-01-15 14:32:18',
    '收银台：03号    收银员：张三',
    '------------------------------',
    '商品名称          数量  单价  金额',
    '------------------------------',
    '可口可乐330ml    2    3.50   7.00',
    '乐事薯片原味      1    8.90   8.90',
    '蒙牛纯牛奶250ml   6    3.20  19.20',
    '统一老坛酸菜面    3    4.50  13.50',
    '双汇火腿肠        5    2.00  10.00',
    '------------------------------',
  ],
  handwritten: [
    '商品合计：        ¥58.60',
    '折扣：            -¥5.00',
    '实付金额：        ¥53.60',
    '收款：现金        ¥100.00',
    '找零：            ¥46.40',
    '',
    '备注：会员积分+53',
    '会员卡号：1380****5678',
    '',
    '谢谢惠顾，欢迎下次光临！',
    '客服热线：400-XXX-XXXX',
  ],
};

const CANDIDATES_MAP: Record<string, string[]> = {
  '0': ['0', 'O', 'Q', 'D'],
  '1': ['1', 'l', 'I', '7'],
  '2': ['2', 'Z', 'Z'],
  '5': ['5', 'S', 's'],
  '8': ['8', 'B', '3'],
  '×': ['×', 'x', 'X', '·'],
  '÷': ['÷', '+', '='],
  '(' : ['(', '[', '{'],
  ')': [')', ']', '}'],
  'a': ['a', 'o', 'e', 'd'],
  'e': ['e', 'o', 'c', 'a'],
  '己': ['己', '已', '巳'],
  '未': ['未', '末'],
  '土': ['土', '士', '土'],
  '千': ['千', '干', '于'],
  '王': ['王', '玉', '主'],
};

const generateConfidence = (textType: TextType): number => {
  if (textType === 'printed') {
    return randomNormal(0.96, 0.03);
  } else if (textType === 'handwritten') {
    return randomNormal(0.85, 0.08);
  }
  return randomNormal(0.90, 0.06);
};

const generateCandidates = (content: string): string[] | undefined => {
  if (content.length === 0) return undefined;
  const candidates: string[] = [];
  for (const char of content) {
    if (CANDIDATES_MAP[char] && Math.random() < 0.3) {
      candidates.push(CANDIDATES_MAP[char][0]);
    }
  }
  if (candidates.length > 0) {
    const base = candidates.join('');
    return [content, base, content.replace(/[0-9]/g, '?')];
  }
  if (Math.random() < 0.15) {
    return [content, content.replace(/[a-zA-Z]/g, (c) => (Math.random() < 0.5 ? c.toLowerCase() : c.toUpperCase()))];
  }
  return undefined;
};

const getContentByCategory = (
  category: FileCategory,
  handwrittenRatio: number
): { printed: string[]; handwritten: string[] } => {
  switch (category) {
    case 'exam':
      return EXAM_CONTENTS;
    case 'note':
      return NOTE_CONTENTS;
    case 'receipt':
      return RECEIPT_CONTENTS;
    case 'custom':
    default:
      return {
        printed: ['自定义文本行 1', '自定义文本行 2', '通用印刷体文本', '文档标题内容'],
        handwritten: ['手写笔记内容', '随手记录文字', '签名或批注', '补充说明信息'],
      };
  }
};

const generateTableData = (): { rows: string[][]; texts: string[] } => {
  const rows = randomInt(3, 6);
  const cols = randomInt(3, 5);
  const table: string[][] = [];
  const allTexts: string[] = [];

  const headers = ['项目', '单价', '数量', '金额', '备注'];
  const data = [
    ['A001', 'B002', 'C003', 'D004', 'E005'],
    ['10.00', '25.50', '8.00', '100.00', '15.80'],
    ['张三', '李四', '王五', '赵六', '钱七'],
    ['完成', '进行中', '未开始', '已审核', '待确认'],
  ];

  const headerRow: string[] = [];
  for (let c = 0; c < cols; c++) {
    headerRow.push(headers[c] || `列${c + 1}`);
    allTexts.push(headerRow[c]);
  }
  table.push(headerRow);

  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = `${randomChoice(data[c % data.length])}`;
      row.push(cell);
      allTexts.push(cell);
    }
    table.push(row);
  }

  return { rows: table, texts: allTexts };
};

export const mockOCR = (
  imagePath: string,
  options: MockOCROptions = {}
): TextBlock[] => {
  const {
    category = 'exam',
    includeTable = category === 'receipt',
    handwrittenRatio = category === 'note' ? 0.6 : category === 'exam' ? 0.5 : 0.3,
    lineCount = randomInt(12, 25),
    pageWidth = 800,
    pageHeight = 1100,
    pageIndex = 0,
  } = options;

  const contents = getContentByCategory(category, handwrittenRatio);
  const textBlocks: TextBlock[] = [];

  const allLines: { text: string; type: TextType }[] = [];

  for (let i = 0; i < lineCount; i++) {
    const isHandwritten = Math.random() < handwrittenRatio;
    const type: TextType = isHandwritten ? 'handwritten' : 'printed';
    const pool = isHandwritten ? contents.handwritten : contents.printed;
    const text = pool[i % pool.length];
    allLines.push({ text, type });
  }

  if (includeTable) {
    const tableResult = generateTableData();
    let lineIdx = randomInt(Math.floor(lineCount / 3), Math.floor(lineCount * 2 / 3));
    for (const row of tableResult.rows) {
      const merged = row.join('  |  ');
      allLines.splice(lineIdx, 0, { text: merged, type: 'printed' });
      lineIdx++;
    }
  }

  const lineHeight = Math.floor(pageHeight / (allLines.length + 2));
  const startY = lineHeight;

  allLines.forEach((line, idx) => {
    const id = generateTextBlockId();
    const y = startY + idx * lineHeight + randomInt(-5, 5);
    const x = randomInt(30, 80);
    const w = pageWidth - x - randomInt(30, 80);
    const h = lineHeight - randomInt(4, 10);
    const confidence = generateConfidence(line.type);
    const candidates = line.type === 'handwritten' ? generateCandidates(line.text) : undefined;

    textBlocks.push({
      id,
      type: line.type,
      content: line.text,
      confidence,
      candidates,
      boundingBox: { x, y, w, h },
      pageIndex,
      lineIndex: idx,
    });
  });

  return textBlocks;
};

export const mockOCRAwait = (
  imagePath: string,
  options: MockOCROptions = {}
): Promise<TextBlock[]> => {
  const delay = randomInt(500, 2000);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockOCR(imagePath, options));
    }, delay);
  });
};

export default mockOCR;
