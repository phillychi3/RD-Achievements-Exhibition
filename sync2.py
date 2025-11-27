import os
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
EXCEL_PATH = "C:\\Users\\whitecloud\\Downloads\\all-1126.xlsx"


def parse_answer(answer: str) -> int:
    mapping = {"A": 0, "B": 1, "C": 2, "D": 3}
    return mapping.get(str(answer).strip().upper(), 0)


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("請在 .env 檔案設定 SUPABASE_URL 和 SUPABASE_KEY")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("已連接到 Supabase")

    df = pd.read_excel(EXCEL_PATH)
    print(f"讀取 {len(df)} 筆資料")

    rows = []
    for idx, row in df.iterrows():
        row_id = idx + 1

        data = {
            "ct": row_id,
            "work_name": str(row["name"]),
            "ask": str(row["q1"]),
            "ask2": str(row["q1.1"]),  # Excel 中第二題是 q1.1
            "questions1": [
                str(row["a1"]),
                str(row["b1"]),
                str(row["c1"]),
                str(row["d1"]),
            ],
            "questions2": [
                str(row["a2"]),
                str(row["b2"]),
                str(row["c2"]),
                str(row["d2"]),
            ],
            "answer1": parse_answer(row["ans1"]),
            "answer2": parse_answer(row["ans2"]),
        }
        rows.append(data)

    print("正在同步...")
    supabase.table("questions").upsert(rows).execute()

    print(f"完成！已同步 {len(rows)} 筆資料")


if __name__ == "__main__":
    main()
