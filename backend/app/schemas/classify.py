from pydantic import BaseModel, Field
from typing import Optional

class ClassifyParams(BaseModel):
    threshold: Optional[float] = Field(0.05, ge=0.0, le=1.0, description="Fractional threshold to mark promo (e.g. 0.05)")