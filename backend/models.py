from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class LocationQuery(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None

class SearchQuery(BaseModel):
    medicine_name: str
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    location: Optional[LocationQuery] = None
    price_weight: float = Field(default=0.5, ge=0.0, le=1.0)

class ColumnMapping(BaseModel):
    medicine_name: str
    brand_name: Optional[str] = None
    salt_composition: str
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    therapeutic_class: Optional[str] = None
    price: str
    stock_quantity: str
    availability: Optional[str] = None
    pharmacy_name: str
    pharmacy_address: Optional[str] = None
    latitude: str
    longitude: str
    phone: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None

class ConfirmItem(BaseModel):
    ocr_text: str
    matched_id: Optional[int] = None
    matched_name: Optional[str] = None
    confidence: float
    confirmed: bool

class OCRConfirmRequest(BaseModel):
    items: List[ConfirmItem]
    location: Optional[LocationQuery] = None
    price_weight: float = Field(default=0.5)

class SearchHistoryItem(BaseModel):
    id: int
    medicine_name: str
    search_time: str
