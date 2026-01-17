"""
로빈스 조직행동론 PDF 분할 스크립트
실행 방법: python split_robbins_pdf.py

필요 패키지: pip install PyPDF2
"""

from PyPDF2 import PdfReader, PdfWriter
import os

# 설정
INPUT_FILE = "스티븐 로빈스Organizational behavior.pdf"
OUTPUT_DIR = "."  # 현재 폴더에 저장

# 분할 범위 (실제 책 구조에 맞게 조정 필요)
# 대략적인 분할: 2371페이지 ÷ 3 ≈ 790페이지씩
SPLITS = [
    ("로빈스_조직행동론_Part1_개인행동.pdf", 1, 800),      # 1-800페이지
    ("로빈스_조직행동론_Part2_집단행동.pdf", 801, 1600),   # 801-1600페이지
    ("로빈스_조직행동론_Part3_조직시스템.pdf", 1601, 2371) # 1601-끝
]

def split_pdf():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ 파일을 찾을 수 없습니다: {INPUT_FILE}")
        return
    
    print(f"📖 PDF 로딩 중: {INPUT_FILE}")
    reader = PdfReader(INPUT_FILE)
    total_pages = len(reader.pages)
    print(f"📄 총 페이지 수: {total_pages}")
    
    for output_name, start, end in SPLITS:
        writer = PdfWriter()
        
        # 페이지 범위 조정 (0-indexed)
        actual_end = min(end, total_pages)
        
        print(f"\n✂️ 분할 중: {output_name}")
        print(f"   페이지 범위: {start} - {actual_end}")
        
        for page_num in range(start - 1, actual_end):
            writer.add_page(reader.pages[page_num])
        
        output_path = os.path.join(OUTPUT_DIR, output_name)
        with open(output_path, "wb") as output_file:
            writer.write(output_file)
        
        print(f"   ✅ 저장 완료: {output_name} ({actual_end - start + 1}페이지)")
    
    print("\n🎉 PDF 분할 완료!")
    print("\n💡 다음 단계:")
    print("1. 기존 '스티븐 로빈스Organizational behavior.pdf'를 삭제하거나 이동")
    print("2. 프로그램의 AI 설정에서 분할된 3개 PDF를 업로드")

if __name__ == "__main__":
    split_pdf()
