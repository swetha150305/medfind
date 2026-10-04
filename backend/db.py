import sqlite3
import os
from datetime import datetime

DB_PATH = os.environ.get("MEDFIND_DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "medfind.db"))
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dataset_meta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_synthetic INTEGER DEFAULT 1,
        imported_at TEXT,
        records_imported INTEGER DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        name TEXT,
        role TEXT DEFAULT 'user',
        provider TEXT DEFAULT 'local'
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_name TEXT NOT NULL,
        brand_name TEXT,
        salt_composition TEXT,
        strength TEXT,
        dosage_form TEXT,
        therapeutic_class TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pharmacies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pharmacy_name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        district TEXT,
        state TEXT,
        latitude REAL,
        longitude REAL,
        phone TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER,
        pharmacy_id INTEGER,
        price REAL,
        stock_quantity INTEGER,
        availability TEXT,
        last_updated TEXT,
        FOREIGN KEY (medicine_id) REFERENCES medicines (id) ON DELETE CASCADE,
        FOREIGN KEY (pharmacy_id) REFERENCES pharmacies (id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS substitution_pairs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER,
        candidate_id INTEGER,
        valid_substitute INTEGER, -- 1 for valid, 0 for invalid
        verified_by TEXT,
        FOREIGN KEY (medicine_id) REFERENCES medicines (id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES medicines (id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_session_id TEXT,
        medicine_name TEXT,
        search_time TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        otp_code TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_email TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        is_read INTEGER DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)

    conn.commit()

    # Check if database has any dataset metadata, if not, seed synthetic data
    cursor.execute("SELECT COUNT(*) FROM dataset_meta")
    if cursor.fetchone()[0] == 0:
        seed_synthetic_data(conn)
    
    conn.close()

def get_system_setting(key: str, default: str = "") -> str:
    """Retrieves a persistent configuration value from the system_settings table."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        return row["value"] if row else default
    except Exception:
        return default

def set_system_setting(key: str, value: str):
    """Saves or updates a persistent configuration value in the system_settings table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

def clear_user_data(conn):
    """Clears all medicine, pharmacy, and inventory data before a new import."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM inventory")
    cursor.execute("DELETE FROM substitution_pairs")
    cursor.execute("DELETE FROM medicines")
    cursor.execute("DELETE FROM pharmacies")
    cursor.execute("DELETE FROM dataset_meta")
    conn.commit()

def seed_synthetic_data(conn):
    """Seeds the database with a small synthetic dataset for testing/Demo Mode."""
    cursor = conn.cursor()
    clear_user_data(conn)

    # Seed default user accounts if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO users (email, password_hash, name, role, provider) VALUES (?, ?, ?, ?, ?)",
            [
                ("admin@medfind.com", "240a10a18a9b2ff92453e97089fa08ef9090b8fcf6b046036814eb38e2170366", "Dr. Swetha R (Admin)", "admin", "local"),
                ("user@medfind.com", "4d35e12818a7c29fb9166f21c5f3e97f0a71be7de55a73e655938bf8cf533b37", "Raji G (Researcher)", "user", "local")
            ]
        )

    # Insert dataset metadata
    cursor.execute(
        "INSERT INTO dataset_meta (is_synthetic, imported_at, records_imported) VALUES (1, ?, ?)",
        (datetime.now().isoformat(), 7)
    )

    # Insert synthetic medicines
    medicines = [
        ]
    
    cursor.executemany(
        "INSERT INTO medicines (medicine_name, brand_name, salt_composition, strength, dosage_form, therapeutic_class) VALUES (?, ?, ?, ?, ?, ?)",
        medicines
    )
    
    # Insert synthetic pharmacies
    # Latitudes/Longitudes set around a center in Madurai, Tamilnadu, India (9.9252, 78.1198) matching the authors' college location
    pharmacies = [
        # (pharmacy_name, address, city, district, state, latitude, longitude, phone)
        ("Apollo Pharmacy", "12, Town Hall Rd", "Madurai", "Madurai", "Tamil Nadu", 9.9215, 78.1182, "+91 98765 43210"),
        ("MedPlus Pharmacy", "45, Bypass Road", "Madurai", "Madurai", "Tamil Nadu", 9.9320, 78.0980, "+91 98765 43211"),
        ("City Pharmacy", "101, Kamarajar Salai", "Madurai", "Madurai", "Tamil Nadu", 9.9190, 78.1410, "+91 98765 43212"),
        ("Sunrise Medicos", "8, Velammal College Rd", "Madurai", "Madurai", "Tamil Nadu", 9.9312, 78.1745, "+91 98765 43213")
    ]
    cursor.executemany(
        "INSERT INTO pharmacies (pharmacy_name, address, city, district, state, latitude, longitude, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        pharmacies
    )

    # Get the inserted IDs to link them in the inventory
    cursor.execute("SELECT id, medicine_name FROM medicines")
    med_map = {row["medicine_name"]: row["id"] for row in cursor.fetchall()}

    cursor.execute("SELECT id, pharmacy_name FROM pharmacies")
    pharm_map = {row["pharmacy_name"]: row["id"] for row in cursor.fetchall()}

    # Insert inventory (medicine_id, pharmacy_id, price, stock_quantity, availability, last_updated)
    inventory = [
        # Apollo Pharmacy
        (med_map["Paracetamol 650"], pharm_map["Apollo Pharmacy"], 30.5, 50, "Available", datetime.now().isoformat()),
        (med_map["Amoxicillin 500"], pharm_map["Apollo Pharmacy"], 85.0, 10, "Available", datetime.now().isoformat()),
        (med_map["Ibuprofen 400"], pharm_map["Apollo Pharmacy"], 15.0, 100, "Available", datetime.now().isoformat()),
        (med_map["Metformin 500"], pharm_map["Apollo Pharmacy"], 24.5, 0, "Out of Stock", datetime.now().isoformat()),

        # MedPlus Pharmacy
        (med_map["Paracetamol 650"], pharm_map["MedPlus Pharmacy"], 28.0, 120, "Available", datetime.now().isoformat()),
        (med_map["Paracetamol 500"], pharm_map["MedPlus Pharmacy"], 18.0, 80, "Available", datetime.now().isoformat()),
        (med_map["Amoxicillin 500"], pharm_map["MedPlus Pharmacy"], 82.5, 0, "Out of Stock", datetime.now().isoformat()),
        (med_map["Amoxicillin 250"], pharm_map["MedPlus Pharmacy"], 45.0, 40, "Available", datetime.now().isoformat()),

        # City Pharmacy
        (med_map["Paracetamol 650"], pharm_map["City Pharmacy"], 29.0, 10, "Available", datetime.now().isoformat()),
        (med_map["Ibuprofen 400"], pharm_map["City Pharmacy"], 14.0, 0, "Out of Stock", datetime.now().isoformat()),
        (med_map["Ibuprofen 200"], pharm_map["City Pharmacy"], 8.0, 150, "Available", datetime.now().isoformat()),

        # Sunrise Medicos (All out of stock for Paracetamol 650 to test substitutions!)
        (med_map["Paracetamol 650"], pharm_map["Sunrise Medicos"], 32.0, 0, "Out of Stock", datetime.now().isoformat()),
        (med_map["Paracetamol 500"], pharm_map["Sunrise Medicos"], 20.0, 15, "Available", datetime.now().isoformat()),
        (med_map["Amoxicillin 250"], pharm_map["Sunrise Medicos"], 48.0, 0, "Out of Stock", datetime.now().isoformat())
    ]
    
    cursor.executemany(
        "INSERT INTO inventory (medicine_id, pharmacy_id, price, stock_quantity, availability, last_updated) VALUES (?, ?, ?, ?, ?, ?)",
        inventory
    )

    # Insert substitution pairs for training
    sub_pairs = [
        # (medicine_id, candidate_id, valid_substitute, verified_by)
        (med_map["Paracetamol 650"], med_map["Paracetamol 500"], 1, "Dr. Raji G"),
        (med_map["Amoxicillin 500"], med_map["Amoxicillin 250"], 1, "Dr. Swetha R"),
        (med_map["Ibuprofen 400"], med_map["Ibuprofen 200"], 1, "Dr. Ragavi S"),
        (med_map["Paracetamol 650"], med_map["Ibuprofen 400"], 0, "Dr. Raji G"),
        (med_map["Paracetamol 500"], med_map["Ibuprofen 200"], 0, "Dr. Swetha R"),
        (med_map["Amoxicillin 500"], med_map["Metformin 500"], 0, "Dr. Ragavi S"),
        (med_map["Amoxicillin 250"], med_map["Ibuprofen 200"], 0, "Dr. Raji G"),
        (med_map["Metformin 500"], med_map["Paracetamol 650"], 0, "Dr. Swetha R")
    ]
    cursor.executemany(
        "INSERT INTO substitution_pairs (medicine_id, candidate_id, valid_substitute, verified_by) VALUES (?, ?, ?, ?)",
        sub_pairs
    )

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
