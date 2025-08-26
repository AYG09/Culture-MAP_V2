// src/utils/markdownParser.ts

export const parseMarkdown = (text: string): string => {
  if (!text) return '';

  let html = text.trim();

  // 구분선 (---) -> <hr>
  html = html.replace(/^-{3,}\s*$/gm, '<hr />');

  // 헤더 (##, ###, ####)
  html = html.replace(/^####\s+(.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.*$)/gim, '<h2>$1</h2>');

  // 번호 목록 (1., 2.)
  html = html.replace(/^\s*\d\.\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/<\/li>\n<li>/gim, '</li><li>');
  html = html.replace(/(<li>.*<\/li>)/gim, '<ol>$1</ol>');
  html = html.replace(/<\/ol>\n<ol>/gim, '');

  // 불릿 목록 (-)
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/<\/li>\n<li>/gim, '</li><li>');
  html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\n<ul>/gim, '');

  // 굵은 글씨 (**)
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

  // 줄바꿈 -> <br> (주의: 복잡한 HTML 구조에서는 문제가 될 수 있으나, 현재 수준에서는 유지)
  // 정규식 순서가 중요. 블록 요소(ul, ol, h) 처리 후 줄바꿈을 적용해야 함.
  const lines = html.split('\n');
  const newLines = lines.map(line => {
    if (line.match(/<(h[2-4]|ul|ol|li|hr)/)) {
      return line;
    }
    return line.trim() === '' ? '<br />' : line;
  });
  html = newLines
    .join('<br />')
    .replace(/<br \/>/g, '\n')
    .replace(/\n/g, '<br />');

  // 태그 내 <br> 정제
  html = html.replace(/<br \/>\n/g, '<br />');
  html = html.replace(/<br \/>/g, '\n');
  html = html.replace(/<(\w+)><br \/>/g, '<$1>');
  html = html.replace(/<br \/><\/(\w+)>/g, '</$1>');
  html = html.replace(/\n/g, '<br />');

  return html;
};
