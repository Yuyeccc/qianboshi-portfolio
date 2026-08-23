#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一键更新线上作品集：重新生成快照 → git 提交 → 推送（GitHub Actions 自动部署）

用法: C:/Python314/python.exe E:/qianboshi-portfolio/backend/scripts/update_site.py
无变更时自动跳过提交/推送。
"""
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PORTFOLIO = Path(r"E:\qianboshi-portfolio")
GENERATOR = PORTFOLIO / "backend" / "scripts" / "generate_snapshots.py"
PYTHON = r"C:\Python314\python.exe"
GIT_USER = "Yuyeccc"
GIT_EMAIL = "1944800751@qq.com"


def run(cmd: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess:
    print("  $", " ".join(cmd))
    result = subprocess.run(cmd, cwd=cwd or PORTFOLIO, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.stdout.strip():
        print(result.stdout.strip()[:2000])
    if result.returncode != 0 and result.stderr.strip():
        print("  [stderr]", result.stderr.strip()[:2000])
    return result


def main() -> int:
    print(f"=== 更新线上作品集 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===")

    # 1. 重新生成快照（读最新线下数据）
    print("[1/4] 生成快照...")
    r = run([PYTHON, str(GENERATOR)])
    if r.returncode != 0:
        print("  ❌ 快照生成失败，中止")
        return 1

    # 2. git 提交（无变更则跳过）
    print("[2/4] git 提交...")
    r = run(["git", "add", "-A"])
    if r.returncode != 0:
        print("  ❌ git add 失败，中止")
        return 1

    r = run(["git", "status", "--short"])
    changed = r.stdout.strip()
    if not changed:
        print("  ℹ️ 无变更，跳过提交与推送")
        return 0

    date_str = datetime.now().strftime("%Y-%m-%d")
    r = run(["git", "-c", f"user.name={GIT_USER}", "-c", f"user.email={GIT_EMAIL}",
             "commit", "-m", f"chore: update snapshots {date_str}"])
    if r.returncode != 0:
        print("  ❌ git commit 失败，中止")
        return 1

    # 3. 推送（触发 GitHub Actions 自动部署）
    print("[3/4] git push...")
    r = run(["git", "push", "origin", "main"])
    if r.returncode != 0:
        print("  ❌ git push 失败")
        return 1

    print("[4/4] ✅ 已推送，GitHub Actions 正在自动部署（约 1-2 分钟）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
