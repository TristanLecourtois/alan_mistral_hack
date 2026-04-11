#!/usr/bin/env python3
"""Keep relevant metrics from raw Thryve JSON and generate plots."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", ".matplotlib-cache")

import matplotlib.pyplot as plt
import pandas as pd


RELEVANT_METRICS = [
    "SleepDuration",
    "SleepEfficiency",
    "SleepQuality",
    "SleepRegularity",
    "SleepInterdailyStability",
    "SleepLatency",
    "SleepInterruptions",
    "HeartRate",
    "HeartRateResting",
    "HeartRateSleepLowest",
    "Steps",
    "ActiveDuration",
    "ActivityDuration",
    "ActivityIntensity",
    "ActiveBurnedCalories",
    "BurnedCalories",
    "SPO2",
]

PLOT_GROUPS = {
    "sleep_duration": ["SleepDuration", "SleepLatency", "SleepInterruptions"],
    "sleep_scores": ["SleepEfficiency", "SleepQuality", "SleepRegularity", "SleepInterdailyStability"],
    "heart_rate": ["HeartRate", "HeartRateResting", "HeartRateSleepLowest"],
    "activity": ["Steps", "ActiveDuration", "ActivityDuration", "ActivityIntensity"],
    "calories": ["ActiveBurnedCalories", "BurnedCalories"],
}

MINUTES_TO_HOURS = {
    "SleepDuration",
    "SleepLatency",
    "ActiveDuration",
    "ActivityDuration",
}


def latest_daily_raw_json() -> Path:
    files = sorted(Path("data/raw").glob("thryve_daily_*.json"), key=lambda path: path.stat().st_mtime)
    if not files:
        raise SystemExit("No raw daily JSON found in data/raw. Pass --input explicitly.")
    return files[-1]


def matching_epoch_raw_json(daily_path: Path, authentication_tokens: set[str]) -> Path | None:
    files = sorted(Path("data/raw").glob("thryve_epoch_*.json"), key=lambda path: path.stat().st_mtime)
    if not files:
        return None

    for token in authentication_tokens:
        matches = [path for path in files if token and token in path.name]
        if matches:
            return matches[-1]

    daily_name = daily_path.name.replace("daily", "epoch", 1)
    exact = Path("data/raw") / daily_name
    if exact.exists():
        return exact

    return files[-1]


def iter_raw_users(raw: object) -> list[dict]:
    if isinstance(raw, list) and raw and all(isinstance(item, list) for item in raw):
        return [user for chunk in raw for user in chunk if isinstance(user, dict)]
    if isinstance(raw, list):
        return [user for user in raw if isinstance(user, dict)]
    if isinstance(raw, dict):
        return [raw]
    raise SystemExit("Unsupported raw JSON shape.")


def load_daily(path: Path) -> pd.DataFrame:
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for user in iter_raw_users(raw):
        for source in user.get("dataSources", []):
            for item in source.get("data", []):
                details = item.get("details") or {}
                rows.append(
                    {
                        "authenticationToken": user.get("authenticationToken"),
                        "partnerUserID": user.get("partnerUserID"),
                        "dataSource": source.get("dataSource"),
                        "day": item.get("day"),
                        "createdAt": item.get("createdAt"),
                        "typeId": item.get("dailyDynamicValueType"),
                        "typeName": item.get("dailyDynamicValueTypeName"),
                        "value": item.get("value"),
                        "valueType": item.get("valueType"),
                        "timezoneOffset": details.get("timezoneOffset"),
                        "generation": details.get("generation"),
                        "trustworthiness": details.get("trustworthiness"),
                        "medicalGrade": details.get("medicalGrade"),
                    }
                )

    if not rows:
        raise SystemExit(f"No daily data found in {path}.")

    df = pd.DataFrame(rows)
    df = df.copy()
    df["day"] = pd.to_datetime(df["day"], errors="coerce")
    df["numeric_value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna(subset=["day", "typeName", "numeric_value"])
    return df


def load_epoch(path: Path) -> pd.DataFrame:
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for user in iter_raw_users(raw):
        for source in user.get("dataSources", []):
            for item in source.get("data", []):
                details = item.get("details") or {}
                rows.append(
                    {
                        "authenticationToken": user.get("authenticationToken"),
                        "partnerUserID": user.get("partnerUserID"),
                        "dataSource": source.get("dataSource"),
                        "startTimestamp": item.get("startTimestamp"),
                        "endTimestamp": item.get("endTimestamp"),
                        "createdAt": item.get("createdAt"),
                        "typeId": item.get("dynamicValueType"),
                        "typeName": item.get("dynamicValueTypeName"),
                        "value": item.get("value"),
                        "valueType": item.get("valueType"),
                        "timezoneOffset": details.get("timezoneOffset"),
                        "generation": details.get("generation"),
                        "trustworthiness": details.get("trustworthiness"),
                        "medicalGrade": details.get("medicalGrade"),
                    }
                )

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["startTimestamp"], errors="coerce")
    df["numeric_value"] = pd.to_numeric(df["value"], errors="coerce")
    return df.dropna(subset=["timestamp", "typeName", "numeric_value"])


def keep_relevant(df: pd.DataFrame) -> pd.DataFrame:
    kept = df[df["typeName"].isin(RELEVANT_METRICS)].copy()
    kept["plot_value"] = kept["numeric_value"]
    kept.loc[kept["typeName"].isin(MINUTES_TO_HOURS), "plot_value"] = kept["plot_value"] / 60
    kept["plot_unit"] = kept["typeName"].map(lambda metric: "hours" if metric in MINUTES_TO_HOURS else "value")
    return kept


def keep_epoch_spo2(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df.copy()
    kept = df[df["typeName"].eq("SPO2")].copy()
    kept["plot_value"] = kept["numeric_value"]
    kept["plot_unit"] = "percent"
    return kept


def pivot_metrics(df: pd.DataFrame, metrics: list[str]) -> pd.DataFrame:
    subset = df[df["typeName"].isin(metrics)].copy()
    if subset.empty:
        return pd.DataFrame()

    index = ["day"]
    if "partnerUserID" in subset.columns:
        index.append("partnerUserID")

    pivot = subset.pivot_table(index=index, columns="typeName", values="plot_value", aggfunc="mean").reset_index()
    return pivot.sort_values(index)


def plot_group(df: pd.DataFrame, metrics: list[str], title: str, output_path: Path) -> bool:
    present = [metric for metric in metrics if metric in set(df["typeName"])]
    if not present:
        return False

    if "partnerUserID" in df.columns and df["partnerUserID"].nunique() > 1:
        profiles = sorted(df["partnerUserID"].dropna().unique())
    else:
        profiles = [None]

    fig, axes = plt.subplots(len(present), 1, figsize=(12, max(3, 2.4 * len(present))), sharex=True)
    if len(present) == 1:
        axes = [axes]

    for ax, metric in zip(axes, present):
        metric_df = df[df["typeName"] == metric]
        for profile in profiles:
            series_df = metric_df if profile is None else metric_df[metric_df["partnerUserID"] == profile]
            daily = series_df.groupby("day", as_index=False)["plot_value"].mean().sort_values("day")
            if daily.empty:
                continue
            label = metric if profile is None else str(profile)
            ax.plot(daily["day"], daily["plot_value"], marker="o", linewidth=1.8, label=label)

        unit = "hours" if metric in MINUTES_TO_HOURS else "value"
        ax.set_ylabel(unit)
        ax.set_title(metric)
        ax.grid(True, alpha=0.25)
        if len(profiles) > 1:
            ax.legend(loc="best", fontsize=8)

    fig.suptitle(title)
    fig.autofmt_xdate()
    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


def plot_epoch_spo2(df: pd.DataFrame, output_path: Path) -> bool:
    if df.empty:
        return False

    if "partnerUserID" in df.columns and df["partnerUserID"].nunique() > 1:
        profiles = sorted(df["partnerUserID"].dropna().unique())
    else:
        profiles = [None]

    fig, ax = plt.subplots(figsize=(12, 4))
    for profile in profiles:
        series_df = df if profile is None else df[df["partnerUserID"] == profile]
        series_df = series_df.sort_values("timestamp")
        if series_df.empty:
            continue
        label = "SPO2" if profile is None else str(profile)
        ax.plot(series_df["timestamp"], series_df["plot_value"], marker=".", linewidth=1.2, label=label)

    ax.set_title("Epoch SPO2")
    ax.set_ylabel("percent")
    ax.grid(True, alpha=0.25)
    if len(profiles) > 1:
        ax.legend(loc="best", fontsize=8)
    fig.autofmt_xdate()
    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=160)
    plt.close(fig)
    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Filter relevant Thryve metrics from raw JSON and generate plots.")
    parser.add_argument("--input", type=Path, default=None, help="Raw daily JSON. Defaults to latest data/raw/thryve_daily_*.json")
    parser.add_argument("--epoch-input", type=Path, default=None, help="Raw epoch JSON for SPO2. Defaults to a matching data/raw/thryve_epoch_*.json when available.")
    parser.add_argument("--output-dir", type=Path, default=Path("reports/relevant_metrics"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = args.input or latest_daily_raw_json()

    daily = load_daily(input_path)
    relevant = keep_relevant(daily)
    if relevant.empty:
        raise SystemExit("No relevant metrics found in the input raw JSON.")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    filtered_path = args.output_dir / f"{input_path.stem}_relevant_metrics.csv"
    relevant.to_csv(filtered_path, index=False)

    generated = []
    for group_name, metrics in PLOT_GROUPS.items():
        output_path = args.output_dir / f"{input_path.stem}_{group_name}.png"
        if plot_group(relevant, metrics, group_name.replace("_", " ").title(), output_path):
            generated.append(output_path)

    epoch_path = args.epoch_input or matching_epoch_raw_json(
        input_path,
        set(relevant["authenticationToken"].dropna().astype(str).unique()),
    )
    epoch_spo2_path = None
    if epoch_path and epoch_path.exists():
        epoch_spo2 = keep_epoch_spo2(load_epoch(epoch_path))
        if not epoch_spo2.empty:
            epoch_spo2_path = args.output_dir / f"{epoch_path.stem}_spo2_epoch.csv"
            epoch_spo2.to_csv(epoch_spo2_path, index=False)
            output_path = args.output_dir / f"{epoch_path.stem}_spo2_epoch.png"
            if plot_epoch_spo2(epoch_spo2, output_path):
                generated.append(output_path)

    print(f"Input: {input_path}")
    print(f"Filtered CSV: {filtered_path}")
    if epoch_spo2_path:
        print(f"Epoch SPO2 CSV: {epoch_spo2_path}")
    elif epoch_path:
        print(f"Epoch input had no SPO2: {epoch_path}")
    else:
        print("No epoch JSON found for SPO2.")
    for path in generated:
        print(f"Plot: {path}")


if __name__ == "__main__":
    main()
