import pandas as pd
import numpy as np
import io
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from backend.db import get_db_connection, clear_user_data

# Define expected fields and their common variations for auto-mapping
COLUMN_SYNONYMS = {
    "medicine_name": ["medicine name", "medicine_name", "drug name", "drug_name", "medicine", "drug", "name"],
    "brand_name": ["brand name", "brand_name", "brand", "manufacturer"],
    "salt_composition": ["salt", "salt composition", "salt_composition", "composition", "active ingredient", "salts"],
    "strength": ["strength", "dosage strength", "power", "mg"],
    "dosage_form": ["dosage form", "dosage_form", "form", "type", "tablet/syrup/capsule"],
    "therapeutic_class": ["therapeutic class", "therapeutic_class", "class", "category"],
    "price": ["price", "mrp", "selling price", "rate", "cost"],
    "stock_quantity": ["stock quantity", "stock_quantity", "stock", "quantity", "qty", "inventory"],
    "availability": ["availability", "status", "instock", "stock_status"],
    "pharmacy_name": ["pharmacy name", "pharmacy_name", "pharmacy", "shop name", "store name", "store"],
    "pharmacy_address": ["pharmacy address", "pharmacy_address", "address", "location"],
    "latitude": ["latitude", "lat", "latitude_coords"],
    "longitude": ["longitude", "long", "lon", "longitude_coords"],
    "city": ["city", "town", "locality"],
    "district": ["district", "area"],
    "state": ["state", "province"],
    "phone": ["phone", "contact", "phone number", "mobile", "telephone"]
}

REQUIRED_FIELDS = ["medicine_name", "salt_composition", "price", "pharmacy_name", "latitude", "longitude"]

def detect_columns(df_columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """
    Attempts to map df_columns to standard schema fields using synonym matching.
    Returns:
        mapped_columns: {standard_field: df_column}
        missing_required: list of standard fields that are required but could not be mapped
    """
    mapped_columns = {}
    cleaned_columns = {col.lower().strip().replace("_", " "): col for col in df_columns}
    
    for standard_field, synonyms in COLUMN_SYNONYMS.items():
        found = False
        # 1. Look for exact matches or synonyms
        for syn in synonyms:
            if syn in cleaned_columns:
                mapped_columns[standard_field] = cleaned_columns[syn]
                found = True
                break
        
        # 2. If not found, try partial matching
        if not found:
            for syn in synonyms:
                for clean_col, orig_col in cleaned_columns.items():
                    if syn in clean_col or clean_col in syn:
                        mapped_columns[standard_field] = orig_col
                        found = True
                        break
                if found:
                    break
                    
    missing_required = [field for field in REQUIRED_FIELDS if field not in mapped_columns]
    return mapped_columns, missing_required


def validate_and_import(file_bytes: bytes, filename: str, custom_mapping: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Parses a file, validates data according to columns mapping,
    reports errors, and if valid, saves to database.
    """
    # 1. Parse Excel or CSV
    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            # Try parsing with UTF-8 first, fallback to latin-1
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8")
            except Exception:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin-1")
    except Exception as e:
        return {"status": "error", "message": f"Failed to parse file: {str(e)}"}
        
    df = df.replace({np.nan: None}) # Clean NaNs for SQL insertion
    
    # 2. Get columns mapping
    df_columns = list(df.columns)
    if custom_mapping:
        # Validate mapping provided by user
        mapping = {k: v for k, v in custom_mapping.items() if v in df_columns}
        missing_required = [f for f in REQUIRED_FIELDS if f not in mapping]
    else:
        mapping, missing_required = detect_columns(df_columns)
        
    # If missing required fields, stop and return the current status for UI mapping screen
    if missing_required:
        return {
            "status": "mapping_required",
            "detected_columns": mapping,
            "all_columns": df_columns,
            "missing_required": missing_required,
            "message": "Some required columns could not be mapped automatically."
        }
        
    # 3. Perform Row-by-Row Validation
    errors = []
    valid_rows = []
    
    # Track unique items to show stats
    unique_medicines = set()
    unique_pharmacies = set()
    
    for index, row in df.iterrows():
        row_num = index + 1
        row_errors = []
        
        # Check required fields are not empty
        for req_field in REQUIRED_FIELDS:
            df_col = mapping[req_field]
            val = row[df_col]
            if val is None or str(val).strip() == "":
                row_errors.append(f"Missing required field: '{req_field}' (mapped to column '{df_col}')")
                
        # Validate price
        price_col = mapping["price"]
        price_val = row[price_col]
        try:
            if price_val is not None:
                price = float(price_val)
                if price < 0:
                    row_errors.append(f"Price cannot be negative: {price}")
            else:
                price = 0.0
        except ValueError:
            row_errors.append(f"Invalid price value: '{price_val}'")
            
        # Validate coordinates
        lat_col = mapping["latitude"]
        lon_col = mapping["longitude"]
        lat_val = row[lat_col]
        lon_val = row[lon_col]
        
        lat = None
        lon = None
        
        try:
            if lat_val is not None:
                lat = float(lat_val)
                if not (-90 <= lat <= 90):
                    row_errors.append(f"Latitude out of bounds [-90, 90]: {lat}")
            if lon_val is not None:
                lon = float(lon_val)
                if not (-180 <= lon <= 180):
                    row_errors.append(f"Longitude out of bounds [-180, 180]: {lon}")
        except ValueError:
            row_errors.append(f"Coordinates must be numeric. Got lat: '{lat_val}', lon: '{lon_val}'")
            
        # Validate stock quantity if available
        stock_val = 0
        if "stock_quantity" in mapping:
            stock_col = mapping["stock_quantity"]
            raw_stock = row[stock_col]
            if raw_stock is not None:
                try:
                    stock_val = int(float(raw_stock))
                    if stock_val < 0:
                        row_errors.append(f"Stock quantity cannot be negative: {stock_val}")
                except ValueError:
                    row_errors.append(f"Invalid stock quantity: '{raw_stock}'")
                    
        # If there are errors, log them and skip this row
        if row_errors:
            errors.append({
                "row": row_num,
                "medicine": str(row.get(mapping.get("medicine_name"), "Unknown")),
                "errors": row_errors
            })
        else:
            # Prepare row for DB insertion
            med_name = str(row[mapping["medicine_name"]]).strip()
            brand = str(row[mapping["brand_name"]]).strip() if mapping.get("brand_name") and row[mapping["brand_name"]] else None
            salt = str(row[mapping["salt_composition"]]).strip()
            strength = str(row[mapping["strength"]]).strip() if mapping.get("strength") and row[mapping["strength"]] else None
            dosage = str(row[mapping["dosage_form"]]).strip() if mapping.get("dosage_form") and row[mapping["dosage_form"]] else None
            t_class = str(row[mapping["therapeutic_class"]]).strip() if mapping.get("therapeutic_class") and row[mapping["therapeutic_class"]] else None
            
            pharm_name = str(row[mapping["pharmacy_name"]]).strip()
            pharm_addr = str(row[mapping["pharmacy_address"]]).strip() if mapping.get("pharmacy_address") and row[mapping["pharmacy_address"]] else None
            city = str(row[mapping["city"]]).strip() if mapping.get("city") and row[mapping["city"]] else "Unknown"
            district = str(row[mapping["district"]]).strip() if mapping.get("district") and row[mapping["district"]] else None
            state = str(row[mapping["state"]]).strip() if mapping.get("state") and row[mapping["state"]] else None
            phone = str(row[mapping["phone"]]).strip() if mapping.get("phone") and row[mapping["phone"]] else None
            
            # Inventory items
            price = float(row[mapping["price"]])
            stock = stock_val
            
            # Determine availability
            availability = "Out of Stock"
            if stock > 0:
                availability = "Available"
            elif mapping.get("availability") and row[mapping["availability"]]:
                raw_avail = str(row[mapping["availability"]]).lower().strip()
                if "avail" in raw_avail or "yes" in raw_avail or "in stock" in raw_avail or "1" in raw_avail:
                    availability = "Available"
                    if stock == 0:
                        stock = 10 # Default positive stock if marked available
            
            unique_medicines.add((med_name, brand, salt, strength, dosage, t_class))
            # Unique pharmacy by name and coordinate
            unique_pharmacies.add((pharm_name, pharm_addr, city, district, state, lat, lon, phone))
            
            valid_rows.append({
                "medicine": (med_name, brand, salt, strength, dosage, t_class),
                "pharmacy": (pharm_name, pharm_addr, city, district, state, lat, lon, phone),
                "price": price,
                "stock": stock,
                "availability": availability
            })
            
    # 4. Save to Database (Only if we have valid rows and we want to apply the upload)
    if valid_rows:
        conn = get_db_connection()
        clear_user_data(conn) # Complete overwrite of the DB (remove synthetic data)
        cursor = conn.cursor()
        
        # Save metadata
        cursor.execute(
            "INSERT INTO dataset_meta (is_synthetic, imported_at, records_imported) VALUES (0, ?, ?)",
            (datetime.now().isoformat(), len(valid_rows))
        )
        
        # Insert pharmacies and track IDs
        pharm_db_ids = {}
        for pharm in unique_pharmacies:
            # pharm is (name, addr, city, district, state, lat, lon, phone)
            cursor.execute("""
                INSERT INTO pharmacies (pharmacy_name, address, city, district, state, latitude, longitude, phone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, pharm)
            pharm_db_ids[pharm] = cursor.lastrowid
            
        # Insert medicines and track IDs
        med_db_ids = {}
        for med in unique_medicines:
            # med is (name, brand, salt, strength, dosage, class)
            cursor.execute("""
                INSERT INTO medicines (medicine_name, brand_name, salt_composition, strength, dosage_form, therapeutic_class)
                VALUES (?, ?, ?, ?, ?, ?)
            """, med)
            med_db_ids[med] = cursor.lastrowid
            
        # Insert inventory
        inventory_records = []
        for item in valid_rows:
            med_id = med_db_ids[item["medicine"]]
            pharm_id = pharm_db_ids[item["pharmacy"]]
            price = item["price"]
            stock = item["stock"]
            avail = item["availability"]
            last_upd = datetime.now().isoformat()
            
            inventory_records.append((med_id, pharm_id, price, stock, avail, last_upd))
            
        cursor.executemany("""
            INSERT INTO inventory (medicine_id, pharmacy_id, price, stock_quantity, availability, last_updated)
            VALUES (?, ?, ?, ?, ?, ?)
        """, inventory_records)
        
        # Optional: Auto-create substitution pairs from the uploaded dataset if columns exist
        # If columns valid_substitute exists in the dataframe, we could extract pairs.
        # But normally, the database only stores medicines. The user page allows ML training
        # if the dataset uploaded has labelled pair rows.
        # Wait, does the dataset uploaded contain medicines or pairs?
        # Typically, a dataset uploaded is a list of medicine inventories per pharmacy.
        # If they also include "valid_substitute" columns in the same sheet, we can parse them.
        # If they upload a separate table, they can map it.
        # For simplicity, if we find columns like "valid_substitute" and "candidate_medicine",
        # we will extract them.
        # Let's check if the dataframe contains "valid_substitute" and "candidate_name".
        # Let's search columns:
        candidate_cols = [c for c in df_columns if "candidate" in c.lower() or "substitute" in c.lower()]
        valid_sub_cols = [c for c in df_columns if "valid" in c.lower() or "label" in c.lower()]
        
        if candidate_cols and valid_sub_cols:
            cand_col = candidate_cols[0]
            label_col = valid_sub_cols[0]
            
            sub_pairs_to_insert = []
            for index, row in df.iterrows():
                med_name = row.get(mapping["medicine_name"])
                cand_name = row.get(cand_col)
                label_val = row.get(label_col)
                
                if med_name and cand_name and label_val is not None:
                    # Resolve IDs from database
                    cursor.execute("SELECT id FROM medicines WHERE medicine_name = ?", (str(med_name).strip(),))
                    m_row = cursor.fetchone()
                    cursor.execute("SELECT id FROM medicines WHERE medicine_name = ?", (str(cand_name).strip(),))
                    c_row = cursor.fetchone()
                    
                    if m_row and c_row:
                        try:
                            # 1 for valid, 0 for invalid
                            label = 1 if "valid" in str(label_val).lower() or str(label_val) in ["1", "1.0", "True", "true", True] else 0
                            sub_pairs_to_insert.append((m_row["id"], c_row["id"], label, "Dataset Upload"))
                        except Exception:
                            pass
            if sub_pairs_to_insert:
                cursor.executemany("""
                    INSERT INTO substitution_pairs (medicine_id, candidate_id, valid_substitute, verified_by)
                    VALUES (?, ?, ?, ?)
                """, sub_pairs_to_insert)
                
        conn.commit()
        conn.close()
        
    return {
        "status": "success",
        "records_imported": len(valid_rows),
        "total_medicines": len(unique_medicines),
        "total_pharmacies": len(unique_pharmacies),
        "errors": errors,
        "error_count": len(errors)
    }
