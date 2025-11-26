import os
import sys
import tempfile
import pandas as pd
import qrcode
from PIL import Image
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from io import BytesIO
from rapidfuzz import fuzz
import warnings
import re

warnings.filterwarnings("ignore")


def sanitize_filename(filename):
    filename = re.sub(r"[\r\n\t\x00-\x1f\x7f]", "", filename)

    illegal_chars = r'[<>:"/\\|?*]'
    filename = re.sub(illegal_chars, "_", filename)
    filename = filename.strip()
    filename = filename.strip(".")

    return filename


def generate_qrcode(url, size=(150, 150)):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img = img.resize(size, Image.Resampling.LANCZOS)
    return img


def find_matching_pdf(name, pdf_folder):
    if not os.path.exists(pdf_folder):
        return None, 0

    pdf_files = [f for f in os.listdir(pdf_folder) if f.lower().endswith(".pdf")]

    if not pdf_files:
        return None, 0
    pdf_names = [os.path.splitext(f)[0] for f in pdf_files]
    best_match = None
    best_score = 0

    for i, pdf_name in enumerate(pdf_names):
        ratio_score = fuzz.ratio(name, pdf_name)
        partial_score = fuzz.partial_ratio(name, pdf_name)

        current_score = max(ratio_score, partial_score)

        if current_score > best_score:
            best_score = current_score
            best_match = os.path.join(pdf_folder, pdf_files[i])

    if best_score >= 60:
        return best_match, best_score

    return None, 0


def add_qrcode_to_pdf(
    input_pdf_path, output_pdf_path, qrcode_img, position="bottom-right"
):
    try:
        reader = PdfReader(input_pdf_path)
        writer = PdfWriter()

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_file:
            qrcode_img.save(tmp_file.name, format="PNG")
            temp_qr_path = tmp_file.name

        try:
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]

                page_width = float(page.mediabox.width)
                page_height = float(page.mediabox.height)

                packet = BytesIO()
                can = canvas.Canvas(packet, pagesize=(page_width, page_height))

                qr_size = 310
                margin = 190

                x_position = page_width - qr_size - margin
                y_position = margin

                can.drawImage(
                    temp_qr_path,
                    x_position,
                    y_position,
                    width=qr_size,
                    height=qr_size,
                    preserveAspectRatio=True,
                )
                can.save()

                packet.seek(0)

                qr_pdf = PdfReader(packet)
                qr_page = qr_pdf.pages[0]

                page.merge_page(qr_page)
                writer.add_page(page)

            with open(output_pdf_path, "wb") as output_file:
                writer.write(output_file)

            return True

        finally:
            if os.path.exists(temp_qr_path):
                os.unlink(temp_qr_path)

    except Exception as e:
        print(f"處理 PDF 時發生錯誤: {e}")
        import traceback

        traceback.print_exc()
        return False


def process_excel_to_pdf(excel_path, pdf_folder):
    df = pd.read_excel(excel_path)

    base_dir = os.path.dirname(excel_path)
    out_pdf_dir = os.path.join(base_dir, "out_pdf")
    out_qrcode_dir = os.path.join(base_dir, "out_qrcode")

    os.makedirs(out_pdf_dir, exist_ok=True)
    os.makedirs(out_qrcode_dir, exist_ok=True)

    print(f"處理 {len(df)} 筆資料...")
    print(f"PDF 來源資料夾: {pdf_folder}")
    print(f"輸出 PDF 到: {out_pdf_dir}")
    print(f"輸出 QR code 到: {out_qrcode_dir}")
    print("-" * 60)

    success_count = 0
    fail_count = 0
    not_found_list = []

    for idx, row in df.iterrows():
        row_id = idx + 1
        name = str(row["name"]).strip()

        print(f"\n[{row_id}/{len(df)}] 處理: {name}")

        safe_name = sanitize_filename(name)
        if safe_name != name:
            print(f"檔名含非法字符，已清理為: {safe_name}")

        qr_url = f"https://research.cloudowo.com/q/{row_id}"

        qr_img = generate_qrcode(qr_url)

        qrcode_filename = f"{safe_name}_{row_id}.png"
        qrcode_path = os.path.join(out_qrcode_dir, qrcode_filename)
        qr_img.save(qrcode_path)
        print(f"QR code 已儲存: {qrcode_filename}")

        pdf_path, match_score = find_matching_pdf(name, pdf_folder)

        if pdf_path:
            print(
                f"找到 PDF: {os.path.basename(pdf_path)} (匹配度: {match_score:.0f}%)"
            )

            output_pdf_filename = f"{safe_name}_{row_id}.pdf"
            output_pdf_path = os.path.join(out_pdf_dir, output_pdf_filename)

            if add_qrcode_to_pdf(pdf_path, output_pdf_path, qr_img):
                print(f"PDF 已處理並儲存: {output_pdf_filename}")
                success_count += 1
            else:
                print("PDF 處理失敗")
                fail_count += 1
        else:
            print("找不到對應的 PDF 檔案")
            not_found_list.append((row_id, name))
            fail_count += 1

    print("\n" + "=" * 60)
    print("處理完成!")
    print(f"成功: {success_count} 筆")
    print(f"失敗: {fail_count} 筆")

    if not_found_list:
        print(f"找不到對應 PDF 的項目 ({len(not_found_list)} 筆):")
        print("-" * 60)
        for item_id, item_name in not_found_list:
            print(f"  [{item_id}] {item_name}")
        print("-" * 60)

    print(f"\nQR code 輸出到: {out_qrcode_dir}")
    print(f"PDF 輸出到: {out_pdf_dir}")


def main():
    excel_path = "C:\\Users\\whitecloud\\Downloads\\啥東東\\all.xlsx"

    if not os.path.exists(excel_path):
        print(f"錯誤: 找不到 Excel 檔案: {excel_path}")
        sys.exit(1)

    pdf_folder = "C:\\Users\\whitecloud\\Downloads\\啥東東"

    if not os.path.exists(pdf_folder):
        print(f"\n錯誤: 資料夾不存在: {pdf_folder}")
        sys.exit(1)

    if not os.path.isdir(pdf_folder):
        print(f"\n錯誤: 路徑不是資料夾: {pdf_folder}")
        sys.exit(1)

    process_excel_to_pdf(excel_path, pdf_folder)


if __name__ == "__main__":
    main()
