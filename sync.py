import os
import csv
from supabase import create_client, Client
from typing import Dict
from dotenv import load_dotenv

load_dotenv()


def parse_answer(answer: str) -> int:
    mapping = {"A": 0, "B": 1, "C": 2, "D": 3}
    return mapping.get(answer, 0)


def process_csv_row(row: Dict[str, str]) -> Dict:
    return {
        "work_name": row["作品名稱"],
        "ask": row["第一題題目"],
        "ask2": row["第二道題目"],
        "questions1": [row["1-a"], row["1-b"], row["1-c"], row["1-d"]],
        "questions2": [row["2-a"], row["2-b"], row["2-c"], row["2-d"]],
        "answer1": parse_answer(row["第一題答案"]),
        "answer2": parse_answer(row["第二題答案"]),
    }


def main():
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    supabase: Client = create_client(url, key)

    with open("quiz-data.csv", "r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        rows = []
        for row in reader:
            processed_row = process_csv_row(row)
            rows.append(processed_row)

        result = supabase.table("questions").insert(rows).execute()
        print(f"成功插入 {len(rows)} 筆資料")


if __name__ == "__main__":
    main()
