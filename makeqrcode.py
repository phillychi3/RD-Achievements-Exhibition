import os
import re
from supabase import create_client, Client
from dotenv import load_dotenv
import qrcode


def clean_filename(filename: str) -> str:
    return re.sub(r"[^\w\-\u4e00-\u9fff]", "_", filename)


def generate_qr_codes():
    load_dotenv()

    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    supabase: Client = create_client(url, key)

    output_dir = "qrcodes"
    os.makedirs(output_dir, exist_ok=True)

    response = supabase.table("questions").select("id,work_name").execute()

    base_url = "https://research.xn--op5a.tw/lotter?booth="

    for record in response.data:
        question_id = record["id"]
        work_name = record["work_name"]

        if not work_name:
            continue

        full_url = f"{base_url}{question_id}"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(full_url)
        qr.make(fit=True)

        qr_image = qr.make_image(fill_color="black", back_color="white")

        clean_name = clean_filename(work_name)
        filename = os.path.join(output_dir, f"{clean_name}.png")

        qr_image.save(filename)
        print(f"QR code{filename}")


if __name__ == "__main__":
    generate_qr_codes()
