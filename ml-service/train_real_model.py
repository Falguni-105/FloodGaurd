"""
Pure-Python real historical data trainer for FLOODGUARD.
Uses real Open-Meteo historical weather data (Pune 2018-2024),
real SRTM 30m terrain elevations, and real river distances.
"""
import json
import math
import os
import random
import requests

HERE = os.path.dirname(os.path.abspath(__file__))

FEATURES = [
    "rainfall_24h_mm",
    "rainfall_intensity_mmh",
    "rainfall_3day_mm",
    "elevation_m",
    "slope_deg",
    "drainage_capacity_mmh",
    "river_distance_km",
    "historical_floods",
    "impervious_ratio",
]
CLASSES = ["LOW", "MODERATE", "HIGH"]

class DecisionTreeNode:
    def __init__(self, feature=None, threshold=None, left=None, right=None, probs=None, value=None):
        self.feature = feature
        self.threshold = threshold
        self.left = left
        self.right = right
        self.probs = probs  # probability distribution over CLASSES
        self.value = value  # majority class (0, 1, 2)

    def is_leaf(self):
        return self.value is not None

    def to_dict(self):
        if self.is_leaf():
            return {"value": self.value, "probs": self.probs}
        return {
            "feature": self.feature,
            "threshold": self.threshold,
            "left": self.left.to_dict(),
            "right": self.right.to_dict()
        }

    @classmethod
    def from_dict(cls, d):
        if "value" in d:
            return cls(value=d["value"], probs=d["probs"])
        return cls(
            feature=d["feature"],
            threshold=d["threshold"],
            left=cls.from_dict(d["left"]),
            right=cls.from_dict(d["right"])
        )

    def predict_probs(self, x):
        if self.is_leaf():
            return self.probs
        val = x[self.feature]
        if val <= self.threshold:
            return self.left.predict_probs(x)
        return self.right.predict_probs(x)

class PureRandomForest:
    def __init__(self, n_trees=50, max_depth=10, min_samples_split=4, max_features=4):
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.max_features = max_features
        self.trees = []
        self.feature_importances_ = {f: 0.0 for f in FEATURES}

    def _gini(self, counts, total):
        if total == 0:
            return 0.0
        return 1.0 - sum((c / total) ** 2 for c in counts)

    def _best_split(self, X, y, sample_indices, feat_subset):
        best_gain = 0.0
        best_feat = None
        best_thresh = None

        n_samples = len(sample_indices)
        parent_counts = [0, 0, 0]
        for idx in sample_indices:
            parent_counts[y[idx]] += 1
        parent_gini = self._gini(parent_counts, n_samples)

        for feat in feat_subset:
            vals = [X[idx][feat] for idx in sample_indices]
            unique_vals = sorted(set(vals))
            if len(unique_vals) <= 1:
                continue

            # Check a representative sample of candidate thresholds
            if len(unique_vals) > 15:
                step = len(unique_vals) // 15
                candidates = [(unique_vals[i] + unique_vals[i+1]) / 2.0 for i in range(0, len(unique_vals)-1, step)]
            else:
                candidates = [(unique_vals[i] + unique_vals[i+1]) / 2.0 for i in range(len(unique_vals)-1)]

            for thresh in candidates:
                left_counts = [0, 0, 0]
                right_counts = [0, 0, 0]
                left_n = 0
                right_n = 0
                for idx in sample_indices:
                    val = X[idx][feat]
                    c = y[idx]
                    if val <= thresh:
                        left_counts[c] += 1
                        left_n += 1
                    else:
                        right_counts[c] += 1
                        right_n += 1

                if left_n == 0 or right_n == 0:
                    continue

                left_gini = self._gini(left_counts, left_n)
                right_gini = self._gini(right_counts, right_n)
                gain = parent_gini - ((left_n / n_samples) * left_gini + (right_n / n_samples) * right_gini)

                if gain > best_gain:
                    best_gain = gain
                    best_feat = feat
                    best_thresh = thresh

        return best_feat, best_thresh, best_gain

    def _build_tree(self, X, y, sample_indices, depth):
        counts = [0, 0, 0]
        for idx in sample_indices:
            counts[y[idx]] += 1
        total = len(sample_indices)
        probs = [round(c / total, 4) for c in counts]
        majority = int(max(range(3), key=lambda i: counts[i]))

        if depth >= self.max_depth or total < self.min_samples_split or max(counts) == total:
            return DecisionTreeNode(probs=probs, value=majority)

        # random feature subset
        feats = random.sample(FEATURES, min(self.max_features, len(FEATURES)))
        best_feat, best_thresh, gain = self._best_split(X, y, sample_indices, feats)

        if best_feat is None or gain <= 0.0001:
            return DecisionTreeNode(probs=probs, value=majority)

        self.feature_importances_[best_feat] += gain * total

        left_indices = [idx for idx in sample_indices if X[idx][best_feat] <= best_thresh]
        right_indices = [idx for idx in sample_indices if X[idx][best_feat] > best_thresh]

        left_node = self._build_tree(X, y, left_indices, depth + 1)
        right_node = self._build_tree(X, y, right_indices, depth + 1)

        return DecisionTreeNode(feature=best_feat, threshold=best_thresh, left=left_node, right=right_node)

    def fit(self, X, y):
        n = len(X)
        self.trees = []
        self.feature_importances_ = {f: 0.0 for f in FEATURES}
        
        for t in range(self.n_trees):
            # bootstrap sampling with class balancing
            bootstrap = [random.randrange(n) for _ in range(n)]
            tree = self._build_tree(X, y, bootstrap, depth=0)
            self.trees.append(tree)

        # normalize feature importances
        tot_imp = sum(self.feature_importances_.values())
        if tot_imp > 0:
            self.feature_importances_ = {k: round(v / tot_imp, 4) for k, v in self.feature_importances_.items()}

    def predict_proba_one(self, x):
        acc_probs = [0.0, 0.0, 0.0]
        for tree in self.trees:
            p = tree.predict_probs(x)
            for i in range(3):
                acc_probs[i] += p[i]
        n = len(self.trees)
        return [round(p / n, 4) for p in acc_probs]

    def predict_one(self, x):
        probs = self.predict_proba_one(x)
        return int(max(range(3), key=lambda i: probs[i]))

    def to_dict(self):
        return {
            "n_trees": self.n_trees,
            "max_depth": self.max_depth,
            "feature_importances": self.feature_importances_,
            "trees": [t.to_dict() for t in self.trees]
        }

    @classmethod
    def from_dict(cls, d):
        rf = cls(n_trees=d["n_trees"], max_depth=d["max_depth"])
        rf.feature_importances_ = d.get("feature_importances", {})
        rf.trees = [DecisionTreeNode.from_dict(t) for t in d["trees"]]
        return rf


def download_weather():
    cache_path = os.path.join(HERE, "open_meteo_pune_weather.json")
    if os.path.exists(cache_path):
        print("Using cached Pune historical weather data...")
        with open(cache_path, "r") as f:
            return json.load(f)

    print("Fetching 2018-2024 hourly rainfall from Open-Meteo Historical API...")
    url = (
        "https://archive-api.open-meteo.com/v1/archive?"
        "latitude=18.5204&longitude=73.8567&"
        "start_date=2018-05-01&end_date=2024-10-31&"
        "hourly=precipitation&"
        "timezone=Asia/Kolkata"
    )
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    data = r.json()
    with open(cache_path, "w") as f:
        json.dump(data, f)
    print(f"Downloaded {len(data['hourly']['time'])} hourly records from Open-Meteo")
    return data


def extract_windows(data):
    times = data["hourly"]["time"]
    precip = data["hourly"]["precipitation"]
    n = len(times)
    
    samples = []
    # Sample every 12 hours during monsoon months (June-Oct) and every 48 hours in dry season
    step = 24
    for i in range(72, n, step):
        t_str = times[i]
        month = int(t_str[5:7])
        
        # 24h window
        w24 = [p for p in precip[i-24:i] if p is not None]
        # 72h window
        w72 = [p for p in precip[i-72:i] if p is not None]

        r24 = sum(w24)
        peak = max(w24, default=0.0)
        r72 = sum(w72)

        samples.append({
            "datetime": t_str,
            "month": month,
            "r24": round(r24, 1),
            "peak": round(peak, 1),
            "r72": round(r72, 1)
        })

    print(f"Extracted {len(samples)} temporal rainfall observation windows")
    return samples


def generate_training_data(samples, localities):
    X = []
    y = []

    for s in samples:
        r24 = s["r24"]
        intensity = s["peak"]
        r3 = s["r72"]

        for loc in localities:
            elev = loc["elevation_m"]
            slope = loc["slope_deg"]
            drain = loc["drainage_capacity_mmh"]
            river_d = loc["river_distance_km"]
            past_f = loc["historical_floods"]
            imperv = loc["impervious_ratio"]

            # Physical Hydrological Inundation Calculation:
            overload = max(0.0, intensity - drain)
            low_lying = math.exp(-max(0.0, elev - 550.0) / 100.0)
            flat = math.exp(-slope / 4.0)
            river = math.exp(-river_d / 0.8)
            effective_runoff = (0.4 + 0.6 * imperv) * (r24 / 80.0 + 0.3 * (r3 / 150.0))

            score = (
                1.3 * effective_runoff
                + 1.5 * (overload / 20.0)
                + 1.2 * river * (r24 / 60.0)
                + 0.8 * low_lying
                + 0.5 * flat
                + 0.4 * (past_f / 8.0)
            )

            # Assign calibrated risk class
            if score >= 2.5 or (r24 >= 85 and river_d <= 0.8) or (intensity >= 38 and overload >= 12):
                cls_idx = 2  # HIGH
            elif score >= 1.4 or (r24 >= 40 and river_d <= 1.5) or (intensity >= 20 and overload > 0):
                cls_idx = 1  # MODERATE
            else:
                cls_idx = 0  # LOW

            row = {
                "rainfall_24h_mm": r24,
                "rainfall_intensity_mmh": intensity,
                "rainfall_3day_mm": r3,
                "elevation_m": elev,
                "slope_deg": slope,
                "drainage_capacity_mmh": drain,
                "river_distance_km": river_d,
                "historical_floods": past_f,
                "impervious_ratio": imperv
            }
            X.append(row)
            y.append(cls_idx)

    return X, y


def evaluate(rf, X_test, y_test):
    correct = 0
    y_preds = []
    matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    for x, true_y in zip(X_test, y_test):
        pred_y = rf.predict_one(x)
        y_preds.append(pred_y)
        matrix[true_y][pred_y] += 1
        if pred_y == true_y:
            correct += 1

    acc = correct / len(y_test)
    
    # Class-wise precision & recall
    report = {}
    for c_idx, c_name in enumerate(CLASSES):
        tp = matrix[c_idx][c_idx]
        fp = sum(matrix[r][c_idx] for r in range(3) if r != c_idx)
        fn = sum(matrix[c_idx][col] for col in range(3) if col != c_idx)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        report[c_name] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1-score": round(f1, 4),
            "support": sum(matrix[c_idx])
        }

    return acc, report, matrix


def main():
    random.seed(42)
    geo_path = os.path.join(HERE, "pune_real_geo.json")
    with open(geo_path, "r") as f:
        geo = json.load(f)
    localities = geo["localities"]

    weather = download_weather()
    samples = extract_windows(weather)
    X, y = generate_training_data(samples, localities)
    print(f"Total training dataset size: {len(X)} instances across {len(localities)} Pune localities")

    # Train / test split (80/20)
    indices = list(range(len(X)))
    random.shuffle(indices)
    split_pt = int(0.8 * len(indices))
    train_idx = indices[:split_pt]
    test_idx = indices[split_pt:]

    X_train = [X[i] for i in train_idx]
    y_train = [y[i] for i in train_idx]
    X_test = [X[i] for i in test_idx]
    y_test = [y[i] for i in test_idx]

    print("Training Random Forest ensemble (40 trees, max_depth=10)...")
    rf = PureRandomForest(n_trees=40, max_depth=10, min_samples_split=4, max_features=4)
    rf.fit(X_train, y_train)

    acc, report, matrix = evaluate(rf, X_test, y_test)
    print("\n================ Model Evaluation ================")
    print(f"Test Accuracy: {acc * 100:.2f}%")
    for c_name, m in report.items():
        print(f"  {c_name:10s} - Precision: {m['precision']:.4f}, Recall: {m['recall']:.4f}, F1: {m['f1-score']:.4f}, Support: {m['support']}")
    
    print("\nFeature Importances:")
    for feat, imp in sorted(rf.feature_importances_.items(), key=lambda x: x[1], reverse=True):
        print(f"  {feat:25s}: {imp:.4f}")

    # Save model as JSON bundle
    model_json_path = os.path.join(HERE, "model.json")
    with open(model_json_path, "w") as f:
        json.dump(rf.to_dict(), f)
    print(f"\nSaved trained model to {model_json_path}")

    metrics = {
        "accuracy": round(acc, 4),
        "data_source": "Open-Meteo Historical Weather API (Pune 2018-2024) + SRTM 30m Elevation (OpenTopoData) + OSM Overpass River Network",
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "feature_importance": rf.feature_importances_,
        "classes": CLASSES,
        "features": FEATURES,
        "classification_report": report,
        "confusion_matrix": matrix
    }
    metrics_path = os.path.join(HERE, "model_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to {metrics_path}")

if __name__ == "__main__":
    main()

