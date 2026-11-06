"""Train the FLOODGUARD flood-risk model.

No labelled urban flood dataset ships with this project, so the model is trained on
synthetic data generated from a hydrologically-motivated formula plus noise. This
keeps the pipeline (features -> model -> API -> backend) fully working. Replace
`generate_data()` with real historical flood records for production use.
"""
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split

FEATURES = [
    "rainfall_24h_mm",        # accumulated rainfall in last 24h
    "rainfall_intensity_mmh", # peak hourly intensity
    "rainfall_3day_mm",       # antecedent rainfall (soil/drain saturation)
    "elevation_m",            # locality elevation
    "slope_deg",              # terrain slope
    "drainage_capacity_mmh",  # design capacity of drainage network
    "river_distance_km",      # distance to nearest river / nala
    "historical_floods",      # recorded floods in last 10 years
    "impervious_ratio",       # share of paved / built-up surface (0-1)
]
CLASSES = ["LOW", "MODERATE", "HIGH"]


def generate_data(n=12000, seed=42):
    rng = np.random.default_rng(seed)
    df = pd.DataFrame({
        "rainfall_24h_mm": rng.gamma(2.0, 22.0, n).clip(0, 400),
        "rainfall_intensity_mmh": rng.gamma(2.0, 9.0, n).clip(0, 150),
        "rainfall_3day_mm": rng.gamma(2.5, 40.0, n).clip(0, 700),
        "elevation_m": rng.uniform(150, 900, n),
        "slope_deg": rng.gamma(2.0, 3.0, n).clip(0, 35),
        "drainage_capacity_mmh": rng.uniform(8, 60, n),
        "river_distance_km": rng.exponential(2.5, n).clip(0.05, 15),
        "historical_floods": rng.poisson(1.5, n).clip(0, 12),
        "impervious_ratio": rng.beta(3, 2, n),
    })
    # Drain overload: how far intensity exceeds what the drains can carry
    overload = (df.rainfall_intensity_mmh - df.drainage_capacity_mmh).clip(lower=0) / 30.0
    volume = df.rainfall_24h_mm / 120.0 + 0.4 * df.rainfall_3day_mm / 300.0
    low_lying = np.exp(-(df.elevation_m - 150) / 250.0)         # lower ground floods first
    flat = np.exp(-df.slope_deg / 6.0)                          # water pools on flat land
    river = np.exp(-df.river_distance_km / 1.5)
    history = df.historical_floods / 6.0
    runoff = 0.5 + df.impervious_ratio
    score = (
        1.4 * volume * runoff
        + 1.6 * overload
        + 0.9 * low_lying
        + 0.5 * flat
        + 0.8 * river
        + 0.6 * history
    )
    score = score + rng.normal(0, 0.18, n)
    # three classes by score thresholds
    y = np.digitize(score, [1.9, 3.0])
    df["risk_class"] = y
    return df


def main():
    df = generate_data()
    X, y = df[FEATURES], df["risk_class"]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=7, stratify=y)
    model = RandomForestClassifier(
        n_estimators=250, max_depth=14, min_samples_leaf=3,
        class_weight="balanced", n_jobs=-1, random_state=7,
    )
    model.fit(Xtr, ytr)
    pred = model.predict(Xte)
    acc = accuracy_score(yte, pred)
    print(f"class balance: {y.value_counts(normalize=True).sort_index().round(3).to_dict()}")
    print(f"test accuracy: {acc:.3f}")
    print(classification_report(yte, pred, target_names=CLASSES))

    importances = dict(zip(FEATURES, model.feature_importances_.round(4).tolist()))
    joblib.dump({"model": model, "features": FEATURES, "classes": CLASSES}, "model.joblib")
    with open("model_metrics.json", "w") as f:
        json.dump({"accuracy": round(acc, 4), "feature_importance": importances,
                   "training_data": "synthetic (see train.py)"}, f, indent=2)
    print("saved model.joblib and model_metrics.json")


if __name__ == "__main__":
    main()
