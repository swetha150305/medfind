import re
import os
import pickle
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from sklearn.model_selection import train_test_split, StratifiedKFold, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix, roc_curve

from backend.db import get_db_connection

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
RF_MODEL_PATH = os.path.join(MODEL_DIR, "rf_model.pkl")
LR_MODEL_PATH = os.path.join(MODEL_DIR, "lr_model.pkl")
VOCAB_PATH = os.path.join(MODEL_DIR, "salt_vocab.pkl")


def extract_salts(salt_composition_str: Optional[str]) -> List[str]:
    """Splits a salt composition string into individual normalized salt tokens."""
    if not salt_composition_str:
        return []
    # Split by '+', ',', ';', 'and', '&'
    parts = re.split(r'\+|\bplus\b|\band\b|&|,|;', salt_composition_str.lower())
    salts = []
    for p in parts:
        # Remove numbers, percentages, strengths, and excess spaces
        # e.g., "paracetamol 500mg" -> "paracetamol"
        clean = re.sub(r'\d+(\.\d+)?\s*(mg|mcg|g|ml|%|pct)?\b', '', p)
        clean = clean.strip()
        if clean:
            salts.append(clean)
    return salts


def extract_numeric_strength(strength_str: Optional[str]) -> float:
    """Extracts a float strength value from a strength string."""
    if not strength_str:
        return 0.0
    match = re.search(r'(\d+(?:\.\d+)?)', strength_str)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return 0.0
    return 0.0


def build_salt_vocabulary(conn) -> List[str]:
    """Queries all medicines and compiles a sorted list of unique salts."""
    cursor = conn.cursor()
    cursor.execute("SELECT salt_composition FROM medicines")
    rows = cursor.fetchall()
    
    all_salts = set()
    for row in rows:
        salts = extract_salts(row["salt_composition"])
        for s in salts:
            all_salts.add(s)
            
    vocab = sorted(list(all_salts))
    
    # Cache vocabulary
    try:
        with open(VOCAB_PATH, "wb") as f:
            pickle.dump(vocab, f)
    except Exception:
        pass
        
    return vocab


def load_salt_vocabulary() -> List[str]:
    """Loads cache salt vocabulary from file."""
    if os.path.exists(VOCAB_PATH):
        try:
            with open(VOCAB_PATH, "rb") as f:
                return pickle.load(f)
        except Exception:
            pass
    return []


def get_salt_vector(salts: List[str], vocab: List[str]) -> np.ndarray:
    """Converts a list of salts into a multi-hot encoded vector."""
    vector = np.zeros(len(vocab))
    for s in salts:
        if s in vocab:
            idx = vocab.index(s)
            vector[idx] = 1
    return vector


def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    """Calculates cosine similarity between two vectors."""
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return float(np.dot(v1, v2) / (norm1 * norm2))


def get_substitution_candidates(medicine_id: int, threshold: float = 0.80, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Stage 1 Unsupervised Shortlisting:
    Finds medicines similar to medicine_id based on cosine similarity of salts.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch query medicine
    cursor.execute("SELECT * FROM medicines WHERE id = ?", (medicine_id,))
    query_med = cursor.fetchone()
    if not query_med:
        conn.close()
        return []
        
    # 2. Get/Build salt vocabulary
    vocab = load_salt_vocabulary()
    if not vocab:
        vocab = build_salt_vocabulary(conn)
        
    if not vocab:
        conn.close()
        return []
        
    # Multi-hot encode query medicine
    query_salts = extract_salts(query_med["salt_composition"])
    v_m = get_salt_vector(query_salts, vocab)
    
    # 3. Query all other medicines
    cursor.execute("SELECT * FROM medicines WHERE id != ?", (medicine_id,))
    candidates = cursor.fetchall()
    
    shortlist = []
    for cand in candidates:
        cand_salts = extract_salts(cand["salt_composition"])
        v_i = get_salt_vector(cand_salts, vocab)
        
        sim = cosine_similarity(v_m, v_i)
        if sim >= threshold:
            shortlist.append({
                "candidate": cand,
                "similarity": sim
            })
            
    # Sort by similarity descending
    shortlist.sort(key=lambda x: x["similarity"], reverse=True)
    shortlist = shortlist[:limit]
    
    # Format return list
    results = []
    for item in shortlist:
        c = item["candidate"]
        results.append({
            "id": c["id"],
            "medicine_name": c["medicine_name"],
            "brand_name": c["brand_name"],
            "salt_composition": c["salt_composition"],
            "strength": c["strength"],
            "dosage_form": c["dosage_form"],
            "therapeutic_class": c["therapeutic_class"],
            "similarity": round(item["similarity"], 3)
        })
        
    conn.close()
    return results


def extract_features_for_pair(med1: Dict[str, Any], med2: Dict[str, Any], vocab: List[str]) -> np.ndarray:
    """
    Extracts classifier features for a pair of medicines:
    1. Cosine similarity of salt vectors
    2. Exact salt match (binary)
    3. Dosage form match (binary)
    4. Absolute difference in strength
    """
    salts1 = extract_salts(med1["salt_composition"])
    salts2 = extract_salts(med2["salt_composition"])
    
    v1 = get_salt_vector(salts1, vocab)
    v2 = get_salt_vector(salts2, vocab)
    
    sim = cosine_similarity(v1, v2)
    
    exact_salt = 1.0 if med1["salt_composition"] and med2["salt_composition"] and med1["salt_composition"].strip().lower() == med2["salt_composition"].strip().lower() else 0.0
    form_match = 1.0 if med1["dosage_form"] and med2["dosage_form"] and med1["dosage_form"].strip().lower() == med2["dosage_form"].strip().lower() else 0.0
    
    str1 = extract_numeric_strength(med1["strength"])
    str2 = extract_numeric_strength(med2["strength"])
    strength_diff = abs(str1 - str2)
    
    return np.array([sim, exact_salt, form_match, strength_diff])


def train_classifier(n_estimators: int = 200, max_depth: Optional[int] = None, min_samples_leaf: int = 2) -> Dict[str, Any]:
    """
    Trains the Random Forest classifier and Logistic Regression baseline on labeled pairs.
    Performs Stratified 5-Fold CV on the training set, hyperparameter tuning, and evaluates on test set.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch substitution pairs
    cursor.execute("""
        SELECT sp.medicine_id, sp.candidate_id, sp.valid_substitute, 
               m1.medicine_name as name1, m1.salt_composition as salt1, m1.strength as str1, m1.dosage_form as form1,
               m2.medicine_name as name2, m2.salt_composition as salt2, m2.strength as str2, m2.dosage_form as form2
        FROM substitution_pairs sp
        JOIN medicines m1 ON sp.medicine_id = m1.id
        JOIN medicines m2 ON sp.candidate_id = m2.id
    """)
    pairs = cursor.fetchall()
    
    if len(pairs) < 6:
        conn.close()
        return {
            "success": False,
            "reason": "insufficient_data",
            "message": "ML substitution verification requires pharmacist-labelled training data. Candidate similarity can still be demonstrated, but the classifier cannot be clinically validated from the current dataset."
        }
        
    vocab = load_salt_vocabulary()
    if not vocab:
        vocab = build_salt_vocabulary(conn)
        
    # 2. Prepare features (X) and labels (y)
    X = []
    y = []
    
    for row in pairs:
        med1 = {"salt_composition": row["salt1"], "strength": row["str1"], "dosage_form": row["form1"]}
        med2 = {"salt_composition": row["salt2"], "strength": row["str2"], "dosage_form": row["form2"]}
        features = extract_features_for_pair(med1, med2, vocab)
        
        X.append(features)
        y.append(row["valid_substitute"])
        
    X = np.array(X)
    y = np.array(y)
    
    # Check class distribution
    classes, counts = np.unique(y, return_counts=True)
    if len(classes) < 2 or min(counts) < 2:
        conn.close()
        return {
            "success": False,
            "reason": "insufficient_data",
            "message": "ML training requires at least some positive and negative labeled pairs. Currently, the dataset class distribution is unbalanced or lacks instances for one class."
        }
        
    # 3. Train/Test Split (80/20 Stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    # 4. Stratified 5-Fold Cross Validation on training split
    # Since dataset might be very small in prototype, limit n_splits if needed
    classes_train, counts_train = np.unique(y_train, return_counts=True)
    n_splits = min(5, min(counts_train))
    if n_splits < 2:
        n_splits = 2
        
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    
    # Define Hyperparameter grid search for Random Forest
    rf_param_grid = {
        'max_depth': [3, 5, 10, None] if max_depth is None else [max_depth],
        'min_samples_leaf': [1, 2, 4, 8] if min_samples_leaf == 2 else [min_samples_leaf]
    }
    
    rf_grid = GridSearchCV(
        RandomForestClassifier(n_estimators=n_estimators, class_weight='balanced', random_state=42),
        rf_param_grid,
        cv=skf,
        scoring='precision', # Prioritize Precision on valid substitutes for clinical safety
        n_jobs=-1
    )
    rf_grid.fit(X_train, y_train)
    
    best_rf = rf_grid.best_estimator_
    
    # Train baseline Logistic Regression
    lr = LogisticRegression(class_weight='balanced', random_state=42)
    lr.fit(X_train, y_train)
    
    # 5. Evaluate on Test Set
    # RF predictions
    rf_preds = best_rf.predict(X_test)
    # Handle case where predict_proba might raise or return 1 class
    rf_probs = best_rf.predict_proba(X_test)[:, 1] if len(best_rf.classes_) > 1 else np.array([float(x) for x in rf_preds])
    
    # Metrics
    rf_acc = accuracy_score(y_test, rf_preds)
    rf_prec = precision_score(y_test, rf_preds, zero_division=0)
    rf_rec = recall_score(y_test, rf_preds, zero_division=0)
    rf_f1 = f1_score(y_test, rf_preds, zero_division=0)
    
    try:
        rf_auc = roc_auc_score(y_test, rf_probs) if len(np.unique(y_test)) > 1 else 1.0
    except Exception:
        rf_auc = 1.0
        
    # Logistic Regression metrics
    lr_preds = lr.predict(X_test)
    lr_acc = accuracy_score(y_test, lr_preds)
    lr_prec = precision_score(y_test, lr_preds, zero_division=0)
    lr_rec = recall_score(y_test, lr_preds, zero_division=0)
    lr_f1 = f1_score(y_test, lr_preds, zero_division=0)
    
    # ROC Curve coordinates for plotting
    if len(np.unique(y_test)) > 1:
        fpr, tpr, _ = roc_curve(y_test, rf_probs)
        roc_data = [{"fpr": float(f), "tpr": float(t)} for f, t in zip(fpr, tpr)]
    else:
        roc_data = [{"fpr": 0.0, "tpr": 0.0}, {"fpr": 1.0, "tpr": 1.0}]
        
    # Confusion Matrix
    cm = confusion_matrix(y_test, rf_preds)
    # cm format: [[tn, fp], [fn, tp]]
    tn, fp, fn, tp = int(cm[0][0]), int(cm[0][1]), int(cm[1][0]), int(cm[1][1]) if cm.size == 4 else (int(cm[0][0]), 0, 0, 0)
    
    # Feature Importances
    importances = best_rf.feature_importances_
    features_list = ["Cosine Similarity", "Exact Salt Match", "Dosage Form Match", "Strength Difference"]
    importance_data = [{"feature": f, "importance": float(imp)} for f, imp in zip(features_list, importances)]
    
    # Save the models
    with open(RF_MODEL_PATH, "wb") as f:
        pickle.dump(best_rf, f)
    with open(LR_MODEL_PATH, "wb") as f:
        pickle.dump(lr, f)
        
    # Class distribution statistics
    cursor.execute("SELECT valid_substitute, COUNT(*) FROM substitution_pairs GROUP BY valid_substitute")
    dist_rows = cursor.fetchall()
    class_dist = {str(row[0]): row[1] for row in dist_rows}
    
    conn.close()
    
    return {
        "success": True,
        "class_distribution": class_dist,
        "total_pairs": len(pairs),
        "random_forest": {
            "accuracy": round(rf_acc, 2),
            "precision": round(rf_prec, 2),
            "recall": round(rf_rec, 2),
            "f1_score": round(rf_f1, 2),
            "roc_auc": round(rf_auc, 2),
            "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
            "roc_curve": roc_data,
            "feature_importance": importance_data
        },
        "logistic_regression": {
            "accuracy": round(lr_acc, 2),
            "precision": round(lr_prec, 2),
            "recall": round(lr_rec, 2),
            "f1_score": round(lr_f1, 2)
        }
    }


def predict_substitution_validity(med1: Dict[str, Any], med2: Dict[str, Any]) -> Tuple[bool, float]:
    """
    Stage 2 Supervised ML Verification:
    Uses the trained Random Forest model to predict if med2 is a valid substitute for med1.
    If no model is trained, returns fallback similarity-based confidence.
    """
    vocab = load_salt_vocabulary()
    if not vocab:
        # Fallback if no vocabulary cache exists
        return True, 0.50
        
    features = extract_features_for_pair(med1, med2, vocab)
    
    if os.path.exists(RF_MODEL_PATH):
        try:
            with open(RF_MODEL_PATH, "rb") as f:
                model = pickle.load(f)
            # Reshape for single sample prediction
            x_input = features.reshape(1, -1)
            pred = model.predict(x_input)[0]
            probs = model.predict_proba(x_input)[0]
            confidence = float(probs[1]) if len(probs) > 1 else float(pred)
            return bool(int(pred) == 1), float(confidence)
        except Exception:
            pass
            
    # Fallback heuristic if ML model is not trained/available
    # Features index 0 is cosine similarity, index 2 is dosage form match
    cos_sim = float(features[0])
    form_match = float(features[2])
    
    # Heuristic confidence calculation
    confidence = float(cos_sim * 0.7 + form_match * 0.3)
    is_valid = bool(confidence >= 0.75)
    
    return is_valid, confidence
