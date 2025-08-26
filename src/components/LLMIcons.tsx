import type { SVGProps } from 'react';

export const GeminiIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
);

export const ChatGPTIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.28,10.27a6,6,0,0,0-8.56,0l-2,2a6,6,0,0,0,0,8.56,1,1,0,0,0,1.41-1.41,4,4,0,0,1,0-5.66l2-2a4,4,0,0,1,5.66,5.66l-2,2a4,4,0,0,1-5.66,0,1,1,0,0,0-1.41,1.41,6,6,0,0,0,8.56,0l2-2a6,6,0,0,0,0-8.56Z" />
    <path d="M6.28,16.27a4,4,0,0,1,0-5.66l2-2a4,4,0,0,1,5.66,5.66l-1.29,1.29a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l1.29-1.29a6,6,0,0,0-8.56-8.56l-2,2a6,6,0,0,0,0,8.56,1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41A4,4,0,0,1,6.28,16.27Z" />
  </svg>
);

export const ClaudeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M14.2,6C11.9,6,10,7.9,10,10.2v3.5C10,16.1,11.9,18,14.2,18s4.2-1.9,4.2-4.2v-3.5C18.3,7.9,16.4,6,14.2,6z" />
  </svg>
);

export const PerplexityIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M4 4h16v16H4z" />
  </svg>
);

export const GrokIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export const CopilotIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <circle cx="12" cy="12" r="10" opacity=".3" />
    <path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" />
    <path d="M12,7a5,5,0,1,0,5,5A5,5,0,0,0,12,7Zm0,8a3,3,0,1,1,3-3A3,3,0,0,1,12,15Z" />
  </svg>
);
