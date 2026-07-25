from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
import tempfile
import os

from app.database.database import get_db
from app.services.excel_importer import import_from_excel

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("/excel")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """上传 Excel 文件并导入数据"""
    # Save uploaded file to temp location
    suffix = os.path.splitext(file.filename or "data.xlsx")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        stats = import_from_excel(tmp_path, db)
        return {"success": True, "stats": stats}
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        os.unlink(tmp_path)
