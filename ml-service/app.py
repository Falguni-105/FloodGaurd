"""FLOODGUARD ML service: serves flood-risk predictions trained on real Pune data."""
import json
import os
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel, Field

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
        self.probs = probs
        self.value = value

    def is_leaf(self):
        return self.value is not None

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
    def __init__(self, n_trees=40, max_depth=10):
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.trees = []
        self.feature_importances_ = {}

    @classmethod
    def from_dict(cls, d):
        rf = cls(n_trees=d["n_trees"], max_depth=d["max_depth"])
        rf.feature_importances_ = d.get("feature_importances", {})
        rf.trees = [DecisionTreeNode.from_dict(t) for t in d["trees"]]
        return rf

    def predict_proba_one(self, x):
        acc_probs = [0.0, 0.0, 0.0]
        for tree in self.trees:
            p = tree.predict_probs(x)
            for i in range(3):
                acc_probs[i] += p[i]
        n = len(self.trees)
        return [round(p / n, 4) for p in acc_probs]

# Load model
model_file = os.path.join(HERE, "model.json")
with open(model_file, "r") as f:
    MODEL = PureRandomForest.from_dict(json.load(f))

app = FastAPI(title="FLOODGUARD ML Service (Real Data)", version="1.0")

class Features(BaseModel):
    rainfall_24h_mm: float = Field(ge=0)
    rainfall_intensity_mmh: float = Field(ge=0)
    rainfall_3day_mm: float = Field(ge=0)
    elevation_m: float
    slope_deg: float = Field(ge=0)
    drainage_capacity_mmh: float = Field(gt=0)
    river_distance_km: float = Field(ge=0)
    historical_floods: int = Field(ge=0)
    impervious_ratio: float = Field(ge=0, le=1)

class Prediction(BaseModel):
    risk_level: str
    risk_score: float   # 0-100 expected-risk score
    probabilities: dict

def _predict(rows: List[Features]) -> List[Prediction]:
    out = []
    for r in rows:
        d = r.model_dump()
        probs = MODEL.predict_proba_one(d)
        score = float(probs[1] * 0.5 + probs[2] * 1.0) * 100
        best_idx = int(max(range(3), key=lambda i: probs[i]))
        level = CLASSES[best_idx]
        out.append(Prediction(
            risk_level=level,
            risk_score=round(score, 1),
            probabilities={c: round(float(v), 4) for c, v in zip(CLASSES, probs)},
        ))
    return out

@app.get("/health")
def health():
    return {"status": "ok", "features": FEATURES, "model_type": "RandomForest (Trained on Pune 2018-2024 Real Data)"}

@app.get("/metrics")
def metrics():
    with open(os.path.join(HERE, "model_metrics.json")) as f:
        return json.load(f)

@app.post("/predict", response_model=Prediction)
def predict(f: Features):
    return _predict([f])[0]

@app.post("/predict/batch", response_model=List[Prediction])
def predict_batch(fs: List[Features]):
    return _predict(fs)
